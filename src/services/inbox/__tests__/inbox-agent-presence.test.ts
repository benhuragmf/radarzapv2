import {
  agentPresenceConnect,
  agentPresenceDisconnect,
  getOnlineAgentIds,
  isAgentOnline,
  preferOnlineCandidates,
} from '@/services/inbox/inbox-agent-presence';

describe('inbox-agent-presence', () => {
  const clientId = 'org-1';
  const userA = 'user-a';
  const userB = 'user-b';

  afterEach(() => {
    agentPresenceDisconnect(clientId, userA);
    agentPresenceDisconnect(clientId, userB);
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
});
