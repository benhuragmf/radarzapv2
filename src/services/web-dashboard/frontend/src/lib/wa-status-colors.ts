/** Paleta de fundos de status WhatsApp (cores reais do app — não seguem tema do painel). */
export const WA_STATUS_COLORS = [
  { id: 'cream', value: '#FFFCF5', label: 'Creme' },
  { id: 'yellow', value: '#FFEECF', label: 'Amarelo' },
  { id: 'peach', value: '#FFD8A8', label: 'Pêssego' },
  { id: 'pink', value: '#FECDCA', label: 'Rosa' },
  { id: 'lavender', value: '#FCD6FF', label: 'Lilás' },
  { id: 'blue', value: '#D1E9FF', label: 'Azul' },
  { id: 'mint', value: '#CFF5E7', label: 'Menta' },
  { id: 'dark', value: '#1F2C34', label: 'Escuro' },
] as const

export const WA_STATUS_DARK_BG = WA_STATUS_COLORS.find((c) => c.id === 'dark')!.value

export const WA_STATUS_DEFAULT_BG = WA_STATUS_COLORS[0].value

export function waStatusPreviewTextClass(backgroundColor?: string | null): string {
  return backgroundColor === WA_STATUS_DARK_BG
    ? 'text-white'
    : 'text-[var(--rz-on-light-surface)]'
}
