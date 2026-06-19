/** Presença em tempo real — painel com socket + heartbeat (por tenant). */
type AgentPresenceEntry = { sockets: number; lastSeen: number };

const onlineByClient = new Map<string, Map<string, AgentPresenceEntry>>();
const presenceTimeoutSecByClient = new Map<string, number>();

const DEFAULT_PRESENCE_TIMEOUT_SEC = 90;

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

export function agentPresenceConnect(clientId: string, userId: string): void {
  let users = onlineByClient.get(clientId);
  if (!users) {
    users = new Map();
    onlineByClient.set(clientId, users);
  }
  const entry = users.get(userId) ?? { sockets: 0, lastSeen: Date.now() };
  entry.sockets += 1;
  touchEntry(entry);
  users.set(userId, entry);
}

export function agentPresenceDisconnect(clientId: string, userId: string): void {
  const users = onlineByClient.get(clientId);
  if (!users) return;
  const entry = users.get(userId);
  if (!entry) return;
  entry.sockets -= 1;
  if (entry.sockets <= 0) {
    users.delete(userId);
  } else {
    users.set(userId, entry);
  }
}

export function agentPresenceHeartbeat(clientId: string, userId: string): void {
  const users = onlineByClient.get(clientId);
  if (!users) return;
  const entry = users.get(userId);
  if (!entry) return;
  touchEntry(entry);
}

export function isAgentOnline(clientId: string, userId: string): boolean {
  const entry = onlineByClient.get(clientId)?.get(userId);
  if (!entry) return false;
  return Date.now() - entry.lastSeen < presenceTimeoutMs(clientId);
}

export function getOnlineAgentIds(clientId: string): string[] {
  const users = onlineByClient.get(clientId);
  if (!users) return [];
  return [...users.keys()].filter(userId => isAgentOnline(clientId, userId));
}

/** Prefer online; mantém ordem round-robin nos que estão no painel. */
export function preferOnlineCandidates(
  clientId: string,
  candidates: { toString(): string }[],
): { toString(): string }[] {
  const online = candidates.filter(c => isAgentOnline(clientId, c.toString()));
  return online.length > 0 ? online : candidates;
}

/** Testes — limpa estado in-memory. */
export function resetAgentPresenceState(): void {
  onlineByClient.clear();
  presenceTimeoutSecByClient.clear();
}
