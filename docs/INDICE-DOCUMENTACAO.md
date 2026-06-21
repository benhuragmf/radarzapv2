# RadarZap v2 — Índice de documentação

**Versão do produto:** `2.11.1` · **Atualizado:** 2026-06-19

Mapa de referência rápida. Novas entregas devem atualizar este índice ([`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md)).

---

## Governança e versão

| Documento | Descrição |
|-----------|-----------|
| [`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md) | **Protocolo** — como versionar e documentar |
| [`CHANGELOG.md`](./CHANGELOG.md) | Changelog append-only (entregas recentes) |
| [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md) | Registro vivo espelho do sistema (versionado no git) |
| [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md) | Roadmap, gate estabilização, lacunas |

---

## Modos de atendimento (2.11.0)

| Documento | Descrição |
|-----------|-----------|
| [`RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`](./RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md) | **Consolidado** — tudo implementado Fases 1–4 |
| [`ANALISE-MODOS-ATENDIMENTO.md`](./ANALISE-MODOS-ATENDIMENTO.md) | Análise pré-implementação |
| [`RADARZAP-ATTENDANCE-MODES-PHASE-1.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-1.md) | Fases 0–2: UI + adapter |
| [`RADARZAP-ATTENDANCE-MODES-PHASE-3.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-3.md) | Fase 3: Mongo `attendanceMode` |
| [`RADARZAP-ATTENDANCE-MODES-PHASE-4.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-4.md) | Fase 4: WebChat robotizado |
| [`RADARZAP-ATTENDANCE-MODES-PHASE-5.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-5.md) | Fase 5: IA Básica local-first |
| [`RADARZAP-ATTENDANCE-MODES-PHASE-6.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-6.md) | Fase 6: WebChat × modo global |
| [`RADARZAP-ATTENDANCE-MODES-PHASE-7.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-7.md) | Fase 7: custos/logs por modo |
| [`RADARZAP-ATTENDANCE-MODES-PHASE-8.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-8.md) | Fase 8: E2E Playwright modos |

---

## Atendimento e canais

| Documento | Descrição |
|-----------|-----------|
| [`INBOX-ATENDIMENTO.md`](./INBOX-ATENDIMENTO.md) | Inbox, triagem WA, fila, CSAT, IA |
| [`TICKET-ATENDIMENTO.md`](./TICKET-ATENDIMENTO.md) | Chamados, SLA, menu bot |
| [`WEBCHAT.md`](./WEBCHAT.md) | Widget, API pública, fila, IA, FAQ |
| [`radarzap-inbox-upgrade.md`](./radarzap-inbox-upgrade.md) | Upgrade visual Inbox 2.10.18 |
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
| [`BILLING.md`](./BILLING.md) | Stripe / planos |

---

## Design e QA

| Documento | Descrição |
|-----------|-----------|
| [`DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md) | Tokens `--rz-*`, componentes |
| [`docs/audits/`](./audits/) | Auditorias incrementais |

---

## Código ↔ documentação

| Área | Código principal | Doc |
|------|------------------|-----|
| Modos / adapter | `src/types/attendance-mode.ts` | Consolidado modos |
| Settings IA | `src/models/AiSettings.ts`, `AiSettingsService.ts` | PHASE-3, consolidado |
| UI IA | `frontend/.../AiAtendimento.tsx` | PHASE-1 |
| Robotizado WC | `webchat-robotic-triage.service.ts` | PHASE-4 |
| Triagem WA | `inbox-triage.ts`, `InboxService` | INBOX-ATENDIMENTO |

---

*Adicionar linha neste índice ao criar qualquer novo `docs/*.md` de módulo ou feature.*
