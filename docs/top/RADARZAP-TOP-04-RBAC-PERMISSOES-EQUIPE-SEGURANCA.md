# RadarZap — TOP 04/20 — RBAC, Permissões, Equipe e Segurança Multiempresa

**Data:** 2026-06-24  
**Versão após TOP 04:** `2.11.90`  
**Branch:** `main`

---

## Resumo executivo

O TOP 04 fechou a **base de segurança operacional** do RadarZap: matriz oficial de cargos/permissões documentada, presets existentes validados por testes, **limites de equipe por plano** aplicados no fluxo de convite/alteração de cargo, auditoria mínima em ações de equipe e testes RBAC/cross-tenant.

**Implementado:** helper `team-plan-limits.ts`, enforcement em `OrganizationService.inviteMember` e `updateMember`, papéis custom sugeridos (Financeiro, Marketing, Viewer) em novas orgs, testes unitários (25 novos cenários RBAC/equipe).

**Não implementado (escopo):** billing enforcement agressivo (TOP 17), status operacional de atendente (TOP 05), novos enums `CompanyRole` destrutivos, capability dedicada `leads:*` (usa `consent:view` hoje).

**Gates:** typecheck, build backend, 594 testes — todos verdes. Frontend não alterado nesta etapa.

---

## Herança dos TOPs anteriores

### TOP 01 — RBAC identificado como OK

- Presets: `OWNER`, `ADMIN`, `MANAGER`, `ATTENDANT`, `INTEGRATION`, `CUSTOM` (legado).
- Capabilities granulares em `src/auth/rbac/capabilities.ts`; `requireCapability()` no backend; `ProtectedRoute` + `ROUTE_PERMISSIONS` + `can()` no frontend.
- Risco principal: UI não substitui backend; APIs públicas WebChat/Leads e cross-tenant exigiam validação.

### TOP 02 — Baseline verde

- Versão `2.11.88`; typecheck, build, testes, `qa:atendimento:gate`, build frontend verdes.

### TOP 03 — Limites comerciais

- Catálogo `config/plans.json` com `includedAgents`, `includedUsers`, `includedSupervisors` por plano.
- Recomendação: usar esses campos em convites/equipe sem billing agressivo.

### Esta etapa aplica

| Item | Status |
|------|--------|
| Matriz oficial cargos/permissões | Documentada |
| Limites equipe no convite/troca de cargo | Implementado |
| Papéis Financeiro/Marketing/Viewer | Custom roles default (novas orgs) |
| Testes RBAC + cross-tenant + limites | Criados |
| Auditoria convite/cargo/remoção equipe | `AuditLog` |
| Revisão endpoints `/team/*` e billing | Documentada |

### Esta etapa não aplica

| Item | TOP futuro |
|------|------------|
| Billing bloqueio inadimplência | TOP 17 |
| Status operacional atendente | TOP 05 |
| Modos de atendimento | TOP 06 |
| Capability `leads:*` dedicada | Pendente produto |
| Auditoria completa plataforma | TOP 18 |

---

## Estado Git inicial

| Item | Valor |
|------|-------|
| Branch | `main` |
| Último commit antes | `37015d2` — `chore(top): planos mensalidades e limites 2.11.89` |
| Arquivos modificados | Nenhum (tracked) |
| Untracked | `data/`, `mocker/modelochat/` |
| Risco de mistura | Baixo |

---

## Escopo autorizado

- RBAC, equipe, convites, limites por plano, cross-tenant, documentação.
- Correções mínimas de proteção em endpoints críticos já existentes.
- **Fora:** billing novo, status TOP 05, Inbox/WA/WebChat profundo.

---

## Diagnóstico RBAC atual

| Item | Existe? | Arquivo | Observação |
|------|---------|---------|------------|
| Capabilities granulares | Sim | `src/auth/rbac/capabilities.ts` | 50+ caps incl. `billing:*`, `inbox:*`, `company:members:*` |
| Presets sistema | Sim | `capabilities.ts`, `companyRolePresets.ts` | OWNER/ADMIN/MANAGER/ATTENDANT/INTEGRATION |
| Papéis custom | Sim | `Organization.customRoles[]`, `org-custom-role.ts` | Chave `custom:{id}`; default na criação da org |
| Middleware backend | Sim | `src/auth/rbac/middleware.ts` | `loadAuthContext`, `requireCapability` |
| Proteção frontend | Sim | `ProtectedRoute`, `navConfig.ts`, `can.ts` | `ROUTE_PERMISSIONS` por rota |
| Rota protegida | Sim | `App.tsx` + `ProtectedRoute` | Billing, equipe, inbox por cap |
| Rota pública | Sim | WebChat `/api/webchat/public`, leads embed | Token/chave própria |
| API key / integration | Sim | `INTEGRATION` role + `api:key:*` | Plano pro/enterprise adiciona caps via `applyPlanCapabilities` |
| Auditoria alteração cargo | Parcial → Sim | `AuditLog` + `OrganizationService` | TOP 04: `team:member:invite`, `role_change`, `remove` |
| Cross-tenant checks | Sim | Queries com `organizationId` em serviços | Teste unitário em `organization-team-cross-tenant.test.ts` |

---

## Diagnóstico equipe atual

| Fluxo | Existe? | Proteção atual | Lacuna |
|-------|---------|----------------|--------|
| Listar equipe | Sim | `GET /team/members` + `company:members:manage` | — |
| Convidar | Sim | Cap + limite plano (TOP 04) | UI não mostra contagem vs limite |
| Aceitar convite | Sim | Login + vínculo `userId` | — |
| Alterar cargo | Sim | Cap + owner-only ADMIN + limite plano | — |
| Remover membro | Sim | `COMPANY_MEMBERS_REMOVE` ou OWNER | — |
| Desativar usuário | Sim | `isActive=false` em remove | Sem “desativar” separado de remover |
| Reativar usuário | Sim | Reconvite inativo | — |
| Criar papel custom | Sim | `POST /team/custom-roles` | — |
| Alterar permissões preset | Sim | `PATCH /team/roles/:role` | — |
| Ver auditoria equipe | Parcial | `AuditLog` gravado; UI audit em `platform:audit:view` | Filtro dedicado equipe = TOP 18 |

**Proteções owner:** não remove/altera OWNER; só OWNER convida ADMIN.

---

## Diagnóstico multiempresa

| Área | Filtro `organizationId` | Risco |
|------|-------------------------|-------|
| Equipe `/team/*` | Sim (`auth.organizationId`) | Baixo — testado |
| Billing `/billing/*` | Sim (via auth context) | Baixo |
| Inbox | Sim (`InboxService`) | Médio — revisão pontual TOP 01 |
| Contatos/consent | Sim | Baixo |
| Leads | Sim + token público embed | Médio — embed usa `lfm_*` |
| Tickets | Sim | Baixo |
| WebChat config | Sim painel; público com widget token | Médio — by design |
| WhatsApp session | `requireSelfOrStaff` + org | Baixo |
| IA settings | Cap `inbox:ai:manage` + org | Baixo |
| API keys | Vinculadas à org | Baixo |
| Webhooks | Org-scoped | Baixo |

**Riscos restantes:** endpoints públicos WebChat/Leads dependem de token; revisão contínua em TOPs de hardening.

---

## Matriz oficial de cargos

| Cargo produto | Mapeamento código | Convite | Notas |
|---------------|-------------------|---------|-------|
| Dono / Owner | `OWNER` | Não | Tudo; único `BILLING_MANAGE` + remove org |
| Admin | `ADMIN` | Sim (só OWNER convida) | Quase tudo; sem `billing:manage`, sem WA sessão manage |
| Supervisor / Manager | `MANAGER` | Sim | Supervisão + inbox; sem billing/equipe |
| Atendente | `ATTENDANT` | Sim | Inbox própria; sem billing/equipe |
| Financeiro | `custom:role-finance` | Sim | Default em novas orgs |
| Marketing / Leads | `custom:role-marketing` | Sim | Default em novas orgs |
| Somente leitura | `custom:role-viewer` | Sim | Default em novas orgs |
| Integração | `INTEGRATION` | Sim | API mínima |

Org legadas mantêm presets antigos; podem criar papéis Financeiro/Marketing/Viewer manualmente em Equipe.

---

## Matriz oficial de permissões

Legenda: **TOTAL** · **GERENCIAR** · **EDITAR** · **VER** · **ATRIBUÍDO** · **NÃO** · **PENDENTE**

| Módulo | Owner | Admin | Supervisor | Atendente | Financeiro | Marketing | Viewer | Integration |
|--------|-------|-------|------------|-----------|------------|-----------|--------|-------------|
| Dashboard | TOTAL | VER | VER | VER | VER | VER | VER | VER |
| Inbox | TOTAL | GERENCIAR | GERENCIAR | ATRIBUÍDO | NÃO | VER | PENDENTE | NÃO |
| Supervisão | TOTAL | GERENCIAR | GERENCIAR | NÃO | NÃO | NÃO | PENDENTE | NÃO |
| Tickets | TOTAL | GERENCIAR | VER | EDITAR | NÃO | VER | PENDENTE | NÃO |
| Leads | TOTAL | GERENCIAR | VER | ATRIBUÍDO | NÃO | GERENCIAR | PENDENTE | NÃO |
| Contatos | TOTAL | GERENCIAR | VER | VER | NÃO | VER | VER | NÃO |
| Formulários | TOTAL | GERENCIAR | PENDENTE | NÃO | NÃO | GERENCIAR | PENDENTE | NÃO |
| WebChat | TOTAL | GERENCIAR | GERENCIAR | ATRIBUÍDO | NÃO | NÃO | NÃO | NÃO |
| WhatsApp sessão | TOTAL | VER | NÃO | NÃO | NÃO | NÃO | NÃO | NÃO |
| IA config | TOTAL | GERENCIAR | NÃO | NÃO | NÃO | NÃO | NÃO | NÃO |
| IA Créditos barra | TOTAL | VER | VER | NÃO | VER | NÃO | NÃO | NÃO |
| Billing | TOTAL | VER | NÃO | NÃO | VER | NÃO | NÃO | NÃO |
| Equipe | TOTAL | GERENCIAR | NÃO | NÃO | NÃO | NÃO | NÃO | NÃO |
| Permissões | TOTAL | GERENCIAR | NÃO | NÃO | NÃO | NÃO | NÃO | NÃO |
| Relatórios | TOTAL | VER | VER | PENDENTE | VER | VER | VER | NÃO |
| Auditoria | TOTAL | VER | NÃO | NÃO | NÃO | NÃO | NÃO | NÃO |
| Webhooks/API | TOTAL | PENDENTE | NÃO | NÃO | NÃO | NÃO | NÃO | GERENCIAR |
| Config empresa | TOTAL | GERENCIAR | NÃO | NÃO | NÃO | NÃO | NÃO | NÃO |
| Exportação | TOTAL | PENDENTE | PENDENTE | NÃO | NÃO | PENDENTE | NÃO | NÃO |

**PENDENTE** = sem capability dedicada hoje; usar custom role ou TOP futuro.

---

## Limites de equipe por plano

Fonte: `config/plans.json` (TOP 03).

| Plano | includedAgents | includedUsers | includedSupervisors |
|-------|---------------:|--------------:|--------------------:|
| trial | 1 | 1 | 0 |
| free | 1 | 1 | 0 |
| starter | 2 | 3 | 1 |
| pro | 5 | 8 | 2 |
| enterprise | 20 | 30 | 10 |

### Regras de enforcement (TOP 04)

- Contagem: membros **ativos** exceto OWNER + convites pendentes (`isActive`).
- **Atendente:** `ATTENDANT` ou custom com `inbox:reply` / `webchat:reply` (sem supervisão).
- **Supervisor:** `MANAGER` ou custom com `inbox:supervise`.
- Bloqueio só em **novo convite** ou **troca de cargo** que exceda limite.
- Membros legados acima do limite **não são removidos**; novos convites bloqueados.
- Mensagens: ver `TEAM_LIMIT_MESSAGES` em `team-plan-limits.ts`.

---

## Endpoints revisados

| Endpoint/área | Proteção atual | Ajuste aplicado | Risco restante |
|---------------|----------------|-----------------|----------------|
| `GET/POST/PATCH/DELETE /team/*` | `company:members:manage` | Limite plano em POST/PATCH membro | Baixo |
| `GET /billing/*` | `billing:view` | Nenhum | Baixo |
| `POST /billing/checkout` | `billing:manage` | Nenhum | Baixo |
| `GET /inbox/*` | `inbox:view` + org | Nenhum (escopo) | Médio QA |
| `GET /sessions` | `whatsapp:session:view` | Nenhum | Baixo |
| `POST /sessions/connect` | `whatsapp:session:manage` | Nenhum | Baixo |
| API keys | `api:key:*` | Nenhum | Baixo |
| WebChat público | Token widget | Fora escopo alteração | Médio |
| Leads embed | `lfm_*` token | Fora escopo alteração | Médio |

---

## Frontend e rotas revisadas

| Rota | Permissão `ROUTE_PERMISSIONS` | Alinhado? |
|------|------------------------------|-----------|
| `/plans` | `billing:view` | Sim — atendente não vê |
| `/settings/team` | `company:members:manage` | Sim |
| `/settings/permissions` | `company:members:manage` | Sim |
| `/platform/leads` | `consent:view` | Parcial — Marketing usa custom role |
| Inbox | `inbox:view` | Sim |

**Sem alteração de UI** nesta etapa; backend é barreira real.

---

## Segurança cross-tenant

- `OrganizationService.updateMember` / `removeMember` filtram `{ organizationId, _id }`.
- Testes: `organization-team-cross-tenant.test.ts` (3 cenários).
- `auth.organizationId` vem de sessão via `buildAuthContext` — frontend não troca tenant sem seleção de org.

---

## Correções ou ajustes aplicados

1. **`src/services/team/team-plan-limits.ts`** — resolve limites, conta assentos, valida convite/cargo.
2. **`OrganizationService`** — enforcement + `AuditLog` em convite, troca de cargo, remoção.
3. **`defaultOrgCustomRoles()`** — Financeiro, Marketing, Viewer (novas orgs).
4. **Testes** — `capabilities-rbac.test.ts`, `team-plan-limits.test.ts`, `organization-team-cross-tenant.test.ts`.

---

## Testes criados ou atualizados

| Arquivo | Cenários |
|---------|----------|
| `src/auth/rbac/__tests__/capabilities-rbac.test.ts` | OWNER/ADMIN/MANAGER/ATTENDANT/INTEGRATION + custom Finance/Marketing/Viewer |
| `src/services/team/__tests__/team-plan-limits.test.ts` | Limites catálogo, contagem, bloqueio users/agents/supervisors |
| `src/services/organization/__tests__/organization-team-cross-tenant.test.ts` | Isolamento org em update/remove |

**Total suite:** 594 testes passando.

---

## Gates executados

| Gate | Resultado |
|------|-----------|
| `npm run typecheck` | Verde |
| `npm run build` | Verde |
| `npm test` | Verde (594) |
| Frontend build | Não executado (sem alteração frontend) |
| `npm run qa:atendimento:gate` | Não executado (sem alteração Inbox/WA/WebChat) |

---

## Arquivos alterados

- `src/services/team/team-plan-limits.ts` (novo)
- `src/services/team/__tests__/team-plan-limits.test.ts` (novo)
- `src/auth/rbac/__tests__/capabilities-rbac.test.ts` (novo)
- `src/services/organization/__tests__/organization-team-cross-tenant.test.ts` (novo)
- `src/services/organization/OrganizationService.ts`
- `src/types/org-custom-role.ts`
- `docs/top/RADARZAP-TOP-04-RBAC-PERMISSOES-EQUIPE-SEGURANCA.md` (novo)
- `docs/EQUIPE-RBAC.md`
- `docs/CHANGELOG.md`
- `docs/SISTEMA-REGISTRO.md`
- `docs/INDICE-DOCUMENTACAO.md`
- `.cursor/rules/radarzap-v2-system-registry.mdc`
- `package.json`
- `README.md`

---

## Riscos reduzidos

- Convite acima do limite do plano bloqueado com mensagem clara.
- Troca de cargo para atendente/supervisor validada contra catálogo.
- Presets RBAC cobertos por testes automatizados.
- Ações de equipe registradas em `AuditLog`.
- Cross-tenant em fluxos de equipe testado.

---

## Riscos restantes

- Org legada acima do limite continua operando (by design).
- Leads no menu usa `consent:view` — não há cap `leads:*`.
- APIs públicas WebChat/Leads fora de revisão profunda.
- UI não exibe “X/Y assentos usados”.
- Orgs antigas não recebem papéis Financeiro/Marketing/Viewer automaticamente.
- Enforcement billing/widgets = TOP 16/17.

---

## Decisões pendentes para Benhur

1. Adicionar capability `leads:view` / `leads:manage` separada de `consent:view`?
2. Backfill papéis Financeiro/Marketing/Viewer em orgs existentes?
3. OWNER conta no `includedUsers` ou sempre extra? (hoje: **não conta**)
4. Exibir contagem de assentos na UI Equipe?
5. Promover FINANCE/MARKETING/VIEWER a `CompanyRole` enum no futuro?

---

## Próximo passo recomendado

**TOP 05 — Status operacional de atendente** (presença avançada, online sem receber atendimento, políticas de fila por disponibilidade real), usando RBAC e limites de equipe desta etapa como base.
