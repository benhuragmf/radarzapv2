import {

  agentPresenceConnect,

  agentPresenceDisconnect,

  agentPresenceHeartbeat,

  agentPresenceSetStatus,

  getAgentPresence,

  getAvailableAgentIdsForQueue,

  getOnlineAgentIds,

  isAgentAvailableForQueue,

  isAgentOnline,

  preferOnlineCandidates,

  resetAgentPresenceState,

  resolveAgentActivity,

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



  it('defaults to online on connect', () => {

    agentPresenceConnect(clientId, userA);

    const snap = getAgentPresence(clientId, userA);

    expect(snap.operationalStatus).toBe('online');

    expect(snap.availableForQueue).toBe(true);

  });



  it('ausente and ocupado are online but not available for queue', () => {

    agentPresenceConnect(clientId, userA);

    agentPresenceSetStatus(clientId, userA, 'ausente', 'manual');

    expect(isAgentOnline(clientId, userA)).toBe(true);

    expect(isAgentAvailableForQueue(clientId, userA)).toBe(false);



    agentPresenceSetStatus(clientId, userA, 'ocupado', 'manual');

    expect(isAgentAvailableForQueue(clientId, userA)).toBe(false);



    agentPresenceSetStatus(clientId, userA, 'supervisor_online', 'manual');

    expect(isAgentOnline(clientId, userA)).toBe(true);

    expect(isAgentAvailableForQueue(clientId, userA)).toBe(false);

  });



  it('prefers available candidates when available', () => {

    agentPresenceConnect(clientId, userB);

    agentPresenceSetStatus(clientId, userB, 'online', 'manual');

    const candidates = [{ toString: () => userA }, { toString: () => userB }];

    const picked = preferOnlineCandidates(clientId, candidates);

    expect(picked.map(c => c.toString())).toEqual([userB]);

  });



  it('falls back to all when none available', () => {

    const candidates = [{ toString: () => userA }, { toString: () => userB }];

    const picked = preferOnlineCandidates(clientId, candidates);

    expect(picked).toHaveLength(2);

    expect(getAvailableAgentIdsForQueue(clientId)).toEqual([]);

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



  it('stores route and viewing conversation on heartbeat', () => {

    agentPresenceConnect(clientId, userA);

    agentPresenceHeartbeat(clientId, userA, {

      route: '/platform/inbox?conv=abc',

      viewingConversationId: 'abc',

    });

    const snap = getAgentPresence(clientId, userA);

    expect(snap.route).toBe('/platform/inbox?conv=abc');

    expect(snap.viewingConversationId).toBe('abc');

  });



  it('syncs operational status via heartbeat', () => {

    agentPresenceConnect(clientId, userA);

    agentPresenceHeartbeat(clientId, userA, {

      operationalStatus: 'ocupado',

      statusSource: 'manual',

    });

    expect(getAgentPresence(clientId, userA).operationalStatus).toBe('ocupado');

    expect(isAgentAvailableForQueue(clientId, userA)).toBe(false);

  });



  it('resolves activity labels from operational status', () => {

    const offline = resolveAgentActivity(getAgentPresence(clientId, userA), 0);

    expect(offline.activity).toBe('offline');



    agentPresenceConnect(clientId, userA);

    agentPresenceSetStatus(clientId, userA, 'supervisor_online', 'manual');

    const supervisor = resolveAgentActivity(getAgentPresence(clientId, userA), 0);

    expect(supervisor.activity).toBe('supervisor');

    expect(supervisor.label).toContain('sem receber');



    agentPresenceSetStatus(clientId, userA, 'online', 'manual');

    agentPresenceHeartbeat(clientId, userA, {

      route: '/platform/inbox',

      viewingConversationId: 'conv-1',

    });

    const inChat = resolveAgentActivity(getAgentPresence(clientId, userA), 0);

    expect(inChat.activity).toBe('in_chat');

  });



  it('getOnlineAgentIds vs getAvailableAgentIdsForQueue', () => {

    agentPresenceConnect(clientId, userA);

    agentPresenceConnect(clientId, userB);

    agentPresenceSetStatus(clientId, userB, 'ausente', 'manual');

    expect(getOnlineAgentIds(clientId)).toHaveLength(2);

    expect(getAvailableAgentIdsForQueue(clientId)).toEqual([userA]);

  });

});


