import { WebChatBasicTriageService } from '../webchat-basic-triage.service';

const getSettingsDoc = jest.fn();

jest.mock('@/services/attendance/attendance-audit.service', () => ({
  recordAttendanceEvent: jest.fn(),
}));

jest.mock('@/services/ai/AiSettingsService', () => ({
  AiSettingsService: {
    getInstance: () => ({ getSettingsDoc }),
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
    exists: jest.fn(),
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

const { InboxDepartment } = jest.requireMock('@/models/InboxDepartment');
const { WebChatMessage } = jest.requireMock('@/models/WebChatMessage');

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
    getSettingsDoc.mockResolvedValue({
      mode: 'disabled',
      attendanceMode: 'basic_triage',
      transferRules: { lowConfidenceThreshold: 0.45 },
    });
    WebChatMessage.exists.mockResolvedValue(null);
  });

  it('ignora quando attendanceMode não é basic_triage', async () => {
    getSettingsDoc.mockResolvedValue({
      mode: 'disabled',
      attendanceMode: 'premium_assistant',
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

  it('envia saudação inteligente quando texto vazio (não menu robotizado)', async () => {
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
    expect(sendBotReply).toHaveBeenCalledWith(expect.stringContaining('Descreva sua dúvida'));
    expect(sendBotReply).not.toHaveBeenCalledWith('Menu 1-4');
  });

  it('texto vago encaminha para fila geral (confiança baixa)', async () => {
    const sendBotReply = jest.fn(async (body: string) => ({ body }));
    const escalate = jest.fn(async () => {});
    WebChatMessage.exists.mockResolvedValue({ _id: 'm1' });
    const result = await svc.handleInbound({
      clientId,
      conversation: baseConv as never,
      text: 'xyz coisa aleatória',
      messageRows: [],
      sendBotReply,
      escalate,
    });
    expect(result.handled).toBe(true);
    expect(escalate).toHaveBeenCalled();
    expect(sendBotReply).not.toHaveBeenCalledWith('Menu 1-4');
  });
});
