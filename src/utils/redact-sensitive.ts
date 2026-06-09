/**
 * Redação de dados sensíveis para logs (não substitui política de retenção/LGPD).
 */
export function redactEmail(email: string | undefined | null): string {
  if (!email || !email.includes('@')) return '[redacted]';
  const [local, domain] = email.split('@');
  const visible = local.length <= 2 ? '*' : `${local[0]}***`;
  return `${visible}@${domain}`;
}

export function redactOAuthError(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    error: payload.error,
    error_description: payload.error_description,
    status: payload.status,
  };
}

/** Escapa string para uso seguro em $regex do MongoDB */
export function escapeMongoRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 200);
}

export function redactPhone(phone: string | undefined | null): string {
  if (!phone) return '[redacted]';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `${digits.slice(0, 4)}***${digits.slice(-2)}`;
}
