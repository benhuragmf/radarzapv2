import type { IWebChatConversation } from '@/models/WebChatConversation';
import { WebChatMessage } from '@/models/WebChatMessage';
import { InboxDepartment } from '@/models/InboxDepartment';
import { loadInboxSettings } from '@/constants/inbox-triage';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';
import { generateInboxTicketRef } from '@/utils/inbox-ticket-ref';
import { DEFAULT_WHATSAPP_FALLBACK_VISITOR_MESSAGE } from '@/types/inbox-settings';
import { listVerifiedWhatsappInboxAgents } from '@/services/inbox/whatsapp-agent-auth.service';
import { createServiceLogger } from '@/utils/logger';
import mongoose from 'mongoose';
import {
  isFallbackAcceptTimeoutElapsed,
  isFallbackWaAssumirTimeoutElapsed,
  resolveFallbackAcceptTimeoutSeconds,
  resolveFallbackWaitMode,
  shouldRetryFallbackAfterCooldown,
} from './webchat-fallback-timing.util';

const logger = createServiceLogger('WebChatWhatsAppFallback');

const EXHAUSTED_ALERT_COOLDOWN_MS = 15 * 60 * 1000;

export {
  isFallbackAcceptTimeoutElapsed,
  isFallbackWaAssumirTimeoutElapsed,
  getFallbackAcceptWaitStart,
  getFallbackCountdownState,
  resolveFallbackWaitMode,
  resolveFallbackAcceptTimeoutSeconds,
} from './webchat-fallback-timing.util';

export type FallbackWhatsappRotationResult =
  | { kind: 'none' }
  | { kind: 'sent'; userId: string; agentName: string }
  | { kind: 'rotated'; fromUserId: string; toUserId: string; agentName: string }
  | { kind: 'exhausted'; visitorMessage: string; alertSent: boolean };

export function normalizeWhatsAppAlertDestination(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes('@')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 10) return digits;
  return null;
}

/**
 * Remove destinos que coincidem com o número da sessão Baileys conectada (evita loop de alerta).
 */
export function filterFallbackAlertPhones(
  phones: string[],
  sessionPhoneDigits: string | null,
): string[] {
  if (!sessionPhoneDigits?.trim()) return phones;
  const sessionNorm = sessionPhoneDigits.replace(/\D/g, '');
  if (sessionNorm.length < 10) return phones;

  return phones.filter(dest => {
    if (dest.includes('@g.us')) return true;
    const destDigits = (dest.includes('@') ? dest.split('@')[0] : dest).replace(/\D/g, '');
    if (destDigits.length < 10) return true;
    const match =
      destDigits === sessionNorm ||
      destDigits.endsWith(sessionNorm.slice(-11)) ||
      sessionNorm.endsWith(destDigits.slice(-11));
    if (match) {
      logger.info('bridge:alert_skipped_same_session', {
        destination: dest.slice(0, 6) + '…',
      });
      return false;
    }
    return true;
  });
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
    'Novo chamado no Radar Chat',
    '',
    `Ticket: ${input.ticketRef}`,
    `Cliente: ${input.visitorName}`,
    input.visitorPhone ? `Telefone: ${input.visitorPhone}` : null,
    input.pageUrl ? `Página: ${input.pageUrl}` : null,
    input.initialMessage ? `Mensagem inicial:\n"${input.initialMessage.slice(0, 400)}"` : null,
    '',
    'Para assumir atendimento (escolha uma opção):',
    `!assumir — assume este alerta (${input.ticketRef})`,
    `!assumir ${ticketNum}`,
    '',
    'Para abrir chamado formal (token no site):',
    `!abrir ${ticketNum} Cliente precisa @setor`,
    '(substitua @setor pelo motivo real — comando em uma linha só)',
    '',
    'Consultar abertos: !abertos · seus: !meus',
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

async function resolveDepartmentMemberUserIds(
  clientId: string,
  departmentId?: mongoose.Types.ObjectId | null,
): Promise<string[] | undefined> {
  if (!departmentId) return undefined;
  const dept = await InboxDepartment.findOne({
    _id: departmentId,
    clientId: new mongoose.Types.ObjectId(clientId),
  })
    .select('memberUserIds')
    .lean();
  if (!dept?.memberUserIds?.length) return undefined;
  return dept.memberUserIds.map(id => String(id));
}

async function loadDepartmentForBridge(
  clientId: string,
  departmentId?: mongoose.Types.ObjectId | null,
) {
  if (!departmentId) return null;
  return InboxDepartment.findOne({
    _id: departmentId,
    clientId: new mongoose.Types.ObjectId(clientId),
  })
    .select('memberUserIds memberConfigs')
    .lean();
}

export async function listFallbackWhatsappAgents(
  clientId: string,
  departmentId?: mongoose.Types.ObjectId | null,
): Promise<Array<{ userId: string; displayName: string; whatsappPhone: string }>> {
  const memberFilter = await resolveDepartmentMemberUserIds(clientId, departmentId);
  const agents = await listVerifiedWhatsappInboxAgents(clientId, memberFilter);
  const dept = await loadDepartmentForBridge(clientId, departmentId);
  if (!dept?.memberConfigs?.length) return agents;

  const settings = await loadInboxSettings(clientId);
  const { filterAgentsForDepartmentBridge } = await import(
    '@/services/inbox/inbox-department-bridge.util'
  );
  return filterAgentsForDepartmentBridge(agents, dept, settings);
}

export function pickNextFallbackAgent(
  agents: Array<{ userId: string; displayName: string; whatsappPhone: string }>,
  triedUserIds: string[],
  currentUserId?: string | null,
): { userId: string; displayName: string; whatsappPhone: string } | null {
  if (!agents.length) return null;
  const tried = new Set(triedUserIds.map(String));
  if (currentUserId) tried.add(String(currentUserId));

  const remaining = agents.filter(a => !tried.has(a.userId));
  if (!remaining.length) return null;

  if (!currentUserId) return remaining[0];

  const currentIdx = agents.findIndex(a => a.userId === String(currentUserId));
  if (currentIdx < 0) return remaining[0];

  for (let offset = 1; offset <= agents.length; offset += 1) {
    const candidate = agents[(currentIdx + offset) % agents.length];
    if (!tried.has(candidate.userId)) return candidate;
  }
  return null;
}

async function buildAlertBodyForConversation(
  conversation: IWebChatConversation,
): Promise<string> {
  const ticketRef = await ensureWebChatTicketRef(conversation);
  const visitorName =
    conversation.visitorName?.trim() ||
    conversation.visitorEmail?.trim() ||
    'Visitante do site';
  const initialMessage = await lastVisitorMessageBody(conversation._id as mongoose.Types.ObjectId);
  return buildWhatsAppFallbackAlertBody({
    ticketRef,
    visitorName,
    visitorPhone: conversation.visitorPhone?.trim(),
    pageUrl: conversation.pageUrl?.trim(),
    initialMessage,
  });
}

async function sendAlertToAgentPhone(
  clientId: string,
  phone: string,
  alertBody: string,
): Promise<boolean> {
  const wa = WhatsAppService.getInstance();
  const sessionDigits = wa.getConnectedSessionPhoneDigits(clientId);
  const normalized = normalizeWhatsAppAlertDestination(phone);
  if (!normalized) return false;
  const destinations = filterFallbackAlertPhones([normalized], sessionDigits);
  if (!destinations.length) return false;

  try {
    const result = await wa.sendInternalAlert(clientId, destinations[0], alertBody);
    return Boolean(result.success);
  } catch (err) {
    logger.warn('WhatsApp fallback alert failed', {
      clientId,
      destination: destinations[0].slice(0, 6) + '…',
      err: (err as Error).message,
    });
    return false;
  }
}

/** Envia alerta WA para um atendente da equipe (um por vez). */
export async function sendFallbackAlertToAgent(
  clientId: string,
  conversation: IWebChatConversation,
  agent: { userId: string; whatsappPhone: string },
): Promise<boolean> {
  const alertBody = await buildAlertBodyForConversation(conversation);
  const sent = await sendAlertToAgentPhone(clientId, agent.whatsappPhone, alertBody);
  if (sent) {
    const ticketRef = conversation.ticketRef?.trim();
    if (ticketRef) {
      const { setWaAgentPendingAlert } = await import(
        '@/services/inbox/whatsapp-agent-focus.service'
      );
      await setWaAgentPendingAlert(
        clientId,
        agent.userId,
        ticketRef,
        conversation.visitorName?.trim(),
      );
    }
  }
  return sent;
}

/**
 * Inicia ou avança rotação WA: 1 atendente por vez; se não assumir, próximo.
 * `immediate` ignora timeout (ex.: ninguém online no painel na escalação).
 */
export async function processFallbackWhatsappRotation(
  clientId: string,
  conversation: IWebChatConversation,
  opts?: { immediate?: boolean; timeoutSeconds?: number; allowRetry?: boolean },
): Promise<FallbackWhatsappRotationResult> {
  const settings = await loadInboxSettings(clientId);
  if (!settings.whatsappFallbackEnabled) return { kind: 'none' };

  const exhaustedCooldown = shouldRetryFallbackAfterCooldown(
    conversation.whatsappFallbackAlertSentAt,
    EXHAUSTED_ALERT_COOLDOWN_MS,
  );
  if (
    conversation.whatsappFallbackAlertSentAt &&
    !exhaustedCooldown &&
    !opts?.allowRetry
  ) {
    return { kind: 'none' };
  }

  if (exhaustedCooldown && conversation.whatsappFallbackAlertSentAt) {
    conversation.whatsappFallbackTriedUserIds = [];
    conversation.whatsappFallbackWaNotifiedUserId = undefined;
    conversation.whatsappFallbackWaNotifiedAt = undefined;
    conversation.whatsappFallbackAlertSentAt = undefined;
  }

  const mode = resolveFallbackWaitMode(clientId, conversation);
  const timeoutSec =
    opts?.timeoutSeconds ??
    resolveFallbackAcceptTimeoutSeconds(settings, mode);

  const nowMs = Date.now();

  if (
    !opts?.immediate &&
    !isFallbackAcceptTimeoutElapsed(clientId, conversation, settings, nowMs)
  ) {
    return { kind: 'none' };
  }

  const agents = await listFallbackWhatsappAgents(
    clientId,
    conversation.departmentId as mongoose.Types.ObjectId | undefined,
  );
  const tried = [...(conversation.whatsappFallbackTriedUserIds ?? [])];
  const currentSuggested = conversation.suggestedUserId?.trim() || null;
  const waNotified = conversation.whatsappFallbackWaNotifiedUserId?.trim() || null;

  if (agents.length >= 1) {
    if (!currentSuggested) {
      const first = pickNextFallbackAgent(agents, tried, null);
      if (!first) {
        return finalizeManualFallbackBroadcast(clientId, conversation, settings);
      }
      const sent = await sendFallbackAlertToAgent(clientId, conversation, first);
      conversation.suggestedUserId = first.userId;
      conversation.suggestedAt = new Date();
      if (!conversation.whatsappFallbackPriorityStartedAt) {
        conversation.whatsappFallbackPriorityStartedAt = new Date();
      }
      conversation.whatsappFallbackWaNotifiedUserId = first.userId;
      conversation.whatsappFallbackWaNotifiedAt = new Date();
      await conversation.save();
      if (sent) {
        logger.info('WhatsApp fallback: alert sent to first agent', {
          clientId,
          userId: first.userId,
        });
      }
      return { kind: 'sent', userId: first.userId, agentName: first.displayName };
    }

    if (waNotified === currentSuggested) {
      if (
        !isFallbackWaAssumirTimeoutElapsed(clientId, conversation, settings, nowMs)
      ) {
        return { kind: 'none' };
      }
    }

    if (waNotified !== currentSuggested) {
      const agent = agents.find(a => a.userId === currentSuggested);
      if (agent) {
        const sent = await sendFallbackAlertToAgent(clientId, conversation, agent);
        conversation.whatsappFallbackWaNotifiedUserId = agent.userId;
        conversation.whatsappFallbackWaNotifiedAt = new Date();
        await conversation.save();
        if (sent) {
          logger.info('WhatsApp fallback: alert sent to suggested agent', {
            clientId,
            userId: agent.userId,
          });
        }
        return { kind: 'sent', userId: agent.userId, agentName: agent.displayName };
      }
    }

    const next = pickNextFallbackAgent(agents, tried, currentSuggested);
    if (!next) {
      return finalizeManualFallbackBroadcast(clientId, conversation, settings);
    }

    const fromUserId = currentSuggested;
    if (fromUserId && !tried.includes(fromUserId)) {
      conversation.whatsappFallbackTriedUserIds = [...tried, fromUserId];
    }

    const sent = await sendFallbackAlertToAgent(clientId, conversation, next);
    conversation.suggestedUserId = next.userId;
    conversation.suggestedAt = new Date();
    if (!conversation.whatsappFallbackPriorityStartedAt) {
      conversation.whatsappFallbackPriorityStartedAt = new Date();
    }
    conversation.whatsappFallbackWaNotifiedUserId = next.userId;
    conversation.whatsappFallbackWaNotifiedAt = new Date();
    await conversation.save();

    if (sent) {
      logger.info('WhatsApp fallback: rotated alert to next agent', {
        clientId,
        fromUserId,
        toUserId: next.userId,
      });
    }
    return {
      kind: 'rotated',
      fromUserId: fromUserId ?? next.userId,
      toUserId: next.userId,
      agentName: next.displayName,
    };
  }

  return finalizeManualFallbackBroadcast(clientId, conversation, settings);
}

async function finalizeManualFallbackBroadcast(
  clientId: string,
  conversation: IWebChatConversation,
  settings: Awaited<ReturnType<typeof loadInboxSettings>>,
): Promise<FallbackWhatsappRotationResult> {
  const result = await handleWebChatNoAgentOnline(clientId, conversation, {
    skipTeamRotation: true,
  });
  return { kind: 'exhausted', visitorMessage: result.visitorMessage, alertSent: result.alertSent };
}

export async function handleWebChatNoAgentOnline(
  clientId: string,
  conversation: IWebChatConversation,
  opts?: { departmentName?: string; skipTeamRotation?: boolean },
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
    if (age < EXHAUSTED_ALERT_COOLDOWN_MS) {
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
    const sessionDigits = wa.getConnectedSessionPhoneDigits(clientId);
    const destinations = filterFallbackAlertPhones(phones, sessionDigits);
    if (destinations.length === 0) {
      logger.info('WhatsApp fallback: alert phones match session — skipped to avoid loop', {
        clientId,
      });
    }
    for (const dest of destinations) {
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
  } else if (!opts?.skipTeamRotation) {
    logger.info('WhatsApp fallback enabled but no alert phones configured', { clientId });
  } else {
    logger.info('WhatsApp fallback: team agents exhausted, no manual phones', { clientId });
  }

  if (alertSent) {
    conversation.whatsappFallbackAlertSentAt = new Date();
    await conversation.save();
  } else if (opts?.skipTeamRotation && phones.length === 0) {
    // Equipe esgotada e sem telefones manuais — evita scan infinito sem bloquear retry de alerta falho.
    conversation.whatsappFallbackAlertSentAt = new Date();
    await conversation.save();
  }

  return { visitorMessage, alertSent };
}
