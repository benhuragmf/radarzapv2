import { ExternalLink, Palette, Sparkles } from 'lucide-react'
import { Button } from '../ui/Button'
import { cn } from '@/lib/utils'
import {
  WEBCHAT_PREVIEW_TEMPLATES,
  webChatPreviewUrl,
  type WebChatAppearancePreset,
  type WebChatPreviewTemplate,
} from '@/lib/webchatPreviewTemplates'

type Props = {
  publicKey?: string
  selectedTemplateId?: string | null
  onSelectTemplate?: (template: WebChatPreviewTemplate) => void
  onApplyAppearance?: (appearance: WebChatAppearancePreset) => void
  compact?: boolean
}

export function WebChatPreviewTemplates({
  publicKey,
  selectedTemplateId,
  onSelectTemplate,
  onApplyAppearance,
  compact = false,
}: Props) {
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {!compact && (
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-[var(--rz-text)]">
            <Sparkles className="h-4 w-4 text-[var(--rz-primary)]" />
            Modelos de página de teste
          </h4>
          <p className="mt-1 text-xs text-[var(--rz-text-muted)]">
            Simulam sites externos com o widget embedado. Escolha um visual, abra em nova aba ou
            aplique cores e textos ao widget.
          </p>
        </div>
      )}

      <div
        className={cn(
          'grid gap-3',
          compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4',
        )}
      >
        {WEBCHAT_PREVIEW_TEMPLATES.map(template => {
          const active = selectedTemplateId === template.id
          const previewHref = publicKey ? webChatPreviewUrl(template.path, publicKey) : undefined

          return (
            <div
              key={template.id}
              className={cn(
                'overflow-hidden rounded-xl border transition-colors',
                active
                  ? 'border-[var(--rz-primary)] ring-1 ring-[var(--rz-primary)]/40'
                  : 'border-[var(--rz-border)]',
              )}
            >
              <div
                className={cn(
                  'relative h-20 border-b border-[var(--rz-border)]/60',
                  template.thumbClass,
                )}
              >
                <div className="absolute inset-0 flex items-end justify-end p-2">
                  <span
                    className="h-8 w-8 rounded-full shadow-md"
                    style={{ backgroundColor: template.appearance.primaryColor }}
                    title="Cor do botão"
                  />
                </div>
                {template.id === 'tech' && (
                  <div
                    className="pointer-events-none absolute inset-0 opacity-30"
                    style={{
                      backgroundImage:
                        'linear-gradient(rgba(34,211,238,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.15) 1px, transparent 1px)',
                      backgroundSize: '16px 16px',
                    }}
                  />
                )}
              </div>

              <div className="space-y-2 p-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--rz-text)]">{template.name}</div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--rz-text-muted)]">
                    {template.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {template.tags.map(tag => (
                    <span
                      key={tag}
                      className="rounded-full bg-[var(--rz-surface-elevated)] px-2 py-0.5 text-[10px] text-[var(--rz-text-muted)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {previewHref ? (
                    <a href={previewHref} target="_blank" rel="noreferrer">
                      <Button type="button" variant="secondary" size="sm">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir
                      </Button>
                    </a>
                  ) : (
                    <Button type="button" variant="secondary" size="sm" disabled title="Crie um widget primeiro">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir
                    </Button>
                  )}
                  {onSelectTemplate ? (
                    <Button
                      type="button"
                      variant={active ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => onSelectTemplate(template)}
                    >
                      <Palette className="h-3.5 w-3.5" />
                      {active ? 'Selecionado' : 'Aplicar ao widget'}
                    </Button>
                  ) : onApplyAppearance ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onApplyAppearance(template.appearance)}
                    >
                      <Palette className="h-3.5 w-3.5" />
                      Aplicar visual
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {!publicKey && (
        <p className="text-xs text-[var(--rz-text-muted)]">
          Crie um widget na aba Widgets para abrir os previews com sua chave automaticamente.
        </p>
      )}
    </div>
  )
}
