import { useEffect, useState } from 'react'

import { formatAccelerator } from '../lib/format'

/** Touches qui ne peuvent pas constituer un raccourci à elles seules. */
const MODIFIERS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'OS'])

interface HotkeyFieldProps {
  value: string
  onChange: (accelerator: string) => void
}

/**
 * Champ de capture de raccourci : au clic, la prochaine combinaison pressée
 * devient l'accélérateur. Une touche sans modificateur est refusée, sinon on
 * confisquerait une lettre à l'ensemble du système.
 */
export function HotkeyField({ value, onChange }: HotkeyFieldProps): JSX.Element {
  const [listening, setListening] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    if (!listening) return

    const onKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault()
      event.stopPropagation()

      if (event.key === 'Escape') {
        setListening(false)
        setWarning(null)
        return
      }
      if (MODIFIERS.has(event.key)) return

      const parts: string[] = []
      if (event.ctrlKey) parts.push('Control')
      if (event.shiftKey) parts.push('Shift')
      if (event.altKey) parts.push('Alt')
      if (event.metaKey) parts.push('Super')

      if (parts.length === 0) {
        setWarning('Ajoutez au moins Ctrl, Alt ou Maj.')
        return
      }

      parts.push(normalizeKey(event))
      setListening(false)
      setWarning(null)
      onChange(parts.join('+'))
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [listening, onChange])

  return (
    <div className="hotkey">
      <button
        type="button"
        className={`hotkey__field ${listening ? 'is-listening' : ''}`}
        onClick={() => {
          setListening((current) => !current)
          setWarning(null)
        }}
      >
        {listening ? (
          <span className="hotkey__prompt">Appuyez sur la combinaison…</span>
        ) : (
          formatAccelerator(value)
            .split(' + ')
            .map((key) => <kbd key={key}>{key}</kbd>)
        )}
      </button>
      {warning && <span className="hotkey__warning">{warning}</span>}
    </div>
  )
}

/** Traduit un `KeyboardEvent` en nom de touche compris par Electron. */
function normalizeKey(event: KeyboardEvent): string {
  const code = event.code

  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return `num${code.slice(6).toLowerCase()}`
  if (/^F\d{1,2}$/.test(code)) return code

  const named: Record<string, string> = {
    Space: 'Space',
    Enter: 'Return',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Semicolon: ';',
    Quote: "'",
    Backquote: '`',
    Backslash: '\\',
    Comma: ',',
    Period: '.',
    Slash: '/'
  }

  return named[code] ?? event.key.toUpperCase()
}
