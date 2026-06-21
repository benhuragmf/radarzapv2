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
import { createServiceLogger } from '@/utils/logger';

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

  await WebChatService.getInstance().appendBridgeSystemMessage(
    conversation,
    'Bridge WhatsApp ativo — mensagens do visitante serão encaminhadas ao seu WhatsApp. Responda por aqui para o visitante ver no chat.',
  );
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
  if (!trimmed || trimmed.startsWith('!')) return false;

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
    );
    const ref = conversation!.ticketRef?.trim().toUpperCase();
    if (ref) {
      await InboxService.getInstance().recordTicketClientVisibleCommentFromBridge(
        ctx.clientId,
        agent.userId,
        ref,
        routing.body,
      );
    }
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
