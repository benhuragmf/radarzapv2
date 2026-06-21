import mongoose from 'mongoose';
import { WebChatRoboticTriageService } from '../webchat-robotic-triage.service';

jest.mock('@/models/AiSettings', () => ({
  AiSettings: { findOne: jest.fn() },
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

import { AiSettings } from '@/models/AiSettings';
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
    (AiSettings.findOne as jest.Mock).mockReturnValue({
      select: () => ({ lean: async () => ({ attendanceMode: 'robotic' }) }),
    });
    (WebChatMessage.exists as jest.Mock).mockResolvedValue(null);
  });

  it('ignora quando attendanceMode não é robotic', async () => {
    (AiSettings.findOne as jest.Mock).mockReturnValue({
      select: () => ({ lean: async () => ({ attendanceMode: 'disabled' }) }),
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
});
