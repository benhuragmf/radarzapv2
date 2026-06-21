# RadarZap v2 — Índice de documentação

**Versão do produto:** `2.11.15` · **Atualizado:** 2026-06-21

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
| [`ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md`](./ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md) | Auditoria estabilização Fase 1 |
| [`RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md`](./RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md) | Visão produto / diferenciação (pós-estabilização) |

---

## Modos de atendimento (2.11.0)

| Documento | Descrição |
|-----------|-----------|
| [`RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`](./RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md) | **Consolidado ativo** — tudo implementado Fases 1–8 |
| [`concluidos/`](./concluidos/README.md) | Fases parciais, análise prévia e entregas arquivadas ✅ |

---

## Atendimento e canais

| Documento | Descrição |
|-----------|-----------|
| [`INBOX-ATENDIMENTO.md`](./INBOX-ATENDIMENTO.md) | Inbox, triagem WA, fila, CSAT, IA |
| [`TICKET-ATENDIMENTO.md`](./TICKET-ATENDIMENTO.md) | Chamados, SLA, menu bot |
| [`WEBCHAT.md`](./WEBCHAT.md) | Widget, API pública, fila, IA, FAQ |
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
| [`BILLING.md`](./BILLING.md) | Stripe / planos |

---

## Design e QA

| Documento | Descrição |
|-----------|-----------|
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
| Triagem WA | `inbox-triage.ts`, `InboxService` | INBOX-ATENDIMENTO |

---

*Adicionar linha neste índice ao criar qualquer novo `docs/*.md` de módulo ou feature.*
