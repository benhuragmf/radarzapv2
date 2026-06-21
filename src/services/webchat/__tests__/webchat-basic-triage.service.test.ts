import { WebChatBasicTriageService } from '../webchat-basic-triage.service';

jest.mock('@/models/AiSettings', () => ({
  AiSettings: {
    findOne: jest.fn(),
  },
}));

jest.mock('@/models/InboxDepartment', () => ({
  InboxDepartment: {
    findOne: jest.fn(),
  },
}));

jest.mock('@/models/WebChatMessage', () => ({
  WebChatMessage: {
    find: jest.fn(),
  },
}));

jest.mock('@/services/ai/AiPromptBuilderService', () => ({
  AiPromptBuilderService: {
    getInstance: () => ({
      getOrCreatePrompt: async () => ({ autoResolveEnabled: true }),
    }),
  },
}));

jest.mock('@/constants/inbox-triage', () => ({
  loadClientVisibleDepartments: async () => [
    { _id: 'd1', name: 'Comercial', menuKey: '1', description: 'Vendas' },
    { _id: 'd2', name: 'Financeiro', menuKey: '2', description: 'Cobrança' },
    { _id: 'd3', name: 'Suporte', menuKey: '3', description: 'Técnico' },
    { _id: 'd4', name: 'Geral', menuKey: '4', description: 'Geral' },
  ],
  parseInboxMenuChoice: async (_clientId: string, text: string) => {
    if (text.trim() === '2') return '2';
    return null;
  },
  buildInboxTriageMenu: async () => 'Menu 1-4',
  buildInvalidMenuHint: async () => 'Opção inválida',
  buildQueueConfirmation: async (_c: string, dept: string) => `Fila ${dept}`,
}));

const { AiSettings } = jest.requireMock('@/models/AiSettings');
const { InboxDepartment } = jest.requireMock('@/models/InboxDepartment');

describe('WebChatBasicTriageService', () => {
  const svc = WebChatBasicTriageService.getInstance();
  const clientId = '6a18bdc5ee126fd553a2c56b';

  const baseConv = {
    _id: 'conv1',
    status: 'open',
    queueStatus: 'bot',
    assignedUserId: null,
    whatsappBridgeActive: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    AiSettings.findOne.mockReturnValue({
      select: () => ({
        lean: async () => ({ attendanceMode: 'basic_triage' }),
      }),
    });
  });

  it('ignora quando attendanceMode não é basic_triage', async () => {
    AiSettings.findOne.mockReturnValue({
      select: () => ({
        lean: async () => ({ attendanceMode: 'premium_assistant' }),
      }),
    });
    const result = await svc.handleInbound({
      clientId,
      conversation: baseConv as never,
      text: 'oi',
      messageRows: [],
      sendBotReply: async () => ({}),
      escalate: async () => {},
    });
    expect(result.handled).toBe(false);
  });

  it('encaminha setor por escolha numérica', async () => {
    InboxDepartment.findOne.mockResolvedValue({
      _id: 'd2',
      name: 'Financeiro',
      menuKey: '2',
    });
    const escalate = jest.fn();
    const result = await svc.handleInbound({
      clientId,
      conversation: baseConv as never,
      text: '2',
      messageRows: [],
      sendBotReply: async () => ({}),
      escalate,
    });
    expect(result.handled).toBe(true);
    expect(escalate).toHaveBeenCalledWith('d2', expect.stringContaining('Financeiro'));
  });

  it('envia menu quando texto vazio', async () => {
    const sendBotReply = jest.fn(async (body: string) => ({ body }));
    const result = await svc.handleInbound({
      clientId,
      conversation: baseConv as never,
      text: '',
      messageRows: [],
      sendBotReply,
      escalate: async () => {},
    });
    expect(result.handled).toBe(true);
    expect(sendBotReply).toHaveBeenCalledWith('Menu 1-4');
  });
});
