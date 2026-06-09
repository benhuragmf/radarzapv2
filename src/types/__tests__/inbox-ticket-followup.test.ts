import {
  parseTicketFollowUpChoice,
  parseTicketStatusRequest,
  parseTicketFinalize,
  TICKET_FOLLOW_UP_MENU_AFTER_HOURS,
  TICKET_POST_CLOSE_REPLY_HOURS,
} from '@/types/inbox-ticket';

describe('inbox ticket follow-up', () => {
  it('constantes de prazo', () => {
    expect(TICKET_POST_CLOSE_REPLY_HOURS).toBe(12);
    expect(TICKET_FOLLOW_UP_MENU_AFTER_HOURS).toBe(2);
  });

  it('parseTicketFollowUpChoice', () => {
    expect(parseTicketFollowUpChoice('1')).toBe('ticket');
    expect(parseTicketFollowUpChoice('2')).toBe('new_service');
    expect(parseTicketFollowUpChoice('novo atendimento')).toBe('new_service');
    expect(parseTicketFollowUpChoice('status')).toBe('ticket');
    expect(parseTicketFollowUpChoice('olá')).toBeNull();
  });

  it('parseTicketStatusRequest e finalizar', () => {
    expect(parseTicketStatusRequest('status')).toBe(true);
    expect(parseTicketFinalize('finalizar')).toBe(true);
  });
});
