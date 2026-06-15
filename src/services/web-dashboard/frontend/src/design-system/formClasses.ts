/** Classes padrão de formulário — reutilize em inputs nativos do painel. */
export const inputCls =
  'w-full rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)] px-3 py-2 text-sm text-[var(--rz-text-primary)] placeholder:text-[var(--rz-text-muted)] focus:border-[var(--rz-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--rz-primary)]/20'

export const selectCls = inputCls

export const textareaCls =
  'w-full rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)] px-3 py-2 text-sm text-[var(--rz-text-primary)] placeholder:text-[var(--rz-text-muted)] focus:border-[var(--rz-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--rz-primary)]/20 min-h-[5rem] resize-y'

/** Ícone de busca posicionado dentro de campo com `relative`. */
export const searchFieldIconCls =
  'absolute left-3 top-1/2 -translate-y-1/2 text-[var(--rz-text-muted)] pointer-events-none'

/** Painel de pré-visualização WhatsApp (fundo escuro fixo do app WA). */
export const waPreviewPanelCls = 'rz-wa-preview-panel p-4'

/** Painel de pré-visualização Discord (fundo escuro fixo do client Discord). */
export const discordPreviewPanelCls = 'rz-discord-preview-panel p-3 text-xs'

const previewChannelLabelBase = 'text-[10px] uppercase tracking-wider font-medium mb-2'

/** Rótulo acima do mock Discord (Templates, fluxo captura). */
export const previewChannelLabelDiscordCls = `${previewChannelLabelBase} text-[var(--rz-oauth-discord)]`

/** Rótulo acima do mock WhatsApp. */
export const previewChannelLabelWaCls = `${previewChannelLabelBase} text-[var(--rz-success-text)]`

/** Acentos semânticos em linhas de log (serviço, tenant, poster, live). */
export const logLineMetaCls = {
  service: 'text-[var(--rz-info-text)]',
  tenant: 'text-[var(--rz-premium-text)]',
  poster: 'text-[var(--rz-warning-text)]',
  live: 'text-[var(--rz-success-text)]',
} as const
