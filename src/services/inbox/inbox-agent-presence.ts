/** Presença em tempo real — painel aberto com socket conectado (por tenant). */
const onlineByClient = new Map<string, Map<string, number>>();

export function agentPresenceConnect(clientId: string, userId: string): void {
  let users = onlineByClient.get(clientId);
  if (!users) {
    users = new Map();
    onlineByClient.set(clientId, users);
  }
  users.set(userId, (users.get(userId) ?? 0) + 1);
}

export function agentPresenceDisconnect(clientId: string, userId: string): void {
  const users = onlineByClient.get(clientId);
  if (!users) return;
  const next = (users.get(userId) ?? 1) - 1;
  if (next <= 0) users.delete(userId);
  else users.set(userId, next);
  if (users.size === 0) onlineByClient.delete(clientId);
}

export function isAgentOnline(clientId: string, userId: string): boolean {
  return onlineByClient.get(clientId)?.has(userId) ?? false;
}

export function getOnlineAgentIds(clientId: string): string[] {
  return [...(onlineByClient.get(clientId)?.keys() ?? [])];
}

/** Prefer online; mantém ordem round-robin nos que estão no painel. */
export function preferOnlineCandidates(
  clientId: string,
  candidates: { toString(): string }[],
): { toString(): string }[] {
  const online = candidates.filter(c => isAgentOnline(clientId, c.toString()));
  return online.length > 0 ? online : candidates;
}
