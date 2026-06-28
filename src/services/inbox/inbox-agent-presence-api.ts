import type { Server as SocketIOServer } from 'socket.io';
import type { AgentOperationalStatus } from '@/types/agent-presence';
import {
  ATTENDANT_SELECTABLE_STATUSES,
  SUPERVISOR_SELECTABLE_STATUSES,
} from '@/types/agent-presence';
import {
  agentPresenceSetStatus,
  getAgentLastManualStatus,
  getAgentPresence,
  getAllAgentPresence,
  hydrateAgentPresenceFromPersist,
  type AgentPresenceSnapshot,
} from '@/services/inbox/inbox-agent-presence';
import { loadInboxSettings } from '@/constants/inbox-triage';
import {
  DEFAULT_PRESENCE_HEARTBEAT_INTERVAL_SECONDS,
  DEFAULT_PRESENCE_IDLE_TIMEOUT_SECONDS,
  DEFAULT_PRESENCE_OFFLINE_TIMEOUT_SECONDS,
} from '@/constants/agent-presence';
import { Cap } from '@/auth/rbac';

let socketServer: SocketIOServer | null = null;

export function setAgentPresenceSocketServer(io: SocketIOServer): void {
  socketServer = io;
}

export function broadcastAgentPresenceChanged(
  clientId: string,
  userId: string,
  snapshot: AgentPresenceSnapshot,
): void {
  socketServer?.to(`tenant:${clientId}`).emit('agent:presence:changed', {
    userId,
    ...snapshot,
  });
}

export async function getPresenceConfigForClient(clientId: string): Promise<{
  idleTimeoutSeconds: number;
  heartbeatIntervalSeconds: number;
  offlineTimeoutSeconds: number;
}> {
  const settings = await loadInboxSettings(clientId);
  return {
    idleTimeoutSeconds:
      settings.presenceIdleTimeoutSeconds ?? DEFAULT_PRESENCE_IDLE_TIMEOUT_SECONDS,
    heartbeatIntervalSeconds: DEFAULT_PRESENCE_HEARTBEAT_INTERVAL_SECONDS,
    offlineTimeoutSeconds:
      settings.agentPresenceTimeoutSeconds ?? DEFAULT_PRESENCE_OFFLINE_TIMEOUT_SECONDS,
  };
}

export function selectableStatusesForCapabilities(capabilities: string[]): AgentOperationalStatus[] {
  if (capabilities.includes(Cap.INBOX_SUPERVISE)) {
    return SUPERVISOR_SELECTABLE_STATUSES;
  }
  return ATTENDANT_SELECTABLE_STATUSES;
}

export function assertStatusAllowed(
  status: AgentOperationalStatus,
  capabilities: string[],
): void {
  const allowed = selectableStatusesForCapabilities(capabilities);
  if (!allowed.includes(status)) {
    if (status === 'supervisor_online') {
      throw new Error('Este status é exclusivo para supervisores e administradores.');
    }
    throw new Error('Status não permitido para seu perfil');
  }
}

/** Filtra status do heartbeat — backend é barreira real contra perfil sem supervisão. */
export function filterHeartbeatOperationalStatus(
  status: AgentOperationalStatus | undefined,
  capabilities: string[],
): AgentOperationalStatus | undefined {
  if (!status) return undefined;
  try {
    assertStatusAllowed(status, capabilities);
    return status;
  } catch {
    return undefined;
  }
}

export function setAgentOperationalStatus(
  clientId: string,
  userId: string,
  status: AgentOperationalStatus,
  source: 'manual' | 'auto' = 'manual',
): AgentPresenceSnapshot {
  const snapshot = agentPresenceSetStatus(clientId, userId, status, source);
  broadcastAgentPresenceChanged(clientId, userId, snapshot);
  return snapshot;
}

export async function getMyPresenceSnapshot(
  clientId: string,
  userId: string,
): Promise<AgentPresenceSnapshot & { lastManualStatus: AgentOperationalStatus }> {
  let snapshot = getAgentPresence(clientId, userId);
  if (!snapshot.online || snapshot.operationalStatus === 'offline') {
    const hydrated = await hydrateAgentPresenceFromPersist(clientId, userId);
    if (hydrated) snapshot = hydrated;
  }
  return {
    ...snapshot,
    lastManualStatus: getAgentLastManualStatus(clientId, userId),
  };
}

export function listTeamPresence(
  clientId: string,
  teamMembers: Array<{ userId: string | null; displayName: string; email?: string }>,
): Array<{
  userId: string;
  displayName: string;
  email?: string;
  presence: AgentPresenceSnapshot;
}> {
  const all = getAllAgentPresence(clientId);
  return teamMembers
    .filter(m => m.userId)
    .map(m => {
      const userId = m.userId!;
      const presence = all.get(userId) ?? getAgentPresence(clientId, userId);
      return {
        userId,
        displayName: m.displayName,
        email: m.email,
        presence,
      };
    });
}
