import {
  canAgentReceiveNewAssignmentByPresence,
  resolveMaxConcurrentChatsForPlan,
  shouldApplyAutoAusente,
} from '../agent-availability';
import {
  agentPresenceConnect,
  agentPresenceSetStatus,
  isAgentAvailableForQueue,
  resetAgentPresenceState,
} from '../inbox-agent-presence';

describe('agent-availability', () => {
  const clientId = 'org-avail';
  const userId = 'user-1';

  beforeEach(() => {
    resetAgentPresenceState();
    agentPresenceConnect(clientId, userId);
  });

  afterEach(() => {
    resetAgentPresenceState();
  });

  it('resolveMaxConcurrentChatsForPlan respeita teto do plano', () => {
    expect(resolveMaxConcurrentChatsForPlan('free', 5)).toBe(1);
    expect(resolveMaxConcurrentChatsForPlan('starter', 10)).toBe(3);
    expect(resolveMaxConcurrentChatsForPlan('pro', 2)).toBe(2);
    expect(resolveMaxConcurrentChatsForPlan('enterprise', 99)).toBe(10);
  });

  it('somente online recebe nova atribuição por presença', () => {
    expect(canAgentReceiveNewAssignmentByPresence(clientId, userId)).toBe(true);

    agentPresenceSetStatus(clientId, userId, 'ausente', 'manual');
    expect(canAgentReceiveNewAssignmentByPresence(clientId, userId)).toBe(false);

    agentPresenceSetStatus(clientId, userId, 'online', 'manual');
    agentPresenceSetStatus(clientId, userId, 'supervisor_online', 'manual');
    expect(canAgentReceiveNewAssignmentByPresence(clientId, userId)).toBe(false);

    agentPresenceSetStatus(clientId, userId, 'ocupado', 'manual');
    expect(isAgentAvailableForQueue(clientId, userId)).toBe(false);
  });

  it('auto-ausente não sobrescreve ocupado nem supervisor_online', () => {
    expect(shouldApplyAutoAusente('online', 'ausente', 'auto')).toBe(true);
    expect(shouldApplyAutoAusente('ocupado', 'ausente', 'auto')).toBe(false);
    expect(shouldApplyAutoAusente('supervisor_online', 'ausente', 'auto')).toBe(false);
    expect(shouldApplyAutoAusente('online', 'ausente', 'manual')).toBe(true);
  });
});
