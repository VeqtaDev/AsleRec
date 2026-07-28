import { StrictMode, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

import type { OverlayInit } from '@shared/types'
import './styles/overlay.css'

const internal = window.aslerecInternal

interface Point {
  x: number
  y: number
}

interface Box {
  left: number
  top: number
  width: number
  height: number
}

function boxFrom(a: Point, b: Point): Box {
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y)
  }
}

const MIN_SIZE = 12

function Overlay(): JSX.Element {
  const [init, setInit] = useState<OverlayInit | null>(null)
  const [origin, setOrigin] = useState<Point | null>(null)
  const [box, setBox] = useState<Box | null>(null)
  const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 })
  const submitted = useRef(false)

  useEffect(() => internal.overlay.onInit(setInit), [])

  /** Convertit une zone en pixels CSS vers les pixels physiques de l'écran. */
  const submit = useCallback(
    (target: Box) => {
      if (!init || submitted.current) return
      if (target.width < MIN_SIZE || target.height < MIN_SIZE) return
      submitted.current = true
      const scale = init.scaleFactor
      internal.overlay.select(init.displayId, {
        x: Math.round(target.left * scale),
        y: Math.round(target.top * scale),
        width: Math.round(target.width * scale),
        height: Math.round(target.height * scale)
      })
    },
    [init]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        submitted.current = true
        internal.overlay.cancel()
      }
      if (event.key === 'Enter') {
        submit({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [submit])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button === 2) {
      submitted.current = true
      internal.overlay.cancel()
      return
    }
    if (event.button !== 0) return
    const point = { x: event.clientX, y: event.clientY }
    setOrigin(point)
    setBox({ left: point.x, top: point.y, width: 0, height: 0 })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    setCursor({ x: event.clientX, y: event.clientY })
    if (!origin) return
    setBox(boxFrom(origin, { x: event.clientX, y: event.clientY }))
  }

  const onPointerUp = (): void => {
    if (!origin || !box) return
    setOrigin(null)
    if (box.width < MIN_SIZE || box.height < MIN_SIZE) {
      setBox(null)
      return
    }
    submit(box)
  }

  const scale = init?.scaleFactor ?? 1
  const dragging = Boolean(origin)

  return (
    <div
      className="overlay-surface"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={(event) => event.preventDefault()}
    >
      {!box && (
        <>
          <div className="overlay-guide overlay-guide--v" style={{ left: cursor.x }} />
          <div className="overlay-guide overlay-guide--h" style={{ top: cursor.y }} />
        </>
      )}

      {box ? (
        <div
          className="overlay-selection"
          style={{
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height
          }}
        >
          <div className="overlay-thirds" />
          <span className="overlay-handle overlay-handle--tl" />
          <span className="overlay-handle overlay-handle--tr" />
          <span className="overlay-handle overlay-handle--bl" />
          <span className="overlay-handle overlay-handle--br" />
          <div
            className={`overlay-size ${box.top < 44 ? 'overlay-size--inside' : ''}`}
          >
            {Math.round(box.width * scale)} × {Math.round(box.height * scale)}
          </div>
        </div>
      ) : (
        <div className="overlay-dim" />
      )}

      {!dragging && (
        <div className="overlay-hint">
          <span className="overlay-hint__dot" />
          <strong>Tracez la zone à enregistrer</strong>
          <span className="overlay-hint__sep" />
          <kbd>Entrée</kbd> écran entier
          <span className="overlay-hint__sep" />
          <kbd>Échap</kbd> annuler
        </div>
      )}
    </div>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Overlay />
  </StrictMode>
)
