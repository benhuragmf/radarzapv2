import mongoose from 'mongoose';
import { InboxConversation } from '@/models/InboxConversation';
import { InboxService } from '@/services/inbox/InboxService';
import { InboxConversationStatus } from '@/types/inbox';
import type { IDestination } from '@/models/Destination';
import { WaAutomatedPeerGuardService } from '@/services/inbox/wa-automated-peer-guard.service';
import { CSAT_MAX_INVALID_REMINDERS } from '@/utils/wa-automated-peer.util';

const loadInboxSettingsMock = jest.fn();
const findOrCreateContact = jest.fn();
const findContactDestinationForInbound = jest.fn();
const shouldDeferToConsentFlow = jest.fn();
const acceptInboundInitiated = jest.fn();

jest.mock('@/constants/inbox-triage', () => {
  const actual = jest.requireActual<typeof import('@/constants/inbox-triage')>(
    '@/constants/inbox-triage',
  );
  return {
    ...actual,
    loadInboxSettings: (...args: unknown[]) => loadInboxSettingsMock(...args),
  };
});

jest.mock('@/models/InboxConversation');
jest.mock('@/models/InboxMessage', () => ({
  InboxMessage: { create: jest.fn().mockResolvedValue({}) },
}));

jest.mock('@/services/consent/ConsentService', () => ({
  ConsentService: {
    getInstance: () => ({
      findOrCreateContactFromInbound: (...args: unknown[]) => findOrCreateContact(...args),
      findContactDestinationForInbound: (...args: unknown[]) =>
        findContactDestinationForInbound(...args),
      shouldDeferToConsentFlow: (...args: unknown[]) => shouldDeferToConsentFlow(...args),
      acceptInboundInitiated: (...args: unknown[]) => acceptInboundInitiated(...args),
    }),
  },
}));

jest.mock('@/services/whatsapp/WhatsAppService', () => ({
  WhatsAppService: {
    getInstance: () => ({
      sendMessage: jest.fn().mockResolvedValue({ success: true }),
    }),
  },
}));

const CLIENT_ID = new mongoose.Types.ObjectId().toString();
const DEST_ID = new mongoose.Types.ObjectId();

type InboxPrivate = InboxService & Record<string, unknown>;

function mockDest(): IDestination {
  return {
    _id: DEST_ID,
    identifier: '5511999999999@s.whatsapp.net',
    name: 'Cliente',
  } as IDestination;
}

function freshInboxService(): InboxPrivate {
  (InboxService as unknown as { instance?: InboxService }).instance = undefined;
  return InboxService.getInstance() as InboxPrivate;
}

describe('InboxService anti-loop peer automatizado', () => {
  let svc: InboxPrivate;

  beforeEach(() => {
    WaAutomatedPeerGuardService.resetForTests();
    svc = freshInboxService();
    jest.spyOn(svc, 'inboxTriageContextActive' as keyof InboxService).mockResolvedValue(false);
    jest.spyOn(svc, 'sendToContact' as keyof InboxService).mockResolvedValue({ success: true });
    loadInboxSettingsMock.mockResolvedValue({
      csatEnabled: true,
      csatPrompt: 'Nota 1-5',
      csatThankYou: 'Obrigado',
    });
    findOrCreateContact.mockResolvedValue(mockDest());
    findContactDestinationForInbound.mockResolvedValue(mockDest());
    shouldDeferToConsentFlow.mockReturnValue(false);
    acceptInboundInitiated.mockResolvedValue(true);
    (InboxConversation.exists as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockPendingWithReminders(reminders: number) {
    const pending = {
      _id: new mongoose.Types.ObjectId(),
      csatPending: true,
      csatReminderCount: reminders,
      status: InboxConversationStatus.RESOLVED,
      save: jest.fn().mockResolvedValue(undefined),
    };
    (InboxConversation.findOne as jest.Mock).mockImplementation((query: Record<string, unknown>) => {
      if (query.csatPending === true) {
        return { sort: () => ({ exec: async () => pending }) };
      }
      return { sort: () => ({ exec: async () => null }) };
    });
    return pending;
  }

  it('CSAT: após teto de lembretes não reenvia e limpa pendência', async () => {
    const pending = mockPendingWithReminders(CSAT_MAX_INVALID_REMINDERS);

    const handled = await svc['tryHandleCsatReply'](CLIENT_ID, mockDest(), 'texto qualquer');

    expect(handled).toBe(true);
    expect(svc['sendToContact']).not.toHaveBeenCalled();
    expect(pending.save).toHaveBeenCalled();
    expect(pending.csatPending).toBe(false);
    expect(pending.csatReminderCount).toBe(0);
  });

  it('CSAT: resposta inválida incrementa lembrete e envia instrução', async () => {
    const pending = mockPendingWithReminders(0);

    const handled = await svc['tryHandleCsatReply'](CLIENT_ID, mockDest(), 'obrigado');

    expect(handled).toBe(true);
    expect(pending.csatReminderCount).toBe(1);
    expect(svc['sendToContact']).toHaveBeenCalled();
  });

  it('handleInboundMessage suprime eco de outbound (loop bot)', async () => {
    const guard = WaAutomatedPeerGuardService.getInstance();
    guard.recordOutbound(
      CLIENT_ID,
      '5511999999999@s.whatsapp.net',
      'Para avaliar o atendimento, responda só com um número de 1 a 5.',
    );

    const csatSpy = jest.spyOn(svc, 'tryHandleCsatReply' as keyof InboxService);

    await svc.handleInboundMessage(CLIENT_ID, '5511999999999@s.whatsapp.net', {
      text: 'Para avaliar o atendimento, responda só com um número de 1 a 5.',
    });

    expect(csatSpy).not.toHaveBeenCalled();
    expect(svc['sendToContact']).not.toHaveBeenCalled();
  });
});
