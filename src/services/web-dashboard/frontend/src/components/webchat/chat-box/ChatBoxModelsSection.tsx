import {
  CHATBOX_FREE_MODELS,
  CHATBOX_PREMIUM_MODELS,
  CHATBOX_RESERVED_MODELS,
  canUsePremiumChatBoxModels,
  type ChatBoxModel,
} from '@/lib/chatBoxModels'
import { ChatBoxModelCard } from './ChatBoxModelCard'
import { cn } from '@/lib/utils'

type Props = {
  selectedChatBoxModelId?: string | null
  userPlan?: string | null
  onApplyModel?: (model: ChatBoxModel) => void
  /** Quando true, oculta título/descrição (ex.: aba pai já identifica a coleção). */
  embedded?: boolean
}

export function ChatBoxModelsSection({
  selectedChatBoxModelId,
  userPlan,
  onApplyModel,
  embedded = false,
}: Props) {
  const premiumAllowed = canUsePremiumChatBoxModels(userPlan)

  return (
    <section
      className={cn('space-y-6', !embedded && 'border-t border-[var(--rz-border)] pt-6')}
      aria-labelledby={embedded ? undefined : 'chatbox-models-heading'}
    >
      {!embedded && (
        <div>
          <h4 id="chatbox-models-heading" className="text-sm font-semibold text-[var(--rz-text-primary)]">
            Modelos de Chat Box
          </h4>
          <p className="mt-1 text-xs text-[var(--rz-text-muted)]">
            Escolha um modelo compacto de atendimento para aplicar no widget do seu site.
          </p>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <h5 className="text-xs font-semibold uppercase tracking-wider text-[var(--rz-text-muted)]">
            Grátis
          </h5>
          <p className="mt-1 text-xs text-[var(--rz-text-muted)]">
            Modelos gratuitos, leves e prontos para atendimento rápido.
          </p>
        </div>
        <div
          className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
          role="list"
        >
          {CHATBOX_FREE_MODELS.map(model => (
            <ChatBoxModelCard
              key={model.id}
              model={model}
              active={selectedChatBoxModelId === model.id}
              onApply={onApplyModel}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
            Premium (widget)
          </h5>
          {!premiumAllowed && (
            <span className="text-[10px] text-[var(--rz-text-muted)]">
              Faça upgrade para aplicar modelos premium.
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--rz-text-muted)]">
          Widgets avançados com experiência visual superior — distinto das landings premium (Luxe/Obsidian).
        </p>
        <div
          className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
          role="list"
        >
          {CHATBOX_PREMIUM_MODELS.map(model => (
            <ChatBoxModelCard
              key={model.id}
              model={model}
              active={selectedChatBoxModelId === model.id}
              locked={!premiumAllowed}
              onApply={onApplyModel}
            />
          ))}
        </div>
      </div>

      <p className="text-[10px] text-[var(--rz-text-muted)]">
        Próximos modelos reservados: {CHATBOX_RESERVED_MODELS.map(m => m.name).join(', ')}.
      </p>
    </section>
  )
}
