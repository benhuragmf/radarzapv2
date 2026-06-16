import {
  type InboxMenuContext,
  INBOX_MENU_CONTEXT_TTL_MS,
  isMenuContextActive,
} from '@/types/inbox-menu-context';
import { InboxConversationStatus } from '@/types/inbox';
import {
  isNewServiceGreeting,
  isTicketClientAcknowledgment,
  wantsRejectTicket,
  parseTicketFollowUpChoice,
  parseTicketClientExit,
  parseTicketFinalize,
  parseTicketStatusRequest,
  type TicketInboundMode,
  type InboxTicketStatus,
} from '@/types/inbox-ticket';
import { isClosedTicketReplyWindowActive } from '@/services/inbox/ticket-reply-window.util';

export type TicketCaptureDecision = 'capture' | 'release_inbox' | 'defer_inbox';

export interface TicketInboundRoutingInput {
  trimmed: string;
  ticketStatus: InboxTicketStatus;
  ticketInboundMode?: TicketInboundMode;
  clientReplyPaused: boolean;
  clientReplyExpiresAt?: Date;
  lastTeamMessageAt?: Date;
  closedAt?: Date;
  clientReplyGraceUntil?: Date;
  teamHasMessagedClient: boolean;
  lastMenuContext?: InboxMenuContext;
  lastMenuSentAt?: Date;
  conversationStatus?: InboxConversationStatus;
  /** Menu de setores enviado recentemente ou conversa em bot_triage (histórico de mensagens). */
  inboxTriageActive?: boolean;
  /** IA coletando / aguardando / escalada — ticket não captura ack solto. */
  aiTriageActive?: boolean;
  inboxMenuChoice: string | null;
  now?: Date;
}

function isExplicitTicketMode(mode: TicketInboundMode | undefined): boolean {
  return mode === 'ticket' || mode === 'awaiting_follow_up';
}

/** Inbox ou IA ao vivo — ticket só captura em modo explícito ou grace de complemento. */
export function isInboxServiceCompeting(input: TicketInboundRoutingInput): boolean {
  return Boolean(
    input.inboxTriageActive ||
      input.aiTriageActive ||
      input.conversationStatus === InboxConversationStatus.BOT_TRIAGE ||
      input.conversationStatus === InboxConversationStatus.WAITING_QUEUE ||
      input.conversationStatus === InboxConversationStatus.IN_PROGRESS,
  );
}

function withinClosedReplyWindow(input: TicketInboundRoutingInput, now: Date): boolean {
  return isClosedTicketReplyWindowActive(
    {
      status: 'closed',
      clientReplyExpiresAt: input.clientReplyExpiresAt,
      lastTeamMessageAt: input.lastTeamMessageAt,
      closedAt: input.closedAt,
    },
    now,
  );
}

function graceActive(until: Date | undefined, now: Date): boolean {
  if (!until) return false;
  return now < new Date(until);
}

/** Cliente pediu explicitamente novo atendimento (texto ou menu ticket). */
export function wantsNewInboundService(trimmed: string): boolean {
  if (!trimmed) return false;
  if (wantsRejectTicket(trimmed)) return true;
  if (isNewServiceGreeting(trimmed)) return true;
  const norm = trimmed.trim().toLowerCase();
  if (norm === 'novo' || norm === 'novo atendimento') return true;
  return parseTicketFollowUpChoice(trimmed) === 'new_service';
}

/**
 * Decide se o ticket pode capturar a mensagem antes de retornar true no handler.
 * Inbox tem prioridade quando há menu de triagem ativo ou intenção de novo atendimento.
 */
export function evaluateTicketInboundRouting(
  input: TicketInboundRoutingInput,
): TicketCaptureDecision {
  const now = input.now ?? new Date();
  const within12h = withinClosedReplyWindow(input, now);
  const inOpenTicketContext =
    input.ticketStatus !== 'closed' && input.teamHasMessagedClient;

  if (input.ticketInboundMode === 'new_service') return 'release_inbox';

  if (wantsRejectTicket(input.trimmed)) return 'release_inbox';

  if (
    isInboxServiceCompeting(input) &&
    !isExplicitTicketMode(input.ticketInboundMode) &&
    !graceActive(input.clientReplyGraceUntil, now)
  ) {
    return 'release_inbox';
  }

  if (inOpenTicketContext) {
    if (wantsNewInboundService(input.trimmed)) return 'release_inbox';
    if (
      input.inboxMenuChoice &&
      (input.inboxTriageActive ||
        isMenuContextActive(
          input.lastMenuContext,
          input.lastMenuSentAt,
          'inbox_triage',
          INBOX_MENU_CONTEXT_TTL_MS,
          now.getTime(),
        ))
    ) {
      return 'release_inbox';
    }
    if (
      input.clientReplyPaused &&
      within12h &&
      !wantsNewInboundService(input.trimmed)
    ) {
      const follow = parseTicketFollowUpChoice(input.trimmed);
      if (follow === 'ticket' || parseTicketStatusRequest(input.trimmed)) {
        return 'capture';
      }
      return 'defer_inbox';
    }
    if (parseTicketClientExit(input.trimmed) || parseTicketFinalize(input.trimmed)) {
      return 'capture';
    }
    if (graceActive(input.clientReplyGraceUntil, now)) return 'capture';
    if (isTicketClientAcknowledgment(input.trimmed)) return 'capture';
    return 'capture';
  }

  if (within12h && graceActive(input.clientReplyGraceUntil, now)) {
    return 'capture';
  }

  if (
    within12h &&
    isTicketClientAcknowledgment(input.trimmed) &&
    !input.clientReplyPaused &&
    !isInboxServiceCompeting(input)
  ) {
    return 'capture';
  }

  if (input.conversationStatus === InboxConversationStatus.BOT_TRIAGE) {
    return 'release_inbox';
  }

  if (input.inboxTriageActive || input.aiTriageActive) {
    return 'release_inbox';
  }

  if (wantsNewInboundService(input.trimmed)) return 'release_inbox';

  if (input.inboxMenuChoice) {
    if (
      isMenuContextActive(
        input.lastMenuContext,
        input.lastMenuSentAt,
        'inbox_triage',
        INBOX_MENU_CONTEXT_TTL_MS,
        now.getTime(),
      )
    ) {
      return 'release_inbox';
    }
  }

  if (input.ticketStatus === 'closed' && !within12h) return 'release_inbox';

  if (
    isMenuContextActive(
      input.lastMenuContext,
      input.lastMenuSentAt,
      'inbox_triage',
      INBOX_MENU_CONTEXT_TTL_MS,
      now.getTime(),
    )
  ) {
    return 'release_inbox';
  }

  if (
    isMenuContextActive(
      input.lastMenuContext,
      input.lastMenuSentAt,
      'ticket_grace_expired',
      INBOX_MENU_CONTEXT_TTL_MS,
      now.getTime(),
    )
  ) {
    const choice = parseTicketGraceExpiredChoice(input.trimmed);
    if (choice === 'new_service') return 'release_inbox';
    if (choice === 'add_info' || choice === 'wait_ticket') return 'capture';
  }

  if (
    isMenuContextActive(
      input.lastMenuContext,
      input.lastMenuSentAt,
      'ticket_followup',
      INBOX_MENU_CONTEXT_TTL_MS,
      now.getTime(),
    )
  ) {
    const follow = parseTicketFollowUpChoice(input.trimmed);
    if (follow === 'new_service') return 'release_inbox';
    if (follow === 'ticket') return 'capture';
  }

  if (parseTicketClientExit(input.trimmed) || parseTicketFinalize(input.trimmed)) {
    return 'capture';
  }

  if (input.ticketInboundMode === 'ticket' || input.ticketInboundMode === 'awaiting_follow_up') {
    if (parseTicketStatusRequest(input.trimmed)) return 'capture';
    if (within12h || inOpenTicketContext) return 'capture';
  }

  if (within12h) {
    if (input.clientReplyPaused) {
      const follow = parseTicketFollowUpChoice(input.trimmed);
      if (follow === 'ticket' || parseTicketStatusRequest(input.trimmed)) {
        return 'capture';
      }
      return 'defer_inbox';
    }
    if (graceActive(input.clientReplyGraceUntil, now)) {
      return 'capture';
    }
    return 'capture';
  }

  return 'release_inbox';
}

export type TicketGraceExpiredChoice = 'add_info' | 'new_service' | 'wait_ticket';

export function parseTicketGraceExpiredChoice(text: string): TicketGraceExpiredChoice | null {
  const norm = text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!norm) return null;
  if (
    norm === '1' ||
    norm === 'info' ||
    norm === 'informacao' ||
    norm === 'complemento' ||
    norm === 'enviar'
  ) {
    return 'add_info';
  }
  if (norm === '2' || norm === 'novo' || norm === 'novo atendimento') return 'new_service';
  if (norm === '3' || norm === 'aguardar' || norm === 'retorno') return 'wait_ticket';
  return null;
}

export function buildTicketGraceExpiredMenu(): string {
  return (
    'As informações complementares deste chamado já foram registradas.\n\n' +
    '*1* — Enviar nova informação para este chamado\n' +
    '*2* — Iniciar novo atendimento\n' +
    '*3* — Aguardar retorno da equipe\n\n' +
    'Responda com o número ou digite *NOVO* para novo atendimento.'
  );
}

export const TICKET_GRACE_REOPEN_ACK =
  'Certo! Você tem até 30 minutos para enviar complementos (texto, foto ou documento) neste chamado.';

export const TICKET_GRACE_EXPIRED_HINT =
  'As informações complementares deste chamado já foram registradas. Para iniciar um novo atendimento, digite *NOVO*.';

export const TICKET_WAITING_RETURN_ACK =
  'Certo! Quando nossa equipe enviar uma nova atualização neste chamado, você poderá responder por aqui.';
