import { useState } from 'react'
import { ExternalLink, Eye, MessageCircle, Monitor, Smartphone } from 'lucide-react'
import { WebChatLivePreview } from '../WebChatLivePreview'
import { cn } from '@/lib/utils'

type PreviewMode = 'desktop' | 'mobile' | 'bubble' | 'open'

type Props = {
  publicKey: string
  selectedTemplateId: string | null
  reloadKey?: number
  /** PATCH visual em andamento — prévia ainda reflete o modelo salvo no servidor */
  applying?: boolean
  className?: string
}

export function WebChatWidgetPreviewPanel({
  publicKey,
  selectedTemplateId,
  reloadKey = 0,
  applying = false,
  className,
}: Props) {
  const [mode, setMode] = useState<PreviewMode>('desktop')
  const [mobileOpen, setMobileOpen] = useState(false)

  const previewInner = (
    <div
      className={cn(
        'mx-auto transition-all duration-200',
        mode === 'mobile' && 'max-w-[320px]',
        mode === 'bubble' && 'max-w-[200px] opacity-90',
      )}
    >
      <WebChatLivePreview
        publicKey={publicKey}
        selectedTemplateId={selectedTemplateId}
        reloadKey={reloadKey}
        compact={mode === 'bubble'}
        applying={applying}
      />
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
                ['open', MessageCircle, 'Chat aberto'],
                ['bubble', Eye, 'Balão'],
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
          {applying
            ? 'Aplicando modelo no servidor — a prévia atualiza ao concluir.'
            : 'Prévia aproximada. O comportamento real depende do site instalado.'}
        </p>
      </div>

      <div className="xl:sticky xl:top-28 xl:z-20 xl:max-h-[calc(100vh-7.5rem)]">
        <div className="hidden xl:block">{previewInner}</div>

        <div className="xl:hidden">
          <ButtonPreviewToggle open={mobileOpen} onToggle={() => setMobileOpen(o => !o)} />
          {mobileOpen && <div className="mt-3">{previewInner}</div>}
        </div>
      </div>
    </div>
  )
}

function ButtonPreviewToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/40 px-3 py-2.5 text-sm font-medium text-[var(--rz-text-secondary)]"
    >
      <ExternalLink className="h-4 w-4" />
      {open ? 'Ocultar prévia' : 'Ver prévia do widget'}
    </button>
  )
}
