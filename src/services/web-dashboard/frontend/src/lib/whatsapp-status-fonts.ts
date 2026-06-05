/** Fontes de status WhatsApp (Baileys envia 1–4; UI usa 0–3). */

export const WA_STATUS_FONTS = [
  { value: 0, label: 'Padrão' },
  { value: 1, label: 'Serif' },
  { value: 2, label: 'Manuscrito' },
  { value: 3, label: 'Elegante' },
] as const

export type WaStatusFont = (typeof WA_STATUS_FONTS)[number]['value']

/** Aproximação visual das fontes de status na prévia do painel. */
export function statusFontPreviewClass(font: number | undefined): string {
  switch (font) {
    case 1:
      return 'font-serif'
    case 2:
      return "font-['Segoe Script','Brush Script MT',cursive]"
    case 3:
      return "font-['Palatino Linotype','Book Antiqua',Georgia,serif] tracking-wide"
    default:
      return 'font-sans'
  }
}
