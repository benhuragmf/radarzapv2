import {
  CHATBOX_FREE_MODELS,
  CHATBOX_PREMIUM_MODELS,
  CHATBOX_RESERVED_MODELS,
  canUsePremiumChatBoxModels,
  type ChatBoxModel,
} from '@/lib/chatBoxModels'
import { ChatBoxModelCard } from './ChatBoxModelCard'

type Props = {
  selectedChatBoxModelId?: string | null
  userPlan?: string | null
  onApplyModel?: (model: ChatBoxModel) => void
}

export function ChatBoxModelsSection({
  selectedChatBoxModelId,
  userPlan,
  onApplyModel,
}: Props) {
  const premiumAllowed = canUsePremiumChatBoxModels(userPlan)

  return (
    <section className="space-y-6 border-t border-[var(--rz-border)] pt-6" aria-labelledby="chatbox-models-heading">
      <div>
        <h4 id="chatbox-models-heading" className="text-sm font-semibold text-[var(--rz-text-primary)]">
          Modelos de Chat Box
        </h4>
        <p className="mt-1 text-xs text-[var(--rz-text-muted)]">
          Escolha um modelo compacto de atendimento para aplicar no widget do seu site.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <h5 className="text-xs font-semibold uppercase tracking-wider text-[var(--rz-text-muted)]">
            Modelos Free
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
            Modelos Premium
          </h5>
          {!premiumAllowed && (
            <span className="text-[10px] text-[var(--rz-text-muted)]">
              Faça upgrade para aplicar modelos premium.
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--rz-text-muted)]">
          Modelos avançados com experiência visual superior, fluxos inteligentes e maior personalização.
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
