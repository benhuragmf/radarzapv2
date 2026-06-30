import { CompanyRole } from '@/auth/rbac/roles';

export interface TeamInviteEmailInput {
  organizationName: string;
  inviteeEmail: string;
  roleLabel: string;
  inviterName: string;
  loginUrl: string;
}

const ROLE_LABEL: Record<CompanyRole, string> = {
  OWNER: 'Dono',
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  ATTENDANT: 'Atendente',
  INTEGRATION: 'Integração API',
  CUSTOM: 'Personalizado',
};

export function resolveInviteRoleLabel(
  companyRole: CompanyRole,
  customRoleName?: string,
): string {
  if (companyRole === CompanyRole.CUSTOM && customRoleName?.trim()) {
    return customRoleName.trim();
  }
  return ROLE_LABEL[companyRole] ?? companyRole;
}

export function buildTeamInviteEmail(input: TeamInviteEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const { organizationName, inviteeEmail, roleLabel, inviterName, loginUrl } = input;
  const subject = `Convite para ${organizationName} — Radar Chat`;

  const text = [
    `Olá,`,
    ``,
    `${inviterName} convidou você (${inviteeEmail}) para a equipe *${organizationName}* no Radar Chat.`,
    `Papel: ${roleLabel}.`,
    ``,
    `Para aceitar, entre com a conta Google deste e-mail:`,
    loginUrl,
    ``,
    `Se você não esperava este convite, ignore este e-mail.`,
    ``,
    `— Radar Chat`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111;max-width:520px;margin:0 auto;padding:24px;">
  <p>Olá,</p>
  <p><strong>${escapeHtml(inviterName)}</strong> convidou você (<strong>${escapeHtml(inviteeEmail)}</strong>) para a equipe <strong>${escapeHtml(organizationName)}</strong> no Radar Chat.</p>
  <p>Papel: <strong>${escapeHtml(roleLabel)}</strong></p>
  <p style="margin:28px 0;">
    <a href="${escapeHtml(loginUrl)}" style="background:#16a34a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600;">
      Entrar com Google
    </a>
  </p>
  <p style="font-size:13px;color:#555;">Use o mesmo e-mail do convite (${escapeHtml(inviteeEmail)}). Link alternativo: <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></p>
  <p style="font-size:12px;color:#888;margin-top:32px;">Se você não esperava este convite, ignore este e-mail.</p>
</body>
</html>`;

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
