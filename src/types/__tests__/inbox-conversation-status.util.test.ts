import { InboxConversationStatus } from '@/types/inbox';
import {
  isAssignedConversationStatus,
  isClosedConversationStatus,
  isOpenConversationStatus,
  isQueueConversationStatus,
  isTriageConversationStatus,
  mapProductConversationStatus,
  normalizeConversationStatus,
} from '@/types/inbox-conversation-status.util';

describe('inbox-conversation-status.util', () => {
  it('normaliza status válido e rejeita inválido', () => {
    expect(normalizeConversationStatus('waiting_queue')).toBe(
      InboxConversationStatus.WAITING_QUEUE,
    );
    expect(normalizeConversationStatus('invalid')).toBeNull();
    expect(normalizeConversationStatus(null)).toBeNull();
  });

  it('classifica estados abertos, fila, triagem e encerrados', () => {
    expect(isTriageConversationStatus(InboxConversationStatus.BOT_TRIAGE)).toBe(true);
    expect(isQueueConversationStatus(InboxConversationStatus.WAITING_QUEUE)).toBe(true);
    expect(isAssignedConversationStatus(InboxConversationStatus.IN_PROGRESS)).toBe(true);
    expect(isClosedConversationStatus(InboxConversationStatus.CLOSED)).toBe(true);
    expect(isOpenConversationStatus(InboxConversationStatus.IN_PROGRESS)).toBe(true);
    expect(isOpenConversationStatus(InboxConversationStatus.CLOSED)).toBe(false);
  });

  it('mapeia status persistido para conceito de produto', () => {
    expect(mapProductConversationStatus(InboxConversationStatus.BOT_TRIAGE)).toBe('bot_triage');
    expect(mapProductConversationStatus(InboxConversationStatus.WAITING_QUEUE)).toBe(
      'waiting_queue',
    );
    expect(
      mapProductConversationStatus(InboxConversationStatus.IN_PROGRESS, {
        lastInboundAt: new Date('2026-01-02'),
        lastOutboundAt: new Date('2026-01-01'),
      }),
    ).toBe('pending_agent');
    expect(
      mapProductConversationStatus(InboxConversationStatus.IN_PROGRESS, {
        lastInboundAt: new Date('2026-01-01'),
        lastOutboundAt: new Date('2026-01-02'),
      }),
    ).toBe('pending_customer');
  });
});
