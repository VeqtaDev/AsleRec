import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'

import type { AudioExportRequest, JobProgress, TrimRequest } from '@shared/types'

import { buildVideoFilter, bitrateFor, runFfmpeg } from './ffmpeg'
import { library, sanitizeFileName } from './library'
import { uniquePath } from './recording'
import { settings } from './settings'

class EditorJobs extends EventEmitter {
  private counter = 0

  private nextJobId(): string {
    this.counter += 1
    return `job_${Date.now().toString(36)}_${this.counter}`
  }

  private report(progress: JobProgress): JobProgress {
    this.emit('progress', progress)
    return progress
  }

  /**
   * Découpe (et éventuellement recadre / redimensionne) un enregistrement.
   * En mode `replace`, le fichier n'est écrasé qu'une fois l'encodage réussi.
   */
  async trim(request: TrimRequest): Promise<JobProgress> {
    const jobId = this.nextJobId()
    const label = request.mode === 'replace' ? 'Découpage' : "Export de l'extrait"

    const startSec = Math.max(0, request.startSec)
    const durationSec = Math.max(0.05, request.endSec - startSec)

    if (!fs.existsSync(request.sourcePath)) {
      return this.report({
        jobId,
        label,
        progress: 0,
        done: true,
        error: 'Fichier source introuvable.'
      })
    }

    const ext = path.extname(request.sourcePath) || '.mp4'
    const isMp4 = ext.toLowerCase() === '.mp4'
    const outputFolder = settings().ensureOutputFolder()

    const finalPath =
      request.mode === 'replace'
        ? request.sourcePath
        : uniquePath(
            path.join(
              outputFolder,
              `${sanitizeFileName(request.outputName || `${path.basename(request.sourcePath, ext)} - extrait`)}${ext}`
            )
          )

    // On encode vers un fichier temporaire : une coupure en cours de route ne
    // doit jamais détruire l'enregistrement d'origine.
    const workPath = path.join(
      path.dirname(finalPath),
      `.aslerec-${jobId}${ext}`
    )

    const config = settings().get()
    const filter = buildVideoFilter(request.crop ?? null, request.targetHeight ?? null)
    const height = request.targetHeight ?? config.quality

    const args = [
      '-ss',
      startSec.toFixed(3),
      '-i',
      request.sourcePath,
      '-t',
      durationSec.toFixed(3)
    ]

    if (filter) args.push('-vf', filter)

    if (isMp4) {
      args.push(
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '21',
        '-maxrate',
        `${bitrateFor(height, config.fps)}k`,
        '-bufsize',
        `${bitrateFor(height, config.fps) * 2}k`,
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '160k',
        '-movflags',
        '+faststart'
      )
    } else {
      args.push(
        '-c:v',
        'libvpx-vp9',
        '-deadline',
        'realtime',
        '-cpu-used',
        '5',
        '-b:v',
        `${bitrateFor(height, config.fps)}k`,
        '-c:a',
        'libopus',
        '-b:a',
        '128k'
      )
    }

    args.push('-y', workPath)

    this.report({ jobId, label, progress: 0, done: false })

    try {
      await runFfmpeg(args, {
        expectedDurationSec: durationSec,
        onProgress: (ratio) => this.report({ jobId, label, progress: ratio, done: false })
      })

      if (request.mode === 'replace') {
        fs.rmSync(finalPath, { force: true })
      }
      fs.renameSync(workPath, finalPath)
      await library().register(finalPath)

      return this.report({ jobId, label, progress: 1, done: true, resultPath: finalPath })
    } catch (err) {
      fs.rmSync(workPath, { force: true })
      return this.report({
        jobId,
        label,
        progress: 0,
        done: true,
        error: (err as Error).message
      })
    }
  }

  /** Extrait la piste audio (entière ou partielle) vers un fichier séparé. */
  async exportAudio(request: AudioExportRequest): Promise<JobProgress> {
    const jobId = this.nextJobId()
    const label = "Export de l'audio"

    const startSec = Math.max(0, request.startSec)
    const durationSec = Math.max(0.05, request.endSec - startSec)

    if (!fs.existsSync(request.sourcePath)) {
      return this.report({
        jobId,
        label,
        progress: 0,
        done: true,
        error: 'Fichier source introuvable.'
      })
    }

    const outputFolder = settings().ensureOutputFolder()
    const baseName = sanitizeFileName(
      request.outputName || path.basename(request.sourcePath, path.extname(request.sourcePath))
    )
    const outputPath = uniquePath(
      path.join(outputFolder, `${baseName}.${request.format}`)
    )

    const args = [
      '-ss',
      startSec.toFixed(3),
      '-i',
      request.sourcePath,
      '-t',
      durationSec.toFixed(3),
      '-vn'
    ]

    if (request.format === 'mp3') args.push('-c:a', 'libmp3lame', '-q:a', '2')
    else if (request.format === 'wav') args.push('-c:a', 'pcm_s16le')
    else args.push('-c:a', 'aac', '-b:a', '192k')

    args.push('-y', outputPath)

    this.report({ jobId, label, progress: 0, done: false })

    try {
      await runFfmpeg(args, {
        expectedDurationSec: durationSec,
        onProgress: (ratio) => this.report({ jobId, label, progress: ratio, done: false })
      })
      return this.report({ jobId, label, progress: 1, done: true, resultPath: outputPath })
    } catch (err) {
      fs.rmSync(outputPath, { force: true })
      return this.report({
        jobId,
        label,
        progress: 0,
        done: true,
        error: (err as Error).message
      })
    }
  }
}

let instance: EditorJobs | null = null

export function editor(): EditorJobs {
  if (!instance) instance = new EditorJobs()
  return instance
}
