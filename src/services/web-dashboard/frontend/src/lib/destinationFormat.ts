export function avatarLabel(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1f2937&color=4ade80&size=48&bold=true`
}

/** BR móvel: 55 + DDD + 9 dígitos (13 no total). */
function normalizeBrDigits(digits: string): string {
  const d = digits.replace(/\D/g, '')
  if (d.startsWith('55') && d.length > 13) return d.slice(0, 13)
  return d
}

/**
 * Formata telefone BR para exibição no painel.
 * Ex.: +5511976904921 → +55 (11) 97690-4921
 */
export function formatPhone(id: string): string {
  const digits = normalizeBrDigits(id)
  if (!digits.startsWith('55')) return id.trim() || id

  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  }
  if (digits.length === 12) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`
  }
  if (digits.length > 13) {
    const d = digits.slice(0, 13)
    return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`
  }
  return digits ? `+${digits}` : id
}

/** Rótulo da sessão WhatsApp: número formatado ou nome do perfil. */
export function formatWaSessionLabel(opts: {
  phoneNumber?: string | null
  profileName?: string | null
  fallback?: string
}): string {
  const { phoneNumber, profileName, fallback = 'Conectado' } = opts
  if (phoneNumber) {
    const digits = phoneNumber.replace(/\D/g, '')
    if (digits.startsWith('55') && digits.length >= 12) {
      return formatPhone(phoneNumber)
    }
  }
  if (profileName?.trim()) return profileName.trim()
  return fallback
}
