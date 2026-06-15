import { discordPreviewPanelCls } from '@/design-system'

interface DiscordPostMockProps {
  title: string
}

export function DiscordPostMock({ title }: DiscordPostMockProps) {
  return (
    <div className={discordPreviewPanelCls}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-indigo-600/80 shrink-0" />
        <div>
          <p className="text-[var(--rz-discord-text-primary)] font-medium">Bot</p>
          <p className="text-[var(--rz-discord-text-muted)] text-[10px]">Hoje às 14:10</p>
        </div>
      </div>
      <div className="rz-discord-preview-embed pl-3 py-2">
        <p className="text-[var(--rz-discord-text-primary)] font-semibold">{title}</p>
        <p className="text-[var(--rz-discord-text-secondary)] mt-1">Embed / fields / botões do Discord</p>
      </div>
    </div>
  )
}
