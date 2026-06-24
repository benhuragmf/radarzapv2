import {
  applyInboundCloseGate,
  applyOutboundCloseGate,
  isGracefulCloseAcknowledgment,
  type CloseGateTimestamps,
} from '../inbox-graceful-close.util';
import { isGracefulCloseQuickReplyAllowed, isCloseQuickReplyAllowed } from '../inbox-inactivity';

describe('inbox-graceful-close', () => {
  const t0 = new Date('2026-06-05T12:00:00Z');

  it('detecta respostas de encerramento natural', () => {
    expect(isGracefulCloseAcknowledgment('Não, obrigado!')).toBe(true);
    expect(isGracefulCloseAcknowledgment('só isso')).toBe(true);
    expect(isGracefulCloseAcknowledgment('ainda tenho uma dúvida')).toBe(false);
  });

  it('marca ack quando cliente confirma após pergunta final', () => {
    const conv: CloseGateTimestamps = {
      lastOutboundAt: t0,
      gracefulClosePromptAt: t0,
    };
    applyInboundCloseGate(conv, 'Não, obrigado', true);
    expect(conv.gracefulCloseAckAt).toBeTruthy();
    expect(conv.closeGateSource).toBe('graceful');
  });

  it('limpa pergunta final se cliente faz nova pergunta', () => {
    const conv: CloseGateTimestamps = {
      lastOutboundAt: t0,
      gracefulClosePromptAt: t0,
      closeGateSource: 'graceful',
    };
    applyInboundCloseGate(conv, 'Ainda preciso de ajuda com o boleto', true);
    expect(conv.gracefulClosePromptAt).toBeUndefined();
    expect(conv.closeGateSource).toBeUndefined();
  });

  it('libera /enc após ack do cliente na pergunta final', () => {
    const t1 = new Date('2026-06-05T12:01:00Z');
    const conv = {
      lastOutboundAt: t0,
      lastInboundAt: t1,
      gracefulClosePromptAt: t0,
      gracefulCloseAckAt: t1,
      closeGateSource: 'graceful' as const,
    };
    expect(
      isGracefulCloseQuickReplyAllowed(conv, { gracefulCloseAfterPromptMinutes: 2 }, t1.getTime()),
    ).toBe(true);
    expect(
      isCloseQuickReplyAllowed(
        conv,
        {
          inactivityCloseMinutes: 15,
          inactivityWarningMinutes: 10,
          gracefulCloseAfterPromptMinutes: 2,
        },
        t1.getTime(),
      ),
    ).toBe(true);
  });

  it('define gate ao enviar /mais', () => {
    const conv: CloseGateTimestamps = {};
    applyOutboundCloseGate(conv, 'mais', {}, 'aus', 'enc', 'mais');
    expect(conv.gracefulClosePromptAt).toBeTruthy();
    expect(conv.closeGateSource).toBe('graceful');
    expect(conv.inactivityWarnedAt).toBeUndefined();
  });
});
