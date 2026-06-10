import { AiTicketAssistService } from '../AiTicketAssistService';
import { AiAutoResolveService } from '../AiAutoResolveService';

jest.mock('../AiAutoResolveService');

describe('AiTicketAssistService', () => {
  const svc = AiTicketAssistService.getInstance();
  const mockAuto = AiAutoResolveService.getInstance as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuto.mockReturnValue({
      tryResolve: jest.fn().mockResolvedValue({ hit: false }),
    });
  });

  it('responde recusa sem gravar', async () => {
    const result = await svc.handle({
      clientId: 'c1',
      text: 'não obrigado',
      ticketRef: 'TK-5NP8CT',
      inbox: {} as never,
      contactName: 'Maria Silva',
    });
    expect(result.handled).toBe(true);
    expect(result.intent).toBe('decline');
    expect(result.reply).toContain('Entendido, Maria');
  });

  it('responde consulta de status', async () => {
    const inbox = {
      getTicketStatusReplyForClient: jest
        .fn()
        .mockResolvedValue('Status: *Aberto* — nossa equipe foi avisada.'),
    };
    const result = await svc.handle({
      clientId: 'c1',
      text: 'Gostaria de saber o status dele?',
      ticketRef: 'TK-5NP8CT',
      inbox: inbox as never,
      contactName: 'João',
    });
    expect(result.handled).toBe(true);
    expect(result.intent).toBe('status_inquiry');
    expect(result.reply).toContain('status');
    expect(inbox.getTicketStatusReplyForClient).toHaveBeenCalledWith('c1', 'TK-5NP8CT');
  });

  it('tenta auto-resolve em pergunta antes de gravar', async () => {
    const tryResolve = jest.fn().mockResolvedValue({
      hit: true,
      reply: 'Você pode acompanhar pelo painel.',
      source: 'knowledge',
    });
    mockAuto.mockReturnValue({ tryResolve });

    const inbox = {
      getTicketBriefForAssist: jest.fn().mockResolvedValue({
        ticketRef: 'TK-5NP8CT',
        contextBlock: 'Ticket: TK-5NP8CT\nStatus: Aberto',
      }),
      getTicketStatusReplyForClient: jest.fn(),
    };

    const result = await svc.handle({
      clientId: 'c1',
      text: 'Como acompanho meu chamado?',
      ticketRef: 'TK-5NP8CT',
      inbox: inbox as never,
    });

    expect(result.handled).toBe(true);
    expect(result.intent).toBe('question');
    expect(tryResolve).toHaveBeenCalledWith(
      'c1',
      'Como acompanho meu chamado?',
      expect.objectContaining({ ticketAssist: true }),
    );
    expect(result.reply).toContain('TK-5NP8CT');
  });
});
