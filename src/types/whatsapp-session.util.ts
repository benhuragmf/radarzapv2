import { Cap, type Capability } from '@/auth/rbac/capabilities';

/** Status de produto para painel/documentação (TOP 12). */
export type WhatsappSessionProductStatus =
  | 'disconnected'
  | 'qr_pending'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'logged_out'
  | 'disabled';

export type WhatsappCacheSessionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'qr-required';

const LOGGED_OUT_REASONS = new Set([401, 403, 428]);

/** Mapeia cache Baileys + flags runtime para status de produto. */
export function normalizeWhatsappSessionStatus(input: {
  cacheStatus?: WhatsappCacheSessionStatus | string;
  isLive?: boolean;
  isReconnecting?: boolean;
  manualDisconnect?: boolean;
  integrationDisabled?: boolean;
  statusReason?: number;
}): WhatsappSessionProductStatus {
  if (input.integrationDisabled) return 'disabled';
  if (input.isLive || input.cacheStatus === 'connected') return 'connected';
  if (input.cacheStatus === 'qr-required') return 'qr_pending';
  if (input.isReconnecting && input.cacheStatus === 'connecting') return 'reconnecting';
  if (input.cacheStatus === 'connecting') return 'connecting';
  if (
    input.manualDisconnect ||
    (input.statusReason != null && LOGGED_OUT_REASONS.has(input.statusReason))
  ) {
    return 'logged_out';
  }
  if (input.statusReason != null && input.statusReason !== 0) return 'error';
  return 'disconnected';
}

export function isWhatsappSessionConnected(status: WhatsappSessionProductStatus): boolean {
  return status === 'connected';
}

export function canUserManageWhatsappSession(capabilities: Capability[]): boolean {
  return capabilities.includes(Cap.WHATSAPP_SESSION_MANAGE);
}

export function canUserViewWhatsappSession(capabilities: Capability[]): boolean {
  return (
    capabilities.includes(Cap.WHATSAPP_SESSION_VIEW) ||
    capabilities.includes(Cap.WHATSAPP_SESSION_MANAGE)
  );
}

/** QR/credenciais nunca devem ir para logs de aplicação. */
export function isWhatsappQrLogSafe(field: string): boolean {
  const lower = field.toLowerCase();
  return !(
    lower.includes('qrcode') ||
    lower.includes('qr_code') ||
    lower.includes('sessiondata') ||
    lower.includes('creds')
  );
}

export const WHATSAPP_OUTBOUND_TEXT_MAX = 4096;

export function sanitizeWhatsappOutboundText(raw: unknown, max = WHATSAPP_OUTBOUND_TEXT_MAX): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, max);
}

export function assertWhatsappOutboundText(raw: unknown): string {
  const text = sanitizeWhatsappOutboundText(raw);
  if (!text) throw new Error('Mensagem vazia');
  return text;
}

/** Cross-tenant: sessão/operação WA deve pertencer à organização do contexto. */
export function assertWhatsappSessionClientMatch(
  sessionClientId: string,
  requestedClientId: string,
): void {
  if (sessionClientId !== requestedClientId) {
    throw new Error('Sessão WhatsApp não pertence a esta organização');
  }
}
