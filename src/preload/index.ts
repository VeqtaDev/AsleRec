import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

import { CH } from '@shared/channels'
import type {
  AsleRecApi,
  AsleRecInternalApi,
  AudioExportRequest,
  CaptureRequest,
  JobProgress,
  MediaInfo,
  OverlayInit,
  Recording,
  RecordingStatus,
  Rect,
  Settings,
  SystemNotice,
  TrimRequest
} from '@shared/types'

/** Abonnement typé qui renvoie sa propre fonction de désinscription. */
function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: AsleRecApi = {
  settings: {
    get: () => ipcRenderer.invoke(CH.settings.get),
    update: (patch: Partial<Settings>) => ipcRenderer.invoke(CH.settings.update, patch),
    chooseOutputFolder: () => ipcRenderer.invoke(CH.settings.chooseFolder),
    onChange: (cb) => subscribe<Settings>(CH.settings.changed, cb)
  },
  recording: {
    startRegion: () => ipcRenderer.invoke(CH.recording.startRegion),
    startFullscreen: () => ipcRenderer.invoke(CH.recording.startFullscreen),
    stop: () => ipcRenderer.invoke(CH.recording.stop),
    togglePause: () => ipcRenderer.invoke(CH.recording.togglePause),
    cancel: () => ipcRenderer.invoke(CH.recording.cancel),
    getStatus: () => ipcRenderer.invoke(CH.recording.getStatus),
    onStatus: (cb) => subscribe<RecordingStatus>(CH.recording.status, cb)
  },
  library: {
    list: () => ipcRenderer.invoke(CH.library.list),
    reveal: (filePath: string) => ipcRenderer.invoke(CH.library.reveal, filePath),
    open: (filePath: string) => ipcRenderer.invoke(CH.library.open, filePath),
    delete: (id: string) => ipcRenderer.invoke(CH.library.delete, id),
    rename: (id: string, newName: string) =>
      ipcRenderer.invoke(CH.library.rename, id, newName),
    onChange: (cb) => subscribe<Recording[]>(CH.library.changed, cb),
    fileUrl: (filePath: string) => `aslerec://media/?p=${encodeURIComponent(filePath)}`
  },
  editor: {
    probe: (filePath: string): Promise<MediaInfo> =>
      ipcRenderer.invoke(CH.editor.probe, filePath),
    trim: (request: TrimRequest): Promise<JobProgress> =>
      ipcRenderer.invoke(CH.editor.trim, request),
    exportAudio: (request: AudioExportRequest): Promise<JobProgress> =>
      ipcRenderer.invoke(CH.editor.exportAudio, request),
    onJobProgress: (cb) => subscribe<JobProgress>(CH.editor.jobProgress, cb)
  },
  system: {
    getDisplays: () => ipcRenderer.invoke(CH.system.getDisplays),
    getVersion: () => ipcRenderer.invoke(CH.system.getVersion),
    openExternal: (url: string) => ipcRenderer.invoke(CH.system.openExternal, url),
    quit: () => ipcRenderer.invoke(CH.system.quit),
    minimize: () => ipcRenderer.invoke(CH.system.minimize),
    toggleMaximize: () => ipcRenderer.invoke(CH.system.toggleMaximize),
    close: () => ipcRenderer.invoke(CH.system.close),
    onWindowState: (cb) => subscribe<{ maximized: boolean }>(CH.system.windowState, cb),
    onNotice: (cb) => subscribe<SystemNotice>(CH.system.notice, cb)
  }
}

/**
 * Canaux réservés aux fenêtres techniques (moteur de capture, calque de
 * sélection). Ils ne sont pas destinés à l'interface principale.
 */
const internal: AsleRecInternalApi = {
  capture: {
    onBegin: (cb: (request: CaptureRequest) => void) =>
      subscribe<CaptureRequest>(CH.capture.begin, cb),
    onStop: (cb: (sessionId: string) => void) => subscribe<string>(CH.capture.stop, cb),
    onPause: (cb: (sessionId: string) => void) => subscribe<string>(CH.capture.pause, cb),
    onResume: (cb: (sessionId: string) => void) => subscribe<string>(CH.capture.resume, cb),
    onCancel: (cb: (sessionId: string) => void) => subscribe<string>(CH.capture.cancel, cb),
    started: (sessionId: string) => ipcRenderer.send(CH.capture.started, sessionId),
    chunk: (sessionId: string, chunk: ArrayBuffer) =>
      ipcRenderer.send(CH.capture.chunk, sessionId, chunk),
    finished: (sessionId: string, durationMs: number) =>
      ipcRenderer.send(CH.capture.finished, sessionId, durationMs),
    failed: (sessionId: string, message: string) =>
      ipcRenderer.send(CH.capture.failed, sessionId, message)
  },
  overlay: {
    onInit: (cb: (payload: OverlayInit) => void) => subscribe<OverlayInit>(CH.overlay.init, cb),
    select: (displayId: number, crop: Rect) =>
      ipcRenderer.send(CH.overlay.selection, { displayId, crop }),
    cancel: () => ipcRenderer.send(CH.overlay.cancel)
  },
  navigate: (cb: (page: string) => void) => subscribe<string>(CH.system.navigate, cb)
}

contextBridge.exposeInMainWorld('aslerec', api)
contextBridge.exposeInMainWorld('aslerecInternal', internal)
