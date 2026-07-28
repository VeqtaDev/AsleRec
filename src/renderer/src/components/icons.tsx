/**
 * Jeu d'icônes maison, tracé sur une grille de 24 px avec des extrémités
 * arrondies pour rester cohérent avec le reste de l'interface.
 */
interface IconProps {
  size?: number
  className?: string
}

function Svg({
  size = 20,
  className,
  strokeWidth = 1.7,
  children
}: IconProps & { strokeWidth?: number; children: React.ReactNode }): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function IconRegion(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M4 8.5V6.5A2.5 2.5 0 0 1 6.5 4h2" />
      <path d="M15.5 4h2A2.5 2.5 0 0 1 20 6.5v2" />
      <path d="M20 15.5v2a2.5 2.5 0 0 1-2.5 2.5h-2" />
      <path d="M8.5 20h-2A2.5 2.5 0 0 1 4 17.5v-2" />
      <circle cx="12" cy="12" r="2.6" />
    </Svg>
  )
}

export function IconFullscreen(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="2.5" y="4.5" width="19" height="13" rx="2.6" />
      <path d="M8.5 20.5h7" />
      <path d="M12 17.5v3" />
    </Svg>
  )
}

export function IconLibrary(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M10.4 9.6v4.8l4-2.4-4-2.4Z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconSettings(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.4 14.4a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47V21a2 2 0 0 1-4 0v-.11a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97H3a2 2 0 0 1 0-4h.11a1.6 1.6 0 0 0 1.47-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.77.32H9a1.6 1.6 0 0 0 .97-1.47V3a2 2 0 0 1 4 0v.11a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.77V9a1.6 1.6 0 0 0 1.47.97H21a2 2 0 0 1 0 4h-.11a1.6 1.6 0 0 0-1.47.97Z" />
    </Svg>
  )
}

export function IconScissors(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="6" cy="6.5" r="2.5" />
      <circle cx="6" cy="17.5" r="2.5" />
      <path d="M20 4 8.1 15.7" />
      <path d="M14.4 12.3 20 20" />
      <path d="M8.1 8.3 12 12" />
    </Svg>
  )
}

export function IconCrop(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M6.5 2.5v13a2 2 0 0 0 2 2h13" />
      <path d="M2.5 6.5h13a2 2 0 0 1 2 2v13" />
    </Svg>
  )
}

export function IconWave(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M3 12h1.6" />
      <path d="M7.4 8.4v7.2" />
      <path d="M11.1 5.4v13.2" />
      <path d="M14.8 9.2v5.6" />
      <path d="M18.5 7.2v9.6" />
      <path d="M21.6 11h-.2" />
    </Svg>
  )
}

export function IconFolder(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M3 8.2A2.2 2.2 0 0 1 5.2 6h3.4l2 2.4h8.2A2.2 2.2 0 0 1 21 10.6v6.2A2.2 2.2 0 0 1 18.8 19H5.2A2.2 2.2 0 0 1 3 16.8Z" />
    </Svg>
  )
}

export function IconTrash(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M4.5 7h15" />
      <path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7" />
      <path d="M6.4 7l.8 11.1A2 2 0 0 0 9.2 20h5.6a2 2 0 0 0 2-1.9L17.6 7" />
      <path d="M10.5 11v5M13.5 11v5" />
    </Svg>
  )
}

export function IconPlay(props: IconProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={props.size ?? 20}
      height={props.size ?? 20}
      className={props.className}
      aria-hidden="true"
    >
      <path
        d="M8 5.6c0-1 1.1-1.6 1.9-1l8 6.4c.7.5.7 1.5 0 2l-8 6.4c-.8.6-1.9 0-1.9-1V5.6Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconPause(props: IconProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={props.size ?? 20}
      height={props.size ?? 20}
      className={props.className}
      aria-hidden="true"
    >
      <rect x="7" y="5" width="3.6" height="14" rx="1.6" fill="currentColor" />
      <rect x="13.4" y="5" width="3.6" height="14" rx="1.6" fill="currentColor" />
    </svg>
  )
}

export function IconStop(props: IconProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={props.size ?? 20}
      height={props.size ?? 20}
      className={props.className}
      aria-hidden="true"
    >
      <rect x="5" y="5" width="14" height="14" rx="3.5" fill="currentColor" />
    </svg>
  )
}

export function IconClose(props: IconProps): JSX.Element {
  return (
    <Svg {...props} strokeWidth={2}>
      <path d="M6.6 6.6 17.4 17.4M17.4 6.6 6.6 17.4" />
    </Svg>
  )
}

export function IconChevronLeft(props: IconProps): JSX.Element {
  return (
    <Svg {...props} strokeWidth={2}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </Svg>
  )
}

export function IconChevronRight(props: IconProps): JSX.Element {
  return (
    <Svg {...props} strokeWidth={2}>
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </Svg>
  )
}

export function IconCheck(props: IconProps): JSX.Element {
  return (
    <Svg {...props} strokeWidth={2.4}>
      <path d="M5 12.8 9.6 17.4 19 7.2" />
    </Svg>
  )
}

export function IconSpeaker(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4Z" />
      <path d="M16.2 9.4a3.6 3.6 0 0 1 0 5.2" />
      <path d="M18.8 6.8a7.2 7.2 0 0 1 0 10.4" />
    </Svg>
  )
}

export function IconMic(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="9" y="2.8" width="6" height="11.4" rx="3" />
      <path d="M5.5 11.4a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.9V21" />
    </Svg>
  )
}

export function IconMinimize(props: IconProps): JSX.Element {
  return (
    <Svg {...props} strokeWidth={1.4}>
      <path d="M5 12h14" />
    </Svg>
  )
}

export function IconMaximize(props: IconProps): JSX.Element {
  return (
    <Svg {...props} strokeWidth={1.4}>
      <rect x="5.5" y="5.5" width="13" height="13" rx="2" />
    </Svg>
  )
}

export function IconRestore(props: IconProps): JSX.Element {
  return (
    <Svg {...props} strokeWidth={1.4}>
      <rect x="4.5" y="7.5" width="11" height="11" rx="2" />
      <path d="M8.2 7.5V6a2 2 0 0 1 2-2h7.3a2 2 0 0 1 2 2v7.3a2 2 0 0 1-2 2H16" />
    </Svg>
  )
}

export function IconSparkle(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.4l-1.9-5.6L4.5 11 10.1 9Z" />
      <path d="M18.5 4v3M20 5.5h-3" />
    </Svg>
  )
}

export function IconKeyboard(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="2.5" y="6" width="19" height="12" rx="2.6" />
      <path d="M6.4 9.6h.01M9.7 9.6h.01M13 9.6h.01M16.3 9.6h.01" />
      <path d="M6.4 12.8h.01M9.7 12.8h.01M13 12.8h.01M16.3 12.8h.01" />
      <path d="M8.4 15.6h7.2" />
    </Svg>
  )
}
