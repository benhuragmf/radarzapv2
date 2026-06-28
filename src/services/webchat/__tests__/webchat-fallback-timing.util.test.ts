import {
  getFallbackAcceptWaitStart,
  getFallbackCountdownState,
  isFallbackAcceptTimeoutElapsed,
  isFallbackWaAssumirTimeoutElapsed,
  resolveFallbackAcceptTimeoutSeconds,
  resolveFallbackWaitMode,
  shouldRetryFallbackAfterCooldown,
} from '@/services/webchat/webchat-fallback-timing.util';

jest.mock('@/services/inbox/inbox-agent-presence', () => ({
  isAgentAvailableForQueue: jest.fn((clientId: string, userId: string) => {
    if (userId === 'offline-agent') return false;
    return Boolean(clientId && userId);
  }),
}));

describe('webchat-fallback-timing', () => {
  const clientId = 'org-1';
  const settings = {
    whatsappFallbackAcceptTimeoutSeconds: 120,
    whatsappFallbackNoAgentTimeoutSeconds: 0,
  };

  it('uses with_priority_agent when suggested agent is online', () => {
    const conv = { suggestedUserId: 'agent-1', suggestedAt: new Date() };
    expect(resolveFallbackWaitMode(clientId, conv)).toBe('with_priority_agent');
    expect(resolveFallbackAcceptTimeoutSeconds(settings, 'with_priority_agent')).toBe(120);
  });

  it('uses no_agent_available when suggested agent is offline', () => {
    const conv = { suggestedUserId: 'offline-agent', suggestedAt: new Date() };
    expect(resolveFallbackWaitMode(clientId, conv)).toBe('no_agent_available');
    expect(resolveFallbackAcceptTimeoutSeconds(settings, 'no_agent_available')).toBe(0);
  });

  it('waits from priorityStartedAt and does not reset on suggestedAt change', () => {
    const priorityStartedAt = new Date('2026-06-21T12:00:00Z');
    const suggestedAt = new Date('2026-06-21T12:01:00Z');
    const conv = {
      suggestedUserId: 'agent-1',
      suggestedAt,
      queueEnteredAt: new Date('2026-06-21T11:58:00Z'),
      whatsappFallbackPriorityStartedAt: priorityStartedAt,
    };
    expect(getFallbackAcceptWaitStart(conv, 'with_priority_agent')).toEqual(priorityStartedAt);
    expect(
      isFallbackAcceptTimeoutElapsed(clientId, conv, settings, priorityStartedAt.getTime() + 119_000),
    ).toBe(false);
    expect(
      isFallbackAcceptTimeoutElapsed(clientId, conv, settings, priorityStartedAt.getTime() + 120_000),
    ).toBe(true);
  });

  it('no suggested agent triggers immediate timeout when no-agent seconds is 0', () => {
    const queueEnteredAt = new Date('2026-06-21T12:00:00Z');
    const conv = { queueEnteredAt };
    expect(getFallbackAcceptWaitStart(conv, 'no_agent_available')).toEqual(queueEnteredAt);
    expect(isFallbackAcceptTimeoutElapsed(clientId, conv, settings, queueEnteredAt.getTime())).toBe(
      true,
    );
  });

  it('shouldRetryFallbackAfterCooldown respects 15 min window', () => {
    const sentAt = new Date('2026-06-21T12:00:00Z');
    const cooldownMs = 15 * 60 * 1000;
    expect(shouldRetryFallbackAfterCooldown(null, cooldownMs, sentAt.getTime())).toBe(true);
    expect(shouldRetryFallbackAfterCooldown(sentAt, cooldownMs, sentAt.getTime() + cooldownMs - 1)).toBe(
      false,
    );
    expect(shouldRetryFallbackAfterCooldown(sentAt, cooldownMs, sentAt.getTime() + cooldownMs)).toBe(
      true,
    );
  });

  it('wa assumir timeout waits full accept window after WA alert', () => {
    const waNotifiedAt = new Date('2026-06-21T12:00:00Z');
    const conv = {
      suggestedUserId: 'agent-1',
      whatsappFallbackWaNotifiedUserId: 'agent-1',
      whatsappFallbackWaNotifiedAt: waNotifiedAt,
    };
    expect(
      isFallbackWaAssumirTimeoutElapsed(clientId, conv, settings, waNotifiedAt.getTime() + 119_000),
    ).toBe(false);
    expect(
      isFallbackWaAssumirTimeoutElapsed(clientId, conv, settings, waNotifiedAt.getTime() + 120_000),
    ).toBe(true);
  });

  it('getFallbackCountdownState returns panel phase before WA alert', () => {
    const priorityStartedAt = new Date('2026-06-21T12:00:00Z');
    const state = getFallbackCountdownState(
      clientId,
      {
        suggestedUserId: 'agent-1',
        whatsappFallbackPriorityStartedAt: priorityStartedAt,
      },
      settings,
      true,
      priorityStartedAt.getTime() + 30_000,
    );
    expect(state?.phase).toBe('panel');
    expect(state?.remainingSec).toBe(90);
    expect(state?.waAlertSent).toBe(false);
  });

  it('getFallbackCountdownState returns wa_assumir after alert', () => {
    const waNotifiedAt = new Date('2026-06-21T12:00:00Z');
    const state = getFallbackCountdownState(
      clientId,
      {
        suggestedUserId: 'agent-1',
        whatsappFallbackWaNotifiedUserId: 'agent-1',
        whatsappFallbackWaNotifiedAt: waNotifiedAt,
      },
      settings,
      true,
      waNotifiedAt.getTime() + 60_000,
    );
    expect(state?.phase).toBe('wa_assumir');
    expect(state?.remainingSec).toBe(60);
    expect(state?.waAlertSent).toBe(true);
  });
});
