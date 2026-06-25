import { CompanyRole } from '@/auth/rbac/roles';
import { Cap } from '@/auth/rbac/capabilities';
import {
  canAssignTeamRole,
  classifyMemberSeatRole,
  countTeamSeats,
  resolveTeamPlanLimits,
  TEAM_LIMIT_MESSAGES,
} from '../team-plan-limits';

describe('team-plan-limits', () => {
  describe('resolveTeamPlanLimits', () => {
    it('lê limites do catálogo starter', () => {
      const limits = resolveTeamPlanLimits('starter');
      expect(limits).toEqual({
        includedUsers: 3,
        includedAgents: 2,
        includedSupervisors: 1,
      });
    });

    it('lê limites enterprise', () => {
      const limits = resolveTeamPlanLimits('enterprise');
      expect(limits.includedUsers).toBe(30);
      expect(limits.includedAgents).toBe(20);
      expect(limits.includedSupervisors).toBe(10);
    });
  });

  describe('classifyMemberSeatRole', () => {
    it('ATTENDANT conta como atendente', () => {
      expect(classifyMemberSeatRole(CompanyRole.ATTENDANT)).toEqual({
        isAgent: true,
        isSupervisor: false,
      });
    });

    it('MANAGER conta como supervisor', () => {
      expect(classifyMemberSeatRole(CompanyRole.MANAGER)).toEqual({
        isAgent: false,
        isSupervisor: true,
      });
    });

    it('custom com INBOX_SUPERVISE é supervisor', () => {
      expect(
        classifyMemberSeatRole(CompanyRole.CUSTOM, [Cap.INBOX_SUPERVISE, Cap.INBOX_VIEW]),
      ).toEqual({ isAgent: false, isSupervisor: true });
    });

    it('custom com INBOX_REPLY é atendente', () => {
      expect(
        classifyMemberSeatRole(CompanyRole.CUSTOM, [Cap.INBOX_REPLY, Cap.INBOX_VIEW]),
      ).toEqual({ isAgent: true, isSupervisor: false });
    });

    it('financeiro custom não é atendente nem supervisor', () => {
      expect(
        classifyMemberSeatRole(CompanyRole.CUSTOM, [Cap.BILLING_VIEW, Cap.DASHBOARD_VIEW]),
      ).toEqual({ isAgent: false, isSupervisor: false });
    });
  });

  describe('countTeamSeats', () => {
    it('ignora owner e inativos', () => {
      const counts = countTeamSeats([
        { id: '1', companyRole: CompanyRole.OWNER, isActive: true },
        { id: '2', companyRole: CompanyRole.ATTENDANT, isActive: true },
        { id: '3', companyRole: CompanyRole.MANAGER, isActive: false },
      ]);
      expect(counts).toEqual({ users: 1, agents: 1, supervisors: 0 });
    });
  });

  describe('canAssignTeamRole', () => {
    const starterLimits = {
      includedUsers: 3,
      includedAgents: 2,
      includedSupervisors: 1,
    };

    it('permite convite dentro do limite', () => {
      const result = canAssignTeamRole(
        { users: 1, agents: 1, supervisors: 0 },
        starterLimits,
        { companyRole: CompanyRole.ATTENDANT },
      );
      expect(result).toEqual({ ok: true });
    });

    it('bloqueia usuários totais', () => {
      const result = canAssignTeamRole(
        { users: 3, agents: 1, supervisors: 0 },
        starterLimits,
        { companyRole: CompanyRole.ADMIN },
      );
      expect(result).toEqual({
        ok: false,
        code: 'users',
        message: TEAM_LIMIT_MESSAGES.users,
      });
    });

    it('bloqueia atendentes', () => {
      const result = canAssignTeamRole(
        { users: 2, agents: 2, supervisors: 0 },
        starterLimits,
        { companyRole: CompanyRole.ATTENDANT },
      );
      expect(result).toEqual({
        ok: false,
        code: 'agents',
        message: TEAM_LIMIT_MESSAGES.agents,
      });
    });

    it('bloqueia supervisores', () => {
      const result = canAssignTeamRole(
        { users: 2, agents: 1, supervisors: 1 },
        starterLimits,
        { companyRole: CompanyRole.MANAGER },
      );
      expect(result).toEqual({
        ok: false,
        code: 'supervisors',
        message: TEAM_LIMIT_MESSAGES.supervisors,
      });
    });

    it('troca de cargo sem novo assento ainda valida limite de supervisor', () => {
      const result = canAssignTeamRole(
        { users: 3, agents: 1, supervisors: 1 },
        starterLimits,
        { companyRole: CompanyRole.MANAGER, addsUserSeat: false },
      );
      expect(result).toEqual({
        ok: false,
        code: 'supervisors',
        message: TEAM_LIMIT_MESSAGES.supervisors,
      });
    });

    it('owner sempre permitido', () => {
      const result = canAssignTeamRole(
        { users: 99, agents: 99, supervisors: 99 },
        starterLimits,
        { companyRole: CompanyRole.OWNER },
      );
      expect(result).toEqual({ ok: true });
    });
  });
});
