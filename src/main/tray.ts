import { Menu, Tray, app, nativeImage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

import { recording } from './recording'
import { settings } from './settings'
import { revealMainWindow } from './windows'

let tray: Tray | null = null

/** Les icônes sont copiées à la racine des ressources par electron-builder. */
function iconPath(name: string): string {
  const packaged = path.join(process.resourcesPath, name)
  if (app.isPackaged && fs.existsSync(packaged)) return packaged
  return path.join(app.getAppPath(), 'build', name)
}

function buildMenu(): Menu {
  const busy = recording().isBusy()
  const config = settings().get()

  return Menu.buildFromTemplate([
    {
      label: 'Ouvrir AsleRec',
      click: () => revealMainWindow('library')
    },
    { type: 'separator' },
    {
      label: `Enregistrer une zone\t${config.hotkeys.region.replace(/Control/g, 'Ctrl')}`,
      enabled: !busy,
      click: () => void recording().start('region')
    },
    {
      label: `Enregistrer tout l'écran\t${config.hotkeys.fullscreen.replace(/Control/g, 'Ctrl')}`,
      enabled: !busy,
      click: () => void recording().start('fullscreen')
    },
    {
      label: "Arrêter l'enregistrement",
      enabled: busy,
      click: () => void recording().stop()
    },
    { type: 'separator' },
    {
      label: 'Réglages…',
      click: () => revealMainWindow('settings')
    },
    { type: 'separator' },
    {
      label: 'Quitter AsleRec',
      click: () => {
        app.quit()
      }
    }
  ])
}

export function createTray(): Tray {
  if (tray && !tray.isDestroyed()) return tray

  const image = nativeImage.createFromPath(iconPath('tray.png'))
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)
  tray.setToolTip('AsleRec')
  tray.setContextMenu(buildMenu())
  tray.on('double-click', () => revealMainWindow('library'))

  recording().on('status', () => refreshTray())
  settings().on('changed', () => refreshTray())
  return tray
}

export function refreshTray(): void {
  if (!tray || tray.isDestroyed()) return
  const busy = recording().isBusy()
  tray.setContextMenu(buildMenu())
  tray.setToolTip(busy ? 'AsleRec — enregistrement en cours' : 'AsleRec')
  const image = nativeImage.createFromPath(iconPath(busy ? 'tray-recording.png' : 'tray.png'))
  if (!image.isEmpty()) tray.setImage(image)
}

export function destroyTray(): void {
  if (tray && !tray.isDestroyed()) tray.destroy()
  tray = null
}
