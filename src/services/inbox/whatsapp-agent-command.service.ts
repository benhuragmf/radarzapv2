import mongoose from 'mongoose';
import { InboxTicket, IInboxTicket } from '@/models/InboxTicket';
import { InboxConversation, IInboxConversation } from '@/models/InboxConversation';
import { InboxConversationStatus } from '@/types/inbox';
import { User } from '@/models/User';
import { WebChatConversation, IWebChatConversation } from '@/models/WebChatConversation';
import { INBOX_TICKET_STATUS_LABEL, ticketIsActive } from '@/types/inbox-ticket';
import {
  normalizeCommandTicketRef,
  parseCommandTicketArg,
  parseWhatsappAgentCommand,
  isPlaceholderTicketOpeningMessage,
} from '@/utils/whatsapp-agent-command.util';
import { WebChatService } from '@/services/webchat/WebChatService';
import { InboxService } from '@/services/inbox/InboxService';
import { visitorDisplayName } from '@/services/webchat/webchat-inbox-bridge';
import { createServiceLogger } from '@/utils/logger';
import {
  resolveAuthorizedWhatsappAgentFromContext,
  sendWhatsappInternalReply,
  type WhatsappSenderContext,
} from '@/services/inbox/whatsapp-agent-auth.service';
import { activateWhatsappBridge } from '@/services/webchat/webchat-whatsapp-bridge.service';
import {
  buildDynamicWhatsappAgentHelp,
  executeCustomWhatsappCommand,
  isSystemCommandAvailable,
  loadWhatsappBridgeCommandsConfig,
  mapSystemCommandNameToHandler,
  parseCustomWhatsappCommand,
  resolveSystemCommandIdByName,
} from '@/services/inbox/whatsapp-bridge-commands.service';
import {
  clearWaAgentFocus,
  clearWaAgentPendingAlert,
  formatNumberedPicklist,
  getWaAgentFocus,
  resolveAgentTicketRef,
  resolveTicketCommandArg,
  resolveTicketOnlyArg,
  saveWaAgentPicklist,
  setWaAgentFocus,
  type WaAgentPicklistEntry,
} from '@/services/inbox/whatsapp-agent-focus.service';

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
): Promise<{
  ticket: IInboxTicket | null;
  webChat: IWebChatConversation | null;
  inboxConv: IInboxConversation | null;
}> {
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
    let inboxConv: IInboxConversation | null = null;
    if (ticket.conversationId) {
      inboxConv = await InboxConversation.findOne({
        _id: ticket.conversationId,
        clientId: clientOid,
      });
    }
    return { ticket, webChat, inboxConv };
  }

  const webChat = await WebChatConversation.findOne({
    clientId: clientOid,
    ticketRef,
    status: 'open',
  });
  if (webChat) {
    return { ticket: null, webChat, inboxConv: null };
  }

  const inboxConv = await InboxConversation.findOne({
    clientId: clientOid,
    ticketRef,
    status: {
      $in: [
        InboxConversationStatus.WAITING_QUEUE,
        InboxConversationStatus.IN_PROGRESS,
        InboxConversationStatus.BOT_TRIAGE,
      ],
    },
  });
  return { ticket: null, webChat: null, inboxConv };
}

async function applyTicketOpeningContext(
  ticket: IInboxTicket,
  userId: string,
  message: string,
): Promise<void> {
  const text = message.trim().slice(0, 2000);
  if (!text || isPlaceholderTicketOpeningMessage(text)) return;
  if (!ticket.subject?.trim()) {
    ticket.subject = text.slice(0, 200);
  }
  if (!ticket.internalNotesList) ticket.internalNotesList = [];
  ticket.internalNotesList.push({
    userId: new mongoose.Types.ObjectId(userId),
    body: text,
    createdAt: new Date(),
  });
  ticket.updatedAt = new Date();
  await ticket.save();
}

function formatChannelLabel(channel?: string, bridge?: boolean): string {
  if (channel === 'webchat_site') {
    return bridge ? 'site · bridge' : 'site';
  }
  if (channel === 'whatsapp') return 'WA';
  return '—';
}

async function handleAbertos(clientId: string, agentUserId: string): Promise<string> {
  const clientOid = new mongoose.Types.ObjectId(clientId);
  const tickets = await InboxTicket.find({
    clientId: clientOid,
    status: { $in: ['open', 'in_progress', 'client_replied'] },
  })
    .sort({ updatedAt: -1 })
    .limit(20)
    .select('ticketRef status channel contactName assignedUserId webChatConversationId')
    .lean();

  const openConvs = await WebChatConversation.find({
    clientId: clientOid,
    status: 'open',
    ticketRef: { $exists: true, $nin: [null, ''] },
  })
    .select('ticketRef visitorName assignedUserId whatsappBridgeActive')
    .lean();

  const bridgeByRef = new Map(
    openConvs.map(c => [(c.ticketRef ?? '').trim().toUpperCase(), Boolean(c.whatsappBridgeActive)]),
  );

  const formalRefs = new Set(tickets.map(t => t.ticketRef.toUpperCase()));
  const informal = openConvs.filter(c => {
    const ref = (c.ticketRef ?? '').trim().toUpperCase();
    return ref && !formalRefs.has(ref);
  });

  if (tickets.length === 0 && informal.length === 0) {
    await saveWaAgentPicklist(clientId, agentUserId, []);
    return 'Nenhum chamado aberto no momento.';
  }

  const assigneeIds = [
    ...new Set([
      ...tickets.map(t => (t.assignedUserId ? String(t.assignedUserId) : '')),
      ...informal.map(c => (c.assignedUserId ? String(c.assignedUserId) : '')),
    ].filter(Boolean)),
  ];
  const users = assigneeIds.length
    ? await User.find({ _id: { $in: assigneeIds } }).select('displayName email').lean()
    : [];
  const userName = (id?: string | null) => {
    if (!id) return '—';
    const u = users.find(x => String(x._id) === id);
    return u?.displayName?.trim() || u?.email?.split('@')[0] || 'Atendente';
  };

  const picklist: WaAgentPicklistEntry[] = [];
  const detailLines: string[] = [];

  for (const t of tickets) {
    const status =
      INBOX_TICKET_STATUS_LABEL[t.status as keyof typeof INBOX_TICKET_STATUS_LABEL] ?? t.status;
    picklist.push({ ticketRef: t.ticketRef, label: t.contactName || 'Cliente' });
    detailLines.push(
      `${t.ticketRef} · ${status} · ${t.contactName} · ${formatChannelLabel(t.channel, bridgeByRef.get(t.ticketRef.toUpperCase()))} · ${userName(t.assignedUserId ? String(t.assignedUserId) : null)}`,
    );
  }

  for (const c of informal.slice(0, 10)) {
    const ref = (c.ticketRef ?? '').trim().toUpperCase();
    const name = c.visitorName?.trim() || 'Visitante';
    picklist.push({ ticketRef: ref, label: name });
    detailLines.push(
      `${ref} · conversa site (use !abrir) · ${name} · ${c.whatsappBridgeActive ? 'bridge' : '—'} · ${userName(c.assignedUserId ? String(c.assignedUserId) : null)}`,
    );
  }

  await saveWaAgentPicklist(clientId, agentUserId, picklist);

  const numbered = formatNumberedPicklist(
    `Chamados abertos (${picklist.length}):`,
    picklist,
    '!assumir 1 — assume pelo número · !ticket TK-… — detalhes · !meus — só os seus',
  );

  return [numbered, '', '— Detalhes —', ...detailLines].join('\n');
}

async function handleMeus(clientId: string, userId: string): Promise<string> {
  const clientOid = new mongoose.Types.ObjectId(clientId);
  const userOid = new mongoose.Types.ObjectId(userId);

  const tickets = await InboxTicket.find({
    clientId: clientOid,
    assignedUserId: userOid,
    status: { $in: ['open', 'in_progress', 'client_replied'] },
  })
    .sort({ updatedAt: -1 })
    .limit(15)
    .select('ticketRef status channel contactName')
    .lean();

  const convs = await WebChatConversation.find({
    clientId: clientOid,
    assignedUserId: userOid,
    status: 'open',
  })
    .sort({ updatedAt: -1 })
    .limit(10)
    .select('ticketRef visitorName whatsappBridgeActive')
    .lean();

  const ticketRefs = new Set(tickets.map(t => t.ticketRef.toUpperCase()));
  const convOnly = convs.filter(c => {
    const ref = (c.ticketRef ?? '').trim().toUpperCase();
    return !ref || !ticketRefs.has(ref);
  });

  if (tickets.length === 0 && convOnly.length === 0) {
    await saveWaAgentPicklist(clientId, userId, []);
    return 'Você não tem chamados ou conversas em andamento.';
  }

  const picklist: WaAgentPicklistEntry[] = [];
  const detailLines: string[] = [];

  for (const t of tickets) {
    const status =
      INBOX_TICKET_STATUS_LABEL[t.status as keyof typeof INBOX_TICKET_STATUS_LABEL] ?? t.status;
    picklist.push({ ticketRef: t.ticketRef, label: t.contactName || 'Cliente' });
    detailLines.push(`${t.ticketRef} · ${status} · ${t.contactName} · ${formatChannelLabel(t.channel)}`);
  }

  for (const c of convOnly) {
    const ref = (c.ticketRef ?? '—').trim().toUpperCase() || '—';
    const name = c.visitorName?.trim() || 'Visitante';
    if (ref !== '—') {
      picklist.push({ ticketRef: ref, label: name });
    }
    detailLines.push(
      `${ref} · conversa site · ${name}${c.whatsappBridgeActive ? ' · bridge ativo' : ''}`,
    );
  }

  await saveWaAgentPicklist(clientId, userId, picklist);

  const numbered = formatNumberedPicklist(
    `Seus atendimentos (${picklist.length}):`,
    picklist,
    '!assumir 1 — foco pelo número · !foco — contexto atual',
  );

  return [numbered, '', '— Detalhes —', ...detailLines].join('\n');
}

async function handleFoco(clientId: string, userId: string): Promise<string> {
  const focus = await getWaAgentFocus(clientId, userId);
  if (!focus?.ticketRef) {
    return [
      'Nenhum foco ativo.',
      'Use !assumir (alerta pendente), !assumir 1 após !abertos, ou !assumir TK-…',
    ].join('\n');
  }
  const { ticket, webChat } = await findTicketByRef(clientId, focus.ticketRef);
  const clientLabel =
    focus.label ||
    ticket?.contactName ||
    webChat?.visitorName?.trim() ||
    'Cliente';
  const bridge =
    webChat?.whatsappBridgeActive ||
    (ticket?.webChatConversationId
      ? (
          await WebChatConversation.findById(ticket.webChatConversationId)
            .select('whatsappBridgeActive')
            .lean()
        )?.whatsappBridgeActive
      : false);

  return [
    `Foco: ${focus.ticketRef}`,
    `Cliente: ${clientLabel}`,
    bridge ? 'Bridge WhatsApp: ativo' : 'Bridge: inativo (use !assumir se for chat do site)',
    '',
    '!trocar 2 — mudar foco · !nota texto — nota no foco atual',
  ].join('\n');
}

async function handleTrocar(
  clientId: string,
  userId: string,
  rawArg?: string,
): Promise<string> {
  const resolved = await resolveAgentTicketRef(clientId, userId, rawArg);
  if (resolved.ok === false) return resolved.message;

  const { ticket, webChat } = await findTicketByRef(clientId, resolved.ticketRef);
  const conv =
    webChat ??
    (ticket?.webChatConversationId
      ? await WebChatConversation.findById(ticket.webChatConversationId)
      : null);

  if (conv?.whatsappBridgeActive && String(conv.whatsappBridgeAgentUserId) === userId) {
    await setWaAgentFocus(clientId, userId, resolved.ticketRef, resolved.label);
    await clearWaAgentPendingAlert(clientId, userId);
    const name = resolved.label || conv.visitorName?.trim() || 'Cliente';
    return [
      `Foco alterado: ${resolved.ticketRef}`,
      `Cliente: ${name}`,
      'Bridge já ativo — responda direto no WhatsApp.',
    ].join('\n');
  }

  return handleAssumir(clientId, userId, resolved.ticketRef);
}

async function handleNota(
  clientId: string,
  userId: string,
  ticketRef: string,
  noteBody?: string,
): Promise<string> {
  if (!noteBody?.trim()) {
    return 'Use: !nota TK-XXXX texto da nota interna (ex.: @suporte2 @financeiro)';
  }

  const { ticket } = await findTicketByRef(clientId, ticketRef);
  if (!ticket) {
    return `Chamado ${ticketRef} não encontrado. Abra com !abrir antes de anotar.`;
  }

  try {
    await InboxService.getInstance().addTicketInternalNote(
      clientId,
      userId,
      ticketRef,
      noteBody.trim(),
    );
    return [`Nota interna registrada em ${ticketRef}.`, '(Só equipe — não vai ao cliente.)'].join(
      '\n',
    );
  } catch (err) {
    return (err as Error).message || `Não foi possível salvar nota em ${ticketRef}.`;
  }
}

async function commitAgentFocus(
  clientId: string,
  userId: string,
  ticketRef: string,
  label?: string,
): Promise<void> {
  await setWaAgentFocus(clientId, userId, ticketRef, label);
  await clearWaAgentPendingAlert(clientId, userId);
}

async function handleAssumir(
  clientId: string,
  userId: string,
  ticketRef: string,
): Promise<string> {
  const { ticket, webChat, inboxConv: inboxFromRef } = await findTicketByRef(clientId, ticketRef);

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

    if (ticket) {
      ticket.assignedUserId = new mongoose.Types.ObjectId(userId);
      ticket.status = 'in_progress';
      await ticket.save();
    }

    await activateWhatsappBridge(clientId, String(conversation._id), userId);

    const { contactName } = visitorDisplayName(
      conversation.visitorName,
      conversation.visitorEmail,
      conversation.visitorPhone,
    );
    const ref = (conversation.ticketRef ?? ticketRef).trim().toUpperCase();
    const ticketOpened = Boolean(ticket);
    const clientLabel = ticket?.contactName ?? contactName;

    await commitAgentFocus(clientId, userId, ref, clientLabel);

    return [
      `Você assumiu ${ref}.`,
      `Canal: chat do site (bridge WhatsApp ativo)`,
      `Cliente: ${clientLabel}`,
      '',
      'Responda aqui no WhatsApp — o visitante verá no chat do site.',
      'Comandos usam o foco atual (!foco) — !nota texto, sem repetir TK.',
      'Vários chamados? Use: TK-XXXX sua mensagem ou !trocar 2',
      '',
      ticketOpened
        ? `Chamado formal aberto. Reenvio de token: !token ${ref.replace(/^TK-/i, '')}`
        : `Para abrir chamado e enviar token ao visitante: !abrir ${ref.replace(/^TK-/i, '')}`,
      '',
      `Painel → Inbox → ${ref}`,
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

    await commitAgentFocus(clientId, userId, ticketRef, ticket.contactName);

    return [
      `Você assumiu ${ticketRef}.`,
      `Canal: WhatsApp`,
      `Cliente: ${ticket.contactName}`,
      '',
      `Painel → Inbox → ${ticketRef}`,
    ].join('\n');
  }

  const inboxConv = inboxFromRef;
  if (inboxConv) {
    if (
      inboxConv.status === InboxConversationStatus.IN_PROGRESS &&
      inboxConv.assignedUserId &&
      String(inboxConv.assignedUserId) !== userId
    ) {
      const other = await User.findById(inboxConv.assignedUserId)
        .select('displayName email')
        .lean();
      const otherName =
        other?.displayName?.trim() || other?.email?.split('@')[0] || 'outro atendente';
      return `Conversa ${ticketRef} já está com ${otherName}.`;
    }

    await InboxService.getInstance().assignConversation(
      clientId,
      userId,
      String(inboxConv._id),
    );

    const ref = (inboxConv.ticketRef ?? ticketRef).trim().toUpperCase();
    await commitAgentFocus(clientId, userId, ref, inboxConv.contactName);

    return [
      `Você assumiu ${ref}.`,
      `Canal: WhatsApp (fila Inbox)`,
      `Cliente: ${inboxConv.contactName}`,
      '',
      'Responda aqui no WhatsApp ou no painel Inbox.',
      '',
      `Painel → Inbox → ${ref}`,
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

  if (!ticket) {
    return [
      `Chamado ${ticketRef} ainda não foi aberto formalmente.`,
      `Use: !abrir ${ticketRef.replace(/^TK-/i, '')}`,
      'Ou no painel: Inbox → *Abrir chamado*.',
    ].join('\n');
  }

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
  const subjectLine = ticket?.subject?.trim() ? `Assunto: ${ticket.subject.trim().slice(0, 160)}` : null;

  const lines = [
    `Ticket: ${ref}`,
    `Status: ${INBOX_TICKET_STATUS_LABEL[status as keyof typeof INBOX_TICKET_STATUS_LABEL] ?? status}`,
    `Canal: ${channel === 'webchat_site' ? 'Chat do site' : 'WhatsApp'}`,
    `Cliente: ${contact}`,
    `Responsável: ${assignee}`,
    subjectLine,
    bridgeLine,
    preview ? `Última msg: ${preview.slice(0, 120)}` : null,
  ].filter((line): line is string => Boolean(line));

  return lines.join('\n');
}

async function handleAbrir(
  clientId: string,
  userId: string,
  ticketRef: string,
  openingMessage?: string,
): Promise<string> {
  const { ticket, webChat } = await findTicketByRef(clientId, ticketRef);

  if (webChat || ticket?.webChatConversationId) {
    const conversation =
      webChat ??
      (await WebChatConversation.findOne({
        _id: ticket!.webChatConversationId,
        clientId: new mongoose.Types.ObjectId(clientId),
      }));
    if (!conversation) return `Conversa ${ticketRef} não encontrada.`;
    if (conversation.status === 'closed') {
      return `Conversa ${ticketRef} encerrada — não é possível abrir chamado.`;
    }

    if (ticket?.publicAccessTokenHash) {
      if (openingMessage) {
        await applyTicketOpeningContext(ticket, userId, openingMessage);
        return [
          `Nota registrada em ${ticketRef}.`,
          `Motivo: ${openingMessage.slice(0, 160)}${openingMessage.length > 160 ? '…' : ''}`,
          '',
          `Reenviar token: !token ${ticketRef.replace(/^TK-/i, '')}`,
        ].join('\n');
      }
      return [
        `Chamado ${ticketRef} já está aberto.`,
        `Reenviar token: !token ${ticketRef.replace(/^TK-/i, '')}`,
        'Adicionar motivo: !nota TK-… texto ou !abrir TK-… motivo',
      ].join('\n');
    }

    await WebChatService.getInstance().assignConversation(
      clientId,
      userId,
      String(conversation._id),
    );

    let result: {
      ticketRef: string;
      ticketStatus: string;
      notifiedClient: boolean;
      ok: boolean;
    };
    try {
      result = await WebChatService.getInstance().convertToTicket(
        clientId,
        userId,
        String(conversation._id),
      );
    } catch (err) {
      return (err as Error).message || `Não foi possível abrir ${ticketRef}.`;
    }

    const ticketDoc = await InboxTicket.findOne({
      clientId: new mongoose.Types.ObjectId(clientId),
      ticketRef: result.ticketRef,
    });
    if (ticketDoc) {
      ticketDoc.assignedUserId = new mongoose.Types.ObjectId(userId);
      ticketDoc.status = 'in_progress';
      if (openingMessage) {
        if (!ticketDoc.subject?.trim() && !isPlaceholderTicketOpeningMessage(openingMessage)) {
          ticketDoc.subject = openingMessage.trim().slice(0, 200);
        }
        if (!isPlaceholderTicketOpeningMessage(openingMessage)) {
          if (!ticketDoc.internalNotesList) ticketDoc.internalNotesList = [];
          ticketDoc.internalNotesList.push({
            userId: new mongoose.Types.ObjectId(userId),
            body: openingMessage.trim().slice(0, 2000),
            createdAt: new Date(),
          });
        }
      }
      await ticketDoc.save();
    }

    const noteLine = openingMessage
      ? [`Motivo registrado: ${openingMessage.slice(0, 120)}${openingMessage.length > 120 ? '…' : ''}`, '']
      : [];

    if (result.notifiedClient) {
      return [
        `Chamado ${result.ticketRef} aberto.`,
        'Visitante notificado no chat do site com número e token de consulta.',
        ...noteLine,
        `Status: ${result.ticketStatus}`,
        `Reenvio: !token ${result.ticketRef.replace(/^TK-/i, '')}`,
      ].join('\n');
    }

    return [
      `Chamado ${result.ticketRef} registrado.`,
      'Visitante já havia sido notificado ou chamado já existia.',
      ...noteLine,
      `Reenvio de token: !token ${result.ticketRef.replace(/^TK-/i, '')}`,
    ].join('\n');
  }

  if (ticket?.conversationId) {
    try {
      const result = await InboxService.getInstance().convertToTicket(
        clientId,
        userId,
        String(ticket.conversationId),
      );
      if (openingMessage && result.ticketRef) {
        const ticketDoc = await InboxTicket.findOne({
          clientId: new mongoose.Types.ObjectId(clientId),
          ticketRef: result.ticketRef,
        });
        if (ticketDoc) await applyTicketOpeningContext(ticketDoc, userId, openingMessage);
      }
      if (result.notifiedClient) {
        const extra = openingMessage ? `\nMotivo: ${openingMessage.slice(0, 120)}` : '';
        return `Chamado ${result.ticketRef} aberto. Cliente notificado no WhatsApp.${extra}`;
      }
      return `Chamado ${result.ticketRef} já estava aberto.`;
    } catch (err) {
      return (err as Error).message || `Não foi possível abrir ${ticketRef}.`;
    }
  }

  return [
    `Conversa ${ticketRef} não encontrada.`,
    'Verifique o TK-… do alerta ou use !assumir antes, se for chat do site.',
  ].join('\n');
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

  const focus = await getWaAgentFocus(clientId, userId);
  if (focus?.ticketRef?.toUpperCase() === ticketRef.toUpperCase()) {
    await clearWaAgentFocus(clientId, userId);
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
      await clearWaAgentFocus(clientId, userId);
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

    await clearWaAgentFocus(clientId, userId);
    return `Chamado ${ticketRef} finalizado. Visitante notificado no chat do site.`;
  }

  if (ticket && ticketIsActive(ticket.status)) {
    ticket.status = 'closed';
    ticket.closedByUserId = new mongoose.Types.ObjectId(userId);
    ticket.closedAt = new Date();
    await ticket.save();
    await clearWaAgentFocus(clientId, userId);
    return `Chamado ${ticketRef} encerrado.`;
  }

  const focus = await getWaAgentFocus(clientId, userId);
  if (focus?.ticketRef?.toUpperCase() === ticketRef.toUpperCase()) {
    await clearWaAgentFocus(clientId, userId);
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
  const trimmed = input.text.trim();
  if (!trimmed.startsWith('!')) return false;

  const agent = await resolveAuthorizedWhatsappAgentFromContext(input);
  if (!agent) {
    await replyCommand(
      input.clientId,
      input.replyJid,
      'Comando não autorizado. Cadastre seu WhatsApp em Equipe → editar membro → WhatsApp pessoal.',
    );
    return true;
  }

  const bridgeConfig = await loadWhatsappBridgeCommandsConfig(input.clientId);
  if (!bridgeConfig.enabled) {
    await replyCommand(
      input.clientId,
      input.replyJid,
      'Comandos WhatsApp bridge desativados pela empresa. Fale com o administrador.',
    );
    return true;
  }

  const parsed = parseWhatsappAgentCommand(trimmed);
  const customParsed = !parsed
    ? parseCustomWhatsappCommand(trimmed, bridgeConfig.customCommands)
    : null;

  if (!parsed && !customParsed) {
    await replyCommand(
      input.clientId,
      input.replyJid,
      'Comando não reconhecido. Envie !ajuda para ver os comandos.',
    );
    return true;
  }

  try {
    if (customParsed) {
      const cmd = customParsed.command;
      if (!cmd.enabled || cmd.paused) {
        await replyCommand(
          input.clientId,
          input.replyJid,
          `Comando !${cmd.command} está pausado ou desativado.`,
        );
        return true;
      }
      let customArg = customParsed.arg;
      if (cmd.requiresTicketRef) {
        if (!customArg?.trim()) {
          const only = await resolveTicketOnlyArg(input.clientId, agent.userId);
          if (only.ok === false) {
            await replyCommand(input.clientId, input.replyJid, only.message);
            return true;
          }
          customArg = only.ticketRef.replace(/^TK-/i, '');
        } else {
          const resolved = await resolveTicketCommandArg(
            input.clientId,
            agent.userId,
            customParsed.arg,
          );
          if (resolved.ok === false) {
            await replyCommand(input.clientId, input.replyJid, resolved.message);
            return true;
          }
          customArg = resolved.message
            ? `${resolved.ticketRef.replace(/^TK-/i, '')} ${resolved.message}`
            : resolved.ticketRef.replace(/^TK-/i, '');
        }
      }
      const response = await executeCustomWhatsappCommand({
        clientId: input.clientId,
        userId: agent.userId,
        agentName: agent.displayName,
        command: cmd,
        arg: customArg,
      });
      await replyCommand(input.clientId, input.replyJid, response);
      return true;
    }

    const systemId = mapSystemCommandNameToHandler(parsed!.command);
    if (systemId && !isSystemCommandAvailable(bridgeConfig, systemId)) {
      const def = resolveSystemCommandIdByName(parsed!.command);
      await replyCommand(
        input.clientId,
        input.replyJid,
        def
          ? `Comando !${parsed!.command} está pausado ou desativado pela empresa.`
          : 'Comando não disponível.',
      );
      return true;
    }

    if (parsed!.command === 'ajuda' || parsed!.command === 'help') {
      await replyCommand(
        input.clientId,
        input.replyJid,
        buildDynamicWhatsappAgentHelp(bridgeConfig),
      );
      return true;
    }

    let response: string;
    switch (parsed!.command) {
      case 'abertos':
      case 'chamados':
        response = await handleAbertos(input.clientId, agent.userId);
        break;
      case 'meus':
        response = await handleMeus(input.clientId, agent.userId);
        break;
      case 'foco':
        response = await handleFoco(input.clientId, agent.userId);
        break;
      case 'assumir': {
        const resolved = await resolveAgentTicketRef(
          input.clientId,
          agent.userId,
          parsed.arg,
        );
        if (resolved.ok === false) {
          response = resolved.message;
          break;
        }
        response = await handleAssumir(input.clientId, agent.userId, resolved.ticketRef);
        break;
      }
      case 'trocar': {
        response = await handleTrocar(input.clientId, agent.userId, parsed.arg);
        break;
      }
      case 'abrir':
      case 'abrirchamado': {
        const resolved = await resolveTicketCommandArg(
          input.clientId,
          agent.userId,
          parsed.arg,
        );
        if (resolved.ok === false) {
          response = resolved.message;
          break;
        }
        response = await handleAbrir(
          input.clientId,
          agent.userId,
          resolved.ticketRef,
          resolved.message,
        );
        break;
      }
      case 'nota': {
        const resolved = await resolveTicketCommandArg(
          input.clientId,
          agent.userId,
          parsed.arg,
        );
        if (resolved.ok === false) {
          response = resolved.message;
          break;
        }
        response = await handleNota(
          input.clientId,
          agent.userId,
          resolved.ticketRef,
          resolved.message,
        );
        break;
      }
      case 'ticket': {
        const resolved = await resolveTicketOnlyArg(
          input.clientId,
          agent.userId,
          parsed.arg,
        );
        if (resolved.ok === false) {
          response = resolved.message;
          break;
        }
        response = await handleTicketSummary(input.clientId, resolved.ticketRef);
        break;
      }
      case 'token': {
        const resolved = await resolveTicketOnlyArg(
          input.clientId,
          agent.userId,
          parsed.arg,
        );
        if (resolved.ok === false) {
          response = resolved.message;
          break;
        }
        response = await handleToken(input.clientId, agent.userId, resolved.ticketRef);
        break;
      }
      case 'encerrar': {
        const resolved = await resolveTicketOnlyArg(
          input.clientId,
          agent.userId,
          parsed.arg,
        );
        if (resolved.ok === false) {
          response = resolved.message;
          break;
        }
        response = await handleEncerrar(input.clientId, agent.userId, resolved.ticketRef);
        break;
      }
      case 'encerrarchat':
      case 'sairchat':
      case 'fecharchat': {
        const resolved = await resolveTicketOnlyArg(
          input.clientId,
          agent.userId,
          parsed.arg,
        );
        if (resolved.ok === false) {
          response = resolved.message;
          break;
        }
        response = await handleEncerrarChat(input.clientId, agent.userId, resolved.ticketRef);
        break;
      }
      default:
        response = buildDynamicWhatsappAgentHelp(bridgeConfig);
    }

    await replyCommand(input.clientId, input.replyJid, response);
  } catch (err) {
    logger.warn('WhatsApp agent command failed', {
      clientId: input.clientId,
      command: parsed?.command ?? customParsed?.command.command,
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
