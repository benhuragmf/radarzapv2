import { Cap } from '@/auth/rbac/capabilities';
import { can, buildCapabilities } from '@/auth/rbac/can';
import { SystemRole, CompanyRole, UserRole } from '@/auth/rbac/roles';
import type { AuthContext } from '@/auth/rbac/types';

function ctx(partial: Partial<AuthContext>): AuthContext {
  const systemRole = partial.systemRole ?? SystemRole.USER;
  return {
    userId: 'u1',
    clientId: 'org1',
    organizationId: 'org1',
    companyRole: CompanyRole.OWNER,
    organizations: [],
    needsOrganizationChoice: false,
    username: 'test',
    avatar: null,
    plan: 'pro',
    systemRole,
    primaryRole: UserRole.USER,
    capabilities: [],
    guilds: [],
    linkedGuildIds: [],
    hasDiscordAccess: false,
    isInternalStaff:
      systemRole === SystemRole.SYSTEM_ADMIN || systemRole === SystemRole.SYSTEM_MODERATOR,
    connections: {
      google: { linked: false },
      discord: { linked: false },
    },
    ...partial,
  };
}

describe('admin ops summary RBAC', () => {
  it('system admin acessa dashboard:global', () => {
    const admin = ctx({
      systemRole: SystemRole.SYSTEM_ADMIN,
      primaryRole: UserRole.SYSTEM_ADMIN,
      capabilities: buildCapabilities(SystemRole.SYSTEM_ADMIN, CompanyRole.OWNER, [], 'pro', []),
    });
    expect(can(admin, Cap.DASHBOARD_GLOBAL)).toBe(true);
  });

  it('system moderator com dashboard:global acessa', () => {
    const mod = ctx({
      systemRole: SystemRole.SYSTEM_MODERATOR,
      primaryRole: UserRole.SYSTEM_MODERATOR,
      capabilities: buildCapabilities(SystemRole.SYSTEM_MODERATOR, null, [], 'free', []),
    });
    expect(can(mod, Cap.DASHBOARD_GLOBAL)).toBe(true);
  });

  it('owner tenant comum não possui dashboard:global', () => {
    const owner = ctx({
      systemRole: SystemRole.USER,
      companyRole: CompanyRole.OWNER,
      capabilities: buildCapabilities(SystemRole.USER, CompanyRole.OWNER, [], 'pro', []),
    });
    expect(can(owner, Cap.DASHBOARD_GLOBAL)).toBe(false);
  });

  it('atendente não possui dashboard:global', () => {
    const attendant = ctx({
      systemRole: SystemRole.USER,
      companyRole: CompanyRole.ATTENDANT,
      capabilities: buildCapabilities(SystemRole.USER, CompanyRole.ATTENDANT, [], 'pro', []),
    });
    expect(can(attendant, Cap.DASHBOARD_GLOBAL)).toBe(false);
  });

  it('manager não possui dashboard:global', () => {
    const manager = ctx({
      systemRole: SystemRole.USER,
      companyRole: CompanyRole.MANAGER,
      capabilities: buildCapabilities(SystemRole.USER, CompanyRole.MANAGER, [], 'pro', []),
    });
    expect(can(manager, Cap.DASHBOARD_GLOBAL)).toBe(false);
  });
});
