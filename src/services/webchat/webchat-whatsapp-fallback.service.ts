import type { IWebChatConversation } from '@/models/WebChatConversation';
import { WebChatMessage } from '@/models/WebChatMessage';
import { loadInboxSettings } from '@/constants/inbox-triage';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';
import { generateInboxTicketRef } from '@/utils/inbox-ticket-ref';
import { DEFAULT_WHATSAPP_FALLBACK_VISITOR_MESSAGE } from '@/types/inbox-settings';
import { createServiceLogger } from '@/utils/logger';
import mongoose from 'mongoose';

const logger = createServiceLogger('WebChatWhatsAppFallback');

const ALERT_COOLDOWN_MS = 15 * 60 * 1000;

export function normalizeWhatsAppAlertDestination(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes('@')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 10) return digits;
  return null;
}

export function buildWhatsAppFallbackAlertBody(input: {
  ticketRef: string;
  visitorName: string;
  visitorPhone?: string;
  pageUrl?: string;
  initialMessage?: string;
}): string {
  const ticketNum = input.ticketRef.replace(/^TK-/i, '');
  const lines = [
    'Novo chamado no RadarZap',
    '',
    `Ticket: ${input.ticketRef}`,
    `Cliente: ${input.visitorName}`,
    input.visitorPhone ? `Telefone: ${input.visitorPhone}` : null,
    input.pageUrl ? `Página: ${input.pageUrl}` : null,
    input.initialMessage ? `Mensagem inicial:\n"${input.initialMessage.slice(0, 400)}"` : null,
    '',
    'Para assumir:',
    `!assumir ${ticketNum}`,
    '',
    `Para ver resumo:`,
    `!ticket ${ticketNum}`,
    '',
    `Para encerrar o atendimento no site:`,
    `!encerrarchat ${ticketNum}`,
    '',
    `Para arquivar o chamado no painel:`,
    `!encerrar ${ticketNum}`,
  ].filter((line): line is string => Boolean(line));
  return lines.join('\n');
}

async function ensureWebChatTicketRef(conversation: IWebChatConversation): Promise<string> {
  if (conversation.ticketRef?.trim()) {
    return conversation.ticketRef.trim().toUpperCase();
  }
  const ref = generateInboxTicketRef();
  conversation.ticketRef = ref;
  await conversation.save();
  return ref;
}

async function lastVisitorMessageBody(conversationId: mongoose.Types.ObjectId): Promise<string | undefined> {
  const msg = await WebChatMessage.findOne({
    conversationId,
    direction: 'inbound',
  })
    .sort({ createdAt: -1 })
    .select('body')
    .lean();
  return msg?.body?.trim() || undefined;
}

export async function handleWebChatNoAgentOnline(
  clientId: string,
  conversation: IWebChatConversation,
  opts?: { departmentName?: string },
): Promise<{ visitorMessage: string; alertSent: boolean }> {
  const settings = await loadInboxSettings(clientId);
  const defaultMsg = 'Nenhum atendente online no painel — fila aberta para a equipe assumir.';

  if (!settings.whatsappFallbackEnabled) {
    return { visitorMessage: defaultMsg, alertSent: false };
  }

  const visitorMessage =
    settings.whatsappFallbackVisitorMessage?.trim() || DEFAULT_WHATSAPP_FALLBACK_VISITOR_MESSAGE;

  if (conversation.whatsappFallbackAlertSentAt) {
    const age = Date.now() - conversation.whatsappFallbackAlertSentAt.getTime();
    if (age < ALERT_COOLDOWN_MS) {
      return { visitorMessage, alertSent: false };
    }
  }

  const ticketRef = await ensureWebChatTicketRef(conversation);
  const visitorName =
    conversation.visitorName?.trim() ||
    conversation.visitorEmail?.trim() ||
    'Visitante do site';
  const initialMessage = await lastVisitorMessageBody(conversation._id as mongoose.Types.ObjectId);

  const alertBody = buildWhatsAppFallbackAlertBody({
    ticketRef,
    visitorName,
    visitorPhone: conversation.visitorPhone?.trim(),
    pageUrl: conversation.pageUrl?.trim(),
    initialMessage,
  });

  const phones = (settings.whatsappFallbackAlertPhones ?? [])
    .map(normalizeWhatsAppAlertDestination)
    .filter((p): p is string => Boolean(p));

  let alertSent = false;
  if (phones.length > 0) {
    const wa = WhatsAppService.getInstance();
    for (const dest of phones) {
      try {
        const result = await wa.sendInternalAlert(clientId, dest, alertBody);
        if (result.success) alertSent = true;
      } catch (err) {
        logger.warn('WhatsApp fallback alert failed', {
          clientId,
          destination: dest.slice(0, 6) + '…',
          err: (err as Error).message,
        });
      }
    }
  } else {
    logger.info('WhatsApp fallback enabled but no alert phones configured', { clientId });
  }

  conversation.whatsappFallbackAlertSentAt = new Date();
  await conversation.save();

  return { visitorMessage, alertSent };
}
