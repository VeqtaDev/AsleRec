import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron'

import { CH } from '@shared/channels'
import type {
  AudioExportRequest,
  Rect,
  Settings,
  SystemNotice,
  TrimRequest
} from '@shared/types'

import { editor } from './editor'
import { probe } from './ffmpeg'
import { library } from './library'
import { recording } from './recording'
import { registerHotkeys } from './shortcuts'
import { settings } from './settings'
import {
  getMainWindow,
  listDisplays,
  resolveRegionOverlay,
  revealMainWindow
} from './windows'

/** Traduit un accélérateur Electron en libellé lisible sur Windows. */
function formatAccelerator(accelerator: string): string {
  return accelerator
    .split('+')
    .map((part) =>
      part === 'Control' || part === 'CommandOrControl'
        ? 'Ctrl'
        : part === 'Shift'
          ? 'Maj'
          : part
    )
    .join(' + ')
}

/** Diffuse un évènement à toutes les fenêtres vivantes. */
function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(channel, payload)
  }
}

export function registerIpc(): void {
  /* ---------------------------------------------------------------- */
  /* Réglages                                                          */
  /* ---------------------------------------------------------------- */

  ipcMain.handle(CH.settings.get, () => settings().get())

  ipcMain.handle(CH.settings.update, (_event, patch: Partial<Settings>) => {
    const previous = settings().get()
    const next = settings().update(patch)

    if (patch.hotkeys) {
      const { failed } = registerHotkeys(next.hotkeys)
      if (failed.length) {
        // Un raccourci déjà pris par Windows ou une autre application ne doit
        // pas rester silencieusement inopérant.
        broadcast(CH.system.notice, {
          tone: 'danger',
          title: failed.length > 1 ? 'Raccourcis indisponibles' : 'Raccourci indisponible',
          detail: `${failed.map(formatAccelerator).join(', ')} — déjà utilisé par une autre application.`
        } satisfies SystemNotice)
      }
    }

    if (patch.launchAtStartup !== undefined) {
      app.setLoginItemSettings({
        openAtLogin: next.launchAtStartup,
        // `--hidden` indique au démarrage de rester dans la zone de notification.
        args: next.startMinimized ? ['--hidden'] : []
      })
    }

    if (patch.outputFolder && patch.outputFolder !== previous.outputFolder) {
      settings().ensureOutputFolder()
      void library()
        .sync(next.outputFolder)
        .then((items) => broadcast(CH.library.changed, items))
    }

    return next
  })

  ipcMain.handle(CH.settings.chooseFolder, async () => {
    const parent = getMainWindow()
    const result = parent
      ? await dialog.showOpenDialog(parent, {
          title: 'Choisir le dossier des enregistrements',
          defaultPath: settings().get().outputFolder,
          properties: ['openDirectory', 'createDirectory']
        })
      : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })

    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  settings().on('changed', (value: Settings) => broadcast(CH.settings.changed, value))

  /* ---------------------------------------------------------------- */
  /* Enregistrement                                                    */
  /* ---------------------------------------------------------------- */

  ipcMain.handle(CH.recording.startRegion, () => recording().start('region'))
  ipcMain.handle(CH.recording.startFullscreen, () => recording().start('fullscreen'))
  ipcMain.handle(CH.recording.stop, () => recording().stop())
  ipcMain.handle(CH.recording.togglePause, () => recording().togglePause())
  ipcMain.handle(CH.recording.cancel, () => recording().cancel())
  ipcMain.handle(CH.recording.getStatus, () => recording().getStatus())

  /* Canaux internes du moteur de capture ---------------------------- */

  ipcMain.on(CH.capture.started, (_event, sessionId: string) => {
    recording().onCaptureStarted(sessionId)
  })

  ipcMain.on(CH.capture.chunk, (_event, sessionId: string, chunk: ArrayBuffer) => {
    recording().onChunk(sessionId, chunk)
  })

  ipcMain.on(
    CH.capture.finished,
    (_event, sessionId: string, durationMs: number) => {
      void recording().onCaptureFinished(sessionId, durationMs)
    }
  )

  ipcMain.on(CH.capture.failed, (_event, sessionId: string, message: string) => {
    recording().onCaptureFailed(sessionId, message)
  })

  /* Sélecteur de zone ----------------------------------------------- */

  ipcMain.on(
    CH.overlay.selection,
    (_event, payload: { displayId: number; crop: Rect }) => {
      resolveRegionOverlay(payload)
    }
  )

  ipcMain.on(CH.overlay.cancel, () => resolveRegionOverlay(null))

  /* ---------------------------------------------------------------- */
  /* Bibliothèque                                                      */
  /* ---------------------------------------------------------------- */

  ipcMain.handle(CH.library.list, async () => {
    return library().sync(settings().get().outputFolder)
  })

  ipcMain.handle(CH.library.reveal, (_event, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle(CH.library.open, async (_event, filePath: string) => {
    const error = await shell.openPath(filePath)
    if (error) throw new Error(error)
  })

  ipcMain.handle(CH.library.delete, (_event, id: string) => library().remove(id, true))

  ipcMain.handle(CH.library.rename, (_event, id: string, newName: string) =>
    library().rename(id, newName)
  )

  library().on('changed', (items) => broadcast(CH.library.changed, items))

  /* ---------------------------------------------------------------- */
  /* Éditeur                                                           */
  /* ---------------------------------------------------------------- */

  ipcMain.handle(CH.editor.probe, (_event, filePath: string) => probe(filePath))
  ipcMain.handle(CH.editor.trim, (_event, request: TrimRequest) => editor().trim(request))
  ipcMain.handle(CH.editor.exportAudio, (_event, request: AudioExportRequest) =>
    editor().exportAudio(request)
  )

  editor().on('progress', (progress) => broadcast(CH.editor.jobProgress, progress))

  /* ---------------------------------------------------------------- */
  /* Système / fenêtre                                                 */
  /* ---------------------------------------------------------------- */

  ipcMain.handle(CH.system.getDisplays, () => listDisplays())
  ipcMain.handle(CH.system.getVersion, () => app.getVersion())

  ipcMain.handle(CH.system.openExternal, (_event, url: string) => {
    if (/^https?:\/\//i.test(url)) return shell.openExternal(url)
    return undefined
  })

  ipcMain.handle(CH.system.quit, () => app.quit())

  ipcMain.handle(CH.system.minimize, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.handle(CH.system.toggleMaximize, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })

  ipcMain.handle(CH.system.close, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.hide()
  })
}

export { revealMainWindow }
