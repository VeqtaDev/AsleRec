import { Sidebar } from './components/Sidebar'
import { Titlebar } from './components/Titlebar'
import { Toasts } from './components/Toasts'
import { CapturePage } from './pages/CapturePage'
import { EditorPage } from './pages/EditorPage'
import { LibraryPage } from './pages/LibraryPage'
import { Onboarding } from './pages/Onboarding'
import { SettingsPage } from './pages/SettingsPage'
import { useApp } from './state/app'

export function App(): JSX.Element {
  const { settings, page, editingId } = useApp()

  if (!settings) {
    return (
      <div className="splash">
        <span className="splash__mark" />
      </div>
    )
  }

  if (!settings.onboardingCompleted) {
    return (
      <div className="app">
        <Titlebar />
        <Onboarding />
        <Toasts />
      </div>
    )
  }

  return (
    <div className="app">
      <Titlebar />
      <div className="app__body">
        <Sidebar />
        <main className="app__main" key={editingId ?? page}>
          {editingId ? (
            <EditorPage recordingId={editingId} />
          ) : page === 'capture' ? (
            <CapturePage />
          ) : page === 'library' ? (
            <LibraryPage />
          ) : (
            <SettingsPage />
          )}
        </main>
      </div>
      <Toasts />
    </div>
  )
}
