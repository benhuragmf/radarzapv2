import {
  isWaitingForClientReply,
  minutesSinceLastOutbound,
  shouldAlertQueueStall,
  shouldAutoCloseForInactivity,
  shouldAutoCloseTriageStalled,
  shouldSendInactivityWarning,
  triageWaitElapsedSec,
  triageWaitUrgency,
} from '../inbox-inactivity';

describe('inbox-inactivity', () => {
  const t0 = new Date('2026-06-05T12:00:00Z');
  const t5 = new Date('2026-06-05T12:05:00Z');
  const t20 = new Date('2026-06-05T12:20:00Z');

  it('detecta espera por resposta do cliente', () => {
    expect(isWaitingForClientReply({ lastOutboundAt: t5, lastInboundAt: t0 })).toBe(true);
    expect(isWaitingForClientReply({ lastOutboundAt: t0, lastInboundAt: t5 })).toBe(false);
    expect(isWaitingForClientReply({ lastOutboundAt: t5 })).toBe(true);
    expect(isWaitingForClientReply({})).toBe(false);
  });

  it('calcula minutos desde último outbound', () => {
    expect(minutesSinceLastOutbound(t0, t20.getTime())).toBe(20);
    expect(minutesSinceLastOutbound(undefined)).toBeNull();
  });

  it('avisa inatividade no intervalo configurado', () => {
    const conv = { lastOutboundAt: t5, lastInboundAt: t0 };
    const t13 = new Date('2026-06-05T12:18:00Z');
    expect(shouldSendInactivityWarning(conv, 10, 15, t13.getTime())).toBe(true);
    expect(shouldSendInactivityWarning(conv, 10, 15, t5.getTime())).toBe(false);
    expect(
      shouldSendInactivityWarning(
        { ...conv, inactivityWarnedAt: t5 },
        10,
        15,
        t20.getTime(),
      ),
    ).toBe(false);
  });

  it('encerra após timeout de inatividade', () => {
    const conv = { lastOutboundAt: t0, lastInboundAt: new Date('2026-06-05T11:55:00Z') };
    expect(shouldAutoCloseForInactivity(conv, 15, true, t20.getTime())).toBe(true);
    expect(shouldAutoCloseForInactivity(conv, 15, false, t20.getTime())).toBe(false);
    expect(shouldAutoCloseForInactivity(conv, 0, true, t20.getTime())).toBe(false);
  });

  it('encerra triagem parada sem outbound do bot', () => {
    const conv = { createdAt: t0 };
    expect(shouldAutoCloseTriageStalled(conv, 15, true, t20.getTime())).toBe(true);
    expect(shouldAutoCloseTriageStalled({ ...conv, lastOutboundAt: t5 }, 15, true, t20.getTime())).toBe(
      false,
    );
  });

  it('calcula urgência da espera na triagem', () => {
    expect(triageWaitElapsedSec(t0, t5.getTime())).toBe(300);
    expect(triageWaitUrgency(450, 15)).toBe(0.5);
  });

  it('alerta fila parada uma vez por entrada na fila', () => {
    expect(shouldAlertQueueStall(t0, 30, undefined, t20.getTime())).toBe(false);
    expect(shouldAlertQueueStall(t0, 15, undefined, t20.getTime())).toBe(true);
    expect(shouldAlertQueueStall(t0, 15, t5, t20.getTime())).toBe(false);
  });
});
