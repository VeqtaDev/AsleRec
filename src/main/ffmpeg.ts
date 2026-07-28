import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import ffmpegStatic from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'

import type { MediaInfo, Rect, Resolution } from '@shared/types'

/**
 * Les binaires livrés par ffmpeg-static / ffprobe-static vivent dans
 * `app.asar` une fois l'application packagée : ils ne sont exécutables que
 * depuis `app.asar.unpacked` (cf. `asarUnpack` dans electron-builder.yml).
 */
function unpacked(binPath: string): string {
  return binPath.includes(`app.asar${path.sep}`)
    ? binPath.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`)
    : binPath.replace('app.asar/', 'app.asar.unpacked/')
}

export const FFMPEG_PATH = unpacked((ffmpegStatic as unknown as string) ?? 'ffmpeg')
export const FFPROBE_PATH = unpacked(
  (ffprobeStatic as unknown as { path: string }).path ?? 'ffprobe'
)

export class FfmpegError extends Error {
  constructor(
    message: string,
    readonly stderrTail: string
  ) {
    super(message)
    this.name = 'FfmpegError'
  }
}

export interface RunOptions {
  /** Durée attendue de la sortie, en secondes, pour calculer la progression. */
  expectedDurationSec?: number
  onProgress?: (ratio: number) => void
  signal?: AbortSignal
}

/** Exécute FFmpeg et résout quand le process se termine avec le code 0. */
export function runFfmpeg(args: string[], options: RunOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child: ChildProcessWithoutNullStreams = spawn(
      FFMPEG_PATH,
      ['-hide_banner', '-loglevel', 'error', '-progress', 'pipe:1', '-nostats', ...args],
      { windowsHide: true }
    ) as ChildProcessWithoutNullStreams

    let stderrTail = ''
    let settled = false

    const onAbort = (): void => {
      if (!child.killed) child.kill('SIGKILL')
    }
    options.signal?.addEventListener('abort', onAbort, { once: true })

    child.stdout.setEncoding('utf-8')
    child.stdout.on('data', (data: string) => {
      if (!options.onProgress || !options.expectedDurationSec) return
      for (const line of data.split(/\r?\n/)) {
        const match = /^out_time_us=(\d+)$/.exec(line.trim())
        if (!match) continue
        const seconds = Number(match[1]) / 1_000_000
        const ratio = Math.max(0, Math.min(1, seconds / options.expectedDurationSec))
        options.onProgress(ratio)
      }
    })

    child.stderr.setEncoding('utf-8')
    child.stderr.on('data', (data: string) => {
      stderrTail = (stderrTail + data).slice(-4000)
    })

    child.on('error', (err) => {
      if (settled) return
      settled = true
      options.signal?.removeEventListener('abort', onAbort)
      reject(new FfmpegError(`FFmpeg n'a pas pu démarrer : ${err.message}`, stderrTail))
    })

    child.on('close', (code) => {
      if (settled) return
      settled = true
      options.signal?.removeEventListener('abort', onAbort)
      if (code === 0) {
        options.onProgress?.(1)
        resolve()
      } else if (options.signal?.aborted) {
        reject(new FfmpegError('Opération annulée.', stderrTail))
      } else {
        reject(new FfmpegError(`FFmpeg a échoué (code ${code}).`, stderrTail))
      }
    })
  })
}

interface ProbeStream {
  codec_type?: string
  width?: number
  height?: number
  avg_frame_rate?: string
  duration?: string
}

interface ProbeResult {
  streams?: ProbeStream[]
  format?: { duration?: string }
}

/** Lit les métadonnées d'un média via ffprobe. */
export function probe(filePath: string): Promise<MediaInfo> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      FFPROBE_PATH,
      [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        filePath
      ],
      { windowsHide: true }
    )

    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf-8')
    child.stdout.on('data', (d: string) => (stdout += d))
    child.stderr.setEncoding('utf-8')
    child.stderr.on('data', (d: string) => (stderr += d))

    child.on('error', (err) => reject(new FfmpegError(err.message, stderr)))
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new FfmpegError(`ffprobe a échoué (code ${code}).`, stderr))
        return
      }
      try {
        const parsed = JSON.parse(stdout) as ProbeResult
        const streams = parsed.streams ?? []
        const video = streams.find((s) => s.codec_type === 'video')
        const audio = streams.find((s) => s.codec_type === 'audio')
        const duration = Number(parsed.format?.duration ?? video?.duration ?? 0)

        let fps = 30
        if (video?.avg_frame_rate) {
          const [num, den] = video.avg_frame_rate.split('/').map(Number)
          if (num && den) fps = num / den
        }

        resolve({
          durationSec: Number.isFinite(duration) ? duration : 0,
          width: video?.width ?? 0,
          height: video?.height ?? 0,
          hasAudio: Boolean(audio),
          fps: Math.round(fps * 100) / 100
        })
      } catch (err) {
        reject(new FfmpegError(`Réponse ffprobe illisible : ${(err as Error).message}`, stderr))
      }
    })
  })
}

/** Construit un filtre `-vf` à partir d'un recadrage et/ou d'une mise à l'échelle. */
export function buildVideoFilter(
  crop: Rect | null | undefined,
  targetHeight: Resolution | null | undefined
): string | null {
  const filters: string[] = []
  if (crop) {
    // Les dimensions impaires font échouer libx264 (yuv420p exige des multiples de 2).
    const w = Math.max(2, Math.floor(crop.width / 2) * 2)
    const h = Math.max(2, Math.floor(crop.height / 2) * 2)
    const x = Math.max(0, Math.floor(crop.x))
    const y = Math.max(0, Math.floor(crop.y))
    filters.push(`crop=${w}:${h}:${x}:${y}`)
  }
  if (targetHeight) {
    filters.push(`scale=-2:${targetHeight}:flags=lanczos`)
  }
  filters.push('format=yuv420p')
  return filters.length ? filters.join(',') : null
}

/** Débit vidéo conseillé (kbps) selon la hauteur cible et la fluidité. */
export function bitrateFor(height: number, fps: number): number {
  const base: Record<number, number> = { 240: 500, 480: 1200, 720: 3000, 1080: 6000 }
  const nearest = [240, 480, 720, 1080].reduce((acc, h) =>
    Math.abs(h - height) < Math.abs(acc - height) ? h : acc
  )
  const value = base[nearest] ?? 3000
  return fps > 40 ? Math.round(value * 1.5) : value
}

/** Extrait une vignette JPEG à `atSec` ; renvoie null en cas d'échec. */
export async function extractThumbnail(
  videoPath: string,
  outputPath: string,
  atSec: number
): Promise<string | null> {
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    await runFfmpeg([
      '-ss',
      Math.max(0, atSec).toFixed(3),
      '-i',
      videoPath,
      '-frames:v',
      '1',
      '-vf',
      'scale=-2:360',
      '-q:v',
      '4',
      '-y',
      outputPath
    ])
    return fs.existsSync(outputPath) ? outputPath : null
  } catch (err) {
    console.error('[ffmpeg] vignette impossible', err)
    return null
  }
}
