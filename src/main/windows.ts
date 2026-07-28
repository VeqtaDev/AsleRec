import { BrowserWindow, screen, shell } from 'electron'
import path from 'node:path'

import { CH } from '@shared/channels'
import type { DisplayInfo, Rect } from '@shared/types'

const PRELOAD = path.join(__dirname, '../preload/index.js')
const RENDERER_DIR = path.join(__dirname, '../renderer')

/** Résout l'URL (dev) ou le fichier (prod) d'une page du renderer. */
function loadPage(window: BrowserWindow, page: string, query?: Record<string, string>): void {
  const devServer = process.env['ELECTRON_RENDERER_URL']
  if (devServer) {
    const url = new URL(`${devServer}/${page}`)
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value)
    void window.loadURL(url.toString())
  } else {
    void window.loadFile(path.join(RENDERER_DIR, page), { query })
  }
}

/* ------------------------------------------------------------------ */
/* Fenêtre principale                                                  */
/* ------------------------------------------------------------------ */

let mainWindow: BrowserWindow | null = null

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function createMainWindow(show: boolean): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (show) revealMainWindow()
    return mainWindow
  }

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 940,
    minHeight: 620,
    show: false,
    frame: false,
    backgroundColor: '#0B0B0D',
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    webPreferences: {
      preload: PRELOAD,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    if (show) mainWindow?.show()
  })

  const emitWindowState = (): void => {
    mainWindow?.webContents.send(CH.system.windowState, {
      maximized: mainWindow.isMaximized()
    })
  }
  mainWindow.on('maximize', emitWindowState)
  mainWindow.on('unmaximize', emitWindowState)

  // Les liens externes ouvrent le navigateur, jamais une fenêtre Electron.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  loadPage(mainWindow, 'index.html')
  return mainWindow
}

export function revealMainWindow(page?: string): void {
  const window = mainWindow && !mainWindow.isDestroyed() ? mainWindow : createMainWindow(true)
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
  if (page) window.webContents.send(CH.system.navigate, page)
}

/* ------------------------------------------------------------------ */
/* Moteur de capture (fenêtre cachée)                                  */
/* ------------------------------------------------------------------ */

let recorderWindow: BrowserWindow | null = null

/**
 * La capture vit dans une fenêtre invisible dédiée : l'enregistrement continue
 * même quand l'utilisateur ferme l'interface dans la zone de notification.
 */
export function getRecorderWindow(): BrowserWindow {
  if (recorderWindow && !recorderWindow.isDestroyed()) return recorderWindow

  recorderWindow = new BrowserWindow({
    show: false,
    width: 480,
    height: 320,
    webPreferences: {
      preload: PRELOAD,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // Sans cela, Chromium met la page en veille et le MediaRecorder saccade.
      backgroundThrottling: false
    }
  })

  recorderWindow.on('closed', () => {
    recorderWindow = null
  })

  loadPage(recorderWindow, 'recorder.html')
  return recorderWindow
}

/** Attend que le moteur de capture ait fini de charger. */
export function whenRecorderReady(): Promise<BrowserWindow> {
  const window = getRecorderWindow()
  if (!window.webContents.isLoading()) return Promise.resolve(window)
  return new Promise((resolve) => {
    window.webContents.once('did-finish-load', () => resolve(window))
  })
}

/* ------------------------------------------------------------------ */
/* Barre de contrôle flottante                                         */
/* ------------------------------------------------------------------ */

let controlBar: BrowserWindow | null = null

export function showControlBar(): BrowserWindow {
  if (controlBar && !controlBar.isDestroyed()) {
    controlBar.showInactive()
    return controlBar
  }

  const display = screen.getPrimaryDisplay()
  const width = 372
  const height = 72

  controlBar = new BrowserWindow({
    width,
    height,
    x: Math.round(display.workArea.x + (display.workArea.width - width) / 2),
    y: Math.round(display.workArea.y + display.workArea.height - height - 28),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: PRELOAD,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })

  // Affichée sans activation (`showInactive`) pour ne pas voler le focus à
  // l'application filmée, mais restée focusable afin que ses boutons répondent.
  controlBar.setAlwaysOnTop(true, 'screen-saver')
  controlBar.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  // Empêche la barre d'apparaître dans l'enregistrement (Windows 10+).
  controlBar.setContentProtection(true)

  controlBar.once('ready-to-show', () => controlBar?.showInactive())
  controlBar.on('closed', () => {
    controlBar = null
  })

  loadPage(controlBar, 'controlbar.html')
  return controlBar
}

export function hideControlBar(): void {
  if (controlBar && !controlBar.isDestroyed()) {
    controlBar.close()
  }
  controlBar = null
}

export function getControlBar(): BrowserWindow | null {
  return controlBar && !controlBar.isDestroyed() ? controlBar : null
}

/* ------------------------------------------------------------------ */
/* Sélecteur de zone                                                   */
/* ------------------------------------------------------------------ */

export interface RegionSelection {
  displayId: number
  /** Zone en pixels physiques, relative au coin haut-gauche de l'écran choisi. */
  crop: Rect
}

let overlayWindows: BrowserWindow[] = []
let overlayResolve: ((value: RegionSelection | null) => void) | null = null

export function isOverlayOpen(): boolean {
  return overlayWindows.length > 0
}

/**
 * Recouvre chaque écran d'un calque transparent et laisse l'utilisateur tracer
 * la zone à enregistrer. Résout `null` si la sélection est annulée.
 */
export function showRegionOverlay(): Promise<RegionSelection | null> {
  if (overlayResolve) return Promise.resolve(null)

  return new Promise((resolve) => {
    overlayResolve = resolve

    for (const display of screen.getAllDisplays()) {
      const window = new BrowserWindow({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        hasShadow: false,
        enableLargerThanScreen: true,
        show: false,
        webPreferences: {
          preload: PRELOAD,
          sandbox: false,
          contextIsolation: true,
          nodeIntegration: false
        }
      })

      window.setAlwaysOnTop(true, 'screen-saver')
      window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
      // Le calque ne doit pas se retrouver dans la vidéo.
      window.setContentProtection(true)

      window.once('ready-to-show', () => {
        window.show()
        window.focus()
        window.webContents.send(CH.overlay.init, {
          displayId: display.id,
          scaleFactor: display.scaleFactor,
          bounds: display.bounds
        })
      })

      loadPage(window, 'overlay.html', { displayId: String(display.id) })
      overlayWindows.push(window)
    }
  })
}

export function resolveRegionOverlay(selection: RegionSelection | null): void {
  const resolve = overlayResolve
  overlayResolve = null
  closeRegionOverlay()
  resolve?.(selection)
}

export function closeRegionOverlay(): void {
  for (const window of overlayWindows) {
    if (!window.isDestroyed()) window.destroy()
  }
  overlayWindows = []
}

/* ------------------------------------------------------------------ */

export function listDisplays(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id
  return screen.getAllDisplays().map((display, index) => ({
    id: String(display.id),
    label: display.label || `Écran ${index + 1}`,
    bounds: {
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height
    },
    scaleFactor: display.scaleFactor,
    isPrimary: display.id === primaryId
  }))
}
