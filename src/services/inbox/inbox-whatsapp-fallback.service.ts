import type { IInboxConversation } from '@/models/InboxConversation';
import { InboxMessage } from '@/models/InboxMessage';
import { InboxDepartment } from '@/models/InboxDepartment';
import { loadInboxSettings } from '@/constants/inbox-triage';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';
import { generateInboxTicketRef } from '@/utils/inbox-ticket-ref';
import { DEFAULT_WHATSAPP_FALLBACK_VISITOR_MESSAGE } from '@/types/inbox-settings';
import { createServiceLogger } from '@/utils/logger';
import mongoose from 'mongoose';
import {
  filterFallbackAlertPhones,
  listFallbackWhatsappAgents,
  normalizeWhatsAppAlertDestination,
  pickNextFallbackAgent,
} from '@/services/webchat/webchat-whatsapp-fallback.service';
import {
  isFallbackAcceptTimeoutElapsed,
  isFallbackWaAssumirTimeoutElapsed,
  resolveFallbackAcceptTimeoutSeconds,
  resolveFallbackWaitMode,
  shouldRetryFallbackAfterCooldown,
  type FallbackTimingConversation,
} from '@/services/webchat/webchat-fallback-timing.util';

const logger = createServiceLogger('InboxWhatsAppFallback');

const EXHAUSTED_ALERT_COOLDOWN_MS = 15 * 60 * 1000;

export type InboxFallbackWhatsappRotationResult =
  | { kind: 'none' }
  | { kind: 'sent'; userId: string; agentName: string }
  | { kind: 'rotated'; fromUserId: string; toUserId: string; agentName: string }
  | { kind: 'exhausted'; clientMessage: string; alertSent: boolean };

export function resetInboxQueueFallbackState(conversation: IInboxConversation): void {
  conversation.whatsappFallbackTriedUserIds = undefined;
  conversation.whatsappFallbackWaNotifiedUserId = undefined;
  conversation.whatsappFallbackWaNotifiedAt = undefined;
  conversation.whatsappFallbackClientNotifiedAt = undefined;
  conversation.whatsappFallbackAlertSentAt = undefined;
  conversation.whatsappFallbackPriorityStartedAt = undefined;
}

export function inboxConvToFallbackTiming(conversation: IInboxConversation): FallbackTimingConversation {
  return {
    clientId: String(conversation.clientId),
    suggestedUserId: conversation.suggestedUserId?.toString() ?? null,
    suggestedAt: conversation.suggestedAt ?? null,
    queueEnteredAt: conversation.queueEnteredAt ?? null,
    whatsappFallbackPriorityStartedAt: conversation.whatsappFallbackPriorityStartedAt ?? null,
    whatsappFallbackWaNotifiedAt: conversation.whatsappFallbackWaNotifiedAt ?? null,
    whatsappFallbackWaNotifiedUserId: conversation.whatsappFallbackWaNotifiedUserId ?? null,
  };
}

export function buildWhatsAppInboxFallbackAlertBody(input: {
  ticketRef: string;
  contactName: string;
  contactPhone?: string;
  departmentName?: string;
  initialMessage?: string;
}): string {
  const ticketNum = input.ticketRef.replace(/^TK-/i, '');
  const lines = [
    'Novo atendimento na fila WhatsApp — Radar Chat',
    '',
    `Ticket: ${input.ticketRef}`,
    `Cliente: ${input.contactName}`,
    input.contactPhone ? `Telefone: ${input.contactPhone}` : null,
    input.departmentName ? `Setor: ${input.departmentName}` : null,
    input.initialMessage ? `Última mensagem:\n"${input.initialMessage.slice(0, 400)}"` : null,
    '',
    'Para assumir no painel ou pelo WhatsApp:',
    `!assumir ${ticketNum} — assume sem limite (site = bridge)`,
    `!pausar ${ticketNum} — pausa IA no WhatsApp QR; retoma sozinha depois`,
    '',
    'Consultar resumo:',
    `!ticket ${ticketNum}`,
    '',
    'Chamados abertos: !abertos · seus: !meus',
  ].filter((line): line is string => Boolean(line));
  return lines.join('\n');
}

async function ensureInboxConversationTicketRef(conversation: IInboxConversation): Promise<string> {
  if (conversation.ticketRef?.trim()) {
    return conversation.ticketRef.trim().toUpperCase();
  }
  const ref = generateInboxTicketRef();
  conversation.ticketRef = ref;
  await conversation.save();
  return ref;
}

async function lastInboundMessageBody(
  conversationId: mongoose.Types.ObjectId,
): Promise<string | undefined> {
  const msg = await InboxMessage.findOne({
    conversationId,
    direction: 'inbound',
  })
    .sort({ createdAt: -1 })
    .select('body')
    .lean();
  return msg?.body?.trim() || undefined;
}

async function resolveDepartmentName(
  clientId: string,
  departmentId?: mongoose.Types.ObjectId | null,
): Promise<string | undefined> {
  if (!departmentId) return undefined;
  const dept = await InboxDepartment.findOne({
    _id: departmentId,
    clientId: new mongoose.Types.ObjectId(clientId),
  })
    .select('name')
    .lean();
  return dept?.name?.trim() || undefined;
}

async function buildAlertBodyForInboxConversation(
  clientId: string,
  conversation: IInboxConversation,
): Promise<string> {
  const ticketRef = await ensureInboxConversationTicketRef(conversation);
  const initialMessage = await lastInboundMessageBody(conversation._id as mongoose.Types.ObjectId);
  const departmentName = await resolveDepartmentName(clientId, conversation.departmentId);
  return buildWhatsAppInboxFallbackAlertBody({
    ticketRef,
    contactName: conversation.contactName?.trim() || 'Cliente',
    contactPhone: conversation.contactIdentifier?.trim(),
    departmentName,
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
    logger.warn('Inbox WhatsApp fallback alert failed', {
      clientId,
      destination: destinations[0].slice(0, 6) + '…',
      err: (err as Error).message,
    });
    return false;
  }
}

async function sendFallbackAlertToAgent(
  clientId: string,
  conversation: IInboxConversation,
  agent: { userId: string; whatsappPhone: string },
): Promise<boolean> {
  const alertBody = await buildAlertBodyForInboxConversation(clientId, conversation);
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
        conversation.contactName?.trim(),
      );
    }
  }
  return sent;
}

async function broadcastFallbackAlert(
  clientId: string,
  conversation: IInboxConversation,
  settings: Awaited<ReturnType<typeof loadInboxSettings>>,
): Promise<boolean> {
  const alertBody = await buildAlertBodyForInboxConversation(clientId, conversation);
  const phones = (settings.whatsappFallbackAlertPhones ?? [])
    .map(normalizeWhatsAppAlertDestination)
    .filter((p): p is string => Boolean(p));

  if (!phones.length) {
    logger.info('Inbox WhatsApp fallback: no alert phones configured', { clientId });
    return false;
  }

  const wa = WhatsAppService.getInstance();
  const sessionDigits = wa.getConnectedSessionPhoneDigits(clientId);
  const destinations = filterFallbackAlertPhones(phones, sessionDigits);
  if (!destinations.length) {
    logger.info('Inbox WhatsApp fallback: alert phones match session — skipped', { clientId });
    return false;
  }

  let alertSent = false;
  for (const dest of destinations) {
    try {
      const result = await wa.sendInternalAlert(clientId, dest, alertBody);
      if (result.success) alertSent = true;
    } catch (err) {
      logger.warn('Inbox WhatsApp fallback broadcast failed', {
        clientId,
        destination: dest.slice(0, 6) + '…',
        err: (err as Error).message,
      });
    }
  }
  return alertSent;
}

async function finalizeManualFallbackBroadcast(
  clientId: string,
  conversation: IInboxConversation,
  settings: Awaited<ReturnType<typeof loadInboxSettings>>,
): Promise<InboxFallbackWhatsappRotationResult> {
  const result = await handleInboxQueueNoAgentOnline(clientId, conversation, settings, {
    skipTeamRotation: true,
  });
  return { kind: 'exhausted', clientMessage: result.clientMessage, alertSent: result.alertSent };
}

/** Envia alerta WA para equipe quando fila WhatsApp nativa estoura timeout. */
export async function processInboxFallbackWhatsappRotation(
  clientId: string,
  conversation: IInboxConversation,
  opts?: { immediate?: boolean; timeoutSeconds?: number; allowRetry?: boolean },
): Promise<InboxFallbackWhatsappRotationResult> {
  const settings = await loadInboxSettings(clientId);
  if (!settings.whatsappFallbackEnabled) return { kind: 'none' };

  const timingConv = inboxConvToFallbackTiming(conversation);

  const exhaustedCooldown = shouldRetryFallbackAfterCooldown(
    conversation.whatsappFallbackAlertSentAt,
    EXHAUSTED_ALERT_COOLDOWN_MS,
  );
  if (conversation.whatsappFallbackAlertSentAt && !exhaustedCooldown && !opts?.allowRetry) {
    return { kind: 'none' };
  }

  if (exhaustedCooldown && conversation.whatsappFallbackAlertSentAt) {
    resetInboxQueueFallbackState(conversation);
  }

  const mode = resolveFallbackWaitMode(clientId, timingConv);
  const timeoutSec =
    opts?.timeoutSeconds ?? resolveFallbackAcceptTimeoutSeconds(settings, mode);

  const nowMs = Date.now();

  if (
    !opts?.immediate &&
    !isFallbackAcceptTimeoutElapsed(clientId, timingConv, settings, nowMs)
  ) {
    return { kind: 'none' };
  }

  const agents = await listFallbackWhatsappAgents(
    clientId,
    conversation.departmentId as mongoose.Types.ObjectId | undefined,
  );
  const tried = [...(conversation.whatsappFallbackTriedUserIds ?? [])];
  const currentSuggested = conversation.suggestedUserId?.toString() ?? null;
  const waNotified = conversation.whatsappFallbackWaNotifiedUserId?.trim() || null;

  if (agents.length >= 1) {
    if (!currentSuggested) {
      const first = pickNextFallbackAgent(agents, tried, null);
      if (!first) {
        return finalizeManualFallbackBroadcast(clientId, conversation, settings);
      }
      const sent = await sendFallbackAlertToAgent(clientId, conversation, first);
      conversation.suggestedUserId = new mongoose.Types.ObjectId(first.userId);
      conversation.suggestedAt = new Date();
      if (!conversation.whatsappFallbackPriorityStartedAt) {
        conversation.whatsappFallbackPriorityStartedAt = new Date();
      }
      conversation.whatsappFallbackWaNotifiedUserId = first.userId;
      conversation.whatsappFallbackWaNotifiedAt = new Date();
      await conversation.save();
      if (sent) {
        logger.info('Inbox WA fallback: alert sent to first agent', {
          clientId,
          userId: first.userId,
        });
      }
      return { kind: 'sent', userId: first.userId, agentName: first.displayName };
    }

    if (waNotified === currentSuggested) {
      if (
        !isFallbackWaAssumirTimeoutElapsed(clientId, timingConv, settings, nowMs)
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
          logger.info('Inbox WA fallback: alert sent to suggested agent', {
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
    conversation.suggestedUserId = new mongoose.Types.ObjectId(next.userId);
    conversation.suggestedAt = new Date();
    if (!conversation.whatsappFallbackPriorityStartedAt) {
      conversation.whatsappFallbackPriorityStartedAt = new Date();
    }
    conversation.whatsappFallbackWaNotifiedUserId = next.userId;
    conversation.whatsappFallbackWaNotifiedAt = new Date();
    await conversation.save();

    if (sent) {
      logger.info('Inbox WA fallback: rotated alert to next agent', {
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

export async function handleInboxQueueNoAgentOnline(
  clientId: string,
  conversation: IInboxConversation,
  settings?: Awaited<ReturnType<typeof loadInboxSettings>>,
  opts?: { skipTeamRotation?: boolean },
): Promise<{ clientMessage: string; alertSent: boolean }> {
  const resolvedSettings = settings ?? (await loadInboxSettings(clientId));
  const defaultMsg =
    'Nenhum atendente disponível no momento — sua conversa permanece na fila e responderemos em breve.';

  if (!resolvedSettings.whatsappFallbackEnabled) {
    return { clientMessage: defaultMsg, alertSent: false };
  }

  const clientMessage =
    resolvedSettings.whatsappFallbackVisitorMessage?.trim() ||
    DEFAULT_WHATSAPP_FALLBACK_VISITOR_MESSAGE;

  if (conversation.whatsappFallbackAlertSentAt) {
    const age = Date.now() - conversation.whatsappFallbackAlertSentAt.getTime();
    if (age < EXHAUSTED_ALERT_COOLDOWN_MS) {
      return { clientMessage, alertSent: false };
    }
  }

  const alertSent = await broadcastFallbackAlert(clientId, conversation, resolvedSettings);

  if (alertSent) {
    conversation.whatsappFallbackAlertSentAt = new Date();
    await conversation.save();
  } else if (opts?.skipTeamRotation) {
    conversation.whatsappFallbackAlertSentAt = new Date();
    await conversation.save();
  }

  return { clientMessage, alertSent };
}

export { EXHAUSTED_ALERT_COOLDOWN_MS as INBOX_FALLBACK_EXHAUSTED_COOLDOWN_MS };
