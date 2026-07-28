/**
 * Types partagés entre le process principal, le preload et les fenêtres de rendu.
 * Aucun import Electron/Node ici : ce fichier est chargé des deux côtés.
 */

export type Resolution = 240 | 480 | 720 | 1080
export const RESOLUTIONS: Resolution[] = [240, 480, 720, 1080]

export type Fps = 24 | 30 | 60
export const FPS_OPTIONS: Fps[] = [24, 30, 60]

export type CaptureMode = 'region' | 'fullscreen'

export type OutputFormat = 'mp4' | 'webm'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Hotkeys {
  region: string
  fullscreen: string
  stop: string
  pause: string
}

export interface Settings {
  /** Dossier dans lequel les enregistrements finaux sont écrits. */
  outputFolder: string
  quality: Resolution
  fps: Fps
  outputFormat: OutputFormat
  captureSystemAudio: boolean
  captureMicrophone: boolean
  microphoneDeviceId: string | null
  /** Gains linéaires appliqués au mixage (1 = neutre). */
  micGain: number
  systemGain: number
  launchAtStartup: boolean
  startMinimized: boolean
  showCountdown: boolean
  countdownSeconds: number
  highlightCursor: boolean
  playSounds: boolean
  hotkeys: Hotkeys
  onboardingCompleted: boolean
}

export const DEFAULT_HOTKEYS: Hotkeys = {
  region: 'Control+Shift+R',
  fullscreen: 'Control+Shift+F',
  stop: 'Control+Shift+S',
  pause: 'Control+Shift+P'
}

export interface Recording {
  id: string
  fileName: string
  filePath: string
  thumbnailPath: string | null
  createdAt: number
  durationMs: number
  width: number
  height: number
  sizeBytes: number
  hasAudio: boolean
}

export type RecordingState = 'idle' | 'countdown' | 'recording' | 'paused' | 'processing'

export interface RecordingStatus {
  state: RecordingState
  /** Durée écoulée en millisecondes, hors temps de pause. */
  elapsedMs: number
  mode: CaptureMode | null
  countdownRemaining?: number
  /** Progression 0→1 pendant l'encodage final. */
  progress?: number
  error?: string
}

/** Ordre d'enregistrement envoyé par le main au moteur de capture. */
export interface CaptureRequest {
  sessionId: string
  mode: CaptureMode
  /** Identifiant `desktopCapturer` de l'écran à capturer. */
  sourceId: string
  /** Dimensions physiques réelles de l'écran source, en pixels. */
  sourceWidth: number
  sourceHeight: number
  /** Zone à conserver, en pixels physiques de l'écran source. Null = plein écran. */
  crop: Rect | null
  targetHeight: Resolution
  fps: Fps
  /** Détermine le codec préféré du MediaRecorder (H.264 pour MP4, VP9 pour WebM). */
  outputFormat: OutputFormat
  captureSystemAudio: boolean
  captureMicrophone: boolean
  microphoneDeviceId: string | null
  micGain: number
  systemGain: number
}

export interface DisplayInfo {
  id: string
  label: string
  bounds: Rect
  scaleFactor: number
  isPrimary: boolean
}

export interface AudioInputDevice {
  deviceId: string
  label: string
}

/* ------------------------------------------------------------------ */
/* Éditeur                                                             */
/* ------------------------------------------------------------------ */

export interface TrimRequest {
  /** Enregistrement source. */
  sourcePath: string
  startSec: number
  endSec: number
  /** Recadrage optionnel, exprimé en pixels de la vidéo source. */
  crop?: Rect | null
  /** Hauteur cible ; absent = conserver la résolution source. */
  targetHeight?: Resolution | null
  /** `replace` écrase l'enregistrement, `copy` crée un nouveau fichier. */
  mode: 'replace' | 'copy'
  /** Nom de fichier souhaité (sans extension) pour le mode `copy`. */
  outputName?: string
}

export type AudioExportFormat = 'mp3' | 'wav' | 'm4a'

export interface AudioExportRequest {
  sourcePath: string
  startSec: number
  endSec: number
  format: AudioExportFormat
  outputName?: string
}

export interface JobProgress {
  jobId: string
  label: string
  progress: number
  done: boolean
  error?: string
  resultPath?: string
}

export interface MediaInfo {
  durationSec: number
  width: number
  height: number
  hasAudio: boolean
  fps: number
}

/* ------------------------------------------------------------------ */
/* API exposée au renderer via le preload                              */
/* ------------------------------------------------------------------ */

export interface AsleRecApi {
  settings: {
    get(): Promise<Settings>
    update(patch: Partial<Settings>): Promise<Settings>
    chooseOutputFolder(): Promise<string | null>
    onChange(cb: (settings: Settings) => void): () => void
  }
  recording: {
    startRegion(): Promise<void>
    startFullscreen(): Promise<void>
    stop(): Promise<void>
    togglePause(): Promise<void>
    cancel(): Promise<void>
    getStatus(): Promise<RecordingStatus>
    onStatus(cb: (status: RecordingStatus) => void): () => void
  }
  library: {
    list(): Promise<Recording[]>
    reveal(filePath: string): Promise<void>
    open(filePath: string): Promise<void>
    delete(id: string): Promise<Recording[]>
    rename(id: string, newName: string): Promise<Recording[]>
    onChange(cb: (recordings: Recording[]) => void): () => void
    fileUrl(filePath: string): string
  }
  editor: {
    probe(filePath: string): Promise<MediaInfo>
    trim(request: TrimRequest): Promise<JobProgress>
    exportAudio(request: AudioExportRequest): Promise<JobProgress>
    onJobProgress(cb: (progress: JobProgress) => void): () => void
  }
  system: {
    getDisplays(): Promise<DisplayInfo[]>
    getVersion(): Promise<string>
    openExternal(url: string): Promise<void>
    quit(): Promise<void>
    minimize(): Promise<void>
    toggleMaximize(): Promise<void>
    close(): Promise<void>
    onWindowState(cb: (state: { maximized: boolean }) => void): () => void
    onNotice(cb: (notice: SystemNotice) => void): () => void
  }
}

/** Message ponctuel poussé par le process principal vers l'interface. */
export interface SystemNotice {
  tone: 'neutral' | 'danger'
  title: string
  detail?: string
}

export interface OverlayInit {
  displayId: number
  scaleFactor: number
  bounds: Rect
}

/** API réservée aux fenêtres techniques (moteur de capture, calque de sélection). */
export interface AsleRecInternalApi {
  capture: {
    onBegin(cb: (request: CaptureRequest) => void): () => void
    onStop(cb: (sessionId: string) => void): () => void
    onPause(cb: (sessionId: string) => void): () => void
    onResume(cb: (sessionId: string) => void): () => void
    onCancel(cb: (sessionId: string) => void): () => void
    started(sessionId: string): void
    chunk(sessionId: string, chunk: ArrayBuffer): void
    finished(sessionId: string, durationMs: number): void
    failed(sessionId: string, message: string): void
  }
  overlay: {
    onInit(cb: (payload: OverlayInit) => void): () => void
    select(displayId: number, crop: Rect): void
    cancel(): void
  }
  navigate(cb: (page: string) => void): () => void
}
