# Equipe, papéis e permissões

RBAC multi-tenant por **Organization**. Capabilities em `src/auth/rbac/capabilities.ts`.

## Papéis do sistema

| Papel | Convite | Notas |
|-------|---------|-------|
| OWNER | Não | Acesso total; único que exclui org |
| ADMIN | Sim | Quase tudo |
| MANAGER | Sim | Inbox + supervisão; sem API/WA sessão |
| ATTENDANT | Sim | Inbox + contatos |
| INTEGRATION | Sim | Só API |
| CUSTOM (legado) | **Não** | Oculto na UI; usar papéis `custom:*` |

Presets: `src/auth/rbac/companyRolePresets.ts` — `buildAllPresetsForOrg` filtra CUSTOM e mescla `customRoles`.

## Papéis personalizados (`customRoles`)

Armazenados em `Organization.customRoles[]`:

```ts
{ id: string; name: string; description?: string; capabilities: Capability[] }
```

- Chave API/UI: `custom:{id}` — helpers em `src/types/org-custom-role.ts`
- Membro vinculado: `CompanyMember.companyRole = CUSTOM` + `customRoleId`
- Default na criação da org: **Atendente 2ª instância** (`defaultOrgCustomRoles()`)
- Criar/editar/excluir: `/settings/team` → **Papéis do sistema** → **+ Novo papel**

## Override por empresa

`Organization.roleCapabilities` — mapa `CompanyRole → Capability[]` sobrescreve preset global (não afeta custom roles).

## API (`/api/team/*`)

Requer `company:members:manage` (dono ou quem tiver a cap).

| Método | Rota | Body / notas |
|--------|------|--------------|
| GET | `/team/roles` | presets + permissionGroups + customRoles |
| PATCH | `/team/roles/:role` | `{ capabilities: string[] }` |
| DELETE | `/team/roles/:role` | restaura preset |
| POST | `/team/custom-roles` | `{ name, description?, capabilities }` |
| PATCH | `/team/custom-roles/:id` | `{ name?, description?, capabilities? }` |
| DELETE | `/team/custom-roles/:id` | falha se membros ainda usam |
| POST | `/team/members` | `{ email, roleKey }` — envia e-mail de convite |
| POST | `/team/members/:id/resend-invite` | reenvia e-mail (membro pendente) |
| PATCH | `/team/members/:id` | `{ roleKey? }` — papel apenas; **não** aceita `whatsappPhone` direto |
| PATCH | `/team/members/:id/profile` | `{ displayName?, email?, whatsappPhone? }` — dados do membro; alterar e-mail/WA **invalida** verificação |
| POST | `/team/members/:id/whatsapp/request-code` | `{ phone }` — OTP no número; aviso de auditoria ao dono |
| POST | `/team/members/:id/whatsapp/confirm` | `{ phone, code }` — salva WA verificado |
| DELETE | `/team/members/:id/whatsapp` | remove WA do membro |
| GET | `/organization/team-settings` | `{ allowMembersEditOwnProfile }` |
| PATCH | `/organization/team-settings` | `{ allowMembersEditOwnProfile? }` — **somente OWNER** |

### Perfil do membro (`/auth/me/*`)

Rotas de sessão (cookie painel), sem capability extra — qualquer membro autenticado na org.

| Método | Rota | Body / notas |
|--------|------|--------------|
| GET | `/auth/me/member-profile` | status completo: verificações, `canEditProfile`, `profileComplete`, `pendingConfirmations` |
| PATCH | `/auth/me/member-profile` | `{ displayName? }` — só se `allowMembersEditOwnProfile` |
| POST | `/auth/me/email/request-code` | `{ email? }` — OTP por e-mail; se edição bloqueada, confirma e-mail cadastrado |
| POST | `/auth/me/email/confirm` | `{ email, code }` |
| POST | `/auth/me/whatsapp/request-code` | `{ phone }` — OTP via WA da empresa |
| POST | `/auth/me/whatsapp/confirm` | `{ phone, code }` |
| DELETE | `/auth/me/whatsapp` | remove WA — só se edição liberada |

Código: `src/services/organization/member-profile.service.ts`.

## Perfil, confirmações e política da empresa (2.11.49–2.11.50)

### Modelos

| Modelo | Campo | Desde | Uso |
|--------|-------|-------|-----|
| `Organization` | `teamSettings.allowMembersEditOwnProfile` | 2.11.50 | `false` (padrão): empresa cadastra; atendente só confirma |
| `CompanyMember` | `displayName` | 2.11.50 | Nome na equipe (admin ou self-service) |
| `CompanyMember` | `emailVerifiedAt` | 2.11.50 | E-mail confirmado por OTP |
| `CompanyMember` | `whatsappPhone` | — | Número pessoal (bridge, `!assumir`, alertas) |
| `CompanyMember` | `whatsappPhoneVerifiedAt` | 2.11.49 | WA confirmado por OTP no próprio número |

### Dois modos de operação

**Empresa A (padrão)** — `allowMembersEditOwnProfile = false`

1. Dono/admin cadastra em **Equipe → Editar membro**: nome, e-mail, WhatsApp (`PATCH …/profile` ou OTP WA no modal).
2. Atendente em **Configurações → Meu perfil** (`/settings#perfil`): vê dados em leitura e **confirma** com código.
3. Não pode alterar número/e-mail/nome sem passar pelo admin.

**Empresa B** — `allowMembersEditOwnProfile = true`

1. Dono ativa o toggle em **Equipe → Perfil dos atendentes**.
2. Atendente pode editar nome, e-mail e WhatsApp em Meu perfil.
3. **Toda alteração** exige novo OTP (e-mail ou WhatsApp).

### Confirmações obrigatórias

Para atendentes (`ATTENDANT`, `MANAGER`, `CUSTOM`, etc. — exceto `OWNER` e `INTEGRATION`):

| Dado | Como confirma | Exceção |
|------|----------------|---------|
| E-mail | Código 6 dígitos por e-mail (Resend/SMTP) | Login **Google** com mesmo e-mail → auto-verificado |
| WhatsApp | Código 6 dígitos no número via sessão WA da empresa | — |

`profileComplete = false` enquanto houver item em `pendingConfirmations` (`email` e/ou `whatsapp`).

Comandos WA (`!assumir`, bridge) exigem `whatsappPhoneVerifiedAt` — ver `whatsapp-agent-auth.service.ts`.

### Fluxo OTP WhatsApp (admin)

1. Admin informa número → `POST /team/members/:id/whatsapp/request-code`.
2. Código vai ao **número informado** (impede número aleatório sem acesso).
3. Dono recebe **auditoria** no WA verificado dele (se configurado).
4. Admin confirma com `…/confirm` **ou** o atendente confirma em Meu perfil.

Salvar telefone em `PATCH …/profile` grava número **sem** verificação; o membro deve confirmar depois.

### UI

- `/settings#perfil` — `MyProfilePanel.tsx` (todos os membros; header linka para cá)
- `/settings/team` — toggle política (dono), lista com status e-mail/WA, modal `TeamMemberRoleModal`

## Resolução de permissões

`AuthContextService.buildAuthContext` → `findCustomRoleCapabilities` → `buildCapabilities`.

Ordem: caps do custom role (se houver) + `extraCapabilities` − `deniedCapabilities`.

## UI

- `/settings/team` — `TeamMembers.tsx`, `TeamPermissionsEditor.tsx`
- Layout: scroll do navegador; grid de papéis responsivo (`auto-fill`)

## Presença operacional (Inbox)

Status persistidos por atendente: `online`, `ausente`, `ocupado`, `offline`, `supervisor_online`. Heartbeat no painel + socket; round-robin e fallback WebChat consultam disponibilidade real (não só socket conectado).

**Cap:** `inbox:reply` (atendente altera o próprio status); supervisores veem equipe com `inbox:supervise`.

| Método | Rota | Notas |
|--------|------|-------|
| GET | `/inbox/presence/config` | Timeouts (`presenceIdleTimeoutSeconds`, etc.) |
| GET | `/inbox/presence/me` | Status atual do usuário logado |
| PATCH | `/inbox/presence/me` | `{ status }` — heartbeat implícito |
| GET | `/inbox/presence/team` | Lista equipe + status (`inbox:supervise`) |
| PATCH | `/inbox/presence/:userId` | Supervisor altera status de membro |

Configuração de timeouts: **Triagem e Bot** (`/platform/inbox/bot`) — campos `agentPresenceTimeoutSeconds`, `presenceIdleTimeoutSeconds`, `whatsappFallbackAcceptTimeoutSeconds`.

Código: `src/services/inbox/inbox-agent-presence.ts`, `src/constants/agent-presence.ts`. Doc: [`INBOX-ATENDIMENTO.md`](./INBOX-ATENDIMENTO.md) § Presença operacional.
