import mongoose from 'mongoose';
import { CompanyRole } from '@/auth/rbac/roles';
import { Cap, Capability } from '@/auth/rbac/capabilities';
import { CompanyMember, ICompanyMember } from '@/models/CompanyMember';
import { Organization } from '@/models/Organization';
import { PlanConfigService } from '@/services/billing/plan-config';
import { findCustomRoleCapabilities } from '@/auth/rbac/companyRolePresets';
import type { OrgCustomRole } from '@/types/org-custom-role';

export const TEAM_LIMIT_MESSAGES = {
  users:
    'Limite de usuários do plano atingido. Faça upgrade do plano ou remova usuários inativos para convidar novos membros.',
  agents:
    'Limite de atendentes do plano atingido. Faça upgrade do plano ou ajuste os cargos da equipe.',
  supervisors:
    'Limite de supervisores do plano atingido. Faça upgrade do plano ou ajuste os cargos da equipe.',
} as const;

export interface TeamPlanLimits {
  includedUsers: number;
  includedAgents: number;
  includedSupervisors: number;
}

export interface TeamSeatCounts {
  users: number;
  agents: number;
  supervisors: number;
}

export interface MemberSeatSnapshot {
  id: string;
  companyRole: CompanyRole;
  customRoleId?: string;
  isActive: boolean;
}

export type TeamLimitBlockCode = keyof typeof TEAM_LIMIT_MESSAGES;

export type TeamLimitCheckResult =
  | { ok: true }
  | { ok: false; code: TeamLimitBlockCode; message: string };

/** Limites de equipe do catálogo comercial (TOP 03). */
export function resolveTeamPlanLimits(planId: string): TeamPlanLimits {
  const commercial = PlanConfigService.getInstance().getCommercialLimits(planId);
  if (commercial) {
    return {
      includedUsers: commercial.includedUsers,
      includedAgents: commercial.includedAgents,
      includedSupervisors: commercial.includedSupervisors,
    };
  }
  const free = PlanConfigService.getInstance().getCommercialLimits('free');
  return {
    includedUsers: free?.includedUsers ?? 1,
    includedAgents: free?.includedAgents ?? 1,
    includedSupervisors: free?.includedSupervisors ?? 0,
  };
}

function customCapsForMember(
  member: MemberSeatSnapshot,
  customRoles: OrgCustomRole[],
): Capability[] | null {
  if (!member.customRoleId) return null;
  return findCustomRoleCapabilities(member.customRoleId, customRoles);
}

/** Classifica assento operacional (atendente / supervisor) a partir do papel. */
export function classifyMemberSeatRole(
  companyRole: CompanyRole,
  customCapabilities?: Capability[] | null,
): { isAgent: boolean; isSupervisor: boolean } {
  if (companyRole === CompanyRole.OWNER) {
    return { isAgent: false, isSupervisor: false };
  }
  if (companyRole === CompanyRole.ATTENDANT) {
    return { isAgent: true, isSupervisor: false };
  }
  if (companyRole === CompanyRole.MANAGER) {
    return { isAgent: false, isSupervisor: true };
  }
  if (companyRole === CompanyRole.CUSTOM && customCapabilities?.length) {
    const caps = new Set(customCapabilities);
    const isSupervisor = caps.has(Cap.INBOX_SUPERVISE);
    const isAgent =
      !isSupervisor &&
      (caps.has(Cap.INBOX_REPLY) || caps.has(Cap.WEBCHAT_REPLY));
    return { isAgent, isSupervisor };
  }
  return { isAgent: false, isSupervisor: false };
}

/** Conta assentos ativos/pendentes (exclui OWNER). */
export function countTeamSeats(
  members: MemberSeatSnapshot[],
  customRoles: OrgCustomRole[] = [],
  options?: { excludeMemberId?: string },
): TeamSeatCounts {
  const exclude = options?.excludeMemberId;
  let users = 0;
  let agents = 0;
  let supervisors = 0;

  for (const member of members) {
    if (!member.isActive) continue;
    if (member.companyRole === CompanyRole.OWNER) continue;
    if (exclude && member.id === exclude) continue;

    users += 1;
    const customCaps = customCapsForMember(member, customRoles);
    const seat = classifyMemberSeatRole(member.companyRole, customCaps);
    if (seat.isAgent) agents += 1;
    if (seat.isSupervisor) supervisors += 1;
  }

  return { users, agents, supervisors };
}

export function canAssignTeamRole(
  current: TeamSeatCounts,
  limits: TeamPlanLimits,
  assignment: {
    companyRole: CompanyRole;
    customCapabilities?: Capability[] | null;
    addsUserSeat?: boolean;
  },
): TeamLimitCheckResult {
  if (assignment.companyRole === CompanyRole.OWNER) {
    return { ok: true };
  }

  const seat = classifyMemberSeatRole(
    assignment.companyRole,
    assignment.customCapabilities,
  );
  const addsUser = assignment.addsUserSeat !== false;

  const projectedUsers = addsUser ? current.users + 1 : current.users;
  const projectedAgents = seat.isAgent ? current.agents + 1 : current.agents;
  const projectedSupervisors = seat.isSupervisor
    ? current.supervisors + 1
    : current.supervisors;

  if (projectedUsers > limits.includedUsers) {
    return { ok: false, code: 'users', message: TEAM_LIMIT_MESSAGES.users };
  }
  if (projectedAgents > limits.includedAgents) {
    return { ok: false, code: 'agents', message: TEAM_LIMIT_MESSAGES.agents };
  }
  if (projectedSupervisors > limits.includedSupervisors) {
    return {
      ok: false,
      code: 'supervisors',
      message: TEAM_LIMIT_MESSAGES.supervisors,
    };
  }
  return { ok: true };
}

function memberToSnapshot(doc: ICompanyMember): MemberSeatSnapshot {
  return {
    id: doc._id.toString(),
    companyRole: doc.companyRole,
    customRoleId: doc.customRoleId,
    isActive: doc.isActive,
  };
}

export async function loadTeamSeatContext(
  organizationId: string,
  options?: { excludeMemberId?: string },
): Promise<{
  limits: TeamPlanLimits;
  counts: TeamSeatCounts;
  customRoles: OrgCustomRole[];
}> {
  const orgOid = new mongoose.Types.ObjectId(organizationId);
  const org = await Organization.findById(orgOid).select('plan customRoles').lean();
  const planId = (org?.plan as string | undefined) ?? 'free';
  const customRoles = (org?.customRoles ?? []) as OrgCustomRole[];

  const members = await CompanyMember.find({ organizationId: orgOid }).lean();
  const snapshots = members.map(m =>
    memberToSnapshot(m as unknown as ICompanyMember),
  );
  const counts = countTeamSeats(snapshots, customRoles, options);

  return {
    limits: resolveTeamPlanLimits(planId),
    counts,
    customRoles,
  };
}

export async function assertCanAssignTeamRole(
  organizationId: string,
  assignment: {
    companyRole: CompanyRole;
    customRoleId?: string;
    excludeMemberId?: string;
    addsUserSeat?: boolean;
  },
): Promise<void> {
  const { limits, counts, customRoles } = await loadTeamSeatContext(
    organizationId,
    { excludeMemberId: assignment.excludeMemberId },
  );

  let customCapabilities: Capability[] | null = null;
  if (assignment.customRoleId) {
    customCapabilities = findCustomRoleCapabilities(
      assignment.customRoleId,
      customRoles,
    );
  }

  const result = canAssignTeamRole(counts, limits, {
    companyRole: assignment.companyRole,
    customCapabilities,
    addsUserSeat: assignment.addsUserSeat,
  });

  if (result.ok === false) {
    throw new Error(result.message);
  }
}