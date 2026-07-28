import { useEffect, useState } from 'react'

import { IconClose, IconMaximize, IconMinimize, IconRestore } from './icons'

const api = window.aslerec

/**
 * Barre de titre maison. La fenêtre native est sans cadre : la zone centrale
 * sert de poignée de déplacement, les trois boutons pilotent la fenêtre.
 */
export function Titlebar(): JSX.Element {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => api.system.onWindowState(({ maximized: next }) => setMaximized(next)), [])

  return (
    <header className="titlebar drag-region">
      <div className="titlebar__brand">
        <span className="titlebar__mark" aria-hidden="true">
          <span className="titlebar__mark-dot" />
        </span>
        <span className="titlebar__name">AsleRec</span>
      </div>

      <div className="titlebar__controls no-drag">
        <button
          type="button"
          className="win-btn"
          onClick={() => void api.system.minimize()}
          aria-label="Réduire"
        >
          <IconMinimize size={16} />
        </button>
        <button
          type="button"
          className="win-btn"
          onClick={() => void api.system.toggleMaximize()}
          aria-label={maximized ? 'Restaurer' : 'Agrandir'}
        >
          {maximized ? <IconRestore size={16} /> : <IconMaximize size={16} />}
        </button>
        <button
          type="button"
          className="win-btn win-btn--close"
          onClick={() => void api.system.close()}
          aria-label="Fermer"
          title="Fermer — AsleRec reste dans la zone de notification"
        >
          <IconClose size={16} />
        </button>
      </div>
    </header>
  )
}
