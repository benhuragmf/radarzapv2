import { AiAutoResolveService } from '@/services/ai/AiAutoResolveService';
import type { InboxService } from '@/services/inbox/InboxService';
import {
  classifyTicketClientIntent,
  ticketIntentShouldTryResolve,
  type TicketClientIntent,
} from '@/utils/ticket-client-intent';

export interface TicketAssistResult {
  handled: boolean;
  reply?: string;
  intent?: TicketClientIntent;
}

/**
 * Assistente inteligente no contexto de ticket: classifica intenção,
 * responde status, tenta auto-resolve (KB/skills) antes de gravar no chamado.
 */
export class AiTicketAssistService {
  private static instance: AiTicketAssistService;

  static getInstance(): AiTicketAssistService {
    if (!this.instance) this.instance = new AiTicketAssistService();
    return this.instance;
  }

  async handle(params: {
    clientId: string;
    text: string;
    ticketRef: string;
    inbox: InboxService;
    contactName?: string;
  }): Promise<TicketAssistResult> {
    const intent = classifyTicketClientIntent(params.text);

    if (intent === 'decline') {
      const first = params.contactName?.trim().split(/\s+/)[0];
      return {
        handled: true,
        intent,
        reply: first
          ? `Entendido, ${first}! Se precisar de algo, é só chamar.`
          : 'Entendido! Se precisar de algo, é só chamar.',
      };
    }

    if (intent === 'status_inquiry') {
      const reply = await params.inbox.getTicketStatusReplyForClient(
        params.clientId,
        params.ticketRef,
      );
      if (!reply) return { handled: false, intent };
      const first = params.contactName?.trim().split(/\s+/)[0];
      return {
        handled: true,
        intent,
        reply: first ? `${first}, ${reply.charAt(0).toLowerCase()}${reply.slice(1)}` : reply,
      };
    }

    if (ticketIntentShouldTryResolve(intent)) {
      const brief = await params.inbox.getTicketBriefForAssist(params.clientId, params.ticketRef);
      const auto = await AiAutoResolveService.getInstance().tryResolve(params.clientId, params.text, {
        threadContext: brief?.contextBlock,
        ticketAssist: true,
      });

      if (auto.hit && auto.reply) {
        const first = params.contactName?.trim().split(/\s+/)[0];
        const prefix = first ? `${first}, ` : '';
        return {
          handled: true,
          intent,
          reply:
            `${prefix}${auto.reply}\n\n` +
            `Isso responde sua dúvida sobre o chamado *${params.ticketRef}*? ` +
            `Se não, descreva ou digite *atendente*.`,
        };
      }

      if (intent === 'question') {
        const statusReply = await params.inbox.getTicketStatusReplyForClient(
          params.clientId,
          params.ticketRef,
        );
        if (statusReply) {
          const first = params.contactName?.trim().split(/\s+/)[0];
          return {
            handled: true,
            intent,
            reply:
              (first ? `${first}, ` : '') +
              `sobre o chamado *${params.ticketRef}*:\n\n${statusReply}\n\n` +
              'Se sua dúvida for outra, descreva com detalhes ou digite *atendente*.',
          };
        }
      }
    }

    return { handled: false, intent };
  }
}
