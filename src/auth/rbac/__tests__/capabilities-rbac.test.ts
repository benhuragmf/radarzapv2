import { CompanyRole } from '../roles';
import { Cap, capabilitiesForCompanyRole } from '../capabilities';
import { resolveMemberCapabilities } from '../companyRolePresets';

function hasCap(role: CompanyRole, cap: string): boolean {
  return capabilitiesForCompanyRole(role).includes(cap as (typeof Cap)[keyof typeof Cap]);
}

describe('capabilities RBAC — presets oficiais', () => {
  it('OWNER possui permissões críticas', () => {
    expect(hasCap(CompanyRole.OWNER, Cap.BILLING_MANAGE)).toBe(true);
    expect(hasCap(CompanyRole.OWNER, Cap.COMPANY_MEMBERS_MANAGE)).toBe(true);
    expect(hasCap(CompanyRole.OWNER, Cap.WHATSAPP_SESSION_MANAGE)).toBe(true);
    expect(hasCap(CompanyRole.OWNER, Cap.INBOX_AI_MANAGE)).toBe(true);
    expect(hasCap(CompanyRole.OWNER, Cap.PLATFORM_AUDIT_VIEW)).toBe(true);
  });

  it('ADMIN mantém permissões operacionais sem billing manage', () => {
    expect(hasCap(CompanyRole.ADMIN, Cap.COMPANY_MEMBERS_MANAGE)).toBe(true);
    expect(hasCap(CompanyRole.ADMIN, Cap.INBOX_SUPERVISE)).toBe(true);
    expect(hasCap(CompanyRole.ADMIN, Cap.WEBCHAT_MANAGE)).toBe(true);
    expect(hasCap(CompanyRole.ADMIN, Cap.BILLING_VIEW)).toBe(true);
    expect(hasCap(CompanyRole.ADMIN, Cap.BILLING_MANAGE)).toBe(false);
    expect(hasCap(CompanyRole.ADMIN, Cap.WHATSAPP_SESSION_MANAGE)).toBe(false);
  });

  it('MANAGER supervisiona sem billing nem equipe', () => {
    expect(hasCap(CompanyRole.MANAGER, Cap.INBOX_SUPERVISE)).toBe(true);
    expect(hasCap(CompanyRole.MANAGER, Cap.BILLING_VIEW)).toBe(false);
    expect(hasCap(CompanyRole.MANAGER, Cap.COMPANY_MEMBERS_MANAGE)).toBe(false);
    expect(hasCap(CompanyRole.MANAGER, Cap.API_KEY_CREATE)).toBe(false);
  });

  it('ATTENDANT não acessa billing nem equipe', () => {
    expect(hasCap(CompanyRole.ATTENDANT, Cap.INBOX_REPLY)).toBe(true);
    expect(hasCap(CompanyRole.ATTENDANT, Cap.BILLING_VIEW)).toBe(false);
    expect(hasCap(CompanyRole.ATTENDANT, Cap.COMPANY_MEMBERS_MANAGE)).toBe(false);
    expect(hasCap(CompanyRole.ATTENDANT, Cap.INBOX_SUPERVISE)).toBe(false);
    expect(hasCap(CompanyRole.ATTENDANT, Cap.WEBCHAT_MANAGE)).toBe(false);
  });

  it('INTEGRATION tem permissões mínimas de API', () => {
    const caps = capabilitiesForCompanyRole(CompanyRole.INTEGRATION);
    expect(caps).toContain(Cap.API_KEY_CREATE);
    expect(caps).toContain(Cap.API_LOGS_VIEW);
    expect(caps).not.toContain(Cap.INBOX_VIEW);
    expect(caps).not.toContain(Cap.BILLING_VIEW);
    expect(caps).not.toContain(Cap.COMPANY_MEMBERS_MANAGE);
  });
});

describe('capabilities RBAC — papéis custom oficiais (TOP 04)', () => {
  const financeCaps = [
    Cap.DASHBOARD_VIEW,
    Cap.ACCOUNT_SETTINGS,
    Cap.BILLING_VIEW,
    Cap.INBOX_AI_BALANCE_VIEW,
    Cap.PLATFORM_REPORTS_VIEW,
  ];

  const marketingCaps = [
    Cap.DASHBOARD_VIEW,
    Cap.ACCOUNT_SETTINGS,
    Cap.CONSENT_VIEW,
    Cap.SEND_DESTINATION_VIEW,
    Cap.INBOX_VIEW,
    Cap.PLATFORM_REPORTS_VIEW,
  ];

  const viewerCaps = [
    Cap.DASHBOARD_VIEW,
    Cap.CONSENT_VIEW,
    Cap.INBOX_REPORTS_VIEW,
    Cap.PLATFORM_REPORTS_VIEW,
  ];

  it('Financeiro vê billing e créditos IA, sem inbox reply', () => {
    const caps = resolveMemberCapabilities(CompanyRole.CUSTOM, [], [], undefined, financeCaps);
    expect(caps).toContain(Cap.BILLING_VIEW);
    expect(caps).toContain(Cap.INBOX_AI_BALANCE_VIEW);
    expect(caps).not.toContain(Cap.INBOX_REPLY);
    expect(caps).not.toContain(Cap.COMPANY_MEMBERS_MANAGE);
  });

  it('Marketing vê leads/contatos, sem billing', () => {
    const caps = resolveMemberCapabilities(CompanyRole.CUSTOM, [], [], undefined, marketingCaps);
    expect(caps).toContain(Cap.CONSENT_VIEW);
    expect(caps).toContain(Cap.INBOX_VIEW);
    expect(caps).not.toContain(Cap.BILLING_VIEW);
    expect(caps).not.toContain(Cap.INBOX_REPLY);
  });

  it('Viewer só consulta, sem editar atendimento', () => {
    const caps = resolveMemberCapabilities(CompanyRole.CUSTOM, [], [], undefined, viewerCaps);
    expect(caps).toContain(Cap.INBOX_REPORTS_VIEW);
    expect(caps).not.toContain(Cap.INBOX_REPLY);
    expect(caps).not.toContain(Cap.BILLING_VIEW);
    expect(caps).not.toContain(Cap.COMPANY_MEMBERS_MANAGE);
  });
});
