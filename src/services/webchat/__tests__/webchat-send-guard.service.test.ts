import {
  computeWebChatBridgeRelayTypingMs,
} from '@/services/webchat/webchat-send-guard.service';
import { computeHumanTypingMs } from '@/utils/whatsapp-human-send.util';
import type { WhatsAppSendPolicySnapshot } from '@/types/whatsapp-send-policy';

const basePolicy: WhatsAppSendPolicySnapshot = {
  humanizeEnabled: true,
  composingEnabled: true,
  caps: { conversation: 30, marketing: 10, alert: 60 },
  conversation: { enabled: true, maxPerMinute: 10 },
  marketing: { enabled: true, maxPerMinute: 2 },
  alert: { enabled: true, maxPerMinute: 30 },
};

describe('webchat-send-guard bridge relay delay', () => {
  it('bridge relay is much shorter than panel conversation delay', () => {
    const text = 'Olá, já estou verificando seu pedido para você.';
    const panel = computeHumanTypingMs(text, 'conversation', basePolicy);
    const bridge = computeWebChatBridgeRelayTypingMs(text, basePolicy);
    expect(bridge).toBeLessThan(panel);
    expect(bridge).toBeGreaterThanOrEqual(350);
    expect(bridge).toBeLessThanOrEqual(1100);
  });

  it('bridge relay off when humanize disabled', () => {
    expect(
      computeWebChatBridgeRelayTypingMs('texto', { ...basePolicy, humanizeEnabled: false }),
    ).toBe(0);
  });
});
