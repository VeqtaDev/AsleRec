import { app } from 'electron'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'

import { DEFAULT_HOTKEYS, type Settings } from '@shared/types'

/**
 * Stockage des préférences dans `%APPDATA%/AsleRec/settings.json`.
 * Écriture atomique (fichier temporaire + rename) pour ne jamais laisser
 * un JSON tronqué derrière une coupure de courant.
 */
class SettingsStore extends EventEmitter {
  private filePath: string
  private cache: Settings

  constructor() {
    super()
    this.filePath = path.join(app.getPath('userData'), 'settings.json')
    this.cache = this.load()
  }

  private defaults(): Settings {
    return {
      outputFolder: path.join(app.getPath('videos'), 'AsleRec'),
      quality: 720,
      fps: 30,
      outputFormat: 'mp4',
      captureSystemAudio: true,
      captureMicrophone: false,
      microphoneDeviceId: null,
      micGain: 1,
      systemGain: 1,
      launchAtStartup: true,
      startMinimized: true,
      showCountdown: true,
      countdownSeconds: 3,
      highlightCursor: false,
      playSounds: true,
      hotkeys: { ...DEFAULT_HOTKEYS },
      onboardingCompleted: false
    }
  }

  private load(): Settings {
    const defaults = this.defaults()
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<Settings>
      return {
        ...defaults,
        ...parsed,
        hotkeys: { ...defaults.hotkeys, ...(parsed.hotkeys ?? {}) }
      }
    } catch {
      return defaults
    }
  }

  private persist(): void {
    const tmp = `${this.filePath}.tmp`
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
      fs.writeFileSync(tmp, JSON.stringify(this.cache, null, 2), 'utf-8')
      fs.renameSync(tmp, this.filePath)
    } catch (err) {
      console.error('[settings] écriture impossible', err)
    }
  }

  get(): Settings {
    return { ...this.cache, hotkeys: { ...this.cache.hotkeys } }
  }

  update(patch: Partial<Settings>): Settings {
    this.cache = {
      ...this.cache,
      ...patch,
      hotkeys: { ...this.cache.hotkeys, ...(patch.hotkeys ?? {}) }
    }
    this.persist()
    const snapshot = this.get()
    this.emit('changed', snapshot)
    return snapshot
  }

  /** Crée le dossier de sortie s'il n'existe pas encore ; renvoie le chemin utilisable. */
  ensureOutputFolder(): string {
    const folder = this.cache.outputFolder
    try {
      fs.mkdirSync(folder, { recursive: true })
      return folder
    } catch (err) {
      console.error('[settings] dossier de sortie inaccessible, repli sur Vidéos', err)
      const fallback = path.join(app.getPath('videos'), 'AsleRec')
      fs.mkdirSync(fallback, { recursive: true })
      this.update({ outputFolder: fallback })
      return fallback
    }
  }
}

let instance: SettingsStore | null = null

export function settings(): SettingsStore {
  if (!instance) instance = new SettingsStore()
  return instance
}
