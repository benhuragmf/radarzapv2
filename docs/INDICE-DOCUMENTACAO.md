# RadarZap v2 — Índice de documentação

**Versão do produto:** `2.11.84` · **Atualizado:** 2026-06-24

Mapa de referência rápida. Novas entregas devem atualizar este índice ([`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md)).

---

## Governança e versão

| Documento | Descrição |
|-----------|-----------|
| [`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md) | **Protocolo** — como versionar e documentar |
| [`CHANGELOG.md`](./CHANGELOG.md) | Changelog append-only (entregas recentes) |
| [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md) | Registro vivo espelho do sistema (versionado no git) |
| [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md) | Roadmap, gate estabilização, lacunas |
| [`PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md`](./PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md) | Plano consulta → doc → aplicação (origem GG) |
| [`RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md`](./RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md) | Visão produto / diferenciação (pós-estabilização) |

---

## Modos de atendimento (2.11.0)

| Documento | Descrição |
|-----------|-----------|
| [`RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`](./RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md) | **Consolidado ativo** — tudo implementado Fases 1–8 |
| [`concluidos/`](./concluidos/README.md) | Entregas arquivadas: modos fases 1–8, FAQ WA, upgrade Inbox, **ENTREGA 2.11.24–38**, auditoria estabilização |

---

## Atendimento e canais

| Documento | Descrição |
|-----------|-----------|
| [`INBOX-ATENDIMENTO.md`](./INBOX-ATENDIMENTO.md) | Inbox, triagem WA, fila, CSAT, IA, presença, supervisor, notificações |
| [`IA-CREDITOS-E-CARTEIRA.md`](./IA-CREDITOS-E-CARTEIRA.md) | Créditos IA, carteira mensal, aprendizagem, barra do painel; § cobrança LLM×IA + fluxo mermaid (2.11.85) |
| [`TICKET-ATENDIMENTO.md`](./TICKET-ATENDIMENTO.md) | Chamados, SLA, menu bot, formato `TK-…` (2.11.86) |
| [`WEBCHAT.md`](./WEBCHAT.md) | Widget, API pública, fila, IA, FAQ |
| [`LEADS-FORMULARIO.md`](./LEADS-FORMULARIO.md) | Formulário embed de captura de leads (2.11.57) |
| [`concluidos/radarzap-inbox-upgrade.md`](./concluidos/radarzap-inbox-upgrade.md) | Upgrade visual Inbox 2.10.18 (arquivo) |
| [`WEBHOOKS.md`](./WEBHOOKS.md) | Webhooks outbound |

---

## Painel, API, RBAC

| Documento | Descrição |
|-----------|-----------|
| [`MENU-PAGES-REGISTRY.md`](./MENU-PAGES-REGISTRY.md) | Rotas → componentes → API |
| [`EQUIPE-RBAC.md`](./EQUIPE-RBAC.md) | Papéis, capabilities |
| [`CONSENTIMENTO-LGPD.md`](./CONSENTIMENTO-LGPD.md) | Consentimento |

---

## Plataforma e migração

| Documento | Descrição |
|-----------|-----------|
| [`RADARZAP-V2-MIGRACAO.md`](./RADARZAP-V2-MIGRACAO.md) | Migração v1 → v2 |
| [`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md) | Infra/env (referência) |
| [`PRODUCTION.md`](./PRODUCTION.md) | Runbook go-live |
| [`BILLING.md`](./BILLING.md) | Stripe / planos · alertas críticos `billing:*` no sino (2.11.28) |

---

## Design e QA

| Documento | Descrição |
|-----------|-----------|
| [`QA-FASE1-AUTOMATIZACAO.md`](./QA-FASE1-AUTOMATIZACAO.md) | Mapa automático (Jest/Playwright) vs manual WA |
| [`QA-FASE1-RAPIDO.md`](./QA-FASE1-RAPIDO.md) | **Checklist 1 página** — use no manual |
| [`QA-FASE1-KICKOFF.md`](./QA-FASE1-KICKOFF.md) | **Start** gate humano Fase 1 (pós gate automático) |
| [`QA-FASE1-ROTEIRO.md`](./QA-FASE1-ROTEIRO.md) | Roteiro passo a passo WhatsApp + WebChat |
| [`QA-FASE1-CHECKLIST.md`](./QA-FASE1-CHECKLIST.md) | Checklist imprimível § A–E |
| [`QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`](./QA-WEBCHAT-WA-FALLBACK-BRIDGE.md) | Token, FAQ, fallback, bridge |
| [`QA-FASE1-RESULTADO-TEMPLATE.md`](./QA-FASE1-RESULTADO-TEMPLATE.md) | Template registro QA |
| [`QA-FASE1-RESULTADO-2026-06-22.md`](./QA-FASE1-RESULTADO-2026-06-22.md) | Sessão QA atual (gate auto preenchido) |
| [`DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md) | Tokens `--rz-*`, componentes |
| [`docs/audits/`](./audits/) | Auditorias incrementais |
| [`concluidos/`](./concluidos/README.md) | Entregas concluídas (fases, auditorias, upgrades) |

---

## Código ↔ documentação

| Área | Código principal | Doc |
|------|------------------|-----|
| Modos / adapter | `src/types/attendance-mode.ts` | Consolidado modos |
| Settings IA | `src/models/AiSettings.ts`, `AiSettingsService.ts` | PHASE-3, consolidado |
| UI IA | `frontend/.../AiAtendimento.tsx` | PHASE-1 |
| Robotizado WC | `webchat-robotic-triage.service.ts` | PHASE-4 |
| IA Básica WC | `webchat-basic-triage.service.ts` | Consolidado modos · fix gate 2.11.28 |
| Triagem WA | `inbox-triage.ts`, `InboxService` | INBOX-ATENDIMENTO |
| Créditos / carteira IA | `AiWalletService.ts`, `ai-credits.ts`, `ai-wallet.ts` | IA-CREDITOS-E-CARTEIRA |
| Barra status painel | `HeaderStatusPills.tsx` | IA-CREDITOS-E-CARTEIRA § Barra |
| Presença atendentes | `inbox-agent-presence.ts`, `inbox-agent-presence-api.ts` | [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./concluidos/ENTREGA-ATENDIMENTO-2.11.24-28.md) §3 |
| Fallback WA deferido | `webchat-whatsapp-fallback.service.ts`, scan em `WebChatService` | [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./concluidos/ENTREGA-ATENDIMENTO-2.11.24-28.md) §4 |
| Alertas críticos painel | `panel-events.ts`, `panel-critical-alerts.service.ts`, `EventNotificationBell.tsx` | [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./concluidos/ENTREGA-ATENDIMENTO-2.11.24-28.md) §5 |
| Supervisão equipe | `inbox-supervisor-dashboard.service.ts`, `InboxSupervisor.tsx` | [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./concluidos/ENTREGA-ATENDIMENTO-2.11.24-28.md) §2 |
| Rate limit WA | `whatsapp-session-rate-limit.ts`, `WhatsAppSendLimitsPage.tsx` | PLANO § Fase B · `/platform/wa-limits` |
| Saúde atendimento | `GET /platform/health/atendimento` em `DashboardService.ts` | PLANO § Fase B |

---

*Adicionar linha neste índice ao criar qualquer novo `docs/*.md` de módulo ou feature.*
