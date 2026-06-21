import {
  inboxStatusToWebChatFilter,
  mapWebChatToInboxStatus,
  toWebChatInboxId,
} from '../webchat-inbox-bridge';

describe('webchat-inbox-bridge', () => {
  describe('mapWebChatToInboxStatus', () => {
    it('mapeia fila humana para waiting_queue', () => {
      expect(mapWebChatToInboxStatus('open', 'waiting_human')).toBe('waiting_queue');
    });

    it('mapeia bot para bot_triage', () => {
      expect(mapWebChatToInboxStatus('open', 'bot')).toBe('bot_triage');
    });
  });

  describe('inboxStatusToWebChatFilter', () => {
    it('fila inbox → open + waiting_human', () => {
      expect(inboxStatusToWebChatFilter('waiting_queue')).toEqual({
        conversationStatus: 'open',
        queueStatus: 'waiting_human',
      });
    });

    it('sem filtro → vazio (inclui conversas com ticket)', () => {
      expect(inboxStatusToWebChatFilter(undefined)).toEqual({});
      expect(inboxStatusToWebChatFilter('')).toEqual({});
    });
  });

  describe('toWebChatInboxId', () => {
    it('prefixa wc:', () => {
      expect(toWebChatInboxId('abc123')).toBe('wc:abc123');
    });
  });
});
