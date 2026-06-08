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
| `/platform/wa-status` | `menu/WaStatus.tsx` | `GET /sessions` |
| `/platform/wa-logs` | `menu/WaLogs.tsx` | `GET /logs?tenant=1&service=WhatsAppService` |
| `/platform/automacoes` | `PlatformAutomations.tsx` | `GET/POST /platform/automations` |
| `/platform/inbox` | `menu/Inbox.tsx` | `GET/POST /inbox/*` |
| `/platform/inbox/setores` | `menu/InboxSectors.tsx` | `GET/POST/PATCH /inbox/departments`, `GET /inbox/members` |
| `/platform/inbox/bot` | `menu/InboxBotSettings.tsx` | `GET/PATCH /inbox/settings` |
| `/platform/inbox/supervisor` | `menu/InboxSupervisor.tsx` | `GET /inbox/supervisor/queue`, `POST /inbox/conversations/:id/reassign` |
| `/platform/inbox/relatorios` | `menu/InboxReports.tsx` | `GET /inbox/reports?from=&to=` |

## Integrações API

| Rota / hash | Componente | API |
|-------------|------------|-----|
| `/settings#api-chaves` | `integrations/ApiKeysPanel.tsx` | `GET/POST/DELETE /integrations/api-keys` |
| `/settings#api-webhooks` | `integrations/WebhooksPanel.tsx` | `GET/POST/PATCH/DELETE /integrations/webhooks` |
| `/settings#api-docs` | `integrations/ApiDocsPanel.tsx` | `GET /integrations/openapi` |
| `/settings#api-rate` | `integrations/RateLimitPanel.tsx` | `GET /integrations/rate-limit` |
| `/send#playground` | `integrations/ApiPlayground.tsx` | `POST /integrations/playground` |

## Empresa

| Rota | Componente | API principal |
|------|------------|---------------|
| `/settings/team` | `TeamMembers.tsx` — aba **Papéis do sistema** (`RolePresetEditor`) + aba **Equipe** | `GET /team/roles`, `PATCH/DELETE /team/roles/:role`, `GET/POST/PATCH/DELETE /team/members` — permissões por papel persistidas em `Organization.roleCapabilities`; Discord só se `linkedGuildIds` |
| `/settings/permissions` | `menu/PermissionsPage.tsx` |
| `/settings/security` | `menu/SecuritySettings.tsx` |
| `/settings/backup` | `menu/BackupExport.tsx` |

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
| `/admin/moderation` | `menu/AdminModeration.tsx` | — |
| `/admin/settings` | `menu/AdminSettingsPage.tsx` | `GET /services/health` |

## Redirects legados `/em-breve/:slug`

Ver `pages/menu/EmBreveRedirect.tsx` → `SLUG_REDIRECTS`.

## Modelos backend

- `src/models/InboxSettings.ts`
- `src/models/InboxDepartment.ts`
- `src/models/InboxConversation.ts`
- `src/models/InboxMessage.ts`
- `src/models/InboxTransfer.ts`
- `src/models/ApiKey.ts`
- `src/models/WebhookEndpoint.ts`
- `src/constants/openapi-dashboard.ts`
