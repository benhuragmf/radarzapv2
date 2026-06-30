import mongoose from 'mongoose';
import { WebChatRoboticTriageService } from '../webchat-robotic-triage.service';

const getSettingsDoc = jest.fn();

jest.mock('@/services/ai/AiSettingsService', () => ({
  AiSettingsService: {
    getInstance: () => ({ getSettingsDoc }),
  },
}));

jest.mock('@/models/WebChatMessage', () => ({
  WebChatMessage: { exists: jest.fn() },
}));

jest.mock('@/models/InboxDepartment', () => ({
  InboxDepartment: { findOne: jest.fn() },
}));

jest.mock('@/constants/inbox-triage', () => ({
  buildInboxTriageMenu: jest.fn(async () => 'MENU'),
  buildInvalidMenuHint: jest.fn(async () => 'OPCAO INVALIDA'),
  buildQueueConfirmation: jest.fn(async (_c: string, dept: string) => `FILA ${dept}`),
  parseInboxMenuChoice: jest.fn(),
}));

import { WebChatMessage } from '@/models/WebChatMessage';
import { InboxDepartment } from '@/models/InboxDepartment';
import {
  buildInboxTriageMenu,
  parseInboxMenuChoice,
} from '@/constants/inbox-triage';

const clientId = new mongoose.Types.ObjectId().toString();
const convId = new mongoose.Types.ObjectId();

function baseConversation(overrides: Record<string, unknown> = {}) {
  return {
    _id: convId,
    clientId: new mongoose.Types.ObjectId(clientId),
    status: 'open',
    queueStatus: 'bot',
    assignedUserId: undefined,
    whatsappBridgeActive: false,
    ...overrides,
  } as never;
}

describe('WebChatRoboticTriageService', () => {
  const svc = WebChatRoboticTriageService.getInstance();

  beforeEach(() => {
    jest.clearAllMocks();
    getSettingsDoc.mockResolvedValue({
      mode: 'disabled',
      attendanceMode: 'robotic',
    });
    (WebChatMessage.exists as jest.Mock).mockResolvedValue(null);
  });

  it('ignora quando attendanceMode não é robotic', async () => {
    getSettingsDoc.mockResolvedValue({
      mode: 'disabled',
      attendanceMode: 'disabled',
    });
    const result = await svc.handleInbound({
      clientId,
      conversation: baseConversation(),
      text: 'oi',
      sendBotReply: jest.fn(),
      escalate: jest.fn(),
    });
    expect(result.handled).toBe(false);
  });

  it('envia menu na primeira interação', async () => {
    const sendBotReply = jest.fn(async (body: string) => ({ body }));
    const result = await svc.handleInbound({
      clientId,
      conversation: baseConversation(),
      text: 'oi',
      sendBotReply,
      escalate: jest.fn(),
    });
    expect(result.handled).toBe(true);
    expect(buildInboxTriageMenu).toHaveBeenCalledWith(clientId);
    expect(sendBotReply).toHaveBeenCalledWith('MENU');
  });

  it('escala ao escolher setor válido', async () => {
    const deptOid = new mongoose.Types.ObjectId();
    (parseInboxMenuChoice as jest.Mock).mockResolvedValue('1');
    (InboxDepartment.findOne as jest.Mock).mockResolvedValue({ _id: deptOid, name: 'Comercial' });
    (WebChatMessage.exists as jest.Mock).mockResolvedValue({ _id: 'x' });

    const sendBotReply = jest.fn(async (body: string) => ({ body }));
    const escalate = jest.fn(async () => undefined);

    const result = await svc.handleInbound({
      clientId,
      conversation: baseConversation(),
      text: '1',
      sendBotReply,
      escalate,
    });

    expect(result.handled).toBe(true);
    expect(escalate).toHaveBeenCalledWith(String(deptOid), 'FILA Comercial');
    expect(sendBotReply).not.toHaveBeenCalled();
  });

  it('opção inválida após menu enviado', async () => {
    (parseInboxMenuChoice as jest.Mock).mockResolvedValue(null);
    (WebChatMessage.exists as jest.Mock).mockResolvedValue({ _id: 'sent' });

    const sendBotReply = jest.fn(async (body: string) => ({ body }));
    const result = await svc.handleInbound({
      clientId,
      conversation: baseConversation(),
      text: 'xyz',
      sendBotReply,
      escalate: jest.fn(),
    });

    expect(result.handled).toBe(true);
    expect(sendBotReply).toHaveBeenCalledWith('OPCAO INVALIDA');
  });

  it('híbrido: texto livre após menu passa para triagem (handled false)', async () => {
    getSettingsDoc.mockResolvedValue({
      mode: 'radarchat',
      enabled: true,
      attendanceMode: 'hybrid',
    });
    (parseInboxMenuChoice as jest.Mock).mockResolvedValue(null);
    (WebChatMessage.exists as jest.Mock).mockResolvedValue({ _id: 'sent' });

    const result = await svc.handleInbound({
      clientId,
      conversation: baseConversation(),
      text: 'preciso de ajuda com meu pedido',
      sendBotReply: jest.fn(),
      escalate: jest.fn(),
    });

    expect(result.handled).toBe(false);
  });

  it('híbrido: opção de menu válida escala', async () => {
    getSettingsDoc.mockResolvedValue({
      mode: 'disabled',
      attendanceMode: 'hybrid',
    });
    const deptOid = new mongoose.Types.ObjectId();
    (parseInboxMenuChoice as jest.Mock).mockResolvedValue('2');
    (InboxDepartment.findOne as jest.Mock).mockResolvedValue({ _id: deptOid, name: 'Suporte' });

    const escalate = jest.fn(async () => undefined);
    const result = await svc.handleInbound({
      clientId,
      conversation: baseConversation(),
      text: '2',
      sendBotReply: jest.fn(),
      escalate,
    });

    expect(result.handled).toBe(true);
    expect(escalate).toHaveBeenCalled();
  });
});
