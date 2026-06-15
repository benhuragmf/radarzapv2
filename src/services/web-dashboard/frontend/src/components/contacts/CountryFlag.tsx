import * as Flags from 'country-flag-icons/react/3x2'

type FlagIso = keyof typeof Flags & string

/** Bandeira SVG local (sem CDN) — funciona offline e no Windows. */
export default function CountryFlag({
  iso,
  size = 20,
  className = '',
}: {
  iso: string
  size?: number
  className?: string
}) {
  const code = iso.toUpperCase() as FlagIso
  const Flag = Flags[code]
  const height = Math.round(size * (2 / 3))

  if (!Flag) {
    return (
      <span
        aria-hidden
        className={`inline-flex items-center justify-center rounded-sm bg-[var(--rz-surface-muted)] text-[9px] font-bold text-[var(--rz-text-secondary)] shrink-0 ${className}`}
        style={{ width: size, height }}
      >
        {code}
      </span>
    )
  }

  return (
    <Flag
      title=""
      aria-hidden
      className={`inline-block rounded-sm shrink-0 ${className}`}
      style={{ width: size, height: 'auto' }}
    />
  )
}
