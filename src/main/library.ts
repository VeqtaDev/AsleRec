import { app } from 'electron'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'

import type { Recording } from '@shared/types'
import { extractThumbnail, probe } from './ffmpeg'

const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mkv'])

/** Caractères refusés par NTFS dans un nom de fichier. */
const FORBIDDEN_FILENAME_CHARS = '<>:"/\\|?*'

/**
 * Index des enregistrements. Le JSON n'est qu'un cache : le dossier de sortie
 * reste la source de vérité, ce qui permet à l'utilisateur d'y déposer ou d'y
 * supprimer des fichiers à la main sans casser la bibliothèque.
 */
class Library extends EventEmitter {
  private indexPath = path.join(app.getPath('userData'), 'library.json')
  private thumbsDir = path.join(app.getPath('userData'), 'thumbnails')
  private items: Recording[] = []
  /**
   * File d'exécution des opérations d'index. Le démarrage et l'interface
   * déclenchent tous deux une synchronisation : sans sérialisation, les deux
   * calculent leur liste de fichiers inconnus avant que l'autre n'ait écrit,
   * et le même enregistrement se retrouve indexé en double.
   */
  private queue: Promise<unknown> = Promise.resolve()

  constructor() {
    super()
    this.items = this.read()
    fs.mkdirSync(this.thumbsDir, { recursive: true })
  }

  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task)
    this.queue = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }

  private read(): Recording[] {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.indexPath, 'utf-8')) as Recording[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  private persist(): void {
    try {
      const tmp = `${this.indexPath}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(this.items, null, 2), 'utf-8')
      fs.renameSync(tmp, this.indexPath)
    } catch (err) {
      console.error('[library] écriture impossible', err)
    }
    this.emit('changed', this.list())
  }

  list(): Recording[] {
    return [...this.items].sort((a, b) => b.createdAt - a.createdAt)
  }

  find(id: string): Recording | undefined {
    return this.items.find((item) => item.id === id)
  }

  findByPath(filePath: string): Recording | undefined {
    const normalized = path.resolve(filePath).toLowerCase()
    return this.items.find((item) => path.resolve(item.filePath).toLowerCase() === normalized)
  }

  /** Ajoute (ou rafraîchit) un fichier dans l'index, vignette comprise. */
  register(filePath: string): Promise<Recording | null> {
    return this.serialize(() => this.registerNow(filePath))
  }

  private async registerNow(filePath: string): Promise<Recording | null> {
    if (!fs.existsSync(filePath)) return null

    const stats = fs.statSync(filePath)
    let info = { durationSec: 0, width: 0, height: 0, hasAudio: false, fps: 30 }
    try {
      info = await probe(filePath)
    } catch (err) {
      console.error('[library] probe impossible', filePath, err)
    }

    const existing = this.findByPath(filePath)
    const id =
      existing?.id ??
      `rec_${Math.round(stats.birthtimeMs || Date.now())}_${Math.random().toString(36).slice(2, 8)}`

    const thumbPath = path.join(this.thumbsDir, `${id}.jpg`)
    const thumbnail = await extractThumbnail(
      filePath,
      thumbPath,
      Math.min(1, info.durationSec / 2)
    )

    const record: Recording = {
      id,
      fileName: path.basename(filePath),
      filePath,
      thumbnailPath: thumbnail,
      createdAt: existing?.createdAt ?? stats.birthtimeMs ?? Date.now(),
      durationMs: Math.round(info.durationSec * 1000),
      width: info.width,
      height: info.height,
      sizeBytes: stats.size,
      hasAudio: info.hasAudio
    }

    this.items = [record, ...this.items.filter((item) => item.id !== id)]
    this.persist()
    return record
  }

  /**
   * Réconcilie l'index avec le dossier de sortie : retire les entrées dont le
   * fichier a disparu, indexe les vidéos ajoutées manuellement.
   */
  sync(outputFolder: string): Promise<Recording[]> {
    return this.serialize(() => this.syncNow(outputFolder))
  }

  private async syncNow(outputFolder: string): Promise<Recording[]> {
    const before = this.items.length

    // Retire les entrées orphelines et les doublons de chemin éventuels.
    const seen = new Set<string>()
    this.items = this.items.filter((item) => {
      if (!fs.existsSync(item.filePath)) return false
      const key = path.resolve(item.filePath).toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    let files: string[] = []
    try {
      files = fs.readdirSync(outputFolder)
    } catch {
      files = []
    }

    const known = new Set(this.items.map((item) => path.resolve(item.filePath).toLowerCase()))
    const unknown = files
      .filter((name) => VIDEO_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .map((name) => path.join(outputFolder, name))
      .filter((filePath) => !known.has(path.resolve(filePath).toLowerCase()))

    // Appel direct : nous détenons déjà le verrou de la file.
    for (const filePath of unknown) {
      await this.registerNow(filePath)
    }

    if (before !== this.items.length && !unknown.length) this.persist()
    return this.list()
  }

  remove(id: string, deleteFile: boolean): Recording[] {
    const item = this.find(id)
    if (item) {
      if (deleteFile) {
        try {
          fs.rmSync(item.filePath, { force: true })
        } catch (err) {
          console.error('[library] suppression impossible', err)
        }
      }
      if (item.thumbnailPath) {
        try {
          fs.rmSync(item.thumbnailPath, { force: true })
        } catch {
          /* la vignette est jetable */
        }
      }
      this.items = this.items.filter((entry) => entry.id !== id)
      this.persist()
    }
    return this.list()
  }

  rename(id: string, newName: string): Recording[] {
    const item = this.find(id)
    if (!item) return this.list()

    const ext = path.extname(item.filePath)
    const safe = sanitizeFileName(newName) || path.basename(item.filePath, ext)
    const target = path.join(path.dirname(item.filePath), `${safe}${ext}`)
    if (path.resolve(target) === path.resolve(item.filePath)) return this.list()

    try {
      fs.renameSync(item.filePath, target)
      item.filePath = target
      item.fileName = path.basename(target)
      this.persist()
    } catch (err) {
      console.error('[library] renommage impossible', err)
    }
    return this.list()
  }
}

/**
 * Nettoie un nom de fichier : retire les caractères réservés par Windows ainsi
 * que les codes de contrôle, puis les points/espaces de fin que l'explorateur
 * refuse.
 */
export function sanitizeFileName(name: string): string {
  const kept = Array.from(name).filter((char) => {
    const code = char.codePointAt(0) ?? 0
    return code >= 32 && code !== 127 && !FORBIDDEN_FILENAME_CHARS.includes(char)
  })
  let result = kept.join('').replace(/\s+/g, ' ').trim()
  while (result.endsWith('.') || result.endsWith(' ')) result = result.slice(0, -1)
  while (result.startsWith('.')) result = result.slice(1)
  return result.slice(0, 120).trim()
}

let instance: Library | null = null

export function library(): Library {
  if (!instance) instance = new Library()
  return instance
}
