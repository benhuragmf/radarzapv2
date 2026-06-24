# Registro de páginas do menu — RadarZap v2

Mapa rota → componente → API. Atualizar ao criar novos itens de menu.

**Entregas atendimento 2.11.24–28 (presença, supervisor, fallback, sino):** [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./concluidos/ENTREGA-ATENDIMENTO-2.11.24-28.md).

**Nomes visuais do menu (labels):** ver [`concluidos/menu-renaming-audit.md`](./concluidos/menu-renaming-audit.md) — rotas abaixo permanecem estáveis; labels exibidos vêm de `navConfig.ts` (`PAGE_TITLES`).

## Plataforma (tenant)

| Rota | Componente | API principal |
|------|------------|---------------|
| `/platform` | `PlatformOverview.tsx` | `GET /platform/stats` |
| `/platform/reports` | `PlatformReports.tsx` | `GET /logs?tenant=1`, `GET /queue` |
| `/platform/audit` | `menu/PlatformAudit.tsx` | `GET /integrations/audit-summary` |
| `/platform/campanhas` | `menu/PlatformCampaigns.tsx` | `GET /campaigns` |
| `/platform/segmentos` | `menu/ContactSegments.tsx` | `GET /contact-groups` |
| `/platform/gatilhos` | `menu/PlatformTriggers.tsx` | (link → `/platform/automacoes`) |
| `/platform/wa-status` | `menu/WaStatus.tsx` | `GET /platform/account-stats`, `GET /logs?tenant=1&service=WhatsAppService` |
| `/platform/wa-logs` | `menu/WaLogs.tsx` | `GET /logs?tenant=1&service=WhatsAppService` |
| `/platform/wa-limits` | `menu/WhatsAppSendLimitsPage.tsx` | `GET/PATCH /platform/whatsapp-send-limits` — buckets conversa/marketing/alerta (2.11.17) |
| `/platform/automacoes` | `PlatformAutomations.tsx` | `GET/POST /platform/automations` |
| `/platform/inbox` | `menu/Inbox.tsx` | `GET/POST /inbox/*`, `GET /inbox/whatsapp-status` (2.11.84, `inbox:view`), `?conv=` deep link |
| `/platform/inbox/tickets` | `menu/InboxTickets.tsx` | `GET /inbox/tickets?page&limit`, `GET /inbox/tickets/stats` — paginação server-side (2.10.18) |
| `/platform/inbox/tickets/:ref` | `menu/InboxTicketDetail.tsx` | `GET /inbox/tickets/:ref`, `POST …/client-update`, `…/close`, `…/comments`, `PATCH …/status` — regras: `TICKET-ATENDIMENTO.md` |
| `/platform/inbox/setores` | `menu/InboxSectors.tsx` | `GET/POST/PATCH /inbox/departments`, `GET /inbox/members` |
| `/platform/inbox/bot` | `menu/InboxBotSettings.tsx` | `GET/PATCH /inbox/settings` — CSAT, SLA ticket, fallback WhatsApp, presença; API presença: `GET/PATCH /inbox/presence/*` |
| `/platform/inbox/ia` | `menu/AiAtendimento.tsx` | `GET/PATCH/POST /platform/ai/settings`, KB com keywords/links/sugestão rápida (2.10.71), `DELETE /platform/ai/key`, `POST /platform/ai/test`, `GET /platform/ai/usage`, `GET /platform/ai/balance` (2.11.84, perm `inbox:ai:balance:view`) |
| `/platform/inbox/respostas` | `menu/InboxQuickReplies.tsx` | `GET/PATCH /inbox/quick-replies` |
| `/platform/inbox/supervisor` | `menu/InboxSupervisor.tsx` | `GET /inbox/supervisor/dashboard`, `GET /inbox/supervisor/queue`, `POST /inbox/conversations/:id/reassign`, presença equipe |
| `/platform/inbox/relatorios` | `menu/InboxReports.tsx` | `GET /inbox/reports?from=&to=` |
| `/platform/webchat` | `menu/WebChat.tsx` | Widgets + histórico · API pública: `POST …/tickets/lookup`, `POST …/tickets/resume` (2.10.70), demais rotas em `WEBCHAT.md` |
| `/platform/leads` | `menu/Leads.tsx` | Capturas + aba **Integrar no site** (embed, API, WordPress, Elementor) · API: `/api/leads/*` · pública `POST …/public/forms/:key/submit` · ver `LEADS-FORMULARIO.md` |

## Integrações API

| Rota / hash | Componente | API |
|-------------|------------|-----|
| `/settings#api-chaves` | `integrations/ApiKeysPanel.tsx` | `GET/POST/DELETE /integrations/api-keys` |
| `/settings#api-webhooks` | `integrations/WebhooksPanel.tsx` | `GET/POST/PATCH/DELETE /integrations/webhooks` — entrega via `WebhookDispatcherService` (fila `notifications`, HMAC) |
| `/settings#api-docs` | `integrations/ApiDocsPanel.tsx` | `GET /integrations/openapi` |
| `/settings#api-rate` | `integrations/RateLimitPanel.tsx` | `GET /integrations/rate-limit` |
| `/send#playground` | `integrations/ApiPlayground.tsx` | `POST /integrations/playground` |

## Empresa

| Rota | Componente | API principal |
|------|------------|---------------|
| `/dashboard` | `Dashboard.tsx` | `GET /stats`, `GET /platform/stats` |
| `/dashboard/notificacoes` | `DashboardNotifications.tsx` | `GET /panel/notifications`, `POST /panel/notifications/read-all` |
| `/settings#perfil` | `settings/MyProfilePanel.tsx` | `sessionApi` → `/auth/me/member-profile`, `/auth/me/email/*`, `/auth/me/whatsapp/*` (não usar prefixo `/api`) |
| `/settings/team` | `TeamMembers.tsx` — aba **Papéis do sistema** (`RolesSystemPanel`) + aba **Equipe** | `GET /team/roles`, `PATCH/DELETE /team/roles/:role`, `POST/PATCH/DELETE /team/custom-roles[/:id]`, `GET/POST/PATCH/DELETE /team/members` (`roleKey`), `PATCH /team/members/:id/profile`, `POST/DELETE /team/members/:id/whatsapp/*`, `GET/PATCH /organization/team-settings` (toggle perfil — dono) |
| `/contact?consent=waiting` | `Destinations.tsx` (view `waiting`) | `GET /consent/renewals`, `POST /consent/renewals/:id/approve` — perm `consent:approve-renewal` |
| `/settings/permissions` | `menu/PermissionsPage.tsx` |
| `/settings/security` | `menu/SecuritySettings.tsx` |
| `/settings/backup` | `menu/BackupExport.tsx` | `GET /tenant-backup/export`, `POST /tenant-backup/import` |

## Admin

| Rota | Componente | API |
|------|------------|-----|
| `/admin/queue` | `Queue.tsx` | `GET /queue` |
| `/admin/logs` | `Logs.tsx` | `GET /logs` |
| `/admin/monitoring` | `menu/AdminMonitoring.tsx` | `GET /admin/monitoring` |
| `/admin/errors` | `menu/AdminErrors.tsx` | `GET /admin/errors` |
| `/admin/clients` | `admin/AdminClients.tsx` | `GET /users` |
| `/admin/servers` | `menu/AdminServers.tsx` | `GET /admin/servers-summary` |
| `/admin/audit` | `menu/AdminAuditPage.tsx` | `GET /admin/audit-logs` |
| `/admin/moderation` | `menu/AdminModeration.tsx` | `GET /admin/organizations`, `PATCH /admin/organizations/:id/plan` |
| `/admin/api` | `menu/AdminApiPage.tsx` | `GET /admin/integrations-overview` |
| `/admin/payments` | `menu/AdminPaymentsPage.tsx` | `GET /billing/admin/orders` |
| `/admin/settings` | `menu/AdminSettingsPage.tsx` | `GET /services/health` |

## API auxiliar (sem rota dedicada no menu)

| Método | Rota | Cap | Uso |
|--------|------|-----|-----|
| GET | `/platform/health/atendimento` | `inbox:view` | Saúde WA, filas, CSAT pendente — 2.11.17 |

---

## Redirects legados `/em-breve/:slug`

Ver `pages/menu/EmBreveRedirect.tsx` → `SLUG_REDIRECTS`.

## Modelos backend

- `src/models/Organization.ts` — `roleCapabilities`, `customRoles[]`
- `src/models/CompanyMember.ts` — `customRoleId`, `extraCapabilities`, `deniedCapabilities`
- `src/models/Destination.ts` — `consentRenewalApprovals` (0–2)
- `src/types/org-custom-role.ts` — helpers `custom:uuid`, `defaultOrgCustomRoles()`
- `src/models/InboxSettings.ts` — `whatsappFallbackAcceptTimeoutSeconds`, `agentPresenceTimeoutSeconds`, `presenceIdleTimeoutSeconds` (2.11.25–2.11.28)
- `src/models/InboxDepartment.ts` — `clientVisible`, `internalRank`
- `src/models/InboxConversation.ts`
- `src/models/InboxMessage.ts`
- `src/models/InboxTransfer.ts`
- `src/models/ApiKey.ts`
- `src/models/WebhookEndpoint.ts`
- `src/types/panel-events.ts` — eventos urgentes painel (2.11.28)
- `src/constants/openapi-dashboard.ts`
