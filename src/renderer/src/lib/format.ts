/** Fonctions de formatage partagées par toutes les fenêtres. */

function pad(value: number): string {
  return String(Math.floor(value)).padStart(2, '0')
}

/** `1:07` en dessous d'une heure, `1:04:09` au-delà. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`
}

/** Chronomètre de l'enregistrement : toujours `mm:ss` ou `h:mm:ss`. */
export function formatTimer(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
}

/** Position sur la timeline, à la dixième de seconde près. */
export function formatPrecise(seconds: number): string {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const rest = safe % 60
  return `${pad(minutes)}:${rest.toFixed(1).padStart(4, '0')}`
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 Mo'
  const units = ['o', 'Ko', 'Mo', 'Go']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** index
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

const RELATIVE = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit'
})

/** « il y a 3 min » pour les enregistrements récents, date complète au-delà. */
export function formatWhen(timestamp: number): string {
  const deltaMs = Date.now() - timestamp
  const minutes = Math.round(deltaMs / 60_000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return RELATIVE.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return RELATIVE.format(-hours, 'hour')
  const days = Math.round(hours / 24)
  if (days < 7) return RELATIVE.format(-days, 'day')
  return DATE_FORMAT.format(timestamp)
}

/** Étiquette courte de définition : 1080p, 720p… */
export function formatResolution(width: number, height: number): string {
  if (!width || !height) return '—'
  return `${height}p`
}

/** Traduit un accélérateur Electron en libellé lisible sur Windows. */
export function formatAccelerator(accelerator: string): string {
  return accelerator
    .split('+')
    .map((part) => {
      if (part === 'Control' || part === 'CommandOrControl') return 'Ctrl'
      if (part === 'Alt') return 'Alt'
      if (part === 'Shift') return 'Maj'
      if (part === 'Super' || part === 'Meta') return 'Win'
      return part
    })
    .join(' + ')
}
