import mongoose from 'mongoose';
import type { IDestination } from '@/models/Destination';
import { Destination } from '@/models/Destination';
import type { IInboxConversation } from '@/models/InboxConversation';
import {
  buildAiTicketChoiceMenu,
  clientWantsTicketInteraction,
  isTicketRefOnlyMessage,
  looksLikeTicketSupplement,
  parseAiTicketMenuChoice,
  parseTicketRefFromText,
} from '@/utils/ticket-ref';
import {
  classifyTicketClientIntent,
  ticketIntentBlocksAppend,
  ticketIntentNeedsAssist,
} from '@/utils/ticket-client-intent';
import { AiTicketAssistService } from '@/services/ai/AiTicketAssistService';
import { setContactMenuContext } from '@/services/inbox/menu-context';
import type { InboxService } from '@/services/inbox/InboxService';
import { listClientFacingTickets } from '@/services/inbox/client-ticket-list';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('TicketClientMenuService');

export class TicketClientMenuService {
  private static instance: TicketClientMenuService;

  static getInstance(): TicketClientMenuService {
    if (!this.instance) this.instance = new TicketClientMenuService();
    return this.instance;
  }

  async handleInbound(
    clientId: string,
    conversation: IInboxConversation,
    dest: IDestination,
    text: string,
    inbox: InboxService,
  ): Promise<boolean> {
    const trimmed = text.trim();
    if (!trimmed) return false;

    if (dest.pendingTicketTargetRef) {
      const ref = dest.pendingTicketTargetRef;
      const intent = classifyTicketClientIntent(trimmed);

      if (ticketIntentNeedsAssist(intent)) {
        const assist = await AiTicketAssistService.getInstance().handle({
          clientId,
          text: trimmed,
          ticketRef: ref,
          inbox,
        });
        if (assist.handled && assist.reply) {
          if (intent === 'decline') {
            await this.clearTicketMenuState(dest._id as mongoose.Types.ObjectId);
          }
          await inbox.sendAiReply(clientId, conversation, dest.identifier, assist.reply);
          return true;
        }
      }

      if (
        !ticketIntentBlocksAppend(intent) &&
        looksLikeTicketSupplement(trimmed)
      ) {
        const saved = await inbox.appendTicketClientReplyFromAi(
          clientId,
          ref,
          trimmed,
          dest.identifier,
        );
        if (saved) {
          await this.clearTicketMenuState(dest._id as mongoose.Types.ObjectId);
          await inbox.sendAiReply(
            clientId,
            conversation,
            dest.identifier,
            `Sua informação foi registrada no ticket *${ref}*. Nossa equipe será avisada.`,
          );
          return true;
        }
      }
    }

    if (dest.pendingTicketMenuChoices?.length) {
      if (/^novo\b/i.test(trimmed)) {
        await this.clearTicketMenuState(dest._id as mongoose.Types.ObjectId);
        return false;
      }
      const picked = parseAiTicketMenuChoice(trimmed, dest.pendingTicketMenuChoices);
      if (picked) {
        await Destination.updateOne(
          { _id: dest._id },
          {
            $set: { pendingTicketTargetRef: picked },
            $unset: { pendingTicketMenuChoices: 1 },
          },
        );
        if (looksLikeTicketSupplement(trimmed) && !isTicketRefOnlyMessage(trimmed)) {
          const saved = await inbox.appendTicketClientReplyFromAi(
            clientId,
            picked,
            trimmed,
            dest.identifier,
          );
          if (saved) {
            await this.clearTicketMenuState(dest._id as mongoose.Types.ObjectId);
            await inbox.sendAiReply(
              clientId,
              conversation,
              dest.identifier,
              `Sua informação foi registrada no ticket *${picked}*. Nossa equipe será avisada.`,
            );
            return true;
          }
        }
        await inbox.sendAiReply(
          clientId,
          conversation,
          dest.identifier,
          `Chamado *${picked}* selecionado. O que você gostaria de adicionar?`,
        );
        return true;
      }
      await inbox.sendAiReply(
        clientId,
        conversation,
        dest.identifier,
        `Responda com o número (1–${dest.pendingTicketMenuChoices.length}) ou o código *TK-…*. Digite *novo* para outro assunto.`,
      );
      return true;
    }

    const refOnly = parseTicketRefFromText(trimmed);
    if (refOnly && isTicketRefOnlyMessage(trimmed)) {
      await Destination.updateOne(
        { _id: dest._id },
        { $set: { pendingTicketTargetRef: refOnly }, $unset: { pendingTicketMenuChoices: 1 } },
      );
      await inbox.sendAiReply(
        clientId,
        conversation,
        dest.identifier,
        `Chamado *${refOnly}* selecionado. O que você gostaria de adicionar?`,
      );
      return true;
    }

    if (!clientWantsTicketInteraction(trimmed) || looksLikeTicketSupplement(trimmed)) {
      return false;
    }

    const tickets = await listClientFacingTickets(
      clientId,
      dest._id as mongoose.Types.ObjectId,
    );

    if (tickets.length === 0) {
      await inbox.sendAiReply(
        clientId,
        conversation,
        dest.identifier,
        'Não encontrei chamados anteriores na sua conta. Descreva sua solicitação ou aguarde o menu de setores.',
      );
      return true;
    }

    if (tickets.length === 1) {
      const ref = tickets[0].ref;
      await Destination.updateOne(
        { _id: dest._id },
        { $set: { pendingTicketTargetRef: ref }, $unset: { pendingTicketMenuChoices: 1 } },
      );
      await inbox.sendAiReply(
        clientId,
        conversation,
        dest.identifier,
        `Encontrei o chamado *${ref}*. O que você gostaria de adicionar?`,
      );
      return true;
    }

    const choices = tickets.map(t => t.ref);
    await Destination.updateOne(
      { _id: dest._id },
      { $set: { pendingTicketMenuChoices: choices }, $unset: { pendingTicketTargetRef: 1 } },
    );
    await setContactMenuContext(dest._id as mongoose.Types.ObjectId, 'ticket_pick');
    await inbox.sendAiReply(
      clientId,
      conversation,
      dest.identifier,
      buildAiTicketChoiceMenu(tickets),
    );
    logger.info('Menu de tickets enviado (bot)', { clientId, count: choices.length });
    return true;
  }

  private async clearTicketMenuState(destinationId: mongoose.Types.ObjectId): Promise<void> {
    await Destination.updateOne(
      { _id: destinationId },
      { $unset: { pendingTicketMenuChoices: 1, pendingTicketTargetRef: 1 } },
    );
  }
}
