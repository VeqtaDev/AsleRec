import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'

import type {
  AudioInputDevice,
  JobProgress,
  Recording,
  RecordingStatus,
  Settings
} from '@shared/types'

const api = window.aslerec
const internal = window.aslerecInternal

export type Page = 'capture' | 'library' | 'settings'

export interface Toast {
  id: number
  tone: 'neutral' | 'success' | 'danger'
  title: string
  detail?: string
  /** Action optionnelle affichée à droite du toast. */
  action?: { label: string; run: () => void }
}

interface AppContextValue {
  settings: Settings | null
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  recordings: Recording[]
  refreshLibrary: () => Promise<void>
  status: RecordingStatus
  job: JobProgress | null
  microphones: AudioInputDevice[]
  page: Page
  setPage: (page: Page) => void
  editingId: string | null
  openEditor: (id: string) => void
  closeEditor: () => void
  toasts: Toast[]
  pushToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
}

const AppContext = createContext<AppContextValue | null>(null)

const IDLE_STATUS: RecordingStatus = { state: 'idle', elapsedMs: 0, mode: null }

export function AppProvider({ children }: { children: ReactNode }): JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [status, setStatus] = useState<RecordingStatus>(IDLE_STATUS)
  const [job, setJob] = useState<JobProgress | null>(null)
  const [microphones, setMicrophones] = useState<AudioInputDevice[]>([])
  const [page, setPage] = useState<Page>('capture')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const pushToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { ...toast, id }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((entry) => entry.id !== id))
    }, 5200)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((entry) => entry.id !== id))
  }, [])

  const refreshLibrary = useCallback(async () => {
    setRecordings(await api.library.list())
  }, [])

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings(await api.settings.update(patch))
  }, [])

  /* Chargement initial ------------------------------------------------ */

  useEffect(() => {
    void api.settings.get().then(setSettings)
    void api.recording.getStatus().then(setStatus)
    void refreshLibrary()
  }, [refreshLibrary])

  /* Abonnements ------------------------------------------------------- */

  useEffect(() => {
    const offSettings = api.settings.onChange(setSettings)
    const offLibrary = api.library.onChange(setRecordings)
    const offNotice = api.system.onNotice((notice) =>
      pushToast({ tone: notice.tone, title: notice.title, detail: notice.detail })
    )
    const offNavigate = internal.navigate((target) => {
      if (target === 'library' || target === 'settings' || target === 'capture') {
        setPage(target)
        setEditingId(null)
      }
    })
    return () => {
      offSettings()
      offLibrary()
      offNotice()
      offNavigate()
    }
  }, [pushToast])

  useEffect(() => {
    return api.recording.onStatus((next) => {
      setStatus((previous) => {
        // Un échec passe aussi par `processing → idle` : il ne doit pas être
        // annoncé comme une réussite.
        if (previous.state === 'processing' && next.state === 'idle' && !next.error) {
          pushToast({ tone: 'success', title: 'Enregistrement sauvegardé' })
          void refreshLibrary()
        }
        if (next.error) {
          pushToast({ tone: 'danger', title: 'Enregistrement interrompu', detail: next.error })
        }
        return next
      })
    })
  }, [pushToast, refreshLibrary])

  useEffect(() => {
    return api.editor.onJobProgress((progress) => {
      setJob(progress.done ? null : progress)
      if (progress.done && progress.error) {
        pushToast({ tone: 'danger', title: progress.label, detail: progress.error })
      }
    })
  }, [pushToast])

  /* Liste des micros -------------------------------------------------- */

  const micEnabled = settings?.captureMicrophone ?? false

  useEffect(() => {
    const load = async (): Promise<void> => {
      // Les libellés restent vides tant que le micro n'a jamais été autorisé.
      // On ne déclenche la demande que si l'utilisateur a activé le micro :
      // sinon AsleRec réclamerait l'accès au micro à chaque démarrage.
      if (micEnabled) {
        try {
          const granted = await navigator.mediaDevices.getUserMedia({ audio: true })
          granted.getTracks().forEach((track) => track.stop())
        } catch {
          /* refus possible : la liste reste anonyme */
        }
      }
      const devices = await navigator.mediaDevices.enumerateDevices()
      setMicrophones(
        devices
          .filter((device) => device.kind === 'audioinput')
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `Microphone ${index + 1}`
          }))
      )
    }
    void load()
    navigator.mediaDevices.addEventListener('devicechange', load)
    return () => navigator.mediaDevices.removeEventListener('devicechange', load)
  }, [micEnabled])

  const value = useMemo<AppContextValue>(
    () => ({
      settings,
      updateSettings,
      recordings,
      refreshLibrary,
      status,
      job,
      microphones,
      page,
      setPage: (next: Page) => {
        setPage(next)
        setEditingId(null)
      },
      editingId,
      openEditor: setEditingId,
      closeEditor: () => setEditingId(null),
      toasts,
      pushToast,
      dismissToast
    }),
    [
      settings,
      updateSettings,
      recordings,
      refreshLibrary,
      status,
      job,
      microphones,
      page,
      editingId,
      toasts,
      pushToast,
      dismissToast
    ]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp doit être utilisé dans <AppProvider>.')
  return context
}
