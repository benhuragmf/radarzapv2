import {
  WA_SEND_LIMITS,
  computeSendJitterMs,
  getMaxPerMinuteForKind,
  resolveWhatsAppSendKind,
} from '@/utils/whatsapp-session-rate-limit';

describe('whatsapp-session-rate-limit', () => {
  describe('resolveWhatsAppSendKind', () => {
    it('usa sendKind explícito', () => {
      expect(resolveWhatsAppSendKind({ sendKind: 'alert' })).toBe('alert');
    });

    it('classifica campanha por ruleId ou consentOrigin', () => {
      expect(resolveWhatsAppSendKind({ ruleId: 'abc' })).toBe('marketing');
      expect(resolveWhatsAppSendKind({ consentOrigin: 'campaign' })).toBe('marketing');
    });

    it('classifica inbox como conversa', () => {
      expect(resolveWhatsAppSendKind({ consentOrigin: 'inbox-reply' })).toBe('conversation');
      expect(resolveWhatsAppSendKind({ consentOrigin: 'dashboard-send' })).toBe('conversation');
    });
  });

  describe('getMaxPerMinuteForKind', () => {
    it('marketing = 2/min em produção', () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      expect(getMaxPerMinuteForKind('marketing')).toBe(WA_SEND_LIMITS.marketing.maxPerMinute);
      process.env.NODE_ENV = prev;
    });

    it('conversa = 10/min em produção', () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      expect(getMaxPerMinuteForKind('conversation')).toBe(WA_SEND_LIMITS.conversation.maxPerMinute);
      process.env.NODE_ENV = prev;
    });
  });

  describe('computeSendJitterMs', () => {
    it('alerta não tem jitter', () => {
      expect(computeSendJitterMs('alert')).toBe(0);
    });

    it('conversa tem jitter dentro do intervalo', () => {
      const cfg = WA_SEND_LIMITS.conversation;
      for (let i = 0; i < 20; i++) {
        const ms = computeSendJitterMs('conversation');
        expect(ms).toBeGreaterThanOrEqual(cfg.jitterMinMs);
        expect(ms).toBeLessThanOrEqual(cfg.jitterMaxMs);
      }
    });
  });
});
