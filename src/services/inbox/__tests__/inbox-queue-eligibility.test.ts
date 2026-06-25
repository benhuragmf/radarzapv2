import {
  agentPresenceConnect,
  agentPresenceSetStatus,
  resetAgentPresenceState,
} from '@/services/inbox/inbox-agent-presence';
import { filterQueueEligibleAgentIds } from '@/services/inbox/inbox-queue-eligibility.util';

describe('inbox-queue-eligibility', () => {
  const clientId = 'org-queue';

  beforeEach(() => {
    resetAgentPresenceState();
  });

  afterEach(() => {
    resetAgentPresenceState();
  });

  it('filtra somente atendentes online para round-robin', () => {
    agentPresenceConnect(clientId, 'online-a');
    agentPresenceConnect(clientId, 'offline-b');
    agentPresenceSetStatus(clientId, 'offline-b', 'ausente', 'manual');

    const eligible = filterQueueEligibleAgentIds(clientId, ['online-a', 'offline-b', 'ghost']);
    expect(eligible).toEqual(['online-a']);
  });

  it('supervisor_online e ocupado não entram na fila automática', () => {
    agentPresenceConnect(clientId, 'sup');
    agentPresenceConnect(clientId, 'busy');
    agentPresenceSetStatus(clientId, 'sup', 'supervisor_online', 'manual');
    agentPresenceSetStatus(clientId, 'busy', 'ocupado', 'manual');

    const eligible = filterQueueEligibleAgentIds(clientId, ['sup', 'busy']);
    expect(eligible).toEqual([]);
  });
});
