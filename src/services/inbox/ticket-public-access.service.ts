import mongoose from 'mongoose';
import { InboxTicket, type IInboxTicket } from '@/models/InboxTicket';
import { InboxDepartment } from '@/models/InboxDepartment';
import { WebChatConversation } from '@/models/WebChatConversation';
import { WebChatMessage } from '@/models/WebChatMessage';
import { Destination } from '@/models/Destination';
import { INBOX_TICKET_STATUS_LABEL, ticketIsActive } from '@/types/inbox-ticket';
import {
  generateTicketPublicAccessToken,
  hashTicketPublicAccessToken,
  normalizePhoneForTicketMatch,
  normalizeTicketRefForLookup,
  phonesMatchForTicket,
  publicAccessTokenHint,
  verifyTicketPublicAccessToken,
} from '@/utils/ticket-public-access.util';
import {
  clearTicketLookupFailures,
  isTicketLookupRateLimited,
  isTicketTokenResendOnCooldown,
  isTicketTokenResendRateLimited,
  markTicketTokenResendSent,
  recordTicketLookupFailure,
  recordTicketTokenResendAttempt,
} from './ticket-public-lookup-rate-limit';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('TicketPublicAccess');

export interface TicketPublicLookupMessage {
  body: string;
  createdAt: string;
  kind: 'client' | 'team' | 'system';
}

export interface TicketPublicLookupResult {
  ticketRef: string;
  status: string;
  statusLabel: string;
  subject?: string;
  departmentName?: string;
  openedAt: string;
  updatedAt: string;
  recentMessages: TicketPublicLookupMessage[];
  canContinueInChat: boolean;
  channel: 'whatsapp' | 'webchat_site';
}

const LOOKUP_FAIL_MSG =
  'Não encontramos um chamado com esses dados. Verifique o número e o token e tente novamente.';

export const TICKET_TOKEN_RESEND_SUCCESS_MSG =
  'Se o chamado e o WhatsApp conferirem com nosso cadastro, você receberá um novo token em instantes. Verifique suas mensagens.';

async function resolveTicketWhatsAppPhones(ticket: IInboxTicket): Promise<string[]> {
  const phones = new Set<string>();
  const add = (raw?: string | null) => {
    const n = normalizePhoneForTicketMatch(raw);
    if (n) phones.add(n);
  };

  add(ticket.contactIdentifier);

  if (ticket.destinationId) {
    const dest = await Destination.findById(ticket.destinationId).select('identifier').lean();
    add(dest?.identifier);
  }

  if (ticket.webChatConversationId) {
    const wc = await WebChatConversation.findById(ticket.webChatConversationId)
      .select('visitorPhone')
      .lean();
    add(wc?.visitorPhone);
  }

  return [...phones];
}

export async function rotateInboxTicketPublicAccessToken(ticket: IInboxTicket): Promise<string> {
  const token = generateTicketPublicAccessToken();
  ticket.publicAccessTokenHash = hashTicketPublicAccessToken(token);
  ticket.publicAccessTokenHint = publicAccessTokenHint(token);
  ticket.publicAccessCreatedAt = new Date();
  await ticket.save();
  return token;
}

export async function assignInboxTicketPublicAccessToken(
  ticket: IInboxTicket,
): Promise<string> {
  if (ticket.publicAccessTokenHash) {
    throw new Error('Token de consulta já existe para este chamado');
  }
  const token = generateTicketPublicAccessToken();
  ticket.publicAccessTokenHash = hashTicketPublicAccessToken(token);
  ticket.publicAccessTokenHint = publicAccessTokenHint(token);
  ticket.publicAccessCreatedAt = new Date();
  await ticket.save();
  return token;
}

export async function ensureInboxTicketPublicAccessToken(
  ticket: IInboxTicket,
): Promise<{ token: string; created: boolean }> {
  if (ticket.publicAccessTokenHash) {
    return { token: '', created: false };
  }
  const token = await assignInboxTicketPublicAccessToken(ticket);
  return { token, created: true };
}

async function loadRecentPublicMessages(
  ticket: IInboxTicket,
): Promise<TicketPublicLookupMessage[]> {
  if (ticket.channel === 'webchat_site' && ticket.webChatConversationId) {
    const rows = await WebChatMessage.find({
      conversationId: ticket.webChatConversationId,
      direction: { $ne: 'internal' },
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    return rows
      .reverse()
      .map(m => ({
        body: m.body,
        createdAt: (m.createdAt ?? new Date()).toISOString(),
        kind:
          m.direction === 'inbound'
            ? ('client' as const)
            : m.direction === 'system'
              ? ('system' as const)
              : ('team' as const),
      }))
      .filter(m => m.body?.trim());
  }

  const clientMsgs = (ticket.clientReplies ?? [])
    .slice(-5)
    .map(r => ({
      body: r.body,
      createdAt: (r.createdAt ?? new Date()).toISOString(),
      kind: 'client' as const,
    }));

  return clientMsgs.filter(m => m.body?.trim());
}

export async function buildTicketPublicLookupResult(
  ticket: IInboxTicket,
): Promise<TicketPublicLookupResult> {
  const dept = ticket.departmentId
    ? await InboxDepartment.findById(ticket.departmentId).select('name').lean()
    : null;

  let canContinueInChat = false;
  if (ticket.channel === 'webchat_site' && ticket.webChatConversationId) {
    const wc = await WebChatConversation.findById(ticket.webChatConversationId)
      .select('status')
      .lean();
    canContinueInChat = Boolean(wc && wc.status === 'open' && ticketIsActive(ticket.status));
  }

  const recentMessages = await loadRecentPublicMessages(ticket);

  return {
    ticketRef: ticket.ticketRef,
    status: ticket.status,
    statusLabel: INBOX_TICKET_STATUS_LABEL[ticket.status] ?? ticket.status,
    subject: ticket.subject?.trim() || undefined,
    departmentName: dept?.name,
    openedAt: (ticket.createdAt ?? new Date()).toISOString(),
    updatedAt: (ticket.updatedAt ?? ticket.createdAt ?? new Date()).toISOString(),
    recentMessages,
    canContinueInChat,
    channel: ticket.channel ?? 'whatsapp',
  };
}

export async function lookupTicketByPublicAccess(opts: {
  clientId: string;
  ticketRef: string;
  accessToken: string;
  remoteIp?: string;
}): Promise<TicketPublicLookupResult> {
  const clientOid = new mongoose.Types.ObjectId(opts.clientId);

  if (isTicketLookupRateLimited(opts.clientId, opts.remoteIp)) {
    logger.warn('ticket lookup rate limited', { clientId: opts.clientId });
    throw new Error(LOOKUP_FAIL_MSG);
  }

  const normalizedRef = normalizeTicketRefForLookup(opts.ticketRef);
  if (!normalizedRef) {
    recordTicketLookupFailure(opts.clientId, opts.remoteIp);
    throw new Error(LOOKUP_FAIL_MSG);
  }

  const ticket = await InboxTicket.findOne({
    clientId: clientOid,
    ticketRef: normalizedRef,
    deletedAt: { $exists: false },
  });

  if (!ticket?.publicAccessTokenHash) {
    recordTicketLookupFailure(opts.clientId, opts.remoteIp);
    throw new Error(LOOKUP_FAIL_MSG);
  }

  if (!verifyTicketPublicAccessToken(opts.accessToken, ticket.publicAccessTokenHash)) {
    recordTicketLookupFailure(opts.clientId, opts.remoteIp);
    throw new Error(LOOKUP_FAIL_MSG);
  }

  clearTicketLookupFailures(opts.clientId, opts.remoteIp);
  return buildTicketPublicLookupResult(ticket);
}

export function formatTicketCreatedWithTokenMessage(ticketRef: string, accessToken: string): string {
  return (
    `Seu chamado foi registrado.\n\n` +
    `Número: *${ticketRef}*\n` +
    `Token de consulta: *${accessToken}*\n\n` +
    `Guarde esse token para consultar seu atendimento depois no chat do site.`
  );
}

export function formatTicketTokenResendWhatsAppMessage(ticketRef: string, accessToken: string): string {
  return [
    'RadarZap — token de consulta',
    '',
    `Chamado: *${ticketRef}*`,
    `Token: *${accessToken}*`,
    '',
    'No chat do site: *Consultar chamado* → informe o número e este token.',
    'Guarde este token — o anterior deixa de valer.',
  ].join('\n');
}

/** Reenvia token por WhatsApp após validar telefone do visitante. Resposta sempre genérica (anti-enumeração). */
export async function resendTicketPublicAccessTokenViaWhatsApp(opts: {
  clientId: string;
  ticketRef: string;
  phone: string;
  remoteIp?: string;
}): Promise<{ message: string }> {
  if (isTicketTokenResendRateLimited(opts.clientId, opts.remoteIp)) {
    logger.warn('ticket token resend rate limited', { clientId: opts.clientId });
    return { message: TICKET_TOKEN_RESEND_SUCCESS_MSG };
  }

  recordTicketTokenResendAttempt(opts.clientId, opts.remoteIp);

  const normalizedRef = normalizeTicketRefForLookup(opts.ticketRef);
  const inputPhone = normalizePhoneForTicketMatch(opts.phone);
  if (!normalizedRef || !inputPhone) {
    return { message: TICKET_TOKEN_RESEND_SUCCESS_MSG };
  }

  if (isTicketTokenResendOnCooldown(opts.clientId, normalizedRef, opts.phone)) {
    return { message: TICKET_TOKEN_RESEND_SUCCESS_MSG };
  }

  const clientOid = new mongoose.Types.ObjectId(opts.clientId);
  const ticket = await InboxTicket.findOne({
    clientId: clientOid,
    ticketRef: normalizedRef,
    deletedAt: { $exists: false },
  });

  if (!ticket) {
    return { message: TICKET_TOKEN_RESEND_SUCCESS_MSG };
  }

  const knownPhones = await resolveTicketWhatsAppPhones(ticket);
  const phoneMatches = knownPhones.some(stored => phonesMatchForTicket(opts.phone, stored));
  if (!phoneMatches || knownPhones.length === 0) {
    logger.info('ticket token resend skipped — phone mismatch', {
      clientId: opts.clientId,
      ticketRef: normalizedRef,
    });
    return { message: TICKET_TOKEN_RESEND_SUCCESS_MSG };
  }

  const destination = knownPhones.find(stored => phonesMatchForTicket(opts.phone, stored)) ?? inputPhone;

  try {
    const token = await rotateInboxTicketPublicAccessToken(ticket);
    const text = formatTicketTokenResendWhatsAppMessage(ticket.ticketRef, token);
    await WhatsAppService.getInstance().sendInternalAlert(opts.clientId, destination, text);
    markTicketTokenResendSent(opts.clientId, normalizedRef, opts.phone);
    logger.info('ticket token resent via WhatsApp', {
      clientId: opts.clientId,
      ticketRef: normalizedRef,
    });
  } catch (err) {
    logger.warn('ticket token resend failed', {
      clientId: opts.clientId,
      ticketRef: normalizedRef,
      err: (err as Error).message,
    });
  }

  return { message: TICKET_TOKEN_RESEND_SUCCESS_MSG };
}
