import { computeHumanTypingMs, sendKindPriority } from '@/utils/whatsapp-human-send.util';
import type { WhatsAppSendPolicySnapshot } from '@/types/whatsapp-send-policy';

const basePolicy: WhatsAppSendPolicySnapshot = {
  humanizeEnabled: true,
  composingEnabled: true,
  caps: { conversation: 30, marketing: 10, alert: 60 },
  conversation: { enabled: true, maxPerMinute: 10 },
  marketing: { enabled: true, maxPerMinute: 2 },
  alert: { enabled: true, maxPerMinute: 30 },
};

describe('whatsapp-human-send.util', () => {
  it('prioriza conversa sobre marketing', () => {
    expect(sendKindPriority('conversation')).toBeGreaterThan(sendKindPriority('marketing'));
  });

  it('typing proporcional ao texto em conversa', () => {
    const short = computeHumanTypingMs('Oi', 'conversation', basePolicy);
    const long = computeHumanTypingMs('x'.repeat(200), 'conversation', basePolicy);
    expect(long).toBeGreaterThan(short);
    expect(short).toBeGreaterThanOrEqual(1500);
    expect(long).toBeLessThanOrEqual(11000);
  });

  it('humanize off = zero delay', () => {
    expect(
      computeHumanTypingMs('texto longo', 'conversation', { ...basePolicy, humanizeEnabled: false }),
    ).toBe(0);
  });
});
