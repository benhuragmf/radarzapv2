import { buildTeamInviteEmail, resolveInviteRoleLabel } from '../team-invite-email';
import { CompanyRole } from '@/auth/rbac/roles';

describe('team-invite-email', () => {
  it('monta assunto e link de login', () => {
    const { subject, text, html } = buildTeamInviteEmail({
      organizationName: 'Acme Ltda',
      inviteeEmail: 'ana@acme.com',
      roleLabel: 'Atendente',
      inviterName: 'João',
      loginUrl: 'https://app.example/auth/google',
    });
    expect(subject).toContain('Acme Ltda');
    expect(text).toContain('ana@acme.com');
    expect(text).toContain('https://app.example/auth/google');
    expect(html).toContain('Entrar com Google');
  });

  it('usa nome do papel customizado', () => {
    expect(
      resolveInviteRoleLabel(CompanyRole.CUSTOM, 'Suporte N2'),
    ).toBe('Suporte N2');
    expect(resolveInviteRoleLabel(CompanyRole.ADMIN)).toBe('Administrador');
  });
});
