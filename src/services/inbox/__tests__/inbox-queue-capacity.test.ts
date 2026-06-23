import { getQueuePriorityState } from '@/services/inbox/inbox-queue-priority';

describe('inbox-queue-priority helpers', () => {
  it('getQueuePriorityState calcula urgência e timeout de pull', () => {
    const now = Date.now();
    const suggestedAt = new Date(now - 60_000);
    const state = getQueuePriorityState(suggestedAt, 120);
    expect(state.elapsedSec).toBeGreaterThanOrEqual(59);
    expect(state.urgency).toBeGreaterThan(0);
    expect(state.pullAllowedByTimeout).toBe(false);
  });

  it('getQueuePriorityState sem suggestedAt libera pull', () => {
    const state = getQueuePriorityState(undefined, 120);
    expect(state.pullAllowedByTimeout).toBe(true);
    expect(state.urgency).toBe(0);
  });
});
