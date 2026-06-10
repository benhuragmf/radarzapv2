import type { IAiConversationState } from '@/models/AiConversationState';
import type { AiStructuredReply } from '@/types/ai-assistant';
import type { InboxService } from '@/services/inbox/InboxService';
import {
  isTicketRefOnlyMessage,
  looksLikeTicketSupplement,
  normalizeTicketRef,
  parseTicketRefFromText,
} from '@/utils/ticket-ref';
import { logger } from '@/utils/logger';

export class AiTicketUpdateService {
  private static instance: AiTicketUpdateService;

  static getInstance(): AiTicketUpdateService {
    if (!this.instance) this.instance = new AiTicketUpdateService();
    return this.instance;
  }

  applyTargetTicketRef(
    state: IAiConversationState,
    structured: Pick<AiStructuredReply, 'targetTicketRef'>,
    clientText: string,
  ): void {
    const fromText = parseTicketRefFromText(clientText);
    if (fromText) state.targetTicketRef = fromText;
    if (structured.targetTicketRef?.trim()) {
      state.targetTicketRef = normalizeTicketRef(structured.targetTicketRef);
    }
  }

  resolveAppendBody(
    structured: Pick<AiStructuredReply, 'shouldAppendToTicket' | 'ticketAppendBody'>,
    clientText: string,
    state: IAiConversationState,
  ): string | null {
    if (!state.targetTicketRef) return null;

    const trimmed = clientText.trim();
    if (structured.shouldAppendToTicket) {
      const fromStructured = structured.ticketAppendBody?.trim();
      if (fromStructured) return fromStructured;
      if (trimmed && !isTicketRefOnlyMessage(trimmed) && !SHORT_ACK(trimmed)) {
        return trimmed;
      }
    }

    if (looksLikeTicketSupplement(trimmed)) return trimmed;
    return null;
  }

  async tryPersist(
    clientId: string,
    contactIdentifier: string,
    state: IAiConversationState,
    structured: AiStructuredReply,
    clientText: string,
    inbox: InboxService,
  ): Promise<boolean> {
    this.applyTargetTicketRef(state, structured, clientText);
    const body = this.resolveAppendBody(structured, clientText, state);
    if (!body || !state.targetTicketRef) return false;

    const ok = await inbox.appendTicketClientReplyFromAi(
      clientId,
      state.targetTicketRef,
      body,
      contactIdentifier,
    );
    if (!ok) {
      logger.warn('IA não encontrou ticket para gravar complemento', {
        clientId,
        ticketRef: state.targetTicketRef,
        bodyPreview: body.slice(0, 80),
      });
    } else {
      logger.info('IA gravou complemento no ticket', {
        clientId,
        ticketRef: state.targetTicketRef,
      });
    }
    return ok;
  }
}

function SHORT_ACK(text: string): boolean {
  return /^(sim|nao|não|s|ss|ok|positivo|isso|certo|obrigad|valeu|blz|beleza|tudo|so isso|só isso|isso e tudo|isso é tudo|era so|era só)[.!?\s]*$/i.test(
    text.trim(),
  );
}
