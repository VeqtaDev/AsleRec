import { app, desktopCapturer, screen, session } from 'electron'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'

import { CH } from '@shared/channels'
import type {
  CaptureMode,
  CaptureRequest,
  Rect,
  RecordingStatus,
  Settings
} from '@shared/types'

import { FFPROBE_PATH, bitrateFor, runFfmpeg } from './ffmpeg'
import { library } from './library'
import { settings } from './settings'
import {
  getControlBar,
  getMainWindow,
  hideControlBar,
  showControlBar,
  showRegionOverlay,
  whenRecorderReady
} from './windows'

interface ActiveSession {
  id: string
  mode: CaptureMode
  tempPath: string
  stream: fs.WriteStream
  startedAt: number
  pausedAt: number | null
  pausedTotalMs: number
  bytesWritten: number
}

/** Source retenue pour le prochain appel `getDisplayMedia` du moteur de capture. */
let pendingDisplaySource: { id: string; withAudio: boolean } | null = null

class RecordingController extends EventEmitter {
  private session: ActiveSession | null = null
  private state: RecordingStatus['state'] = 'idle'
  private ticker: NodeJS.Timeout | null = null
  private lastError: string | undefined
  private processingProgress = 0
  private countdownRemaining: number | undefined

  /* -------------------------------------------------------------- */
  /* Statut                                                          */
  /* -------------------------------------------------------------- */

  getStatus(): RecordingStatus {
    return {
      state: this.state,
      elapsedMs: this.elapsedMs(),
      mode: this.session?.mode ?? null,
      countdownRemaining: this.state === 'countdown' ? this.countdownRemaining : undefined,
      progress: this.state === 'processing' ? this.processingProgress : undefined,
      error: this.lastError
    }
  }

  private elapsedMs(): number {
    if (!this.session) return 0
    const now = this.session.pausedAt ?? Date.now()
    return Math.max(0, now - this.session.startedAt - this.session.pausedTotalMs)
  }

  private broadcast(): void {
    const status = this.getStatus()
    for (const window of [getMainWindow(), getControlBar()]) {
      if (window && !window.isDestroyed()) {
        window.webContents.send(CH.recording.status, status)
      }
    }
    this.emit('status', status)
  }

  private setState(state: RecordingStatus['state']): void {
    this.state = state
    this.broadcast()
  }

  private startTicker(): void {
    this.stopTicker()
    this.ticker = setInterval(() => this.broadcast(), 250)
  }

  private stopTicker(): void {
    if (this.ticker) clearInterval(this.ticker)
    this.ticker = null
  }

  isBusy(): boolean {
    return this.state !== 'idle'
  }

  /* -------------------------------------------------------------- */
  /* Démarrage                                                       */
  /* -------------------------------------------------------------- */

  async start(mode: CaptureMode): Promise<void> {
    if (this.isBusy()) return

    const config = settings().get()
    let crop: Rect | null = null
    let displayId: number | null = null

    if (mode === 'region') {
      const selection = await showRegionOverlay()
      if (!selection) return
      crop = selection.crop
      displayId = selection.displayId
      if (crop.width < 16 || crop.height < 16) return
    } else {
      displayId = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id
    }

    const display =
      screen.getAllDisplays().find((entry) => entry.id === displayId) ??
      screen.getPrimaryDisplay()

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 0, height: 0 },
      fetchWindowIcons: false
    })
    const source =
      sources.find((entry) => entry.display_id === String(display.id)) ?? sources[0]

    if (!source) {
      this.fail("Aucun écran capturable n'a été détecté.")
      return
    }

    const sourceWidth = Math.round(display.size.width * display.scaleFactor)
    const sourceHeight = Math.round(display.size.height * display.scaleFactor)

    pendingDisplaySource = { id: source.id, withAudio: config.captureSystemAudio }

    const sessionId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const tempDir = path.join(app.getPath('temp'), 'AsleRec')
    fs.mkdirSync(tempDir, { recursive: true })
    const tempPath = path.join(tempDir, `session-${sessionId}.bin`)

    this.session = {
      id: sessionId,
      mode,
      tempPath,
      stream: fs.createWriteStream(tempPath),
      startedAt: Date.now(),
      pausedAt: null,
      pausedTotalMs: 0,
      bytesWritten: 0
    }
    this.lastError = undefined

    const request: CaptureRequest = {
      sessionId,
      mode,
      sourceId: source.id,
      sourceWidth,
      sourceHeight,
      crop,
      targetHeight: config.quality,
      fps: config.fps,
      outputFormat: config.outputFormat,
      captureSystemAudio: config.captureSystemAudio,
      captureMicrophone: config.captureMicrophone,
      microphoneDeviceId: config.microphoneDeviceId,
      micGain: config.micGain,
      systemGain: config.systemGain
    }

    const recorder = await whenRecorderReady()

    // Le décompte est piloté ici : la barre de contrôle est déjà visible et
    // affiche les secondes restantes pendant que le moteur reste au repos.
    if (config.showCountdown && config.countdownSeconds > 0) {
      showControlBar()
      this.setState('countdown')
      const cancelled = await this.runCountdown(sessionId, config.countdownSeconds)
      if (cancelled) return
    }

    recorder.webContents.send(CH.capture.begin, request)
    this.setState('countdown')
  }

  /** Égrène le décompte ; renvoie true si la session a été abandonnée entretemps. */
  private async runCountdown(sessionId: string, seconds: number): Promise<boolean> {
    for (let remaining = seconds; remaining > 0; remaining -= 1) {
      if (!this.session || this.session.id !== sessionId) return true
      this.countdownRemaining = remaining
      this.broadcast()
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    this.countdownRemaining = undefined
    this.broadcast()
    return !this.session || this.session.id !== sessionId
  }

  /** Le moteur de capture confirme que le MediaRecorder tourne. */
  onCaptureStarted(sessionId: string): void {
    if (!this.session || this.session.id !== sessionId) return
    this.session.startedAt = Date.now()
    this.session.pausedTotalMs = 0
    this.session.pausedAt = null
    this.countdownRemaining = undefined
    showControlBar()
    this.setState('recording')
    this.startTicker()
  }

  onChunk(sessionId: string, chunk: ArrayBuffer): void {
    if (!this.session || this.session.id !== sessionId) return
    const buffer = Buffer.from(chunk)
    this.session.bytesWritten += buffer.byteLength
    this.session.stream.write(buffer)
  }

  /* -------------------------------------------------------------- */
  /* Contrôles                                                       */
  /* -------------------------------------------------------------- */

  async stop(): Promise<void> {
    if (!this.session || (this.state !== 'recording' && this.state !== 'paused')) return
    const recorder = await whenRecorderReady()
    recorder.webContents.send(CH.capture.stop, this.session.id)
  }

  async togglePause(): Promise<void> {
    if (!this.session) return
    const recorder = await whenRecorderReady()

    if (this.state === 'recording') {
      this.session.pausedAt = Date.now()
      recorder.webContents.send(CH.capture.pause, this.session.id)
      this.setState('paused')
    } else if (this.state === 'paused') {
      if (this.session.pausedAt) {
        this.session.pausedTotalMs += Date.now() - this.session.pausedAt
        this.session.pausedAt = null
      }
      recorder.webContents.send(CH.capture.resume, this.session.id)
      this.setState('recording')
    }
  }

  async cancel(): Promise<void> {
    if (!this.session) return
    const active = this.session
    const recorder = await whenRecorderReady()
    recorder.webContents.send(CH.capture.cancel, active.id)

    this.stopTicker()
    hideControlBar()
    active.stream.end(() => {
      fs.rm(active.tempPath, { force: true }, () => undefined)
    })
    this.session = null
    this.setState('idle')
  }

  /* -------------------------------------------------------------- */
  /* Finalisation                                                    */
  /* -------------------------------------------------------------- */

  async onCaptureFinished(sessionId: string, durationMs: number): Promise<void> {
    const active = this.session
    if (!active || active.id !== sessionId) return

    this.stopTicker()
    hideControlBar()
    this.processingProgress = 0
    this.setState('processing')

    await new Promise<void>((resolve) => active.stream.end(resolve))

    if (active.bytesWritten < 1024) {
      this.session = null
      this.fail('Enregistrement trop court : aucune image capturée.')
      return
    }

    const config = settings().get()
    const outputFolder = settings().ensureOutputFolder()
    const outputPath = uniquePath(
      path.join(outputFolder, `${defaultRecordingName()}.${config.outputFormat}`)
    )

    try {
      await transcode(active.tempPath, outputPath, config, durationMs / 1000, (ratio) => {
        this.processingProgress = ratio
        this.broadcast()
      })
      await library().register(outputPath)
    } catch (err) {
      this.session = null
      fs.rm(active.tempPath, { force: true }, () => undefined)
      this.fail(`Encodage impossible : ${(err as Error).message}`)
      return
    }

    fs.rm(active.tempPath, { force: true }, () => undefined)
    this.session = null
    this.processingProgress = 1
    this.setState('idle')
    this.emit('completed', outputPath)
  }

  onCaptureFailed(sessionId: string, message: string): void {
    if (this.session && this.session.id !== sessionId) return
    const active = this.session
    this.stopTicker()
    hideControlBar()
    if (active) {
      active.stream.end(() => fs.rm(active.tempPath, { force: true }, () => undefined))
    }
    this.session = null
    this.fail(message)
  }

  private fail(message: string): void {
    console.error('[recording]', message)
    this.lastError = message
    this.stopTicker()
    this.setState('idle')
    // L'erreur n'est signalée qu'une fois : le statut suivant repart propre.
    this.lastError = undefined
  }
}

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** `AsleRec 2026-07-28 14-32-08` — trié naturellement dans l'explorateur. */
export function defaultRecordingName(date = new Date()): string {
  return [
    'AsleRec ',
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    ' ',
    pad(date.getHours()),
    '-',
    pad(date.getMinutes()),
    '-',
    pad(date.getSeconds())
  ].join('')
}

/** Ajoute un suffixe numérique tant que le chemin est déjà pris. */
export function uniquePath(candidate: string): string {
  if (!fs.existsSync(candidate)) return candidate
  const dir = path.dirname(candidate)
  const ext = path.extname(candidate)
  const base = path.basename(candidate, ext)
  for (let index = 2; index < 1000; index += 1) {
    const next = path.join(dir, `${base} (${index})${ext}`)
    if (!fs.existsSync(next)) return next
  }
  return path.join(dir, `${base} ${Date.now()}${ext}`)
}

/**
 * Convertit l'enregistrement brut vers le conteneur final. Le flux vidéo est
 * simplement recopié quand son codec est déjà compatible : à ce stade la mise
 * à l'échelle a déjà été faite par le canvas côté capture.
 */
async function transcode(
  inputPath: string,
  outputPath: string,
  config: Settings,
  durationSec: number,
  onProgress: (ratio: number) => void
): Promise<void> {
  // Un codec inconnu (sonde en échec) force simplement un ré-encodage.
  const videoCodec = await probeVideoCodec(inputPath)

  const args = ['-i', inputPath]

  if (config.outputFormat === 'mp4') {
    if (videoCodec === 'h264') {
      args.push('-c:v', 'copy')
    } else {
      args.push(
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '21',
        '-maxrate',
        `${bitrateFor(config.quality, config.fps)}k`,
        '-bufsize',
        `${bitrateFor(config.quality, config.fps) * 2}k`,
        '-pix_fmt',
        'yuv420p'
      )
    }
    args.push('-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart')
  } else {
    if (videoCodec === 'vp8' || videoCodec === 'vp9') {
      args.push('-c:v', 'copy')
    } else {
      args.push(
        '-c:v',
        'libvpx-vp9',
        '-deadline',
        'realtime',
        '-cpu-used',
        '5',
        '-b:v',
        `${bitrateFor(config.quality, config.fps)}k`
      )
    }
    args.push('-c:a', 'libopus', '-b:a', '128k')
  }

  args.push('-y', outputPath)

  await runFfmpeg(args, {
    expectedDurationSec: Math.max(1, durationSec),
    onProgress
  })
}

/** Nom du codec vidéo du premier flux, ou chaîne vide si la sonde échoue. */
function probeVideoCodec(filePath: string): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn(
      FFPROBE_PATH,
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=codec_name',
        '-of',
        'default=nokey=1:noprint_wrappers=1',
        filePath
      ],
      { windowsHide: true }
    )
    let out = ''
    child.stdout.setEncoding('utf-8')
    child.stdout.on('data', (data: string) => (out += data))
    child.on('error', () => resolve(''))
    child.on('close', () => resolve(out.trim()))
  })
}

/* ------------------------------------------------------------------ */

let controller: RecordingController | null = null

export function recording(): RecordingController {
  if (!controller) controller = new RecordingController()
  return controller
}

/**
 * Fournit à Chromium la source (et l'audio système en boucle) au moment où le
 * moteur de capture appelle `getDisplayMedia`.
 */
export function installDisplayMediaHandler(): void {
  session.defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      const pending = pendingDisplaySource
      if (!pending) {
        callback({})
        return
      }
      // Consommée une seule fois : une requête ultérieure non sollicitée
      // n'obtiendra rien.
      pendingDisplaySource = null

      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 0, height: 0 }
      })
      const source = sources.find((entry) => entry.id === pending.id) ?? sources[0]
      if (!source) {
        callback({})
        return
      }
      callback(
        pending.withAudio
          ? { video: source, audio: 'loopback' }
          : { video: source }
      )
    },
    { useSystemPicker: false }
  )
}

