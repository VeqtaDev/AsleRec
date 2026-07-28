import { globalShortcut } from 'electron'

import type { Hotkeys } from '@shared/types'
import { recording } from './recording'

/** Raccourcis effectivement enregistrés, pour pouvoir les libérer proprement. */
let registered: string[] = []

export interface ShortcutReport {
  /** Raccourcis refusés par Windows (déjà pris par une autre application). */
  failed: string[]
}

export function registerHotkeys(hotkeys: Hotkeys): ShortcutReport {
  unregisterHotkeys()
  const failed: string[] = []

  const bind = (accelerator: string, handler: () => void): void => {
    if (!accelerator) return
    try {
      const ok = globalShortcut.register(accelerator, handler)
      if (ok) registered.push(accelerator)
      else failed.push(accelerator)
    } catch (err) {
      console.error('[shortcuts] accélérateur invalide', accelerator, err)
      failed.push(accelerator)
    }
  }

  bind(hotkeys.region, () => void recording().start('region'))
  bind(hotkeys.fullscreen, () => void recording().start('fullscreen'))
  bind(hotkeys.stop, () => void recording().stop())
  bind(hotkeys.pause, () => void recording().togglePause())

  if (failed.length) {
    console.warn('[shortcuts] raccourcis indisponibles :', failed.join(', '))
  }
  return { failed }
}

export function unregisterHotkeys(): void {
  for (const accelerator of registered) {
    try {
      globalShortcut.unregister(accelerator)
    } catch {
      /* déjà libéré */
    }
  }
  registered = []
}
