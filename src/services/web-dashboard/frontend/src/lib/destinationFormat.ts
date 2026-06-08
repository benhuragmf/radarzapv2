export function avatarLabel(name: string, size = 48) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1f2937&color=4ade80&size=${size}&bold=true`
}

/** BR móvel: 55 + DDD + 9 dígitos (13 no total). */
function normalizeBrDigits(digits: string): string {
  const d = digits.replace(/\D/g, '')
  if (d.startsWith('55') && d.length > 13) return d.slice(0, 13)
  return d
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/** Telefone BR plausível (não confundir com LID @lid). */
export function isLikelyPhoneIdentifier(value: string): boolean {
  if (!value || value.includes('@lid')) return false
  const d = digitsOnly(value)
  if (!d) return false
  if (!d.startsWith('55') && d.length >= 12 && d.length <= 17) return false
  if (d.startsWith('55')) return d.length >= 12 && d.length <= 13
  return d.length >= 10 && d.length <= 15
}

/**
 * Formata telefone BR para exibição no painel.
 * Ex.: +5511976904921 → +55 (11) 97690-4921
 */
export function formatPhone(id: string): string {
  if (id.includes('@lid')) return id
  const digits = normalizeBrDigits(id)
  if (!digits.startsWith('55')) return id.trim() || id
  if (!isLikelyPhoneIdentifier(id)) return id.trim() || id

  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  }
  if (digits.length === 12) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`
  }
  return digits ? `+${digits}` : id
}

/** Rótulo seguro para contato/Inbox — evita exibir LID como telefone. */
export function formatContactIdentifier(id: string, name?: string | null): string {
  if (id.includes('@lid')) {
    return name?.trim() || 'Contato (sem número na agenda)'
  }
  if (!isLikelyPhoneIdentifier(id)) {
    return name?.trim() || 'Número indisponível'
  }
  return formatPhone(id)
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
