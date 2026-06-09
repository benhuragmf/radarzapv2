# Registro de páginas do menu — RadarZap v2

Mapa rota → componente → API. Atualizar ao criar novos itens de menu.

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
| `/platform/automacoes` | `PlatformAutomations.tsx` | `GET/POST /platform/automations` |
| `/platform/inbox` | `menu/Inbox.tsx` | `GET/POST /inbox/*`, `?conv=` deep link |
| `/platform/inbox/tickets` | `menu/InboxTickets.tsx` | `GET /inbox/tickets`, `GET /inbox/tickets/stats` |
| `/platform/inbox/tickets/:ref` | `menu/InboxTicketDetail.tsx` | `GET /inbox/tickets/:ref`, `POST …/client-update`, `…/close`, `…/comments` — fluxo assíncrono: `INBOX-ATENDIMENTO.md` § Tickets |
| `/platform/inbox/setores` | `menu/InboxSectors.tsx` | `GET/POST/PATCH /inbox/departments`, `GET /inbox/members` |
| `/platform/inbox/bot` | `menu/InboxBotSettings.tsx` | `GET/PATCH /inbox/settings` (CSAT: `csatEnabled`, `csatPrompt`, `csatThankYou`) |
| `/platform/inbox/respostas` | `menu/InboxQuickReplies.tsx` | `GET/PATCH /inbox/quick-replies` |
| `/platform/inbox/supervisor` | `menu/InboxSupervisor.tsx` | `GET /inbox/supervisor/queue`, `POST /inbox/conversations/:id/reassign` |
| `/platform/inbox/relatorios` | `menu/InboxReports.tsx` | `GET /inbox/reports?from=&to=` |

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
| `/settings/team` | `TeamMembers.tsx` — aba **Papéis do sistema** (`RolesSystemPanel`) + aba **Equipe** | `GET /team/roles`, `PATCH/DELETE /team/roles/:role`, `POST/PATCH/DELETE /team/custom-roles[/:id]`, `GET/POST/PATCH/DELETE /team/members` (`roleKey`) — presets em `Organization.roleCapabilities`; papéis nomeados em `Organization.customRoles[]`; preset CUSTOM legado oculto na UI |
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

## Redirects legados `/em-breve/:slug`

Ver `pages/menu/EmBreveRedirect.tsx` → `SLUG_REDIRECTS`.

## Modelos backend

- `src/models/Organization.ts` — `roleCapabilities`, `customRoles[]`
- `src/models/CompanyMember.ts` — `customRoleId`, `extraCapabilities`, `deniedCapabilities`
- `src/models/Destination.ts` — `consentRenewalApprovals` (0–2)
- `src/types/org-custom-role.ts` — helpers `custom:uuid`, `defaultOrgCustomRoles()`
- `src/models/InboxSettings.ts`
- `src/models/InboxDepartment.ts` — `clientVisible`, `internalRank`
- `src/models/InboxConversation.ts`
- `src/models/InboxMessage.ts`
- `src/models/InboxTransfer.ts`
- `src/models/ApiKey.ts`
- `src/models/WebhookEndpoint.ts`
- `src/constants/openapi-dashboard.ts`
