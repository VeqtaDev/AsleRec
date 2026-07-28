import { formatTimer } from '../lib/format'
import { useApp, type Page } from '../state/app'
import { IconFullscreen, IconLibrary, IconRegion, IconSettings } from './icons'

const NAV: { page: Page; label: string; icon: JSX.Element }[] = [
  { page: 'capture', label: 'Enregistrer', icon: <IconRegion size={19} /> },
  { page: 'library', label: 'Bibliothèque', icon: <IconLibrary size={19} /> },
  { page: 'settings', label: 'Réglages', icon: <IconSettings size={19} /> }
]

export function Sidebar(): JSX.Element {
  const { page, setPage, recordings, status } = useApp()
  const busy = status.state === 'recording' || status.state === 'paused'

  return (
    <nav className="sidebar">
      <ul className="sidebar__list">
        {NAV.map((item) => (
          <li key={item.page}>
            <button
              type="button"
              className={`nav-item ${page === item.page ? 'is-active' : ''}`}
              onClick={() => setPage(item.page)}
            >
              <span className="nav-item__icon">{item.icon}</span>
              <span className="nav-item__label">{item.label}</span>
              {item.page === 'library' && recordings.length > 0 && (
                <span className="nav-item__count">{recordings.length}</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {busy && (
        <div className="sidebar__live">
          <span className={`live-dot ${status.state === 'paused' ? 'live-dot--paused' : ''}`} />
          <div>
            <strong>{status.state === 'paused' ? 'En pause' : 'Enregistrement'}</strong>
            <span>{formatTimer(status.elapsedMs)}</span>
          </div>
        </div>
      )}

      <div className="sidebar__foot">
        <IconFullscreen size={15} />
        <span>Disponible dans la zone de notification</span>
      </div>
    </nav>
  )
}
