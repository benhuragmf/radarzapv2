import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  RADAR_CHAT_BRAND_URL,
  canRemoveBranding,
  resolveProductBrandingVisible,
} from '@/lib/brandingPlan'

type Props = {
  planId?: string | null
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
}

export function ProductBrandingFooterToggle({ planId, checked, onChange, className }: Props) {
  const locked = !canRemoveBranding(planId)
  const effectiveChecked = resolveProductBrandingVisible(planId, checked)

  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        className={cn(
          'flex items-start gap-2 text-sm',
          locked ? 'cursor-default opacity-90' : 'cursor-pointer',
        )}
      >
        <input
          type="checkbox"
          className="mt-0.5"
          checked={effectiveChecked}
          disabled={locked}
          onChange={e => {
            if (!locked) onChange(e.target.checked)
          }}
        />
        <span>
          Mostrar crédito Radar Chat no rodapé
          {locked ? (
            <span className="mt-0.5 block text-[10px] font-normal leading-snug text-[var(--rz-text-muted)]">
              Obrigatório no plano atual. Disponível para remover a partir do plano Pro.{' '}
              <a
                href={RADAR_CHAT_BRAND_URL}
                target="_blank"
                rel="noreferrer"
                className="text-brand-400 hover:text-brand-300"
              >
                Conheça a Radar Chat
              </a>
            </span>
          ) : (
            <span className="mt-0.5 block text-[10px] font-normal leading-snug text-[var(--rz-text-muted)]">
              Link discreto para{' '}
              <a
                href={RADAR_CHAT_BRAND_URL}
                target="_blank"
                rel="noreferrer"
                className="text-brand-400 hover:text-brand-300"
              >
                radarchat.com.br
              </a>
              . Você pode ocultar no plano Pro+.
            </span>
          )}
        </span>
      </label>
      {locked ? (
        <p className="text-[10px] text-[var(--rz-text-muted)]">
          Quer remover o crédito?{' '}
          <Link to="/plans" className="text-brand-400 hover:text-brand-300">
            Ver planos pagos
          </Link>
        </p>
      ) : null}
    </div>
  )
}
