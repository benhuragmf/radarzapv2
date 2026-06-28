import mongoose from 'mongoose';
import { CompanyMember } from '@/models/CompanyMember';
import { WebChatConversation, IWebChatConversation } from '@/models/WebChatConversation';
import {
  resolveAuthorizedWhatsappAgentFromContext,
  sendWhatsappInternalReply,
  type WhatsappSenderContext,
} from '@/services/inbox/whatsapp-agent-auth.service';
import { WebChatService } from '@/services/webchat/WebChatService';
import { InboxService } from '@/services/inbox/InboxService';
import { visitorDisplayName } from '@/services/webchat/webchat-inbox-bridge';
import {
  formatVisitorBridgeMessage,
  parseBridgeReplyRouting,
} from '@/utils/webchat-whatsapp-bridge.util';
import {
  assertBridgeClientMatch,
  buildBridgeIdempotencyKey,
  isBridgeLoopRisk,
  shouldProcessBridgeAgentReply,
} from '@/utils/webchat-bridge.util';
import { acquireBridgeForwardDedup } from '@/services/webchat/bridge-forward-dedup.service';
import { createServiceLogger } from '@/utils/logger';
import { recordAttendanceEvent } from '@/services/attendance/attendance-audit.service';
import { WebhookDispatcherService } from '@/services/integrations/WebhookDispatcherService';

const logger = createServiceLogger('WebChatWhatsAppBridge');

export async function activateWhatsappBridge(
  clientId: string,
  conversationId: string,
  agentUserId: string,
): Promise<void> {
  await WebChatConversation.updateOne(
    {
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    },
    {
      $set: {
        whatsappBridgeActive: true,
        whatsappBridgeAgentUserId: agentUserId,
        whatsappBridgeActivatedAt: new Date(),
      },
    },
  );

  const conversation = await WebChatConversation.findById(conversationId);
  if (!conversation) return;

  assertBridgeClientMatch(clientId, String(conversation.clientId));

  await WebChatService.getInstance().appendBridgeSystemMessage(
    conversation,
    'Bridge WhatsApp ativo — mensagens do visitante serão encaminhadas ao seu WhatsApp. Responda por aqui para o visitante ver no chat.',
  );

  await recordAttendanceEvent({
    clientId,
    kind: 'bridge.started',
    conversationId,
    actorUserId: agentUserId,
    ticketRef: conversation.ticketRef ?? undefined,
  });

  WebhookDispatcherService.getInstance().emit(clientId, 'webchat.bridge.started', {
    conversation_id: conversationId,
    ticket_ref: conversation.ticketRef ?? null,
    agent_user_id: agentUserId,
    visitor_name: conversation.visitorName ?? null,
  });
}

export async function deactivateWhatsappBridge(
  clientId: string,
  conversationId: string,
): Promise<void> {
  await WebChatConversation.updateOne(
    {
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    },
    {
      $set: { whatsappBridgeActive: false },
      $unset: { whatsappBridgeAgentUserId: '', whatsappBridgeActivatedAt: '' },
    },
  );

  await recordAttendanceEvent({
    clientId,
    kind: 'bridge.closed',
    conversationId,
  });

  WebhookDispatcherService.getInstance().emit(clientId, 'webchat.bridge.closed', {
    conversation_id: conversationId,
  });
}

async function agentWhatsappDestination(
  clientId: string,
  agentUserId: string,
): Promise<string | null> {
  const member = await CompanyMember.findOne({
    organizationId: new mongoose.Types.ObjectId(clientId),
    userId: new mongoose.Types.ObjectId(agentUserId),
    isActive: true,
  })
    .select('whatsappPhone')
    .lean();
  const phone = member?.whatsappPhone?.trim();
  return phone || null;
}

/** Visitante → WhatsApp do atendente (bridge ativo). */
export async function forwardVisitorMessageToWhatsappBridge(
  conversation: IWebChatConversation,
  body: string,
  opts?: { mediaLabel?: string },
): Promise<void> {
  if (!conversation.whatsappBridgeActive || !conversation.whatsappBridgeAgentUserId) return;

  const forwardBody = opts?.mediaLabel ?? body.trim();
  if (!forwardBody) return;

  const dedupeKey = buildBridgeIdempotencyKey(
    String(conversation.clientId),
    String(conversation._id),
    forwardBody,
  );
  if (!(await acquireBridgeForwardDedup(dedupeKey))) {
    logger.info('bridge:forward_skipped_duplicate', {
      clientId: String(conversation.clientId),
      conversationId: String(conversation._id),
    });
    await recordAttendanceEvent({
      clientId: String(conversation.clientId),
      kind: 'bridge.loop_prevented',
      conversationId: String(conversation._id),
      meta: { reason: 'duplicate_forward' },
    });
    return;
  }

  const clientId = String(conversation.clientId);
  const destination = await agentWhatsappDestination(
    clientId,
    conversation.whatsappBridgeAgentUserId,
  );
  if (!destination) {
    logger.warn('Bridge active but agent has no whatsappPhone', {
      clientId,
      conversationId: String(conversation._id),
    });
    return;
  }

  const { contactName } = visitorDisplayName(
    conversation.visitorName,
    conversation.visitorEmail,
    conversation.visitorPhone,
  );

  const text = formatVisitorBridgeMessage({
    ticketRef: conversation.ticketRef,
    visitorName: contactName,
    body,
    mediaLabel: opts?.mediaLabel,
  });

  try {
    await sendWhatsappInternalReply(clientId, destination, text);
    await recordAttendanceEvent({
      clientId,
      kind: 'bridge.message_forwarded',
      conversationId: String(conversation._id),
      actorUserId: conversation.whatsappBridgeAgentUserId,
      ticketRef: conversation.ticketRef ?? undefined,
      meta: { direction: 'visitor_to_agent' },
    });
  } catch (err) {
    logger.warn('Failed to forward visitor message to WhatsApp bridge', {
      clientId,
      err: (err as Error).message,
    });
  }
}

async function findActiveBridgeConversations(
  clientId: string,
  agentUserId: string,
): Promise<IWebChatConversation[]> {
  return WebChatConversation.find({
    clientId: new mongoose.Types.ObjectId(clientId),
    whatsappBridgeActive: true,
    whatsappBridgeAgentUserId: agentUserId,
    status: 'open',
  })
    .sort({ whatsappBridgeActivatedAt: -1 })
    .limit(10);
}

/** WhatsApp do atendente → visitante no chat (bridge ativo). Retorna true se consumiu a mensagem. */
export async function handleWhatsappBridgeAgentReply(
  ctx: WhatsappSenderContext & { text: string; replyJid: string },
): Promise<boolean> {
  const trimmed = ctx.text.trim();
  if (!shouldProcessBridgeAgentReply(trimmed)) {
    if (trimmed && isBridgeLoopRisk(trimmed)) {
      await recordAttendanceEvent({
        clientId: ctx.clientId,
        kind: 'bridge.loop_prevented',
        actorUserId: (await resolveAuthorizedWhatsappAgentFromContext(ctx))?.userId,
        meta: { reason: 'loop_risk_reply' },
      });
    }
    return false;
  }

  const agent = await resolveAuthorizedWhatsappAgentFromContext(ctx);
  if (!agent) return false;

  const bridges = await findActiveBridgeConversations(ctx.clientId, agent.userId);
  if (bridges.length === 0) return false;

  const routing = parseBridgeReplyRouting(trimmed);
  if (!routing.body) return true;

  let conversation: IWebChatConversation | undefined;

  if (routing.ticketRef) {
    conversation = bridges.find(c => c.ticketRef?.toUpperCase() === routing.ticketRef);
    if (!conversation) {
      await sendWhatsappInternalReply(
        ctx.clientId,
        ctx.replyJid,
        `Nenhum bridge ativo para ${routing.ticketRef}. Use !ticket para ver chamados abertos.`,
      );
      return true;
    }
  } else if (bridges.length === 1) {
    conversation = bridges[0];
  } else {
    const refs = bridges
      .map(c => c.ticketRef)
      .filter(Boolean)
      .join(', ');
    await sendWhatsappInternalReply(
      ctx.clientId,
      ctx.replyJid,
      `Vários chamados ativos (${refs}). Envie: TK-XXXX sua resposta`,
    );
    return true;
  }

  try {
    await WebChatService.getInstance().sendAgentMessage(
      ctx.clientId,
      agent.userId,
      String(conversation!._id),
      routing.body,
      agent.displayName,
      { humanDelay: 'bridge' },
    );
    const ref = conversation!.ticketRef?.trim().toUpperCase();
    if (ref) {
      void InboxService.getInstance()
        .recordTicketClientVisibleCommentFromBridge(
          ctx.clientId,
          agent.userId,
          ref,
          routing.body,
        )
        .catch(err => {
          logger.warn('Bridge ticket comment sync failed', {
            clientId: ctx.clientId,
            err: (err as Error).message,
          });
        });
    }
    await recordAttendanceEvent({
      clientId: ctx.clientId,
      kind: 'bridge.agent_reply',
      conversationId: String(conversation!._id),
      actorUserId: agent.userId,
      ticketRef: ref,
      meta: { bodyLength: routing.body.length },
    });
  } catch (err) {
    logger.warn('Bridge agent reply failed', {
      clientId: ctx.clientId,
      err: (err as Error).message,
    });
    await sendWhatsappInternalReply(
      ctx.clientId,
      ctx.replyJid,
      `Não foi possível enviar ao visitante: ${(err as Error).message}`,
    );
  }

  return true;
}
