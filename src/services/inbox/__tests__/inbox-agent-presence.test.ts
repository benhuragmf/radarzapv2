import {
  agentPresenceConnect,
  agentPresenceDisconnect,
  agentPresenceHeartbeat,
  getOnlineAgentIds,
  isAgentOnline,
  preferOnlineCandidates,
  resetAgentPresenceState,
  setAgentPresenceTimeout,
} from '@/services/inbox/inbox-agent-presence';

describe('inbox-agent-presence', () => {
  const clientId = 'org-1';
  const userA = 'user-a';
  const userB = 'user-b';

  beforeEach(() => {
    resetAgentPresenceState();
    setAgentPresenceTimeout(clientId, 90);
  });

  afterEach(() => {
    agentPresenceDisconnect(clientId, userA);
    agentPresenceDisconnect(clientId, userB);
    resetAgentPresenceState();
  });

  it('tracks connect/disconnect', () => {
    expect(isAgentOnline(clientId, userA)).toBe(false);
    agentPresenceConnect(clientId, userA);
    expect(isAgentOnline(clientId, userA)).toBe(true);
    agentPresenceDisconnect(clientId, userA);
    expect(isAgentOnline(clientId, userA)).toBe(false);
  });

  it('prefers online candidates when available', () => {
    agentPresenceConnect(clientId, userB);
    const candidates = [{ toString: () => userA }, { toString: () => userB }];
    const picked = preferOnlineCandidates(clientId, candidates);
    expect(picked.map(c => c.toString())).toEqual([userB]);
  });

  it('falls back to all when none online', () => {
    const candidates = [{ toString: () => userA }, { toString: () => userB }];
    const picked = preferOnlineCandidates(clientId, candidates);
    expect(picked).toHaveLength(2);
    expect(getOnlineAgentIds(clientId)).toEqual([]);
  });

  it('expires presence after timeout without heartbeat', () => {
    jest.useFakeTimers();
    agentPresenceConnect(clientId, userA);
    expect(isAgentOnline(clientId, userA)).toBe(true);
    jest.advanceTimersByTime(91_000);
    expect(isAgentOnline(clientId, userA)).toBe(false);
    jest.useRealTimers();
  });

  it('extends presence with heartbeat', () => {
    jest.useFakeTimers();
    agentPresenceConnect(clientId, userA);
    jest.advanceTimersByTime(60_000);
    agentPresenceHeartbeat(clientId, userA);
    jest.advanceTimersByTime(60_000);
    expect(isAgentOnline(clientId, userA)).toBe(true);
    jest.useRealTimers();
  });
});
