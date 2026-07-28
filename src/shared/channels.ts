/** Noms des canaux IPC, partagés entre le main, le preload et les renderers. */
export const CH = {
  settings: {
    get: 'settings:get',
    update: 'settings:update',
    chooseFolder: 'settings:choose-folder',
    changed: 'settings:changed'
  },
  recording: {
    startRegion: 'recording:start-region',
    startFullscreen: 'recording:start-fullscreen',
    stop: 'recording:stop',
    togglePause: 'recording:toggle-pause',
    cancel: 'recording:cancel',
    getStatus: 'recording:get-status',
    status: 'recording:status'
  },
  /** Canaux internes entre le main et la fenêtre cachée du moteur de capture. */
  capture: {
    begin: 'capture:begin',
    stop: 'capture:stop',
    pause: 'capture:pause',
    resume: 'capture:resume',
    cancel: 'capture:cancel',
    chunk: 'capture:chunk',
    started: 'capture:started',
    finished: 'capture:finished',
    failed: 'capture:failed',
    listMicrophones: 'capture:list-microphones'
  },
  overlay: {
    selection: 'overlay:selection',
    cancel: 'overlay:cancel',
    init: 'overlay:init'
  },
  library: {
    list: 'library:list',
    reveal: 'library:reveal',
    open: 'library:open',
    delete: 'library:delete',
    rename: 'library:rename',
    changed: 'library:changed'
  },
  editor: {
    probe: 'editor:probe',
    trim: 'editor:trim',
    exportAudio: 'editor:export-audio',
    jobProgress: 'editor:job-progress'
  },
  system: {
    getDisplays: 'system:get-displays',
    getVersion: 'system:get-version',
    openExternal: 'system:open-external',
    quit: 'system:quit',
    minimize: 'system:minimize',
    toggleMaximize: 'system:toggle-maximize',
    close: 'system:close',
    windowState: 'system:window-state',
    navigate: 'system:navigate',
    notice: 'system:notice'
  }
} as const
