import mongoose from 'mongoose';
import { InboxConversationStatus } from '@/types/inbox';

export type DepartmentVisibility = {
  restricted: boolean;
  departmentIds: mongoose.Types.ObjectId[];
};

/** Conversa WA em triagem sem atendente humano (ainda sem setor). */
export const WA_UNASSIGNED_TRIAGE_CLAUSE = {
  status: InboxConversationStatus.BOT_TRIAGE,
  $or: [{ assignedUserId: { $exists: false } }, { assignedUserId: null }],
};

/** Conversa WebChat em triagem bot sem atendente humano. */
export const WEBCHAT_UNASSIGNED_TRIAGE_CLAUSE = {
  queueStatus: 'bot',
  $or: [{ assignedUserId: { $exists: false } }, { assignedUserId: null }],
};

function assignedToUserClause(userOid: mongoose.Types.ObjectId) {
  return {
    $or: [{ assignedUserId: userOid }, { suggestedUserId: userOid }],
  };
}

/** Aplica filtro de visibilidade por setor na listagem do Inbox (WA). */
export function applyRestrictedWaListVisibility(
  query: Record<string, unknown>,
  visibility: DepartmentVisibility,
  userOid: mongoose.Types.ObjectId,
  filters: { departmentId?: string },
  opts: { attendantTriageVisible: boolean },
): void {
  if (!visibility.restricted) return;

  const assignedClause = assignedToUserClause(userOid);

  if (filters.departmentId) {
    const deptOid = new mongoose.Types.ObjectId(filters.departmentId);
    const allowedDept = visibility.departmentIds.some(id => id.equals(deptOid));
    if (!allowedDept) {
      Object.assign(query, assignedClause);
    }
    return;
  }

  const orClauses: Record<string, unknown>[] = [];

  if (visibility.departmentIds.length > 0) {
    orClauses.push({ departmentId: { $in: visibility.departmentIds } });
  }
  orClauses.push(assignedClause);
  if (opts.attendantTriageVisible) {
    orClauses.push(WA_UNASSIGNED_TRIAGE_CLAUSE);
  }

  if (orClauses.length === 1) {
    Object.assign(query, orClauses[0]);
  } else {
    query.$or = orClauses;
  }
}

/** Aplica filtro de visibilidade por setor na listagem unificada WebChat. */
export function applyRestrictedWebChatListVisibility(
  query: Record<string, unknown>,
  visibility: DepartmentVisibility,
  userOid: mongoose.Types.ObjectId,
  filters: { departmentId?: string },
  opts: { attendantTriageVisible: boolean },
): void {
  if (!visibility.restricted) return;

  const assignedClause = assignedToUserClause(userOid);

  if (filters.departmentId) {
    const deptOid = new mongoose.Types.ObjectId(filters.departmentId);
    const allowedDept = visibility.departmentIds.some(id => id.equals(deptOid));
    query.departmentId = deptOid;
    if (!allowedDept) {
      Object.assign(query, assignedClause);
    }
    return;
  }

  const orClauses: Record<string, unknown>[] = [];

  if (visibility.departmentIds.length > 0) {
    orClauses.push({ departmentId: { $in: visibility.departmentIds } });
  }
  orClauses.push(assignedClause);
  if (opts.attendantTriageVisible) {
    orClauses.push(WEBCHAT_UNASSIGNED_TRIAGE_CLAUSE);
  }

  if (orClauses.length === 1) {
    Object.assign(query, orClauses[0]);
  } else {
    query.$or = orClauses;
  }
}

/** Bloqueia acesso direto à triagem quando a empresa não liberou para atendentes. */
export function isUnassignedTriageBlockedForAttendant(
  visibility: DepartmentVisibility,
  opts: {
    attendantTriageVisible: boolean;
    status: string;
    assignedUserId?: mongoose.Types.ObjectId | null;
    suggestedUserId?: mongoose.Types.ObjectId | null;
    departmentId?: mongoose.Types.ObjectId | null;
  },
): boolean {
  if (!visibility.restricted || opts.attendantTriageVisible) return false;
  if (opts.assignedUserId || opts.suggestedUserId) return false;
  if (opts.departmentId) return false;

  return (
    opts.status === InboxConversationStatus.BOT_TRIAGE ||
    opts.status === 'bot_triage'
  );
}
