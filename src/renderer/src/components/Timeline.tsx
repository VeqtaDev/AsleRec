import { useCallback, useEffect, useRef, useState } from 'react'

import { formatPrecise } from '../lib/format'

type DragTarget = 'start' | 'end' | 'playhead' | null

interface TimelineProps {
  duration: number
  currentTime: number
  selection: { start: number; end: number }
  onSelectionChange: (selection: { start: number; end: number }) => void
  onSeek: (time: number) => void
}

/** Écart minimum entre les deux poignées, en secondes. */
const MIN_SPAN = 0.1

/**
 * Piste de montage : une poignée d'entrée, une poignée de sortie et une tête
 * de lecture. Tout se manipule à la souris, avec un repli clavier sur les
 * poignées pour l'accessibilité.
 */
export function Timeline({
  duration,
  currentTime,
  selection,
  onSelectionChange,
  onSeek
}: TimelineProps): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<DragTarget>(null)

  const timeAt = useCallback(
    (clientX: number): number => {
      const track = trackRef.current
      if (!track || duration <= 0) return 0
      const rect = track.getBoundingClientRect()
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      return ratio * duration
    },
    [duration]
  )

  useEffect(() => {
    if (!dragging) return

    const onMove = (event: PointerEvent): void => {
      const time = timeAt(event.clientX)
      if (dragging === 'start') {
        onSelectionChange({
          start: Math.min(time, selection.end - MIN_SPAN),
          end: selection.end
        })
        onSeek(Math.min(time, selection.end - MIN_SPAN))
      } else if (dragging === 'end') {
        onSelectionChange({
          start: selection.start,
          end: Math.max(time, selection.start + MIN_SPAN)
        })
        onSeek(Math.max(time, selection.start + MIN_SPAN))
      } else {
        onSeek(time)
      }
    }

    const onUp = (): void => setDragging(null)

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragging, onSeek, onSelectionChange, selection.end, selection.start, timeAt])

  const percent = (time: number): string =>
    `${duration > 0 ? (time / duration) * 100 : 0}%`

  const nudge = (target: 'start' | 'end', delta: number): void => {
    if (target === 'start') {
      onSelectionChange({
        start: Math.max(0, Math.min(selection.start + delta, selection.end - MIN_SPAN)),
        end: selection.end
      })
    } else {
      onSelectionChange({
        start: selection.start,
        end: Math.min(duration, Math.max(selection.end + delta, selection.start + MIN_SPAN))
      })
    }
  }

  return (
    <div className="timeline">
      <div className="timeline__times">
        <span>{formatPrecise(selection.start)}</span>
        <span className="timeline__span">
          sélection {formatPrecise(selection.end - selection.start)}
        </span>
        <span>{formatPrecise(selection.end)}</span>
      </div>

      <div
        className="timeline__track"
        ref={trackRef}
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget && !(event.target as HTMLElement).classList.contains('timeline__rail')) {
            return
          }
          setDragging('playhead')
          onSeek(timeAt(event.clientX))
        }}
      >
        <div className="timeline__rail" />

        <div
          className="timeline__selection"
          style={{ left: percent(selection.start), right: `${100 - (selection.end / Math.max(duration, 0.001)) * 100}%` }}
        />

        <div className="timeline__playhead" style={{ left: percent(currentTime) }}>
          <span className="timeline__playhead-knob" />
        </div>

        <button
          type="button"
          className="timeline__handle timeline__handle--start"
          style={{ left: percent(selection.start) }}
          onPointerDown={(event) => {
            event.stopPropagation()
            setDragging('start')
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') nudge('start', -0.1)
            if (event.key === 'ArrowRight') nudge('start', 0.1)
          }}
          aria-label="Début de la sélection"
        >
          <span />
        </button>

        <button
          type="button"
          className="timeline__handle timeline__handle--end"
          style={{ left: percent(selection.end) }}
          onPointerDown={(event) => {
            event.stopPropagation()
            setDragging('end')
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') nudge('end', -0.1)
            if (event.key === 'ArrowRight') nudge('end', 0.1)
          }}
          aria-label="Fin de la sélection"
        >
          <span />
        </button>
      </div>
    </div>
  )
}
