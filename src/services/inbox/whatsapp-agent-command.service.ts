import mongoose from 'mongoose';
import { InboxTicket, IInboxTicket } from '@/models/InboxTicket';
import { User } from '@/models/User';
import { WebChatConversation, IWebChatConversation } from '@/models/WebChatConversation';
import { INBOX_TICKET_STATUS_LABEL, ticketIsActive } from '@/types/inbox-ticket';
import {
  normalizeCommandTicketRef,
  parseWhatsappAgentCommand,
  WHATSAPP_AGENT_COMMAND_HELP,
} from '@/utils/whatsapp-agent-command.util';
import { WebChatService } from '@/services/webchat/WebChatService';
import { InboxService } from '@/services/inbox/InboxService';
import { createServiceLogger } from '@/utils/logger';
import {
  resolveAuthorizedWhatsappAgentFromContext,
  sendWhatsappInternalReply,
  type WhatsappSenderContext,
} from '@/services/inbox/whatsapp-agent-auth.service';
import { activateWhatsappBridge } from '@/services/webchat/webchat-whatsapp-bridge.service';

const logger = createServiceLogger('WhatsappAgentCommand');

export interface WhatsappAgentCommandInput extends WhatsappSenderContext {
  text: string;
  /** JID onde enviar a resposta (grupo ou DM). */
  replyJid: string;
}

async function replyCommand(clientId: string, replyJid: string, body: string): Promise<void> {
  await sendWhatsappInternalReply(clientId, replyJid, body);
}

async function findTicketByRef(
  clientId: string,
  ticketRef: string,
): Promise<{ ticket: IInboxTicket | null; webChat: IWebChatConversation | null }> {
  const clientOid = new mongoose.Types.ObjectId(clientId);
  const ticket = await InboxTicket.findOne({ clientId: clientOid, ticketRef });
  if (ticket) {
    let webChat: IWebChatConversation | null = null;
    if (ticket.webChatConversationId) {
      webChat = await WebChatConversation.findOne({
        _id: ticket.webChatConversationId,
        clientId: clientOid,
      });
    }
    return { ticket, webChat };
  }

  const webChat = await WebChatConversation.findOne({
    clientId: clientOid,
    ticketRef,
    status: 'open',
  });
  return { ticket: null, webChat };
}

async function handleAssumir(
  clientId: string,
  userId: string,
  ticketRef: string,
): Promise<string> {
  const { ticket, webChat } = await findTicketByRef(clientId, ticketRef);

  if (webChat || ticket?.webChatConversationId) {
    const conversation =
      webChat ??
      (await WebChatConversation.findOne({
        _id: ticket!.webChatConversationId,
        clientId: new mongoose.Types.ObjectId(clientId),
      }));
    if (!conversation) return `Chamado ${ticketRef} não encontrado.`;
    if (conversation.status === 'closed') return `Conversa do chamado ${ticketRef} já está encerrada.`;

    if (
      conversation.queueStatus === 'with_agent' &&
      conversation.assignedUserId &&
      String(conversation.assignedUserId) !== userId
    ) {
      const other = await User.findById(conversation.assignedUserId)
        .select('displayName email')
        .lean();
      const otherName =
        other?.displayName?.trim() || other?.email?.split('@')[0] || 'outro atendente';
      return `Chamado ${ticketRef} já está com ${otherName}.`;
    }

    await WebChatService.getInstance().assignConversation(
      clientId,
      userId,
      String(conversation._id),
    );

    await WebChatService.getInstance().convertToTicket(
      clientId,
      userId,
      String(conversation._id),
    );

    const freshConv = await WebChatConversation.findById(conversation._id).select('ticketRef').lean();
    const resolvedRef = (freshConv?.ticketRef ?? ticketRef).trim().toUpperCase();

    const ticketDoc = await InboxTicket.findOne({
      clientId: new mongoose.Types.ObjectId(clientId),
      ticketRef: resolvedRef,
    });
    if (!ticketDoc) {
      return `Falha ao registrar chamado ${ticketRef}. Tente novamente ou abra pelo painel.`;
    }

    ticketDoc.assignedUserId = new mongoose.Types.ObjectId(userId);
    ticketDoc.status = 'in_progress';
    await ticketDoc.save();

    await activateWhatsappBridge(clientId, String(conversation._id), userId);

    return [
      `Você assumiu ${ticketRef}.`,
      `Canal: chat do site (bridge WhatsApp ativo)`,
      `Cliente: ${ticketDoc.contactName}`,
      '',
      'Responda aqui no WhatsApp — o visitante verá no chat do site.',
      'Vários chamados? Use: TK-XXXX sua mensagem',
      '',
      `Painel → Inbox → ${ticketRef}`,
    ].join('\n');
  }

  if (ticket?.conversationId) {
    if (!ticketIsActive(ticket.status)) {
      return `Chamado ${ticketRef} está fechado.`;
    }
    if (
      ticket.assignedUserId &&
      String(ticket.assignedUserId) !== userId &&
      ticket.status === 'in_progress'
    ) {
      return `Chamado ${ticketRef} já está em atendimento por outro agente.`;
    }

    await InboxService.getInstance().assignConversation(
      clientId,
      userId,
      String(ticket.conversationId),
    );
    ticket.assignedUserId = new mongoose.Types.ObjectId(userId);
    ticket.status = 'in_progress';
    await ticket.save();

    return [
      `Você assumiu ${ticketRef}.`,
      `Canal: WhatsApp`,
      `Cliente: ${ticket.contactName}`,
      '',
      `Painel → Inbox → ${ticketRef}`,
    ].join('\n');
  }

  return `Chamado ${ticketRef} não encontrado. Verifique o número TK-… do alerta.`;
}

async function handleToken(clientId: string, userId: string, ticketRef: string): Promise<string> {
  const { ticket, webChat } = await findTicketByRef(clientId, ticketRef);

  if (!webChat && !ticket?.webChatConversationId) {
    return `Chamado ${ticketRef} não é do chat do site. Token de consulta vale só para visitantes do widget.`;
  }

  const conversation =
    webChat ??
    (await WebChatConversation.findOne({
      _id: ticket!.webChatConversationId,
      clientId: new mongoose.Types.ObjectId(clientId),
    }));
  if (!conversation) return `Conversa de ${ticketRef} não encontrada.`;

  try {
    const result = await WebChatService.getInstance().sendTicketTokenToVisitor(
      clientId,
      userId,
      String(conversation._id),
    );
    const tokenLine =
      result.token === '(enviado no chat do visitante)'
        ? 'Token enviado no chat do visitante.'
        : `Token: *${result.token}*${result.rotated ? ' (anterior invalidado)' : ''}`;
    return [
      `Token enviado ao visitante no chat do site.`,
      `Chamado: ${result.ticketRef}`,
      tokenLine,
      '',
      'Peça para usar *Consultar chamado* no widget.',
    ].join('\n');
  } catch (err) {
    return (err as Error).message || `Não foi possível enviar token de ${ticketRef}.`;
  }
}

async function handleTicketSummary(clientId: string, ticketRef: string): Promise<string> {
  const { ticket, webChat } = await findTicketByRef(clientId, ticketRef);
  const ref = ticket?.ticketRef ?? webChat?.ticketRef ?? ticketRef;

  if (!ticket && !webChat) {
    return `Chamado ${ticketRef} não encontrado.`;
  }

  const status = ticket?.status ?? (webChat?.status === 'open' ? 'open' : 'closed');
  const channel = ticket?.channel ?? (webChat ? 'webchat_site' : 'whatsapp');
  const contact =
    ticket?.contactName ??
    webChat?.visitorName?.trim() ??
    webChat?.visitorEmail?.trim() ??
    'Visitante';
  const preview =
    webChat?.lastMessagePreview?.trim() ||
    (ticket ? `Status: ${INBOX_TICKET_STATUS_LABEL[status as keyof typeof INBOX_TICKET_STATUS_LABEL] ?? status}` : '—');

  let assignee = '—';
  const assigneeId = ticket?.assignedUserId ?? webChat?.assignedUserId;
  if (assigneeId) {
    const u = await User.findById(assigneeId).select('displayName email').lean();
    assignee = u?.displayName?.trim() || u?.email?.split('@')[0] || 'Atendente';
  }

  const bridgeLine = webChat?.whatsappBridgeActive ? 'Bridge WhatsApp: ativo' : null;

  const lines = [
    `Ticket: ${ref}`,
    `Status: ${INBOX_TICKET_STATUS_LABEL[status as keyof typeof INBOX_TICKET_STATUS_LABEL] ?? status}`,
    `Canal: ${channel === 'webchat_site' ? 'Chat do site' : 'WhatsApp'}`,
    `Cliente: ${contact}`,
    `Responsável: ${assignee}`,
    bridgeLine,
    preview ? `Última msg: ${preview.slice(0, 120)}` : null,
  ].filter((line): line is string => Boolean(line));

  return lines.join('\n');
}

async function handleEncerrarChat(
  clientId: string,
  userId: string,
  ticketRef: string,
): Promise<string> {
  const { ticket, webChat } = await findTicketByRef(clientId, ticketRef);

  if (!webChat && !ticket?.webChatConversationId) {
    return `Chamado ${ticketRef} não é chat do site. Use !encerrar para finalizar o chamado.`;
  }

  const conversation =
    webChat ??
    (await WebChatConversation.findOne({
      _id: ticket!.webChatConversationId,
      clientId: new mongoose.Types.ObjectId(clientId),
    }));
  if (!conversation) return `Conversa de ${ticketRef} não encontrada.`;

  if (conversation.status === 'closed') {
    return `Conversa de ${ticketRef} já está encerrada.`;
  }

  if (!conversation.whatsappBridgeActive) {
    return [
      `Bridge WhatsApp não está ativo em ${ticketRef}.`,
      'Use !encerrar para finalizar o chamado e a conversa.',
    ].join('\n');
  }

  try {
    await WebChatService.getInstance().endWhatsappBridgeOnly(
      clientId,
      String(conversation._id),
      userId,
    );
  } catch (err) {
    return (err as Error).message || `Não foi possível encerrar o chat de ${ticketRef}.`;
  }

  return [
    `Atendimento de ${ticketRef} encerrado para o visitante no chat do site.`,
    'Bridge WhatsApp desativado.',
    'Chamado permanece aberto no painel para registro.',
    '',
    'Para arquivar o chamado no sistema: !encerrar ' + ticketRef.replace(/^TK-/i, ''),
  ].join('\n');
}

async function handleEncerrar(
  clientId: string,
  userId: string,
  ticketRef: string,
): Promise<string> {
  const { ticket, webChat } = await findTicketByRef(clientId, ticketRef);

  if (!ticket && !webChat) {
    return `Chamado ${ticketRef} não encontrado.`;
  }

  if (ticket?.channel === 'whatsapp' && ticket.conversationId && ticketIsActive(ticket.status)) {
    try {
      await InboxService.getInstance().closeTicket(clientId, userId, ticketRef);
      return `Chamado ${ticketRef} encerrado. Cliente notificado no WhatsApp.`;
    } catch (err) {
      return (err as Error).message || `Não foi possível encerrar ${ticketRef}.`;
    }
  }

  if (webChat || ticket?.webChatConversationId) {
    const conversation =
      webChat ??
      (await WebChatConversation.findOne({
        _id: ticket!.webChatConversationId,
        clientId: new mongoose.Types.ObjectId(clientId),
      }));
    if (!conversation) return `Conversa de ${ticketRef} não encontrada.`;

    if (ticket && ticketIsActive(ticket.status)) {
      ticket.status = 'closed';
      ticket.closedByUserId = new mongoose.Types.ObjectId(userId);
      ticket.closedAt = new Date();
      await ticket.save();
    }

    if (conversation.status === 'open') {
      await WebChatService.getInstance().closeConversation(
        clientId,
        String(conversation._id),
        userId,
      );
    }

    return `Chamado ${ticketRef} finalizado. Visitante notificado no chat do site.`;
  }

  if (ticket && ticketIsActive(ticket.status)) {
    ticket.status = 'closed';
    ticket.closedByUserId = new mongoose.Types.ObjectId(userId);
    ticket.closedAt = new Date();
    await ticket.save();
    return `Chamado ${ticketRef} encerrado.`;
  }

  return `Chamado ${ticketRef} já estava fechado.`;
}

/**
 * Processa comando operacional (!assumir etc.) de atendente autorizado.
 * Retorna true se a mensagem foi consumida (comando reconhecido).
 */
export async function handleWhatsappAgentCommand(
  input: WhatsappAgentCommandInput,
): Promise<boolean> {
  const parsed = parseWhatsappAgentCommand(input.text);
  if (!parsed) {
    if (input.text.trim().startsWith('!')) {
      await replyCommand(
        input.clientId,
        input.replyJid,
        'Comando não reconhecido. Envie !ajuda para ver os comandos.',
      );
      return true;
    }
    return false;
  }

  const agent = await resolveAuthorizedWhatsappAgentFromContext(input);
  if (!agent) {
    await replyCommand(
      input.clientId,
      input.replyJid,
      'Comando não autorizado. Cadastre seu WhatsApp em Equipe → editar membro → WhatsApp pessoal.',
    );
    return true;
  }

  try {
    if (parsed.command === 'ajuda' || parsed.command === 'help') {
      await replyCommand(input.clientId, input.replyJid, WHATSAPP_AGENT_COMMAND_HELP);
      return true;
    }

    const ticketRef = normalizeCommandTicketRef(parsed.arg!);

    let response: string;
    switch (parsed.command) {
      case 'assumir':
        response = await handleAssumir(input.clientId, agent.userId, ticketRef);
        break;
      case 'ticket':
        response = await handleTicketSummary(input.clientId, ticketRef);
        break;
      case 'token':
        response = await handleToken(input.clientId, agent.userId, ticketRef);
        break;
      case 'encerrar':
        response = await handleEncerrar(input.clientId, agent.userId, ticketRef);
        break;
      case 'encerrarchat':
      case 'sairchat':
      case 'fecharchat':
        response = await handleEncerrarChat(input.clientId, agent.userId, ticketRef);
        break;
      default:
        response = WHATSAPP_AGENT_COMMAND_HELP;
    }

    await replyCommand(input.clientId, input.replyJid, response);
  } catch (err) {
    logger.warn('WhatsApp agent command failed', {
      clientId: input.clientId,
      command: parsed.command,
      err: (err as Error).message,
    });
    await replyCommand(
      input.clientId,
      input.replyJid,
      `Erro ao processar comando: ${(err as Error).message}`,
    );
  }

  return true;
}
