# Radar Chat — Inventário páginas `/admin/*`

**Versão:** `2.12.44` · **Atualizado:** 2026-06-27  
**Escopo:** todas as rotas staff interno (aba Admin Radar Chat + Moderador)

---

## Mapa rápido

| Rota | Componente | Cap RBAC | Papel |
|------|------------|----------|--------|
| `/admin` | redirect → `/admin/dashboard` | — | Entrada admin |
| `/admin/dashboard` | `AdminDashboard` | `dashboard:global` | **Hub Ops** — 8 abas consolidadas |
| `/admin/clients` | `AdminClients` | `system:users:view` | **Usuários** (contas) — não confundir com empresas |
| `/admin/servers` | `AdminServers` | `system:servers:view` | WA/Discord + Ops atendimento |
| `/admin/sessions` | `Sessions` | `whatsapp:session:view` | Sessões WA globais |
| `/admin/queue` | `Queue` | `queue:global` | Fila BullMQ global |
| `/admin/logs` | `Logs` | `logs:global` | SystemLog global |
| `/admin/monitoring` | `AdminMonitoring` | `logs:global` | Infra detalhe (+ Ops se `dashboard:global`) |
| `/admin/errors` | `AdminErrors` | `logs:global` | Erros sanitizados (+ feed Ops) |
| `/admin/plans` | `Plans` (admin) | `system:plans:manage` | Catálogo planos |
| `/admin/payments` | `AdminPaymentsPage` | `system:payments:view` | Pedidos Stripe |
| `/admin/moderation` | `AdminModeration` | `system:moderation:action` | Moderação |
| `/admin/audit` | `AdminAuditPage` | `system:audit:view` | AuditLog |
| `/admin/api` | `AdminApiPage` | `api:global` | Chaves/webhooks globais |
| `/admin/settings` | `AdminSettingsPage` | `system:settings:manage` | Config plataforma |
| `/admin/ai-blueprint` | `AdminAiBlueprint` | `system:ai:manage` | Blueprint IA |
| `/admin/ai-platform` | `AdminAiPlatform` | `system:ai:manage` | Credenciais IA plataforma |
| `/admin/permissions` | `AdminPermissionsPage` | `system:permissions:view` | Matriz caps staff |
| `/admin/security` | `AdminSecurityPage` | `system:security:view` | Políticas segurança |
| `/admin/backup` | `AdminBackupPage` | `system:backup:manage` | Backup |

---

## Relação Dashboard Ops × legado

```
/admin/dashboard          ← visão consolidada (summary + abas)
    ├── ?tab=infra        ← infra Mongo/Redis/filas
    ├── ?tab=tenants      ← empresas/trial/plano
    ├── ?tab=atendimento  ← WA/WebChat/Inbox/tickets
    ├── ?tab=security     ← alertas + feed eventos
    └── links rápidos → páginas detalhe abaixo

/admin/monitoring   → complemento infra (+ stats legado)
/admin/errors       → erros 24h (feed Ops, filtro error)
/admin/servers      → WA/Discord + canais digitais
```

**Regra:** quem tem `dashboard:global` vê dados Ops enriquecidos nas páginas legado + banner com deep link. Quem só tem cap legado (`logs:global` ou `system:servers:view`) mantém fallback anterior.

---

## Status por página (pós Etapa 8)

| Página | Status | Notas |
|--------|--------|-------|
| Dashboard global | ✅ Completo | Etapas 1–7 |
| Monitoramento | ✅ Enriquecido | Ops infra + fallback |
| Erros | ✅ Enriquecido | Feed sanitizado Etapa 5 |
| Servidores | ✅ Enriquecido | Ops WA/WebChat/Inbox |
| Clientes | ✅ Usuários | Etapa 9 — renomeado; Empresas no menu |
| Moderação | ✅ Focado LGPD | Etapa 9 — tabela plano removida |
| Sessões/Fila/Logs | ✅ Operacional | Páginas transacionais |
| Planos/Pagamentos | ✅ Operacional | Ações admin |
| IA/Backup/Security | ✅ Operacional | Config plataforma |

---

## Deep links

- Dashboard aba: `/admin/dashboard?tab={overview|infra|tenants|atendimento|billing|ai|security|golive}`
- Helper frontend: `adminDashboardTabUrl(tab)` em `adminOpsTabs.ts`

---

Ver também: [`RADARCHAT-ADMIN-DASHBOARD-OPS-ETAPA-9-AUDITORIA-ROTAS.md`](./RADARCHAT-ADMIN-DASHBOARD-OPS-ETAPA-9-AUDITORIA-ROTAS.md).
