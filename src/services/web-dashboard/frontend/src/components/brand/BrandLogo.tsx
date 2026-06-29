import { useTheme } from '../../context/ThemeContext'
import { BrandMark } from './BrandMark'

type BrandLogoVariant = 'icon' | 'horizontal'

interface BrandLogoProps {
  variant?: BrandLogoVariant
  className?: string
  /** Altura em px (largura proporcional). */
  height?: number
  /** Força variante clara/escura (ex.: hero de auth sempre escuro). */
  tone?: 'light' | 'dark' | 'auto'
  /** Anima ondas de radar no ícone. */
  animated?: boolean
}

export function BrandLogo({
  variant = 'icon',
  className,
  height = 32,
  tone = 'auto',
  animated = true,
}: BrandLogoProps) {
  const { theme } = useTheme()
  const resolvedTone = tone === 'auto' ? theme : tone

  if (variant === 'horizontal') {
    const src =
      resolvedTone === 'dark' ? '/logo-horizontal-dark.svg' : '/logo-horizontal-light.svg'
    return (
      <img
        src={src}
        alt="Radar Chat"
        height={height}
        className={className}
        style={{ width: 'auto', height }}
      />
    )
  }

  return <BrandMark size={height} animated={animated} className={className} />
}
