/** Classes padrão de formulário — reutilize em inputs nativos do painel. */
export const inputCls =
  'w-full rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)] px-3 py-2 text-sm text-[var(--rz-text-primary)] placeholder:text-[var(--rz-text-muted)] focus:border-[var(--rz-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--rz-primary)]/20'

export const selectCls = inputCls

export const textareaCls =
  'w-full rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)] px-3 py-2 text-sm text-[var(--rz-text-primary)] placeholder:text-[var(--rz-text-muted)] focus:border-[var(--rz-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--rz-primary)]/20 min-h-[5rem] resize-y'

/** Painel de pré-visualização WhatsApp (fundo escuro fixo do app WA). */
export const waPreviewPanelCls = 'rz-wa-preview-panel p-4'

/** Painel de pré-visualização Discord (fundo escuro fixo do client Discord). */
export const discordPreviewPanelCls = 'rz-discord-preview-panel p-3 text-xs'
