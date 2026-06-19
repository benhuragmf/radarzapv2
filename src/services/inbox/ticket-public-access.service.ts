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
  emailsMatchForTicket,
  looksLikeEmail,
  normalizeEmailForTicketMatch,
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
import {
  generateTicketResendOtpCode,
  isTicketResendOtpRequestLimited,
  recordTicketResendOtpRequest,
  storeTicketResendOtp,
  verifyTicketResendOtp,
} from './ticket-token-resend-otp';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';
import { EmailService } from '@/services/email/EmailService';
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
  'Se a verificação foi concluída, você receberá o novo token em instantes (WhatsApp ou e-mail).';

export const TICKET_TOKEN_RESEND_REQUEST_MSG =
  'Se o chamado e o contato informado conferirem com nosso cadastro, você receberá um código de 6 dígitos em instantes.';

export const TICKET_TOKEN_RESEND_OTP_INVALID_MSG =
  'Código inválido ou expirado. Solicite um novo código.';

export type TicketTokenResendChannel = 'whatsapp' | 'email';

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

async function resolveTicketEmails(ticket: IInboxTicket): Promise<string[]> {
  const emails = new Set<string>();
  const add = (raw?: string | null) => {
    const n = normalizeEmailForTicketMatch(raw);
    if (n) emails.add(n);
  };

  if (looksLikeEmail(ticket.contactIdentifier)) {
    add(ticket.contactIdentifier);
  }

  if (ticket.destinationId) {
    const dest = await Destination.findById(ticket.destinationId).select('email identifier').lean();
    add(dest?.email);
    if (looksLikeEmail(dest?.identifier)) add(dest?.identifier);
  }

  if (ticket.webChatConversationId) {
    const wc = await WebChatConversation.findById(ticket.webChatConversationId)
      .select('visitorEmail')
      .lean();
    add(wc?.visitorEmail);
  }

  return [...emails];
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
  }).select('+publicAccessTokenHash');

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

export function formatTicketTokenResendEmailContent(
  ticketRef: string,
  accessToken: string,
  contactName?: string,
): { subject: string; text: string; html: string } {
  const greeting = contactName?.trim() ? `Olá, ${contactName.trim()}!` : 'Olá!';
  const text = [
    greeting,
    '',
    'Segue seu token para consultar o chamado no chat do site:',
    '',
    `Chamado: ${ticketRef}`,
    `Token: ${accessToken}`,
    '',
    'No widget: Consultar chamado → informe o número e este token.',
    'O token anterior deixa de valer após este envio.',
    '',
    '— RadarZap',
  ].join('\n');

  const html = `
    <p>${greeting}</p>
    <p>Segue seu token para consultar o chamado no chat do site:</p>
    <p><strong>Chamado:</strong> ${ticketRef}<br/>
    <strong>Token:</strong> <code style="font-size:16px;letter-spacing:1px;">${accessToken}</code></p>
    <p>No widget, use <em>Consultar chamado</em> e informe o número e este token.<br/>
    O token anterior deixa de valer após este envio.</p>
    <p style="color:#888;font-size:12px;">RadarZap</p>
  `.trim();

  return { subject: `Token de consulta — ${ticketRef}`, text, html };
}

/** Envia token de consulta por e-mail (criação ou reenvio). */
export async function sendTicketAccessTokenEmail(opts: {
  ticketRef: string;
  accessToken: string;
  toEmail: string;
  contactName?: string;
}): Promise<boolean> {
  const to = normalizeEmailForTicketMatch(opts.toEmail);
  if (!to) return false;

  const content = formatTicketTokenResendEmailContent(
    opts.ticketRef,
    opts.accessToken,
    opts.contactName,
  );
  const result = await EmailService.getInstance().send({
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
  return result.ok;
}

export function formatTicketTokenResendOtpWhatsApp(ticketRef: string, code: string): string {
  return [
    'RadarZap — verificação',
    '',
    `Chamado: *${ticketRef}*`,
    `Código: *${code}*`,
    '',
    'Informe este código no chat do site para reenviar seu token de consulta.',
    'Válido por 10 minutos. Não compartilhe.',
  ].join('\n');
}

export function formatTicketTokenResendOtpEmail(
  ticketRef: string,
  code: string,
  contactName?: string,
): { subject: string; text: string; html: string } {
  const greeting = contactName?.trim() ? `Olá, ${contactName.trim()}!` : 'Olá!';
  const text = [
    greeting,
    '',
    'Use o código abaixo no chat do site para reenviar seu token de consulta:',
    '',
    `Chamado: ${ticketRef}`,
    `Código: ${code}`,
    '',
    'Válido por 10 minutos. Não compartilhe este código.',
    '',
    '— RadarZap',
  ].join('\n');

  const html = `
    <p>${greeting}</p>
    <p>Use o código abaixo no chat do site para reenviar seu token de consulta:</p>
    <p><strong>Chamado:</strong> ${ticketRef}<br/>
    <strong>Código:</strong> <code style="font-size:18px;letter-spacing:2px;">${code}</code></p>
    <p>Válido por 10 minutos. Não compartilhe este código.</p>
    <p style="color:#888;font-size:12px;">RadarZap</p>
  `.trim();

  return { subject: `Código de verificação — ${ticketRef}`, text, html };
}

/** Envia OTP de reenvio por e-mail. */
export async function sendTicketResendOtpEmail(opts: {
  ticketRef: string;
  code: string;
  toEmail: string;
  contactName?: string;
}): Promise<boolean> {
  const to = normalizeEmailForTicketMatch(opts.toEmail);
  if (!to) return false;

  const content = formatTicketTokenResendOtpEmail(opts.ticketRef, opts.code, opts.contactName);
  const result = await EmailService.getInstance().send({
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
  return result.ok;
}

type TicketResendContactMatch = {
  ticket: IInboxTicket;
  channel: TicketTokenResendChannel;
  destination: string;
  contactRaw: string;
};

async function matchTicketForTokenResend(opts: {
  clientId: string;
  ticketRef: string;
  channel: TicketTokenResendChannel;
  phone?: string;
  email?: string;
}): Promise<TicketResendContactMatch | null> {
  const normalizedRef = normalizeTicketRefForLookup(opts.ticketRef);
  if (!normalizedRef) return null;

  const contactRaw = opts.channel === 'email' ? opts.email?.trim() : opts.phone?.trim();
  if (!contactRaw) return null;

  const clientOid = new mongoose.Types.ObjectId(opts.clientId);
  const ticket = await InboxTicket.findOne({
    clientId: clientOid,
    ticketRef: normalizedRef,
    deletedAt: { $exists: false },
  }).select('+publicAccessTokenHash');

  if (!ticket) return null;

  if (opts.channel === 'email') {
    const knownEmails = await resolveTicketEmails(ticket);
    const emailMatches = knownEmails.some(stored => emailsMatchForTicket(contactRaw, stored));
    if (!emailMatches || knownEmails.length === 0) return null;

    const destination =
      knownEmails.find(stored => emailsMatchForTicket(contactRaw, stored)) ??
      normalizeEmailForTicketMatch(contactRaw)!;

    return { ticket, channel: 'email', destination, contactRaw };
  }

  const inputPhone = normalizePhoneForTicketMatch(opts.phone);
  if (!inputPhone) return null;

  const knownPhones = await resolveTicketWhatsAppPhones(ticket);
  const phoneMatches = knownPhones.some(stored => phonesMatchForTicket(contactRaw, stored));
  if (!phoneMatches || knownPhones.length === 0) return null;

  const destination =
    knownPhones.find(stored => phonesMatchForTicket(contactRaw, stored)) ?? inputPhone;

  return { ticket, channel: 'whatsapp', destination, contactRaw };
}

async function deliverRotatedTicketAccessToken(
  clientId: string,
  ticketRef: string,
  match: TicketResendContactMatch,
): Promise<boolean> {
  const token = await rotateInboxTicketPublicAccessToken(match.ticket);

  if (match.channel === 'email') {
    return sendTicketAccessTokenEmail({
      ticketRef: match.ticket.ticketRef,
      accessToken: token,
      toEmail: match.destination,
      contactName: match.ticket.contactName,
    });
  }

  const text = formatTicketTokenResendWhatsAppMessage(match.ticket.ticketRef, token);
  await WhatsAppService.getInstance().sendInternalAlert(clientId, match.destination, text);
  return true;
}

/** Etapa 1: valida contato e envia OTP (não envia o token de consulta). */
export async function requestTicketTokenResendOtp(opts: {
  clientId: string;
  ticketRef: string;
  channel: TicketTokenResendChannel;
  phone?: string;
  email?: string;
  remoteIp?: string;
}): Promise<{ message: string }> {
  if (isTicketTokenResendRateLimited(opts.clientId, opts.remoteIp)) {
    logger.warn('ticket token resend OTP request rate limited', { clientId: opts.clientId });
    return { message: TICKET_TOKEN_RESEND_REQUEST_MSG };
  }

  recordTicketTokenResendAttempt(opts.clientId, opts.remoteIp);

  const normalizedRef = normalizeTicketRefForLookup(opts.ticketRef);
  const contactRaw = opts.channel === 'email' ? opts.email?.trim() : opts.phone?.trim();
  if (!normalizedRef || !contactRaw) {
    return { message: TICKET_TOKEN_RESEND_REQUEST_MSG };
  }

  if (isTicketTokenResendOnCooldown(opts.clientId, normalizedRef, contactRaw)) {
    return { message: TICKET_TOKEN_RESEND_REQUEST_MSG };
  }

  if (isTicketResendOtpRequestLimited(opts.clientId, normalizedRef, contactRaw)) {
    logger.warn('ticket token resend OTP contact limited', {
      clientId: opts.clientId,
      ticketRef: normalizedRef,
    });
    return { message: TICKET_TOKEN_RESEND_REQUEST_MSG };
  }

  const match = await matchTicketForTokenResend(opts);
  if (!match) {
    logger.info('ticket token resend OTP skipped — contact mismatch', {
      clientId: opts.clientId,
      ticketRef: normalizedRef,
      channel: opts.channel,
    });
    return { message: TICKET_TOKEN_RESEND_REQUEST_MSG };
  }

  try {
    const code = generateTicketResendOtpCode();
    storeTicketResendOtp({
      clientId: opts.clientId,
      ticketRef: normalizedRef,
      contact: match.contactRaw,
      channel: match.channel,
      code,
    });
    recordTicketResendOtpRequest(opts.clientId, normalizedRef, match.contactRaw);

    if (match.channel === 'email') {
      await sendTicketResendOtpEmail({
        ticketRef: match.ticket.ticketRef,
        code,
        toEmail: match.destination,
        contactName: match.ticket.contactName,
      });
    } else {
      const text = formatTicketTokenResendOtpWhatsApp(match.ticket.ticketRef, code);
      await WhatsAppService.getInstance().sendInternalAlert(
        opts.clientId,
        match.destination,
        text,
      );
    }

    logger.info('ticket token resend OTP sent', {
      clientId: opts.clientId,
      ticketRef: normalizedRef,
      channel: match.channel,
    });
  } catch (err) {
    logger.warn('ticket token resend OTP failed', {
      clientId: opts.clientId,
      ticketRef: normalizedRef,
      channel: opts.channel,
      err: (err as Error).message,
    });
  }

  return { message: TICKET_TOKEN_RESEND_REQUEST_MSG };
}

/** Etapa 2: confirma OTP e envia novo token de consulta. */
export async function confirmTicketTokenResendOtp(opts: {
  clientId: string;
  ticketRef: string;
  channel: TicketTokenResendChannel;
  phone?: string;
  email?: string;
  verificationCode: string;
  remoteIp?: string;
}): Promise<{ message: string; ok?: boolean }> {
  if (isTicketTokenResendRateLimited(opts.clientId, opts.remoteIp)) {
    logger.warn('ticket token resend confirm rate limited', { clientId: opts.clientId });
    return { message: TICKET_TOKEN_RESEND_OTP_INVALID_MSG, ok: false };
  }

  recordTicketTokenResendAttempt(opts.clientId, opts.remoteIp);

  const normalizedRef = normalizeTicketRefForLookup(opts.ticketRef);
  const contactRaw = opts.channel === 'email' ? opts.email?.trim() : opts.phone?.trim();
  const code = opts.verificationCode?.replace(/\D/g, '').slice(0, 6);

  if (!normalizedRef || !contactRaw || !code || code.length !== 6) {
    return { message: TICKET_TOKEN_RESEND_OTP_INVALID_MSG, ok: false };
  }

  const otpOk = verifyTicketResendOtp({
    clientId: opts.clientId,
    ticketRef: normalizedRef,
    contact: contactRaw,
    code,
    channel: opts.channel,
  });

  if (!otpOk) {
    logger.info('ticket token resend OTP verify failed', {
      clientId: opts.clientId,
      ticketRef: normalizedRef,
    });
    return { message: TICKET_TOKEN_RESEND_OTP_INVALID_MSG, ok: false };
  }

  const match = await matchTicketForTokenResend(opts);
  if (!match) {
    return { message: TICKET_TOKEN_RESEND_OTP_INVALID_MSG, ok: false };
  }

  try {
    const sent = await deliverRotatedTicketAccessToken(opts.clientId, normalizedRef, match);
    if (sent) {
      markTicketTokenResendSent(opts.clientId, normalizedRef, contactRaw);
      logger.info('ticket token resent after OTP', {
        clientId: opts.clientId,
        ticketRef: normalizedRef,
        channel: match.channel,
      });
    }
  } catch (err) {
    logger.warn('ticket token resend after OTP failed', {
      clientId: opts.clientId,
      ticketRef: normalizedRef,
      err: (err as Error).message,
    });
    return { message: TICKET_TOKEN_RESEND_OTP_INVALID_MSG, ok: false };
  }

  return { message: TICKET_TOKEN_RESEND_SUCCESS_MSG, ok: true };
}

/** @deprecated Use requestTicketTokenResendOtp + confirmTicketTokenResendOtp */
export async function resendTicketPublicAccessToken(opts: {
  clientId: string;
  ticketRef: string;
  channel: TicketTokenResendChannel;
  phone?: string;
  email?: string;
  remoteIp?: string;
}): Promise<{ message: string }> {
  return requestTicketTokenResendOtp(opts);
}

/** @deprecated Use resendTicketPublicAccessToken({ channel: 'whatsapp', ... }) */
export async function resendTicketPublicAccessTokenViaWhatsApp(opts: {
  clientId: string;
  ticketRef: string;
  phone: string;
  remoteIp?: string;
}): Promise<{ message: string }> {
  return resendTicketPublicAccessToken({
    clientId: opts.clientId,
    ticketRef: opts.ticketRef,
    channel: 'whatsapp',
    phone: opts.phone,
    remoteIp: opts.remoteIp,
  });
}
