import { useEffect, useRef, type ReactNode } from 'react'

import { IconCheck, IconChevronRight, IconClose } from './icons'

/* ------------------------------------------------------------------ */
/* Boutons                                                             */
/* ------------------------------------------------------------------ */

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'md' | 'lg'
  disabled?: boolean
  icon?: ReactNode
  full?: boolean
  title?: string
  type?: 'button' | 'submit'
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  disabled,
  icon,
  full,
  title,
  type = 'button'
}: ButtonProps): JSX.Element {
  return (
    <button
      type={type}
      className={`btn btn--${variant} btn--${size} ${full ? 'btn--full' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {icon}
      <span>{children}</span>
    </button>
  )
}

interface IconButtonProps {
  children: ReactNode
  onClick?: () => void
  label: string
  tone?: 'neutral' | 'danger'
  disabled?: boolean
}

export function IconButton({
  children,
  onClick,
  label,
  tone = 'neutral',
  disabled
}: IconButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className={`icon-btn icon-btn--${tone}`}
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Interrupteur façon iOS                                              */
/* ------------------------------------------------------------------ */

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
}

export function Toggle({ checked, onChange, disabled, label }: ToggleProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? 'toggle--on' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
    >
      <span className="toggle__knob" />
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Contrôle segmenté                                                   */
/* ------------------------------------------------------------------ */

interface SegmentedProps<T extends string | number> {
  value: T
  options: { value: T; label: string; hint?: string }[]
  onChange: (value: T) => void
  size?: 'md' | 'lg'
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size = 'md'
}: SegmentedProps<T>): JSX.Element {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  )

  return (
    <div className={`segmented segmented--${size}`} role="tablist">
      {/* Le curseur glisse d'un segment à l'autre au lieu d'apparaître sec. */}
      <span
        className="segmented__thumb"
        style={{
          width: `calc((100% - 8px) / ${options.length})`,
          transform: `translateX(calc(${index} * 100%))`
        }}
      />
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={`segmented__item ${option.value === value ? 'is-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          <span>{option.label}</span>
          {option.hint && <small>{option.hint}</small>}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Listes de réglages                                                  */
/* ------------------------------------------------------------------ */

export function Group({
  title,
  footnote,
  children
}: {
  title?: string
  footnote?: string
  children: ReactNode
}): JSX.Element {
  return (
    <section className="group">
      {title && <h2 className="group__title">{title}</h2>}
      <div className="group__body">{children}</div>
      {footnote && <p className="group__footnote">{footnote}</p>}
    </section>
  )
}

interface RowProps {
  icon?: ReactNode
  label: string
  description?: string
  children?: ReactNode
  onClick?: () => void
  chevron?: boolean
}

export function Row({
  icon,
  label,
  description,
  children,
  onClick,
  chevron
}: RowProps): JSX.Element {
  const content = (
    <>
      {icon && <span className="row__icon">{icon}</span>}
      <span className="row__text">
        <span className="row__label">{label}</span>
        {description && <span className="row__description">{description}</span>}
      </span>
      <span className="row__control">{children}</span>
      {chevron && <IconChevronRight size={17} className="row__chevron" />}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className="row row--interactive" onClick={onClick}>
        {content}
      </button>
    )
  }
  return <div className="row">{content}</div>
}

/* ------------------------------------------------------------------ */
/* Curseur                                                             */
/* ------------------------------------------------------------------ */

interface SliderProps {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  format?: (value: number) => string
}

export function Slider({
  value,
  min,
  max,
  step = 0.1,
  onChange,
  format
}: SliderProps): JSX.Element {
  const ratio = ((value - min) / (max - min)) * 100
  return (
    <div className="slider">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ ['--fill' as string]: `${ratio}%` }}
      />
      {format && <span className="slider__value">{format(value)}</span>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sélecteur                                                           */
/* ------------------------------------------------------------------ */

interface SelectProps<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  disabled?: boolean
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  disabled
}: SelectProps<T>): JSX.Element {
  return (
    <div className="select">
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <IconChevronRight size={15} className="select__chevron" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Feuille modale                                                      */
/* ------------------------------------------------------------------ */

interface SheetProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function Sheet({
  open,
  title,
  description,
  onClose,
  children,
  footer
}: SheetProps): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    panelRef.current?.focus()
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="sheet-backdrop" onPointerDown={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="sheet__head">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <IconButton label="Fermer" onClick={onClose}>
            <IconClose size={17} />
          </IconButton>
        </header>
        <div className="sheet__body">{children}</div>
        {footer && <footer className="sheet__foot">{footer}</footer>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Divers                                                              */
/* ------------------------------------------------------------------ */

export function Badge({
  children,
  tone = 'neutral'
}: {
  children: ReactNode
  tone?: 'neutral' | 'red'
}): JSX.Element {
  return <span className={`badge badge--${tone}`}>{children}</span>
}

export function Kbd({ combo }: { combo: string }): JSX.Element {
  return (
    <span className="kbd-combo">
      {combo.split(' + ').map((key) => (
        <kbd key={key}>{key}</kbd>
      ))}
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}): JSX.Element {
  return (
    <div className="empty">
      <span className="empty__icon">{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function CheckPill({ label }: { label: string }): JSX.Element {
  return (
    <span className="check-pill">
      <IconCheck size={13} />
      {label}
    </span>
  )
}
