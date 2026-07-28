import { useApp } from '../state/app'
import { IconClose } from './icons'

export function Toasts(): JSX.Element {
  const { toasts, dismissToast, job } = useApp()

  return (
    <div className="toasts">
      {job && (
        <div className="toast toast--job">
          <div className="toast__spinner" />
          <div className="toast__text">
            <strong>{job.label}</strong>
            <div className="toast__progress">
              <div
                className="toast__progress-fill"
                style={{ width: `${Math.round(job.progress * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.tone}`}>
          <div className="toast__text">
            <strong>{toast.title}</strong>
            {toast.detail && <span>{toast.detail}</span>}
          </div>
          {toast.action && (
            <button type="button" className="toast__action" onClick={toast.action.run}>
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            className="toast__close"
            onClick={() => dismissToast(toast.id)}
            aria-label="Fermer"
          >
            <IconClose size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
