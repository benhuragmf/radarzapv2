import { useState } from 'react'
import { Check, ChevronDown, Crown, ExternalLink, Gem, Moon, Palette, Sparkles, Sun } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { cn } from '@/lib/utils'
import {
  WEBCHAT_PREMIUM_TEMPLATES,
  WEBCHAT_STANDARD_TEMPLATES,
  webChatPreviewUrl,
  type WebChatAppearancePreset,
  type WebChatPreviewTemplate,
} from '@/lib/webchatPreviewTemplates'
import type { ChatBoxModel } from '@/lib/chatBoxModels'
import { ChatBoxModelsSection } from './chat-box/ChatBoxModelsSection'

type Props = {
  publicKey?: string
  selectedTemplateId?: string | null
  selectedChatBoxModelId?: string | null
  userPlan?: string | null
  onSelectTemplate?: (template: WebChatPreviewTemplate) => void
  onApplyAppearance?: (appearance: WebChatAppearancePreset) => void
  onApplyChatBoxModel?: (model: ChatBoxModel) => void
  compact?: boolean
}

function StandardThumbnail({ template }: { template: WebChatPreviewTemplate }) {
  const isDark = template.appearance.theme === 'dark'
  const primary = template.appearance.primaryColor

  return (
    <div
      className={cn(
        'relative h-[6.5rem] overflow-hidden border-b border-[var(--rz-border)]/50',
        template.thumbClass,
      )}
    >
      {template.id === 'copilot' && (
        <>
          <div
            className="pointer-events-none absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                'linear-gradient(rgba(99,102,241,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,.14) 1px, transparent 1px)',
              backgroundSize: '12px 12px',
            }}
          />
          <div className="pointer-events-none absolute -right-4 top-2 h-20 w-20 rounded-full bg-indigo-500/30 blur-2xl" />
        </>
      )}
      {template.id === 'tech' && (
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(rgba(34,211,238,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.12) 1px, transparent 1px)',
            backgroundSize: '14px 14px',
          }}
        />
      )}
      {template.id === 'saas' && (
        <>
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute bottom-4 left-4 h-16 w-16 rounded-full bg-fuchsia-300/20 blur-xl" />
        </>
      )}
      {template.id === 'minimal' && (
        <div className="pointer-events-none absolute inset-4 rounded-lg border border-zinc-200/80" />
      )}

      <div className="relative z-[1] flex items-center gap-1 px-2.5 pt-2">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400/90" />
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400/90" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/90" />
      </div>

      <div className="relative z-[1] px-3 pt-1.5">
        <div
          className={cn(
            'h-1.5 rounded-full',
            isDark ? 'w-[70%] bg-white/25' : template.id === 'saas' ? 'w-[65%] bg-white/35' : 'w-[70%] bg-slate-300/70',
          )}
        />
        <div
          className={cn(
            'mt-1 h-1 rounded-full',
            isDark ? 'w-[45%] bg-white/15' : 'w-[40%] bg-slate-200/80',
          )}
        />
      </div>

      <div className="absolute bottom-2 right-2 z-[2] flex flex-col items-end gap-1">
        {template.id !== 'minimal' && (
          <div
            className={cn(
              'w-[4.5rem] overflow-hidden rounded-md border shadow-md',
              isDark ? 'border-cyan-500/25 bg-slate-900/95' : 'border-black/10 bg-white/95',
            )}
          >
            <div
              className="px-1 py-0.5 text-[6px] font-semibold text-white"
              style={{ background: primary }}
            >
              {template.appearance.title.slice(0, 10)}
            </div>
          </div>
        )}
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-xs text-white shadow-md"
          style={{ backgroundColor: primary }}
        >
          💬
        </div>
      </div>
    </div>
  )
}

function PremiumThumbnail({ template }: { template: WebChatPreviewTemplate }) {
  const isLuxe = template.id === 'luxe'
  const primary = template.appearance.primaryColor

  return (
    <div
      className={cn(
        'relative min-h-[11rem] overflow-hidden rounded-xl border',
        isLuxe
          ? 'border-amber-300/40 bg-gradient-to-br from-[#faf6f0] via-[#f5ebe0] to-[#ede0d4]'
          : 'border-amber-500/20 bg-gradient-to-br from-[#0a0f1a] via-[#111827] to-[#1a1508]',
      )}
    >
      {isLuxe ? (
        <>
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-200/40 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-amber-100/80 to-transparent" />
          <div className="pointer-events-none absolute left-4 top-10 h-px w-20 bg-gradient-to-r from-amber-600/60 to-transparent" />
        </>
      ) : (
        <>
          <div className="pointer-events-none absolute -right-6 top-0 h-28 w-28 rounded-full bg-amber-500/20 blur-3xl" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(201,169,98,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(201,169,98,.3) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />
        </>
      )}

      <div className="relative z-[1] p-3">
        <div className="flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', isLuxe ? 'bg-red-300' : 'bg-red-400/80')} />
          <span className={cn('h-2 w-2 rounded-full', isLuxe ? 'bg-amber-300' : 'bg-amber-400/80')} />
          <span className={cn('h-2 w-2 rounded-full', isLuxe ? 'bg-emerald-300' : 'bg-emerald-400/80')} />
          <span
            className={cn(
              'ml-2 text-[8px] font-medium uppercase tracking-[0.12em]',
              isLuxe ? 'text-amber-800/50' : 'text-amber-400/50',
            )}
          >
            preview.live
          </span>
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <div>
            <div
              className={cn(
                'font-serif text-sm font-semibold leading-tight',
                isLuxe ? 'text-amber-950' : 'text-amber-100',
              )}
            >
              {isLuxe ? 'Maison Élégance' : 'Sterling & Partners'}
            </div>
            <div
              className={cn(
                'mt-1.5 h-1.5 w-[85%] rounded-full',
                isLuxe ? 'bg-amber-900/10' : 'bg-white/10',
              )}
            />
            <div
              className={cn(
                'mt-1 h-1 w-[60%] rounded-full',
                isLuxe ? 'bg-amber-900/8' : 'bg-white/6',
              )}
            />
            <div className="mt-2.5 flex gap-1">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className={cn(
                    'h-8 flex-1 rounded-md border',
                    isLuxe
                      ? 'border-amber-200/60 bg-white/70'
                      : 'border-amber-500/15 bg-white/5',
                  )}
                />
              ))}
            </div>
            <div
              className={cn(
                'mt-2 h-6 rounded-md border',
                isLuxe ? 'border-amber-200/50 bg-white/50' : 'border-amber-500/10 bg-white/3',
              )}
            />
          </div>

          <div className="flex flex-col items-end justify-end gap-1.5 pb-0.5">
            <div
              className={cn(
                'w-[6.5rem] overflow-hidden rounded-xl border-2 shadow-2xl',
                isLuxe
                  ? 'border-amber-200/80 bg-white'
                  : 'border-amber-500/30 bg-slate-900/95',
              )}
            >
              <div
                className="flex items-center gap-1 px-2 py-1.5 text-[8px] font-semibold text-white"
                style={{
                  background: isLuxe
                    ? `linear-gradient(135deg, ${primary}, #c4a574)`
                    : `linear-gradient(135deg, ${primary}, #8b6914)`,
                }}
              >
                <Gem className="h-2.5 w-2.5" />
                <span className="truncate">{template.appearance.title}</span>
              </div>
              <div className="space-y-1.5 p-2">
                <div
                  className={cn(
                    'ml-auto h-2 w-[88%] rounded-full',
                    isLuxe ? 'bg-amber-100' : 'bg-amber-400/25',
                  )}
                />
                <div
                  className={cn(
                    'h-1.5 w-[70%] rounded-full',
                    isLuxe ? 'bg-stone-100' : 'bg-white/10',
                  )}
                />
                <div
                  className={cn(
                    'h-4 rounded-md border',
                    isLuxe ? 'border-amber-100 bg-amber-50/50' : 'border-amber-500/10 bg-white/5',
                  )}
                />
              </div>
            </div>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-base text-white shadow-xl ring-2 ring-amber-300/40"
              style={{
                background: `linear-gradient(145deg, ${primary}, ${template.accentColor})`,
              }}
            >
              💬
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StandardCard({
  template,
  active,
  previewHref,
  onSelectTemplate,
  onApplyAppearance,
}: {
  template: WebChatPreviewTemplate
  active: boolean
  previewHref?: string
  onSelectTemplate?: (t: WebChatPreviewTemplate) => void
  onApplyAppearance?: (a: WebChatAppearancePreset) => void
}) {
  const isDark = template.appearance.theme === 'dark'

  return (
    <article
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border bg-[var(--rz-surface)] transition-all',
        active
          ? 'border-brand-500/60 ring-1 ring-brand-500/25'
          : 'border-[var(--rz-border)] hover:border-[var(--rz-border)] hover:shadow-sm',
      )}
    >
      <StandardThumbnail template={template} />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h5 className="text-sm font-medium text-[var(--rz-text)]">{template.name}</h5>
            <p className="mt-0.5 line-clamp-2 text-[10px] text-[var(--rz-text-muted)]">
              {template.description}
            </p>
          </div>
          <span
            className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10"
            style={{ backgroundColor: template.appearance.primaryColor }}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {template.tags.slice(0, 2).map(tag => (
            <span
              key={tag}
              className="rounded-full bg-[var(--rz-surface-muted)] px-1.5 py-0.5 text-[9px] text-[var(--rz-text-muted)]"
            >
              {tag}
            </span>
          ))}
          <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--rz-surface-muted)] px-1.5 py-0.5 text-[9px] text-[var(--rz-text-muted)]">
            {isDark ? <Moon className="h-2.5 w-2.5" /> : <Sun className="h-2.5 w-2.5" />}
          </span>
        </div>
        <div className="mt-auto flex gap-1 pt-1">
          {previewHref ? (
            <a href={previewHref} target="_blank" rel="noreferrer">
              <Button type="button" variant="secondary" size="sm">
                <ExternalLink className="h-3 w-3" />
                Abrir
              </Button>
            </a>
          ) : (
            <Button type="button" variant="secondary" size="sm" disabled>
              <ExternalLink className="h-3 w-3" />
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
              <Palette className="h-3 w-3" />
              {active ? 'Ativo' : 'Aplicar'}
            </Button>
          ) : onApplyAppearance ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onApplyAppearance(template.appearance)}
            >
              <Palette className="h-3 w-3" />
              Aplicar
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function PremiumCard({
  template,
  active,
  previewHref,
  onSelectTemplate,
  onApplyAppearance,
}: {
  template: WebChatPreviewTemplate
  active: boolean
  previewHref?: string
  onSelectTemplate?: (t: WebChatPreviewTemplate) => void
  onApplyAppearance?: (a: WebChatAppearancePreset) => void
}) {
  const isLuxe = template.id === 'luxe'
  const isDark = template.appearance.theme === 'dark'

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-2xl p-[2px] transition-all duration-300',
        active
          ? 'shadow-lg shadow-amber-500/20'
          : 'hover:shadow-xl hover:shadow-amber-500/15',
      )}
      style={{
        background: active
          ? 'linear-gradient(135deg, #fbbf24, #d97706, #b45309, #fbbf24)'
          : 'linear-gradient(135deg, rgba(251,191,36,.55), rgba(217,119,6,.35), rgba(180,83,9,.25), rgba(251,191,36,.45))',
      }}
    >
      <div
        className={cn(
          'relative flex h-full flex-col overflow-hidden rounded-[14px]',
          isLuxe ? 'bg-[#fffcf8]' : 'bg-[#0c1018]',
        )}
      >
        <div
          className={cn(
            'flex items-center justify-between border-b px-4 py-2.5',
            isLuxe
              ? 'border-amber-200/60 bg-gradient-to-r from-amber-50 to-transparent'
              : 'border-amber-500/15 bg-gradient-to-r from-amber-950/40 to-transparent',
          )}
        >
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em]',
              isLuxe ? 'text-amber-800' : 'text-amber-400',
            )}
          >
            <Crown className="h-3.5 w-3.5" />
            Coleção Premium
          </span>
          {active && <Badge variant="green" label="Aplicado" />}
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[1.15fr_1fr] lg:items-start">
          <PremiumThumbnail template={template} />

          <div className="flex flex-col gap-3">
            <div>
              <h3
                className={cn(
                  'text-xl font-bold tracking-tight',
                  isLuxe ? 'text-amber-950' : 'text-amber-50',
                )}
              >
                {template.name}
              </h3>
              <p
                className={cn(
                  'mt-1.5 text-sm leading-relaxed',
                  isLuxe ? 'text-amber-900/70' : 'text-slate-400',
                )}
              >
                {template.description}
              </p>
            </div>

            <p
              className={cn(
                'text-xs',
                isLuxe ? 'text-amber-800/60' : 'text-amber-500/70',
              )}
            >
              <span className="font-semibold">Ideal para:</span> {template.bestFor}
            </p>

            <ul className="space-y-1.5">
              {(template.highlights ?? []).map(item => (
                <li
                  key={item}
                  className={cn(
                    'flex items-start gap-2 text-[11px] leading-snug',
                    isLuxe ? 'text-amber-900/80' : 'text-slate-400',
                  )}
                >
                  <Check
                    className={cn(
                      'mt-0.5 h-3.5 w-3.5 shrink-0',
                      isLuxe ? 'text-amber-600' : 'text-amber-500',
                    )}
                  />
                  {item}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-1.5">
              {template.tags.map(tag => (
                <span
                  key={tag}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[10px] font-medium',
                    isLuxe
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-amber-500/15 text-amber-300',
                  )}
                >
                  {tag}
                </span>
              ))}
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium',
                  isLuxe ? 'bg-stone-100 text-stone-600' : 'bg-slate-800 text-slate-400',
                )}
              >
                {isDark ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
                Tema {isDark ? 'escuro' : 'claro'}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap gap-2">
              {previewHref ? (
                <a href={previewHref} target="_blank" rel="noreferrer">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className={isLuxe ? '' : 'border-amber-500/20 bg-slate-800 text-amber-100 hover:bg-slate-700'}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver landing completa
                  </Button>
                </a>
              ) : (
                <Button type="button" variant="secondary" size="sm" disabled>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver landing completa
                </Button>
              )}
              {onSelectTemplate ? (
                <Button
                  type="button"
                  size="sm"
                  className={cn(
                    active
                      ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                      : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border-0 shadow-md shadow-amber-500/25',
                  )}
                  onClick={() => onSelectTemplate(template)}
                >
                  <Gem className="h-3.5 w-3.5" />
                  {active ? 'Premium aplicado' : 'Aplicar premium'}
                </Button>
              ) : onApplyAppearance ? (
                <Button
                  type="button"
                  size="sm"
                  className="bg-gradient-to-r from-amber-500 to-amber-600 text-white border-0"
                  onClick={() => onApplyAppearance(template.appearance)}
                >
                  <Gem className="h-3.5 w-3.5" />
                  Aplicar premium
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

export function WebChatPreviewTemplates({
  publicKey,
  selectedTemplateId,
  selectedChatBoxModelId,
  userPlan,
  onSelectTemplate,
  onApplyAppearance,
  onApplyChatBoxModel,
  compact = false,
}: Props) {
  const premiumActive = WEBCHAT_PREMIUM_TEMPLATES.some(t => t.id === selectedTemplateId)
  const [premiumOpen, setPremiumOpen] = useState(false)

  return (
    <div className={cn('space-y-6', compact && 'space-y-5')}>
      {!compact && (
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-[var(--rz-text)]">
            <Sparkles className="h-4 w-4 text-brand-400" />
            Modelos de página de teste
          </h4>
          <p className="mt-1 text-xs text-[var(--rz-text-muted)]">
            Simule sites reais com o widget embedado. Os modelos essenciais cobrem a maioria dos
            casos; a coleção premium traz landings completas para marcas de alto padrão.
          </p>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-[var(--rz-text-muted)]">
            Modelos essenciais
          </h5>
          <div className="h-px flex-1 bg-[var(--rz-border)]" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {WEBCHAT_STANDARD_TEMPLATES.map(template => (
            <StandardCard
              key={template.id}
              template={template}
              active={selectedTemplateId === template.id}
              previewHref={publicKey ? webChatPreviewUrl(template.path, publicKey) : undefined}
              onSelectTemplate={onSelectTemplate}
              onApplyAppearance={onApplyAppearance}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setPremiumOpen(open => !open)}
          className={cn(
            'flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition-colors',
            premiumOpen
              ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/[0.08] via-transparent to-amber-600/[0.04]'
              : 'border-amber-500/20 bg-gradient-to-br from-amber-500/[0.04] to-transparent hover:border-amber-500/35 hover:from-amber-500/[0.07]',
          )}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-amber-500/30">
              <Crown className="h-4 w-4" />
              Coleção Premium
            </span>
            <p className="text-xs text-[var(--rz-text-muted)]">
              {WEBCHAT_PREMIUM_TEMPLATES.length} modelos · landings completas · Luxe e Obsidian
            </p>
            {premiumActive && !premiumOpen && (
              <Badge variant="green" label="Premium em uso" />
            )}
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            {premiumOpen ? 'Recolher' : 'Abrir coleção'}
            <ChevronDown
              className={cn('h-4 w-4 transition-transform duration-200', premiumOpen && 'rotate-180')}
            />
          </span>
        </button>

        {premiumOpen && (
          <div
            className={cn(
              'rounded-xl border p-4',
              'border-amber-500/25 bg-gradient-to-br from-amber-500/[0.06] via-transparent to-amber-600/[0.03]',
            )}
          >
            <div className="grid gap-4">
              {WEBCHAT_PREMIUM_TEMPLATES.map(template => (
                <PremiumCard
                  key={template.id}
                  template={template}
                  active={selectedTemplateId === template.id}
                  previewHref={publicKey ? webChatPreviewUrl(template.path, publicKey) : undefined}
                  onSelectTemplate={onSelectTemplate}
                  onApplyAppearance={onApplyAppearance}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {!compact && onApplyChatBoxModel && (
        <ChatBoxModelsSection
          selectedChatBoxModelId={selectedChatBoxModelId}
          userPlan={userPlan}
          onApplyModel={onApplyChatBoxModel}
        />
      )}

      {!publicKey && (
        <p className="rounded-lg border border-dashed border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/40 px-3 py-2 text-xs text-[var(--rz-text-muted)]">
          Crie um widget na aba <strong className="text-[var(--rz-text-secondary)]">Widgets</strong>{' '}
          para abrir os previews com sua chave automaticamente.
        </p>
      )}
    </div>
  )
}
