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
| PATCH | `/team/members/:id` | `{ roleKey?, whatsappPhone? }` |

## Resolução de permissões

`AuthContextService.buildAuthContext` → `findCustomRoleCapabilities` → `buildCapabilities`.

Ordem: caps do custom role (se houver) + `extraCapabilities` − `deniedCapabilities`.

## UI

- `/settings/team` — `TeamMembers.tsx`, `TeamPermissionsEditor.tsx`
- Layout: scroll do navegador; grid de papéis responsivo (`auto-fill`)
