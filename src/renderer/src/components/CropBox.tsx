import { useEffect, useRef, useState } from 'react'

import type { Rect } from '@shared/types'

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e' | 'move'

interface CropBoxProps {
  /** Rectangle courant, exprimé en pixels de la vidéo source. */
  value: Rect
  onChange: (value: Rect) => void
  /** Dimensions natives de la vidéo. */
  sourceWidth: number
  sourceHeight: number
}

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const MIN_SIDE = 24

/**
 * Cadre de recadrage superposé au lecteur. Les coordonnées manipulées restent
 * toujours celles de la vidéo source : l'affichage n'est qu'une mise à
 * l'échelle, ce qui évite toute dérive lors du redimensionnement de la fenêtre.
 */
export function CropBox({
  value,
  onChange,
  sourceWidth,
  sourceHeight
}: CropBoxProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ handle: Handle; startX: number; startY: number; origin: Rect } | null>(
    null
  )

  useEffect(() => {
    if (!drag) return

    const scale = (): number => {
      const box = containerRef.current?.getBoundingClientRect()
      if (!box || !box.width) return 1
      return sourceWidth / box.width
    }

    const onMove = (event: PointerEvent): void => {
      const factor = scale()
      const dx = (event.clientX - drag.startX) * factor
      const dy = (event.clientY - drag.startY) * factor
      onChange(applyDrag(drag.handle, drag.origin, dx, dy, sourceWidth, sourceHeight))
    }

    const onUp = (): void => setDrag(null)

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [drag, onChange, sourceHeight, sourceWidth])

  const begin = (handle: Handle) => (event: React.PointerEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    setDrag({ handle, startX: event.clientX, startY: event.clientY, origin: value })
  }

  const style = {
    left: `${(value.x / sourceWidth) * 100}%`,
    top: `${(value.y / sourceHeight) * 100}%`,
    width: `${(value.width / sourceWidth) * 100}%`,
    height: `${(value.height / sourceHeight) * 100}%`
  }

  return (
    <div className="cropbox" ref={containerRef}>
      <div className="cropbox__frame" style={style} onPointerDown={begin('move')}>
        <div className="cropbox__thirds" />
        <span className="cropbox__size">
          {Math.round(value.width)} × {Math.round(value.height)}
        </span>
        {HANDLES.map((handle) => (
          <span
            key={handle}
            className={`cropbox__handle cropbox__handle--${handle}`}
            onPointerDown={begin(handle)}
          />
        ))}
      </div>
    </div>
  )
}

/** Applique un déplacement de poignée en gardant le cadre dans l'image. */
function applyDrag(
  handle: Handle,
  origin: Rect,
  dx: number,
  dy: number,
  maxWidth: number,
  maxHeight: number
): Rect {
  let { x, y, width, height } = origin

  if (handle === 'move') {
    x = Math.min(Math.max(0, origin.x + dx), maxWidth - origin.width)
    y = Math.min(Math.max(0, origin.y + dy), maxHeight - origin.height)
    return { x, y, width, height }
  }

  if (handle.includes('w')) {
    const nextX = Math.min(Math.max(0, origin.x + dx), origin.x + origin.width - MIN_SIDE)
    width = origin.width + (origin.x - nextX)
    x = nextX
  }
  if (handle.includes('e')) {
    width = Math.min(
      Math.max(MIN_SIDE, origin.width + dx),
      maxWidth - origin.x
    )
  }
  if (handle.includes('n')) {
    const nextY = Math.min(Math.max(0, origin.y + dy), origin.y + origin.height - MIN_SIDE)
    height = origin.height + (origin.y - nextY)
    y = nextY
  }
  if (handle.includes('s')) {
    height = Math.min(
      Math.max(MIN_SIDE, origin.height + dy),
      maxHeight - origin.y
    )
  }

  return { x, y, width, height }
}
