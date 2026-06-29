import { useState } from 'react'
import { ExternalLink, Monitor, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { leadFormPreviewUrl } from '@/lib/leadFormEditorUtils'

type PreviewMode = 'desktop' | 'mobile'

type Props = {
  publicKey: string
  formName: string
  reloadKey?: number
  active?: boolean
  className?: string
}

const PREVIEW_HEIGHT = 480
const PREVIEW_HEIGHT_MOBILE = 520

export function LeadFormPreviewPanel({
  publicKey,
  formName,
  reloadKey = 0,
  active = true,
  className,
}: Props) {
  const [mode, setMode] = useState<PreviewMode>('desktop')
  const [mobileOpen, setMobileOpen] = useState(false)

  const href = leadFormPreviewUrl(publicKey, reloadKey || undefined)

  const previewInner = (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] shadow-lg shadow-black/10',
        mode === 'mobile' && 'mx-auto max-w-[320px]',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/30 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-medium text-[var(--rz-text-muted)]">
            Página de teste — Formulário Radar Chat
          </p>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-brand-400 hover:text-brand-300"
        >
          <ExternalLink className="h-3 w-3" />
          Nova aba
        </a>
      </div>
      <div
        className="overflow-hidden bg-white"
        style={{ height: mode === 'mobile' ? PREVIEW_HEIGHT_MOBILE : PREVIEW_HEIGHT }}
      >
        {!active ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-xs text-[var(--rz-text-muted)]">
            Formulário inativo — ative na Visão geral para ver a prévia ao vivo.
          </div>
        ) : (
          <iframe
            key={href}
            title={`Preview ${formName}`}
            src={href}
            className="h-full w-full border-0 bg-white"
            sandbox="allow-scripts allow-forms allow-same-origin"
          />
        )}
      </div>
    </div>
  )

  return (
    <div className={cn('space-y-2', className)}>
      <div className="hidden xl:block">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-[var(--rz-text)]">Pré-visualização</p>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ['desktop', Monitor, 'Desktop'],
                ['mobile', Smartphone, 'Mobile'],
              ] as const
            ).map(([id, Icon, label]) => (
              <button
                key={id}
                type="button"
                title={label}
                onClick={() => setMode(id)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors',
                  mode === id
                    ? 'border-brand-500/40 bg-brand-500/10 text-brand-300'
                    : 'border-[var(--rz-border)] text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)]',
                )}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden 2xl:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1 text-[10px] text-[var(--rz-text-muted)]">
          Prévia aproximada com config salva no servidor. Salve para atualizar após mudanças.
        </p>
      </div>

      <div className="xl:sticky xl:top-28 xl:z-20 xl:max-h-[calc(100vh-7.5rem)]">
        <div className="hidden xl:block">{previewInner}</div>
        <div className="xl:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(o => !o)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/40 px-3 py-2.5 text-sm font-medium text-[var(--rz-text-secondary)]"
          >
            <ExternalLink className="h-4 w-4" />
            {mobileOpen ? 'Ocultar prévia' : 'Ver prévia do formulário'}
          </button>
          {mobileOpen && <div className="mt-3">{previewInner}</div>}
        </div>
      </div>
    </div>
  )
}
