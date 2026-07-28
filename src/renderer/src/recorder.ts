/**
 * Moteur de capture d'AsleRec.
 *
 * Tourne dans une fenêtre invisible : il assemble le flux écran, l'audio
 * système et le micro, applique le recadrage / la mise à l'échelle via un
 * canvas, puis pousse les morceaux encodés vers le process principal qui les
 * écrit au fil de l'eau sur le disque.
 */
import type { CaptureRequest } from '@shared/types'

const internal = window.aslerecInternal

/** Codecs testés dans l'ordre de préférence selon le conteneur voulu. */
const CODEC_PREFERENCES: Record<string, string[]> = {
  // H.264 est accéléré matériellement : CPU faible et remux MP4 sans ré-encodage.
  mp4: [
    'video/x-matroska;codecs=avc1,opus',
    'video/webm;codecs=h264,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ],
  webm: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
}

interface ActiveCapture {
  request: CaptureRequest
  recorder: MediaRecorder
  tracks: MediaStreamTrack[]
  audioContext: AudioContext | null
  video: HTMLVideoElement | null
  stopDrawing: (() => void) | null
  startedAt: number
  pausedAt: number | null
  pausedTotalMs: number
  cancelled: boolean
  /** Chaîne d'envoi qui garantit l'ordre des morceaux malgré `arrayBuffer()`. */
  queue: Promise<void>
}

let active: ActiveCapture | null = null

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

function even(value: number): number {
  return Math.max(2, Math.floor(value / 2) * 2)
}

function bitrateFor(height: number, fps: number): number {
  const table: Record<number, number> = { 240: 600_000, 480: 1_500_000, 720: 3_500_000, 1080: 7_000_000 }
  const nearest = [240, 480, 720, 1080].reduce((acc, entry) =>
    Math.abs(entry - height) < Math.abs(acc - height) ? entry : acc
  )
  const value = table[nearest] ?? 3_500_000
  return fps > 40 ? Math.round(value * 1.5) : value
}

function pickMimeType(format: string): string | undefined {
  for (const candidate of CODEC_PREFERENCES[format] ?? CODEC_PREFERENCES.mp4) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate
  }
  return undefined
}

/* ------------------------------------------------------------------ */
/* Démarrage                                                           */
/* ------------------------------------------------------------------ */

async function begin(request: CaptureRequest): Promise<void> {
  if (active) return

  try {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: request.fps, max: request.fps },
        width: { ideal: request.sourceWidth },
        height: { ideal: request.sourceHeight }
      },
      audio: request.captureSystemAudio
    })

    const videoTrack = displayStream.getVideoTracks()[0]
    if (!videoTrack) throw new Error("Le flux vidéo de l'écran est vide.")

    let micStream: MediaStream | null = null
    if (request.captureMicrophone) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: request.microphoneDeviceId
              ? { exact: request.microphoneDeviceId }
              : undefined,
            echoCancellation: false,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
      } catch (err) {
        // Un micro absent ou refusé ne doit pas faire échouer l'enregistrement.
        console.warn('[recorder] micro indisponible', err)
      }
    }

    const { stream: audioStream, context: audioContext } = mixAudio(
      displayStream.getAudioTracks(),
      micStream?.getAudioTracks() ?? [],
      request.systemGain,
      request.micGain
    )

    const { videoStream, video, stopDrawing } = await buildVideoStream(request, videoTrack)

    const combined = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...(audioStream?.getAudioTracks() ?? [])
    ])

    const mimeType = pickMimeType(request.outputFormat)
    const recorder = new MediaRecorder(combined, {
      mimeType,
      videoBitsPerSecond: bitrateFor(request.targetHeight, request.fps),
      audioBitsPerSecond: 160_000
    })

    const capture: ActiveCapture = {
      request,
      recorder,
      tracks: [
        ...displayStream.getTracks(),
        ...(micStream?.getTracks() ?? []),
        ...videoStream.getTracks()
      ],
      audioContext,
      video,
      stopDrawing,
      startedAt: performance.now(),
      pausedAt: null,
      pausedTotalMs: 0,
      cancelled: false,
      queue: Promise.resolve()
    }
    active = capture

    recorder.ondataavailable = (event: BlobEvent) => {
      if (!event.data || event.data.size === 0 || capture.cancelled) return
      capture.queue = capture.queue.then(async () => {
        const buffer = await event.data.arrayBuffer()
        internal.capture.chunk(request.sessionId, buffer)
      })
    }

    recorder.onerror = (event: Event) => {
      const message =
        (event as unknown as { error?: DOMException }).error?.message ??
        "Le composant d'enregistrement a rencontré une erreur."
      fail(message)
    }

    recorder.onstop = () => {
      const durationMs = elapsedMs(capture)
      teardown()
      if (capture.cancelled) return
      void capture.queue.then(() => internal.capture.finished(request.sessionId, durationMs))
    }

    // L'utilisateur peut couper le partage depuis Windows : on finalise proprement.
    videoTrack.addEventListener('ended', () => {
      if (active === capture && recorder.state !== 'inactive') recorder.stop()
    })

    // 1 s par morceau : compromis entre réactivité de l'écriture disque et surcoût.
    recorder.start(1000)
    capture.startedAt = performance.now()
    internal.capture.started(request.sessionId)
  } catch (err) {
    console.error('[recorder] démarrage impossible', err)
    teardown()
    internal.capture.failed(request.sessionId, describeError(err))
  }
}

function describeError(err: unknown): string {
  const error = err as { name?: string; message?: string }
  if (error?.name === 'NotAllowedError') {
    return "Windows a refusé l'accès à la capture d'écran."
  }
  if (error?.name === 'NotFoundError') {
    return 'Aucune source de capture disponible.'
  }
  return error?.message || 'Erreur inconnue pendant la capture.'
}

/* ------------------------------------------------------------------ */
/* Audio                                                               */
/* ------------------------------------------------------------------ */

/** Mixe l'audio système et le micro en une piste unique via la Web Audio API. */
function mixAudio(
  systemTracks: MediaStreamTrack[],
  micTracks: MediaStreamTrack[],
  systemGain: number,
  micGain: number
): { stream: MediaStream | null; context: AudioContext | null } {
  if (!systemTracks.length && !micTracks.length) return { stream: null, context: null }

  const context = new AudioContext()
  const destination = context.createMediaStreamDestination()

  const connect = (tracks: MediaStreamTrack[], gainValue: number): void => {
    if (!tracks.length) return
    const source = context.createMediaStreamSource(new MediaStream(tracks))
    const gain = context.createGain()
    gain.gain.value = Math.max(0, Math.min(3, gainValue))
    source.connect(gain)
    gain.connect(destination)
  }

  connect(systemTracks, systemGain)
  connect(micTracks, micGain)

  return { stream: destination.stream, context }
}

/* ------------------------------------------------------------------ */
/* Vidéo                                                               */
/* ------------------------------------------------------------------ */

/**
 * Prépare le flux vidéo final. Quand aucun recadrage ni redimensionnement
 * n'est nécessaire, la piste d'origine est transmise telle quelle : pas de
 * canvas, donc pas de coût CPU inutile.
 */
async function buildVideoStream(
  request: CaptureRequest,
  videoTrack: MediaStreamTrack
): Promise<{
  videoStream: MediaStream
  video: HTMLVideoElement | null
  stopDrawing: (() => void) | null
}> {
  const settings = videoTrack.getSettings()
  const capturedWidth = settings.width ?? request.sourceWidth
  const capturedHeight = settings.height ?? request.sourceHeight

  // Chromium peut livrer une résolution différente de celle demandée : le
  // recadrage exprimé en pixels de l'écran doit suivre le même facteur.
  const scaleX = capturedWidth / Math.max(1, request.sourceWidth)
  const scaleY = capturedHeight / Math.max(1, request.sourceHeight)

  let sx = 0
  let sy = 0
  let sw = capturedWidth
  let sh = capturedHeight

  if (request.crop) {
    sx = Math.max(0, Math.round(request.crop.x * scaleX))
    sy = Math.max(0, Math.round(request.crop.y * scaleY))
    sw = Math.max(2, Math.round(request.crop.width * scaleX))
    sh = Math.max(2, Math.round(request.crop.height * scaleY))
    sw = Math.min(sw, capturedWidth - sx)
    sh = Math.min(sh, capturedHeight - sy)
  }

  // Le préréglage est un plafond : on n'agrandit jamais une petite zone.
  const outHeight = even(Math.min(request.targetHeight, sh))
  const outWidth = even((sw * outHeight) / sh)

  const passthrough =
    !request.crop && outWidth === capturedWidth && outHeight === capturedHeight

  if (passthrough) {
    return { videoStream: new MediaStream([videoTrack]), video: null, stopDrawing: null }
  }

  const video = document.createElement('video')
  video.srcObject = new MediaStream([videoTrack])
  video.muted = true
  video.playsInline = true
  await video.play()

  const canvas = document.createElement('canvas')
  canvas.width = outWidth
  canvas.height = outHeight
  const context = canvas.getContext('2d', { alpha: false, desynchronized: true })
  if (!context) throw new Error("Le contexte de rendu 2D n'est pas disponible.")
  context.imageSmoothingQuality = 'high'

  let running = true
  let frameHandle: number | null = null
  let intervalHandle: number | null = null

  const draw = (): void => {
    if (!running) return
    try {
      context.drawImage(video, sx, sy, sw, sh, 0, 0, outWidth, outHeight)
    } catch {
      /* une frame manquante ne doit pas interrompre l'enregistrement */
    }
    if (video.requestVideoFrameCallback) {
      frameHandle = video.requestVideoFrameCallback(draw)
    }
  }

  if (video.requestVideoFrameCallback) {
    frameHandle = video.requestVideoFrameCallback(draw)
  } else {
    intervalHandle = window.setInterval(draw, Math.round(1000 / request.fps))
  }

  const stopDrawing = (): void => {
    running = false
    if (frameHandle !== null && video.cancelVideoFrameCallback) {
      video.cancelVideoFrameCallback(frameHandle)
    }
    if (intervalHandle !== null) window.clearInterval(intervalHandle)
    video.srcObject = null
  }

  return { videoStream: canvas.captureStream(request.fps), video, stopDrawing }
}

/* ------------------------------------------------------------------ */
/* Contrôles et nettoyage                                              */
/* ------------------------------------------------------------------ */

function elapsedMs(capture: ActiveCapture): number {
  const end = capture.pausedAt ?? performance.now()
  return Math.max(0, end - capture.startedAt - capture.pausedTotalMs)
}

function teardown(): void {
  if (!active) return
  active.stopDrawing?.()
  for (const track of active.tracks) {
    try {
      track.stop()
    } catch {
      /* piste déjà arrêtée */
    }
  }
  void active.audioContext?.close().catch(() => undefined)
  active = null
}

function fail(message: string): void {
  const sessionId = active?.request.sessionId
  if (active) active.cancelled = true
  teardown()
  if (sessionId) internal.capture.failed(sessionId, message)
}

internal.capture.onBegin((request) => void begin(request))

internal.capture.onStop((sessionId) => {
  if (!active || active.request.sessionId !== sessionId) return
  if (active.recorder.state !== 'inactive') active.recorder.stop()
})

internal.capture.onPause((sessionId) => {
  if (!active || active.request.sessionId !== sessionId) return
  if (active.recorder.state === 'recording') {
    active.pausedAt = performance.now()
    active.recorder.pause()
  }
})

internal.capture.onResume((sessionId) => {
  if (!active || active.request.sessionId !== sessionId) return
  if (active.recorder.state === 'paused') {
    if (active.pausedAt !== null) {
      active.pausedTotalMs += performance.now() - active.pausedAt
      active.pausedAt = null
    }
    active.recorder.resume()
  }
})

internal.capture.onCancel((sessionId) => {
  if (!active || active.request.sessionId !== sessionId) return
  active.cancelled = true
  if (active.recorder.state !== 'inactive') active.recorder.stop()
  else teardown()
})
