import type { AgentOperationalStatus, AgentStatusSource } from '@/types/agent-presence';
import { isQueueEligibleStatus, operationalStatusLabel } from '@/types/agent-presence';
import type { SupervisorAgentActivity } from '@/types/inbox-supervisor';

/** Presença em tempo real — painel com socket + heartbeat (por tenant). */
export type AgentPresenceMeta = {
  route?: string;
  viewingConversationId?: string | null;
  operationalStatus?: AgentOperationalStatus;
  statusSource?: AgentStatusSource;
};

export type AgentPresenceSnapshot = {
  online: boolean;
  availableForQueue: boolean;
  operationalStatus: AgentOperationalStatus;
  statusSource: AgentStatusSource;
  statusLabel: string;
  route?: string;
  viewingConversationId?: string | null;
  lastSeen: number;
  socketCount: number;
};

type AgentPresenceEntry = {
  sockets: number;
  lastSeen: number;
  operationalStatus: AgentOperationalStatus;
  statusSource: AgentStatusSource;
  lastManualStatus: AgentOperationalStatus;
  route?: string;
  viewingConversationId?: string | null;
};

const onlineByClient = new Map<string, Map<string, AgentPresenceEntry>>();
const presenceTimeoutSecByClient = new Map<string, number>();

const DEFAULT_PRESENCE_TIMEOUT_SEC = 90;

function defaultEntry(): AgentPresenceEntry {
  return {
    sockets: 0,
    lastSeen: Date.now(),
    operationalStatus: 'offline',
    statusSource: 'auto',
    lastManualStatus: 'online',
  };
}

export function setAgentPresenceTimeout(clientId: string, seconds: number): void {
  const sec = Math.min(300, Math.max(30, Math.round(seconds) || DEFAULT_PRESENCE_TIMEOUT_SEC));
  presenceTimeoutSecByClient.set(clientId, sec);
}

function presenceTimeoutMs(clientId: string): number {
  const sec = presenceTimeoutSecByClient.get(clientId) ?? DEFAULT_PRESENCE_TIMEOUT_SEC;
  return sec * 1000;
}

function touchEntry(entry: AgentPresenceEntry): void {
  entry.lastSeen = Date.now();
}

function normalizeRoute(route?: string): string | undefined {
  const r = route?.trim();
  if (!r) return undefined;
  return r.slice(0, 512);
}

function normalizeConvId(id?: string | null): string | null | undefined {
  if (id === undefined) return undefined;
  if (id === null || id === '') return null;
  return String(id).slice(0, 128);
}

function normalizeStatus(status?: AgentOperationalStatus): AgentOperationalStatus | undefined {
  if (!status) return undefined;
  const allowed: AgentOperationalStatus[] = [
    'online',
    'ausente',
    'ocupado',
    'offline',
    'supervisor_online',
  ];
  return allowed.includes(status) ? status : undefined;
}

function entryToSnapshot(clientId: string, entry: AgentPresenceEntry): AgentPresenceSnapshot {
  const heartbeatFresh = Date.now() - entry.lastSeen < presenceTimeoutMs(clientId);
  const online = heartbeatFresh;
  const effectiveStatus: AgentOperationalStatus = online ? entry.operationalStatus : 'offline';
  const availableForQueue = online && isQueueEligibleStatus(effectiveStatus);
  return {
    online,
    availableForQueue,
    operationalStatus: effectiveStatus,
    statusSource: entry.statusSource,
    statusLabel: operationalStatusLabel(effectiveStatus),
    route: entry.route,
    viewingConversationId: entry.viewingConversationId,
    lastSeen: entry.lastSeen,
    socketCount: entry.sockets,
  };
}

export function agentPresenceConnect(clientId: string, userId: string): void {
  let users = onlineByClient.get(clientId);
  if (!users) {
    users = new Map();
    onlineByClient.set(clientId, users);
  }
  const prev = users.get(userId);
  const entry = prev ?? defaultEntry();
  entry.sockets += 1;
  touchEntry(entry);
  if (!prev || entry.operationalStatus === 'offline') {
    entry.operationalStatus = 'online';
    entry.statusSource = 'auto';
  }
  users.set(userId, entry);
}

export function agentPresenceDisconnect(clientId: string, userId: string): void {
  const users = onlineByClient.get(clientId);
  if (!users) return;
  const entry = users.get(userId);
  if (!entry) return;
  entry.sockets -= 1;
  if (entry.sockets <= 0) {
    entry.operationalStatus = 'offline';
    entry.statusSource = 'auto';
    users.delete(userId);
  } else {
    users.set(userId, entry);
  }
}

export function agentPresenceSetStatus(
  clientId: string,
  userId: string,
  status: AgentOperationalStatus,
  source: AgentStatusSource = 'manual',
): AgentPresenceSnapshot {
  let users = onlineByClient.get(clientId);
  if (!users) {
    users = new Map();
    onlineByClient.set(clientId, users);
  }
  const entry = users.get(userId) ?? defaultEntry();
  touchEntry(entry);
  if (status !== 'offline') {
    entry.sockets = Math.max(entry.sockets, 1);
  }
  entry.operationalStatus = status;
  entry.statusSource = source;
  if (source === 'manual') {
    entry.lastManualStatus = status;
  }
  users.set(userId, entry);
  return getAgentPresence(clientId, userId);
}

export function agentPresenceHeartbeat(
  clientId: string,
  userId: string,
  meta?: AgentPresenceMeta,
): void {
  let users = onlineByClient.get(clientId);
  if (!users) {
    users = new Map();
    onlineByClient.set(clientId, users);
  }
  const entry = users.get(userId) ?? defaultEntry();
  touchEntry(entry);
  if (entry.sockets <= 0) {
    entry.sockets = 1;
  }
  if (meta) {
    if (meta.route !== undefined) entry.route = normalizeRoute(meta.route);
    if (meta.viewingConversationId !== undefined) {
      entry.viewingConversationId = normalizeConvId(meta.viewingConversationId);
    }
    const nextStatus = normalizeStatus(meta.operationalStatus);
    if (nextStatus) {
      entry.operationalStatus = nextStatus;
      const src = meta.statusSource ?? 'auto';
      entry.statusSource = src;
      if (src === 'manual') {
        entry.lastManualStatus = nextStatus;
      }
    }
  }
  users.set(userId, entry);
}

export function getAgentPresence(clientId: string, userId: string): AgentPresenceSnapshot {
  const entry = onlineByClient.get(clientId)?.get(userId);
  if (!entry) {
    return {
      online: false,
      availableForQueue: false,
      operationalStatus: 'offline',
      statusSource: 'auto',
      statusLabel: operationalStatusLabel('offline'),
      lastSeen: 0,
      socketCount: 0,
    };
  }
  return entryToSnapshot(clientId, entry);
}

/** Conectado ao painel (socket + heartbeat válido). */
export function isAgentOnline(clientId: string, userId: string): boolean {
  return getAgentPresence(clientId, userId).online;
}

/** Elegível para receber novos chats na fila (status online + conectado). */
export function isAgentAvailableForQueue(clientId: string, userId: string): boolean {
  return getAgentPresence(clientId, userId).availableForQueue;
}

export function getOnlineAgentIds(clientId: string): string[] {
  const users = onlineByClient.get(clientId);
  if (!users) return [];
  return [...users.keys()].filter(userId => isAgentOnline(clientId, userId));
}

export function getAvailableAgentIdsForQueue(clientId: string): string[] {
  const users = onlineByClient.get(clientId);
  if (!users) return [];
  return [...users.keys()].filter(userId => isAgentAvailableForQueue(clientId, userId));
}

export function getAllAgentPresence(clientId: string): Map<string, AgentPresenceSnapshot> {
  const users = onlineByClient.get(clientId);
  const out = new Map<string, AgentPresenceSnapshot>();
  if (!users) return out;
  for (const userId of users.keys()) {
    out.set(userId, getAgentPresence(clientId, userId));
  }
  return out;
}

export function getAgentLastManualStatus(
  clientId: string,
  userId: string,
): AgentOperationalStatus {
  const entry = onlineByClient.get(clientId)?.get(userId);
  return entry?.lastManualStatus ?? 'online';
}

export function resolveAgentActivity(
  presence: AgentPresenceSnapshot,
  activeConversationCount: number,
): { activity: SupervisorAgentActivity; label: string } {
  if (!presence.online) {
    return { activity: 'offline', label: presence.statusLabel };
  }
  if (presence.operationalStatus === 'supervisor_online') {
    return { activity: 'supervisor', label: presence.statusLabel };
  }
  if (presence.operationalStatus === 'ausente') {
    return { activity: 'idle', label: presence.statusLabel };
  }
  if (presence.operationalStatus === 'ocupado') {
    return { activity: 'other_page', label: presence.statusLabel };
  }
  if (presence.viewingConversationId) {
    return { activity: 'in_chat', label: 'Em conversa no painel' };
  }
  if (activeConversationCount > 0) {
    return { activity: 'in_chat', label: `${activeConversationCount} atendimento(s) ativo(s)` };
  }
  const route = presence.route ?? '';
  if (route.includes('/platform/inbox/supervisor')) {
    return { activity: 'supervisor', label: 'Tela de supervisão' };
  }
  if (route.includes('/platform/inbox')) {
    return { activity: 'inbox', label: 'Caixa de entrada' };
  }
  if (route.startsWith('/platform') || route.startsWith('/settings') || route.startsWith('/admin')) {
    return { activity: 'other_page', label: 'Outra área do painel' };
  }
  return { activity: 'idle', label: presence.statusLabel };
}

/** Prefer online; mantém ordem round-robin nos que estão no painel. */
export function preferOnlineCandidates(
  clientId: string,
  candidates: { toString(): string }[],
): { toString(): string }[] {
  const available = candidates.filter(c => isAgentAvailableForQueue(clientId, c.toString()));
  return available.length > 0 ? available : candidates;
}

/** Testes — limpa estado in-memory. */
export function resetAgentPresenceState(): void {
  onlineByClient.clear();
  presenceTimeoutSecByClient.clear();
}

