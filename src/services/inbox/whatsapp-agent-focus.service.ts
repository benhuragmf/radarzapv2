import { RedisManager } from '@/cache/RedisManager';
import { normalizeCommandTicketRef, parseCommandTicketArg } from '@/utils/whatsapp-agent-command.util';

const TTL_SECONDS = 12 * 60 * 60; // 12 h — turno operacional

export interface WaAgentPicklistEntry {
  ticketRef: string;
  label: string;
}

export type ResolveAgentTicketRefResult =
  | { ok: true; ticketRef: string; label?: string }
  | { ok: false; message: string };

export type ResolveTicketCommandArgResult =
  | { ok: true; ticketRef: string; message?: string }
  | { ok: false; message: string };

export type ResolveTicketOnlyArgResult =
  | { ok: true; ticketRef: string }
  | { ok: false; message: string };

export interface WaAgentFocusState {
  ticketRef: string;
  label?: string;
  setAt: string;
}

function picklistKey(clientId: string, agentUserId: string): string {
  return `wa:agent-picklist:${clientId}:${agentUserId}`;
}

function focusKey(clientId: string, agentUserId: string): string {
  return `wa:agent-focus:${clientId}:${agentUserId}`;
}

function pendingKey(clientId: string, agentUserId: string): string {
  return `wa:agent-pending:${clientId}:${agentUserId}`;
}

export function looksLikeTicketRefToken(token: string): boolean {
  const t = token.trim();
  if (/^TK-[A-Z0-9]{4,12}$/i.test(t)) return true;
  return /^[A-Z0-9]{4,12}$/i.test(t);
}

export async function saveWaAgentPicklist(
  clientId: string,
  agentUserId: string,
  entries: WaAgentPicklistEntry[],
): Promise<void> {
  const redis = RedisManager.getInstance();
  await redis.setWithTTL(
    picklistKey(clientId, agentUserId),
    JSON.stringify(entries.slice(0, 25)),
    TTL_SECONDS,
  );
}

export async function getWaAgentPicklist(
  clientId: string,
  agentUserId: string,
): Promise<WaAgentPicklistEntry[]> {
  const redis = RedisManager.getInstance();
  const raw = await redis.get(picklistKey(clientId, agentUserId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as WaAgentPicklistEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function resolvePicklistIndex(
  entries: WaAgentPicklistEntry[],
  index: number,
): string | null {
  if (!Number.isInteger(index) || index < 1 || index > entries.length) return null;
  return entries[index - 1]?.ticketRef ?? null;
}

export async function setWaAgentFocus(
  clientId: string,
  agentUserId: string,
  ticketRef: string,
  label?: string,
): Promise<void> {
  const redis = RedisManager.getInstance();
  const state: WaAgentFocusState = {
    ticketRef: normalizeCommandTicketRef(ticketRef),
    label: label?.trim() || undefined,
    setAt: new Date().toISOString(),
  };
  await redis.setWithTTL(focusKey(clientId, agentUserId), JSON.stringify(state), TTL_SECONDS);
}

export async function getWaAgentFocus(
  clientId: string,
  agentUserId: string,
): Promise<WaAgentFocusState | null> {
  const redis = RedisManager.getInstance();
  const raw = await redis.get(focusKey(clientId, agentUserId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WaAgentFocusState;
  } catch {
    return null;
  }
}

export async function clearWaAgentFocus(clientId: string, agentUserId: string): Promise<void> {
  const redis = RedisManager.getInstance();
  await redis.deleteKey(focusKey(clientId, agentUserId));
}

export async function setWaAgentPendingAlert(
  clientId: string,
  agentUserId: string,
  ticketRef: string,
  label?: string,
): Promise<void> {
  const redis = RedisManager.getInstance();
  const payload = JSON.stringify({
    ticketRef: normalizeCommandTicketRef(ticketRef),
    label: label?.trim() || undefined,
    setAt: new Date().toISOString(),
  });
  await redis.setWithTTL(pendingKey(clientId, agentUserId), payload, TTL_SECONDS);
}

export async function getWaAgentPendingAlert(
  clientId: string,
  agentUserId: string,
): Promise<WaAgentFocusState | null> {
  const redis = RedisManager.getInstance();
  const raw = await redis.get(pendingKey(clientId, agentUserId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WaAgentFocusState;
  } catch {
    return null;
  }
}

export async function clearWaAgentPendingAlert(
  clientId: string,
  agentUserId: string,
): Promise<void> {
  const redis = RedisManager.getInstance();
  await redis.deleteKey(pendingKey(clientId, agentUserId));
}

/** Resolve TK por número da lista, alerta pendente, foco ou token explícito. */
export async function resolveAgentTicketRef(
  clientId: string,
  agentUserId: string,
  rawArg?: string,
): Promise<ResolveAgentTicketRefResult> {
  const trimmed = rawArg?.trim() ?? '';

  if (/^\d{1,2}$/.test(trimmed)) {
    const picklist = await getWaAgentPicklist(clientId, agentUserId);
    const ref = resolvePicklistIndex(picklist, Number(trimmed));
    if (!ref) {
      return {
        ok: false,
        message: `Item ${trimmed} inválido. Use !abertos ou !meus para atualizar a lista numerada.`,
      };
    }
    const entry = picklist[Number(trimmed) - 1];
    return { ok: true, ticketRef: ref, label: entry?.label };
  }

  if (trimmed) {
    const first = trimmed.split(/\s+/)[0] ?? '';
    if (looksLikeTicketRefToken(first)) {
      const { ticketRef } = parseCommandTicketArg(trimmed);
      if (ticketRef) {
        return { ok: true, ticketRef: normalizeCommandTicketRef(ticketRef) };
      }
    }
  }

  if (!trimmed) {
    const pending = await getWaAgentPendingAlert(clientId, agentUserId);
    if (pending?.ticketRef) {
      return { ok: true, ticketRef: pending.ticketRef, label: pending.label };
    }

    const picklist = await getWaAgentPicklist(clientId, agentUserId);
    if (picklist.length === 1) {
      return { ok: true, ticketRef: picklist[0].ticketRef, label: picklist[0].label };
    }

    const focus = await getWaAgentFocus(clientId, agentUserId);
    if (focus?.ticketRef) {
      return { ok: true, ticketRef: focus.ticketRef, label: focus.label };
    }

    return {
      ok: false,
      message:
        'Informe o chamado: !assumir TK-…, !assumir 1 (após !abertos), ou só !assumir se houver um alerta pendente.',
    };
  }

  const focus = await getWaAgentFocus(clientId, agentUserId);
  if (focus?.ticketRef) {
    return { ok: false, message: 'Use TK-… ou número da lista (!abertos). Foco atual: ' + focus.ticketRef };
  }

  return {
    ok: false,
    message: 'Chamado não reconhecido. Use !abertos e depois !assumir 1, ou !assumir TK-…',
  };
}

/**
 * Comandos com texto livre (!nota, !abrir): se o arg não começa com TK, usa foco atual.
 */
export async function resolveTicketCommandArg(
  clientId: string,
  agentUserId: string,
  rawArg?: string,
): Promise<ResolveTicketCommandArgResult> {
  const trimmed = rawArg?.trim() ?? '';
  if (!trimmed) {
    const focus = await getWaAgentFocus(clientId, agentUserId);
    if (!focus?.ticketRef) {
      return {
        ok: false,
        message: 'Sem foco ativo. Use !assumir TK-… antes ou !foco para ver o contexto.',
      };
    }
    return { ok: false, message: 'Informe o texto após o comando (ex.: !nota Cliente VIP @suporte).' };
  }

  const first = trimmed.split(/\s+/)[0] ?? '';
  if (looksLikeTicketRefToken(first)) {
    const parsed = parseCommandTicketArg(trimmed);
    return {
      ok: true,
      ticketRef: normalizeCommandTicketRef(parsed.ticketRef),
      message: parsed.message,
    };
  }

  const focus = await getWaAgentFocus(clientId, agentUserId);
  if (!focus?.ticketRef) {
    return {
      ok: false,
      message: `Use !nota TK-… ${trimmed} ou defina foco com !assumir antes.`,
    };
  }

  return { ok: true, ticketRef: focus.ticketRef, message: trimmed };
}

/** Só TK (sem mensagem livre no início). */
export async function resolveTicketOnlyArg(
  clientId: string,
  agentUserId: string,
  rawArg?: string,
): Promise<ResolveTicketOnlyArgResult> {
  const resolved = await resolveAgentTicketRef(clientId, agentUserId, rawArg);
  if (resolved.ok === false) return resolved;
  return { ok: true, ticketRef: resolved.ticketRef };
}

export function formatNumberedPicklist(
  title: string,
  entries: WaAgentPicklistEntry[],
  footer: string,
): string {
  if (entries.length === 0) {
    return 'Nenhum item na lista.';
  }
  const lines = [title, ''];
  entries.forEach((e, i) => {
    lines.push(`${i + 1}) ${e.ticketRef} · ${e.label}`);
  });
  lines.push('', footer);
  return lines.join('\n');
}
