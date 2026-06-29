import { useId } from 'react'

interface BrandMarkProps {
  size?: number
  animated?: boolean
  className?: string
}

/** Ícone da marca com ondas de radar animadas. */
export function BrandMark({ size = 24, animated = true, className }: BrandMarkProps) {
  const uid = useId().replace(/:/g, '')
  const gradId = `rc-g-${uid}`

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 208 222"
      width={size}
      height={size}
      className={[
        'rz-brand-mark',
        animated ? 'rz-brand-mark--animated' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="img"
      aria-label="Radar Chat"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00D4FF" />
          <stop offset="0.55" stopColor="#2563EB" />
          <stop offset="1" stopColor="#22C55E" />
        </linearGradient>
      </defs>

      <g className="rz-brand-mark__bubble">
        <rect x="24" y="28" width="160" height="132" rx="42" fill={`url(#${gradId})`} />
        <path d="M74 160 L52 194 L110 162 Z" fill={`url(#${gradId})`} />
      </g>

      <g className="rz-brand-mark__core-wrap" style={{ transformOrigin: '94px 92px' }}>
        <circle className="rz-brand-mark__core" cx="94" cy="92" r="11" fill="#fff" />
      </g>

      <path
        className="rz-brand-mark__wave rz-brand-mark__wave-1"
        d="M113 74 C134 88 134 116 113 130"
        fill="none"
        stroke="#fff"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <path
        className="rz-brand-mark__wave rz-brand-mark__wave-2"
        d="M137 52 C177 82 177 136 137 166"
        fill="none"
        stroke="#fff"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        className="rz-brand-mark__wave rz-brand-mark__wave-3"
        d="M60 72 C43 90 43 114 60 132"
        fill="none"
        stroke="#fff"
        strokeWidth="10"
        strokeLinecap="round"
      />

      <g className="rz-brand-mark__ping" style={{ transformOrigin: '154px 48px' }}>
        <circle cx="154" cy="48" r="10" fill="#22C55E" stroke="#fff" strokeWidth="5" />
      </g>
    </svg>
  )
}
