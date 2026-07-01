/** Status da checagem se o número existe no WhatsApp (Baileys onWhatsApp). */
export const WA_REGISTRATION_STATUSES = [
  'pending',
  'verified',
  'not_on_whatsapp',
  'check_failed',
] as const;

export type WaRegistrationStatus = (typeof WA_REGISTRATION_STATUSES)[number];

export const WA_REGISTRATION_LABELS: Record<WaRegistrationStatus, string> = {
  pending: 'Aguardando validação',
  verified: 'No WhatsApp',
  not_on_whatsapp: 'Sem WhatsApp',
  check_failed: 'Falha na checagem',
};

export type WaRegistrationFilterKey = WaRegistrationStatus | 'needs_check';

export function parseWaRegistrationFilter(raw?: string): WaRegistrationFilterKey | null {
  if (!raw?.trim()) return null;
  const v = raw.trim().toLowerCase();
  if (v === 'needs_check') return 'needs_check';
  if ((WA_REGISTRATION_STATUSES as readonly string[]).includes(v)) {
    return v as WaRegistrationStatus;
  }
  return null;
}

export function waRegistrationNeedsCheck(status?: WaRegistrationStatus | string | null): boolean {
  if (!status) return true;
  return status === 'pending' || status === 'check_failed';
}

/**
 * Ritmo de validação em background — referência: 1000 contatos em 24h.
 * (~1 número a cada 86s por empresa; não sobrecarrega Baileys nem o servidor.)
 */
export const WA_REGISTRATION_REFERENCE_BATCH = 1000;
export const WA_REGISTRATION_TARGET_HOURS = 24;
export const WA_REGISTRATION_INTERVAL_MS = Math.ceil(
  (WA_REGISTRATION_TARGET_HOURS * 3_600_000) / WA_REGISTRATION_REFERENCE_BATCH,
);
export const WA_REGISTRATION_BACKGROUND_BATCH = 1;
/** Máximo por clique manual (não acelera a fila inteira). */
export const WA_REGISTRATION_MANUAL_BATCH_MAX = 3;

export function estimateWaValidationHoursRemaining(queueSize: number): number {
  if (queueSize <= 0) return 0;
  const hoursPerContact = WA_REGISTRATION_INTERVAL_MS / 3_600_000;
  return Math.ceil(queueSize * hoursPerContact * 10) / 10;
}

export function formatWaValidationEta(hours: number): string {
  if (hours <= 0) return 'em breve';
  if (hours < 1) {
    const mins = Math.max(1, Math.ceil(hours * 60));
    return `~${mins} min`;
  }
  if (hours < 48) {
    return `~${Math.ceil(hours)} h`;
  }
  const days = Math.ceil(hours / 24);
  return `~${days} dia(s)`;
}

export const WA_REGISTRATION_PACE_HINT =
  'O envio só libera após cada número ser checado no WhatsApp (ritmo conforme o plano).';
