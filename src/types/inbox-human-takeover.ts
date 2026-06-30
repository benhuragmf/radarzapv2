/** Pausa humana temporária no WhatsApp (QR) via !pausar — IA retoma após TTL. */

import type { IInboxConversation } from '@/models/InboxConversation';

/** Horas padrão até a IA retomar após !pausar (configurável pelo dono). */
export const DEFAULT_WHATSAPP_PAUSAR_AUTO_RESUME_HOURS = 2;

export const WHATSAPP_PAUSAR_AUTO_RESUME_HOURS_MIN = 1;
export const WHATSAPP_PAUSAR_AUTO_RESUME_HOURS_MAX = 72;

export function clampWhatsappPausarAutoResumeHours(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_WHATSAPP_PAUSAR_AUTO_RESUME_HOURS;
  return Math.min(
    WHATSAPP_PAUSAR_AUTO_RESUME_HOURS_MAX,
    Math.max(WHATSAPP_PAUSAR_AUTO_RESUME_HOURS_MIN, Math.round(n)),
  );
}

export function humanTakeoverUntilFromHours(hours: number, now = Date.now()): Date {
  return new Date(now + hours * 60 * 60 * 1000);
}

export function isHumanTakeoverActive(
  conv: Pick<IInboxConversation, 'humanTakeoverUntil'>,
  now = Date.now(),
): boolean {
  if (!conv.humanTakeoverUntil) return false;
  return new Date(conv.humanTakeoverUntil).getTime() > now;
}

export function formatHumanTakeoverUntil(until: Date, timeZone = 'America/Sao_Paulo'): string {
  try {
    return until.toLocaleString('pt-BR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return until.toISOString();
  }
}
