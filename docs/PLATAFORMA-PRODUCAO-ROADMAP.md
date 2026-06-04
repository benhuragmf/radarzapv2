# RadarZap v2 — Roadmap da área Plataforma (MVP → Produção)

**Última atualização:** junho/2026  
**Estado geral estimado:** ~**52%** pronto para produção na área Plataforma (CSV import/export, visão geral com stats tenant, relatórios tenant, CRUD templates plataforma; campanhas em massa, RBAC granular e admin Gestão ainda incompletos).

Este documento consolida a visão do produto, fases, critérios de aceite, dependências e referências de código. Não substitui os docs técnicos existentes (`RADARZAP-01` … `04`, `RADARZAP-V2-MIGRACAO.md`).

---

## 1. Visão e princípios

A **Plataforma** é o produto para empresas e pessoas que usam WhatsApp (e opcionalmente API) **sem depender do Discord**. A aba **Discord** continua dedicada à automação **Discord → WhatsApp** (canais, regras, formato `dw-*`).

| Domínio | Escopo | Prefixo de rotas (alvo) |
|---------|--------|-------------------------|
| Plataforma | Tenant (organização), envios manuais/agendados, campanhas, contatos, relatórios do cliente | `/platform/*`, `/dashboard`, `/send/*`, `/destinations` |
| Discord | Por servidor (`guildId`), captura e pipeline | `/discord/*` |
| Admin / servidor | Equipe RadarZap, fila/logs globais, clientes | `/admin/*` |

**Separação obrigatória em relatórios:** dados filtrados por `organizationId` (ou `clientId`) vs dados de infraestrutura sem filtro de tenant (apenas papéis com `logs:global`, `queue:global`, etc.).

---

## 2. Fases (MVP → produção)

### Fase 0 — Fundação (parcial, ~60%)

| Item | Aceite | Arquivos / rotas | Depende de | % |
|------|--------|------------------|------------|---|
| Auth Discord + sessão Redis | Login, `/auth/me`, cookie | `src/auth/`, `DashboardService` | Redis, `.env` | 90% |
| RBAC por capability | `can()` no front e middleware no back | `src/auth/rbac/*`, `frontend/src/lib/auth.ts` | — | 70% |
| Multi-tenant base (`Organization`, `CompanyMember`) | Usuário vinculado a org; papéis OWNER/ADMIN/ATTENDANT | `src/models/CompanyMember.ts`, `TeamMembers.tsx` | Convite por e-mail completo | 50% |
| Menu Plataforma vs Discord | Toggle, `navConfig.ts` | `Sidebar.tsx`, `navConfig.ts` | — | 85% |
| Reordenar admin: Gestão por último | Gestão é o último grupo no menu admin/moderador | `ADMIN_PLATFORM_NAV`, `MODERATOR_PLATFORM_NAV` | — | **100%** (jun/2026) |
| Scaffolds `/platform/*` | Rotas renderizam placeholder com título | `pages/platform/*`, `App.tsx` | — | **100%** scaffold |

### Fase 1 — MVP Plataforma (~55%)

| Item | Aceite | Arquivos / rotas | Depende de | % |
|------|--------|------------------|------------|---|
| Dashboard unificado | Cards WhatsApp + bloco Discord se `hasDiscordAccess` | `Dashboard.tsx`, API `/stats` com breakdown | API agregar por fonte | 40% |
| Visão Plataforma (`/platform`) | Cards tenant: contatos, mensagens hoje, WA, fila, Discord opcional | `GET /api/platform/stats`, `PlatformOverview.tsx` | — | **85%** |
| Relatórios tenant (leitura) | Abas Logs / Fila tenant; aba Sistema → links admin | `/platform/reports`, `Logs`/`Queue` `scope=tenant`, `tenant=1` na API | Fila por tenant na API BullMQ | **70%** |
| Contatos CSV | Import + export 3 perfis | `PlatformContacts.tsx`, import/export CSV | multipart, vCard | **90%** |
| Equipe: convite + remoção | Dono convida ADMIN/ATTENDANT | `TeamMembers.tsx`, `/api/team/members` | E-mail transacional | **75%** |

### Fase 2 — Templates e campanhas Plataforma (~55%)

| Item | Aceite | Arquivos / rotas | Depende de | % |
|------|--------|------------------|------------|---|
| CRUD templates plataforma | Catálogo `pw-*` espelhando `dw-*`; variáveis `{nome}`, `{empresa}`, …; PATCH/reset; preview | `platform-whatsapp-templates.ts`, `/platform/templates`, `seed:platform-templates` | Agendamento / dispatch | **95%** |
| Agendamento por template | Escolher template pw-* em Enviar agora + agendar | `SendNow.tsx`, `CampaignDispatchService` | Fase 2 templates | **85%** |
| Aniversários automáticos | Regras recorrentes + cron | `/send/aniversarios`, `BirthdayAutomationService` | CSV birthday | **80%** |
| Campanhas em massa (futuro) | Lista + status por destinatário | `/platform/campaigns` (futuro) | Fila + limites plano | 0% |

### Fase 3 — Contatos CSV e grupos (~85%)

| Item | Aceite | Ver § 6 | Depende de | Estado |
|------|--------|---------|------------|--------|
| Import CSV | Cria/atualiza destinos; salva `birthday` se coluna presente | `POST /api/destinations/import-csv`, `contact-csv-import.ts`, UI `PlatformContacts` | multipart upload | **Feito** — limite 5k linhas no parser |
| Export CSV | Download 3 perfis, UTF-8 BOM | `GET /api/destinations/export-csv`, `contact-csv-export.ts` | vCard | **Feito** |
| Grupos/tags no import | Coluna `groups` → `tags[]` | `Destination.tags[]` no import | grupos WA nativos | **Parcial** — tags sim, grupos WA não |

### Fase 4 — RBAC granular por funcionário (~0%)

| Item | Aceite | Arquivos | Depende de |
|------|--------|----------|------------|
| Limites por membro | Dono define caps além do papel fixo (ex.: só fila, sem billing) | `CompanyMember.customCapabilities[]`, UI em equipe | Schema + `AuthContextService` |
| Herança | ATTENDANT não ganha `billing:manage` unless explicit | `capabilities.ts` | Migração membros |

### Fase 5 — Produção 100%

Ver **§ 9 Checklist de release**.

---

## 3. Hierarquia de menus (rank oficial)

Ordem = de cima para baixo na sidebar (rank 1 = topo). **Gestão sempre por último** para `SYSTEM_ADMIN` e `SYSTEM_MODERATOR`.

### 3.1 Cliente / usuário (aba Plataforma)

| Rank | Item | Rota |
|------|------|------|
| 1 | Dashboard | `/dashboard` |
| 2 | **Seção Plataforma** | — |
| 3 | Visão geral | `/platform` |
| 4 | Modelos de mensagem | `/platform/templates` |
| 5 | Relatórios | `/platform/reports` |
| 6 | Contatos (CSV) | `/platform/contacts` |
| 7 | Conexão WhatsApp | `/sessions` |
| 8 | Enviar mensagens (grupo) | `/send`, `/send/agendamentos`, `/send/historico` |
| 9 | Destinos WhatsApp (grupo) | `/destinations`, `/grupos` |
| 10 | Integrações (grupo) | `/settings#api-*`, `/send#playground` |
| 11 | **Conta** (grupo, rodapé lógico) | `/plans`, `/settings`, `/settings/team` |

Fonte: `PLATFORM_AREA_NAV` + `PLATFORM_TOOLS_NAV` + `grp-account` em `navConfig.ts`.

### 3.2 Admin interno (aba Plataforma)

| Rank | Item | Rota |
|------|------|------|
| 1 | Dashboard global | `/admin/dashboard` |
| 2 | Minha plataforma (seção) | — |
| 3–6 | Mesma área Plataforma do cliente | `/platform/*` + ferramentas WA |
| 7 | **Operação** (grupo) | `/admin/sessions`, `/admin/queue`, `/admin/logs`, `/admin/api` |
| 8 | **Sistema** (grupo) | `/admin/settings` |
| 9 | **Gestão** (grupo, **último**) | `/admin/clients`, `/admin/servers`, … |

### 3.3 Discord (aba Discord)

Inalterado em prioridade relativa: Automação → Monitoramento → Servidor. Ver `DISCORD_NAV`.

---

## 4. Dashboard global

### 4.1 Cliente (`/dashboard`)

**Aceite:**

- Métricas WhatsApp: mensagens, sessões, fila, falhas (já em `Dashboard.tsx` + `/stats`).
- Se `user.hasDiscordAccess === true`: segunda fileira ou abas com métricas Discord (mensagens capturadas, regras ativas, fila discord-scoped).
- Dados sempre limitados ao tenant do usuário.

**Dependências:** endpoint `/stats?scope=platform|discord|all`; socket `stats` com mesmo contrato.

**Arquivos:** `frontend/src/pages/Dashboard.tsx`, `DashboardService.ts` (backend).

**% atual:** ~40% (só WhatsApp agregado).

### 4.2 Admin (`/admin/dashboard`)

**Aceite:** visão cross-tenant; links rápidos para Operação e Gestão.

**% atual:** ~25% (várias subpáginas ainda placeholder `AdminDashboard`).

---

## 5. Dois sistemas de templates

| Aspecto | Plataforma | Discord → WhatsApp |
|---------|------------|-------------------|
| Uso | Envio manual, API, campanhas, aniversário | Formatar post capturado do Discord |
| Rota UI | `/platform/templates` | `/discord/templates` |
| Catálogo | `src/constants/platform-whatsapp-templates.ts` (`pw-*`) + Mongo `platformTemplates` | `src/constants/discord-whatsapp-templates.ts` (`dw-*`) + Mongo `templates` |
| Variáveis | `{nome}`, `{empresa}`, `{aniversario}`, `{mensagem}`, `{link_bloco}`, … — `PLATFORM_WA_VARIABLE_DOCS` | `{titulo}`, `{corpo}`, `{discord_poster}`, … — `DISCORD_WA_VARIABLE_DOCS` |
| API | `GET/PATCH/reset /api/platform/templates`, `variables`, `preview`; seed `npm run seed:platform-templates` | `GET/PATCH/reset /api/templates`, `variables` |
| Render em código | `renderPlatformCatalogTemplate()` | `renderCatalogTemplate()` |

**Aceite Fase 2:** editar template plataforma não altera templates Discord; testes unitários separados (`platform-wa-catalog.test.ts`).

**TODO dispatch:** agendamentos e `/send` ainda não resolvem `pw-*` no envio — ver § 12 blocker “Agendamento usa templates plataforma”.

---

## 6. Contatos — especificação CSV

**Especificação completa (Android / iOS / Google / Apple / perfis de export):** [CONTATOS-CSV-IMPORTACAO.md](./CONTATOS-CSV-IMPORTACAO.md).

Resumo abaixo; detalhes de mapeamento, normalização BR, dedupe e exemplos estão no doc dedicado.

### 6.1 Colunas

| Coluna | Obrigatório | Descrição |
|--------|-------------|-----------|
| `name` | Sim | Nome exibido |
| `phone` | Sim | E.164 ou BR com DDI; normalizar no import |
| `birthday` | Não | `YYYY-MM-DD` ou `DD/MM/YYYY` |
| `groups` | Não | Lista separada por `;` — mapear para tags/grupos internos |
| `email` | Não | Contato opcional |

Aliases aceitos no import (mapear no parser): `nome`, `telefone`, `aniversario`, `grupos`, `tags`.

### 6.2 Comportamento import

1. Validar cabeçalho (mínimo `name` + `phone`).
2. Por linha: upsert por `phone` + `organizationId`.
3. Se telefone novo → criar destino com consent flow padrão do produto.
4. Se `birthday` presente → persistir no documento (campo a adicionar no modelo se ausente).
5. `groups` → split `;`, trim, associar a `tags[]` ou entidade Group (definir em Fase 3).
6. Relatório pós-import: criados / atualizados / ignorados / erros (linha + motivo).

### 6.3 Export

- Perfis: `radarzap-native`, `google-compatible`, `apple-compatible` (ver [CONTATOS-CSV-IMPORTACAO.md](./CONTATOS-CSV-IMPORTACAO.md) §10).
- Formato UTF-8 com BOM para Excel.
- Endpoint existente: `exportDestinationData(clientId, 'csv')` — alinhar colunas à spec.

### 6.4 UI

- **Curto prazo:** `/platform/contacts` → link para `/destinations` (implementado jun/2026).
- **Alvo:** página única com import/export na área Plataforma.

**Arquivos:** `DestinationController.ts`, `DestinationManager.ts`, `destinationRoutes.ts`, `Destinations.tsx`.

---

## 7. Relatórios — duas visões

### 7.1 Visão cliente (tenant)

| Recurso | Rota UI | Capability | Filtro API |
|---------|---------|------------|------------|
| Logs envio/API tenant | `/platform/reports` (aba Logs) | `logs:view` | `organizationId` |
| Fila tenant | mesma página (aba Fila) | `queue:view` | `clientId` / org |
| Status sessões | mesma página (aba Status) | `whatsapp:session:view` | sessões da org |

Também disponível no contexto Discord (escopo guild) em `/discord/logs` e `/discord/fila` — **não substitui** relatório plataforma.

### 7.2 Visão servidor (admin)

| Recurso | Rota | Capability |
|---------|------|------------|
| Logs globais | `/admin/logs` | `logs:global` ou `logs:limited` |
| Fila global | `/admin/queue` | `queue:global` |
| Auditoria | `/admin/audit` | `system:audit:view` / `limited` |

**Aceite:** usuário com só `logs:view` recebe 403 em `/admin/logs`; moderador com `logs:limited` vê subset sem PII sensível (definir política).

**Arquivos:** `Logs.tsx` (`scope` prop), `Queue.tsx`, `MonitoringController.ts`, `LogManager.ts`.

**% atual:** ~35% (componentes existem; falta página unificada `/platform/reports` e enforcement consistente no backend).

---

## 8. RBAC e equipe (multi-tenant)

### 8.1 Papéis fixos hoje (`CompanyRole`)

| Papel | Capabilities principais | Quem define |
|-------|-------------------------|-------------|
| OWNER | Billing, equipe, templates, destinos, fila, logs, API (plano) | Criador da org |
| ADMIN | Operação sem billing manage / sem `company:members:manage` | OWNER |
| ATTENDANT | Envio, fila view, logs view limitados | OWNER |

Fonte: `src/auth/rbac/capabilities.ts` → `capabilitiesForCompanyRole`.

### 8.2 Modelo alvo (Fase 4)

- `CompanyMember.customCapabilities: Capability[]` — override allow/deny.
- UI: matriz de checkboxes agrupadas (WhatsApp, Envios, Relatórios, Billing, Equipe).
- **Aceite:** funcionário não acessa rota nem API sem capability efetiva; OWNER não pode remover próprio OWNER sem transferência.

### 8.3 Discord guild roles

Separado do tenant: `GuildRole` + caps `discord:*` — não misturar com limite de funcionário da empresa.

### 8.4 Staff interno

`SYSTEM_ADMIN` / `SYSTEM_MODERATOR` — menu Gestão no fim; moderador sem pagamentos/planos completos.

**Arquivos:** `CompanyMember.ts`, `AuthContextService.ts`, `TeamMembers.tsx`, `ProtectedRoute.tsx`.

**Blocker:** não há campo `customCapabilities` no schema ainda.

---

## 9. Menus e submenus incompletos

| Rota admin | Estado | Próximo passo |
|------------|--------|----------------|
| `/admin/servers` | Placeholder | Listar guilds vinculadas |
| `/admin/payments` | Placeholder | Integração billing |
| `/admin/moderation` | Placeholder | Fila moderação |
| `/admin/audit` | Placeholder | Audit log paginado |
| `/admin/api` | Placeholder | Métricas API global |
| `/admin/settings` | Placeholder | Feature flags |

| Rota plataforma | Estado |
|-----------------|--------|
| `/platform/templates` | CRUD + editor básico |
| `/platform/reports` | Abas Meu negócio + Sistema (staff) |
| `/platform/contacts` | Import + export 3 perfis |
| `/platform` | Cards stats tenant |

---

## 10. Checklist de release (100% produção)

### Produto

- [ ] Todos os itens Fase 1–4 com aceite verificado em staging
- [ ] CSV import/export com teste de planilha 1k linhas
- [ ] Templates plataforma documentados para suporte
- [ ] Dashboard com Discord opcional validado em conta híbrida

### Segurança e dados

- [ ] Toda API de logs/fila/stats filtra `organizationId` no modo tenant
- [ ] Testes de autorização: ATTENDANT não vê billing; cliente não vê `/admin/*`
- [ ] Rate limit import CSV
- [ ] Auditoria de convites e remoções de membros

### Operação

- [ ] Runbook deploy painel (`RADARZAP-04`)
- [ ] Sentry + alertas fila travada
- [ ] Backup Mongo + retenção logs

### Qualidade

- [ ] E2E: login → import CSV → agendar envio → ver log
- [ ] Testes unitários templates plataforma (separados de `discord-wa-*`)
- [ ] Lighthouse / a11y mínimo no painel

### Legal / compliance

- [ ] Fluxo consent refletido no export CSV
- [ ] Política de retenção contatos

---

## 11. Mapa de arquivos (referência rápida)

```
src/services/web-dashboard/frontend/src/
  lib/navConfig.ts          ← hierarquia menus (fonte da verdade UI)
  App.tsx                   ← rotas React Router
  pages/Dashboard.tsx
  pages/platform/*          ← área Plataforma (scaffold)
  pages/Templates.tsx       ← Discord formato WA
  pages/Logs.tsx, Queue.tsx ← scope discord | global
  pages/TeamMembers.tsx
  pages/admin/*

src/auth/rbac/
  capabilities.ts, roles.ts, can.ts, AuthContextService.ts

src/constants/discord-whatsapp-templates.ts  ← só Discord

src/services/destinations/                   ← bulk import / export CSV
src/models/CompanyMember.ts
```

---

## 12. Blockers conhecidos

| Blocker | Impacto | Mitigação |
|---------|---------|-----------|
| Campo `birthday` em `Destination` | CSV aniversário | **Resolvido jun/2026** |
| `customCapabilities` ausente | RBAC granular | Estender `CompanyMember` |
| `/stats` sem breakdown Discord no `/dashboard` | Dashboard híbrido | `/platform/stats` cobre tenant parcialmente |
| Páginas admin placeholder | Gestão incompleta | Priorizar clientes + fila global |
| Fila tenant na API BullMQ | `/platform/reports` fila | Expor jobs por `clientId` |
| Fuso horário fixo no servidor para `sendTime` | Aniversários | Documentar TZ; UI futura por org |
| Campanhas em massa dedicadas | `/platform/campaigns` | UI lista + status por destinatário |
| E-mail transacional convites | Equipe | Provider SMTP |

---

## 13. Próximas 3 tarefas (prioridade)

1. **Fila tenant na API** — jobs BullMQ filtrados por `clientId` na aba Fila de `/platform/reports`.
2. **Dashboard híbrido `/dashboard`** — breakdown Discord no `/stats` global; E2E import → agendar → log.
3. **TZ por organização** — `sendTime` de aniversários no fuso do cliente.

---

## 14. Integração envio + agendamento + aniversários (jun/2026)

### Envio manual e agendado (`/send`)

- Modo **Texto livre** ou **Modelo Plataforma (pw-*)** em `SendNow.tsx`.
- Preview via `POST /api/platform/templates/preview` com `destinationId` opcional (1º destino selecionado).
- Campanhas: `messageMode: platform_template`, render **por destino** em `CampaignDispatchService` (`platform-send`).
- Variáveis: `buildPlatformWhatsAppVariables()` — `{nome}`, `{empresa}`, `{aniversario}`, `{data}`, `{hora}`, `{rodape}`, `{autor}`, …

### Agendamentos one-shot (`/send/agendamentos`)

- Mesmo fluxo: agendar em Enviar agora com data futura + modelo pw-*.
- Fila `MessageQueue` processada a cada **15 s** (`QueueProcessorService`).

### Aniversários automáticos (`/send/aniversarios`)

| Campo / API | Descrição |
|-------------|-----------|
| `BirthdayAutomationRule` | `organizationId`, `templateName`, `triggerType`, `sendTime`, `active`, tags |
| `triggerType` | `on_contact_birthday` (MM-DD = hoje), `day_of_month` (dia N do mês), `interval_months` (no aniversário + ≥N meses desde `birthdayLastSentAt`) |
| Dedup | Máx. 1 envio automático por contato por **ano civil** (`birthdayLastSentAt`) |
| Cron | `BirthdayAutomationService` — tick a cada **15 min** + na subida do queue-processor; regra roda 1x/dia após `sendTime` |
| API | `GET/POST/PATCH/DELETE /api/platform/birthday-automation`, `POST …/run-now` |

**Configurar na UI:** Enviar mensagens → Aniversários automáticos → Nova regra (ex.: `pw-aniversario`, 09:00, “No dia do aniversário do contato”). Importar `birthday` em Plataforma → Contatos (CSV).

**Requisitos:** `queue-processor` ou modo all-services ativo; WhatsApp conectado no horário; consentimento LGPD do contato.

---

## Histórico de entregas nesta sessão

- Export CSV: `contact-csv-export.ts`, `GET /api/destinations/export-csv`, botões em `PlatformContacts`.
- `GET /api/platform/stats` + cards em `PlatformOverview`.
- `/platform/reports`: abas Meu negócio (`Logs`/`Queue` tenant) e Sistema (links admin).
- Catálogo `pw-*` alinhado ao padrão `dw-*`: `platform-whatsapp-templates.ts`, seed, API merge/reset/preview, UI espelhando `Templates.tsx`.
- Modelo `PlatformTemplate` + `/api/platform/templates` + UI `PlatformTemplates`.
- Logs API: filtro `tenant=1` / auto-scope sem `logs:global`.
- Testes `contact-csv-export.test.ts`.
- Roadmap atualizado (~52% área Plataforma).
