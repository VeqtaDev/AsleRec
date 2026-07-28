import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import type { RecordingStatus } from '@shared/types'
import { formatTimer } from './lib/format'
import './styles/controlbar.css'

const api = window.aslerec

const IDLE: RecordingStatus = { state: 'idle', elapsedMs: 0, mode: null }

function ControlBar(): JSX.Element {
  const [status, setStatus] = useState<RecordingStatus>(IDLE)

  useEffect(() => {
    void api.recording.getStatus().then(setStatus)
    return api.recording.onStatus(setStatus)
  }, [])

  if (status.state === 'countdown') {
    return (
      <div className="bar bar--countdown">
        <div className="countdown" key={status.countdownRemaining}>
          {status.countdownRemaining ?? ''}
        </div>
        <div className="countdown-label">Préparation…</div>
        <button
          type="button"
          className="bar-btn bar-btn--ghost"
          onClick={() => void api.recording.cancel()}
          title="Annuler"
        >
          <CloseIcon />
        </button>
      </div>
    )
  }

  if (status.state === 'processing') {
    return (
      <div className="bar">
        <div className="bar-spinner" />
        <div className="bar-processing">
          <span>Finalisation</span>
          <div className="bar-progress">
            <div
              className="bar-progress__fill"
              style={{ width: `${Math.round((status.progress ?? 0) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  const paused = status.state === 'paused'

  return (
    <div className={`bar ${paused ? 'bar--paused' : ''}`}>
      <span className={`rec-dot ${paused ? 'rec-dot--paused' : ''}`} />

      <span className="timer">{formatTimer(status.elapsedMs)}</span>

      <span className="bar-divider" />

      <button
        type="button"
        className="bar-btn"
        onClick={() => void api.recording.togglePause()}
        title={paused ? 'Reprendre' : 'Mettre en pause'}
      >
        {paused ? <PlayIcon /> : <PauseIcon />}
      </button>

      <button
        type="button"
        className="bar-btn bar-btn--stop"
        onClick={() => void api.recording.stop()}
        title="Arrêter et enregistrer"
      >
        <StopIcon />
      </button>

      <button
        type="button"
        className="bar-btn bar-btn--ghost"
        onClick={() => void api.recording.cancel()}
        title="Annuler sans enregistrer"
      >
        <CloseIcon />
      </button>
    </div>
  )
}

function PauseIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <rect x="7" y="5" width="3.6" height="14" rx="1.6" fill="currentColor" />
      <rect x="13.4" y="5" width="3.6" height="14" rx="1.6" fill="currentColor" />
    </svg>
  )
}

function PlayIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path d="M8 5.6c0-1 1.1-1.6 1.9-1l8 6.4c.7.5.7 1.5 0 2l-8 6.4c-.8.6-1.9 0-1.9-1V5.6Z" fill="currentColor" />
    </svg>
  )
}

function StopIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="3.5" fill="currentColor" />
    </svg>
  )
}

function CloseIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        d="M6.6 6.6 17.4 17.4M17.4 6.6 6.6 17.4"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ControlBar />
  </StrictMode>
)
