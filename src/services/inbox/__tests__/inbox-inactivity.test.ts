import {
  isWaitingForClientReply,
  minutesSinceLastOutbound,
  shouldAlertQueueStall,
  shouldAutoCloseForInactivity,
  shouldAutoCloseTriageStalled,
  shouldCloseTriageInactivity,
  shouldSendInactivityWarning,
  shouldSendTriageInactivityWarning,
  isInactivityCloseQuickReplyAllowed,
  isGracefulCloseQuickReplyAllowed,
  isCloseQuickReplyAllowed,
  triageInactivityTotalMinutes,
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

  it('avisa triagem após pergunta do bot sem resposta', () => {
    const conv = { lastOutboundAt: t0, lastInboundAt: new Date('2026-06-05T11:58:00Z') };
    const t2 = new Date('2026-06-05T12:02:00Z');
    expect(
      shouldSendTriageInactivityWarning(conv, { enabled: true, warningMinutes: 2, closeAfterWarningMinutes: 1 }, t2.getTime()),
    ).toBe(true);
    expect(
      shouldSendTriageInactivityWarning(conv, { enabled: true, warningMinutes: 2, closeAfterWarningMinutes: 1 }, t0.getTime()),
    ).toBe(false);
  });

  it('encerra triagem após aviso e tempo adicional', () => {
    const warned = new Date('2026-06-05T12:02:00Z');
    const conv = {
      lastOutboundAt: warned,
      lastInboundAt: t0,
      inactivityWarnedAt: warned,
    };
    const t3 = new Date('2026-06-05T12:03:01Z');
    expect(
      shouldCloseTriageInactivity(conv, { enabled: true, warningMinutes: 2, closeAfterWarningMinutes: 1 }, t3.getTime()),
    ).toBe(true);
  });

  it('encerra triagem parada sem outbound do bot', () => {
    const conv = { createdAt: t0 };
    expect(shouldAutoCloseTriageStalled(conv, 2, true, t20.getTime())).toBe(true);
    expect(shouldAutoCloseTriageStalled({ ...conv, lastOutboundAt: t5 }, 2, true, t20.getTime())).toBe(
      false,
    );
  });

  it('calcula urgência da espera na triagem', () => {
    expect(triageWaitElapsedSec(t0, t5.getTime())).toBe(300);
    expect(triageWaitUrgency(90, triageInactivityTotalMinutes(2, 1))).toBe(0.5);
  });

  it('alerta fila parada uma vez por entrada na fila', () => {
    expect(shouldAlertQueueStall(t0, 30, undefined, t20.getTime())).toBe(false);
    expect(shouldAlertQueueStall(t0, 15, undefined, t20.getTime())).toBe(true);
    expect(shouldAlertQueueStall(t0, 15, t5, t20.getTime())).toBe(false);
  });

  it('libera encerramento manual só após aviso e tempo configurado', () => {
    const waiting = { lastOutboundAt: t0, lastInboundAt: new Date('2026-06-05T11:55:00Z') };
    const sla = { inactivityCloseMinutes: 15, inactivityWarningMinutes: 10 };

    expect(isInactivityCloseQuickReplyAllowed(waiting, sla, t5.getTime())).toBe(false);

    const warned = { ...waiting, inactivityWarnedAt: t0 };
    const t4 = new Date('2026-06-05T12:04:00Z');
    expect(isInactivityCloseQuickReplyAllowed(warned, sla, t4.getTime())).toBe(false);

    const t6 = new Date('2026-06-05T12:06:00Z');
    expect(isInactivityCloseQuickReplyAllowed(warned, sla, t6.getTime())).toBe(true);
  });

  it('não libera encerramento se cliente já respondeu depois do aviso', () => {
    const warned = {
      lastOutboundAt: t0,
      lastInboundAt: t5,
      inactivityWarnedAt: t0,
    };
    expect(
      isInactivityCloseQuickReplyAllowed(
        warned,
        { inactivityCloseMinutes: 15, inactivityWarningMinutes: 10 },
        t20.getTime(),
      ),
    ).toBe(false);
  });

  it('libera encerramento após pergunta final e timeout', () => {
    const prompted = {
      lastOutboundAt: t0,
      lastInboundAt: new Date('2026-06-05T11:55:00Z'),
      gracefulClosePromptAt: t0,
    };
    expect(
      isGracefulCloseQuickReplyAllowed(prompted, { gracefulCloseAfterPromptMinutes: 2 }, t5.getTime()),
    ).toBe(true);
  });

  it('libera encerramento imediato quando bloqueio está desligado', () => {
    const waiting = { lastOutboundAt: t0, lastInboundAt: new Date('2026-06-05T11:55:00Z') };
    expect(
      isCloseQuickReplyAllowed(
        waiting,
        {
          inactivityCloseMinutes: 15,
          inactivityWarningMinutes: 10,
          gracefulCloseAfterPromptMinutes: 2,
          closeQuickReplyGateEnabled: false,
        },
        t0.getTime(),
      ),
    ).toBe(true);
  });
});
