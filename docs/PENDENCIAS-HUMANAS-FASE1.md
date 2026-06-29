# Pendências humanas — Fase 1 (única fonte ativa)

**Versão produto:** `2.12.69` (main) · **VPS QA:** alinhar com último deploy `main` · **Atualizado:** 2026-06-28

Este doc lista **somente** o que **não pode** ser fechado por código ou CI — requer browser/celular real (Benhur).  
Tudo que já está verde automaticamente está em § Gate automático abaixo.

**Gate § Estabilização:** [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md) · **Kickoff:** [`QA-FASE1-KICKOFF.md`](./QA-FASE1-KICKOFF.md)

---

## Gate automático — ✅ verde (2026-06-28 @ `2.12.63`)

| Comando | Status | Notas |
|---------|--------|-------|
| `npm run qa:atendimento:gate` | ✅ | Revalidado 2026-06-28 — Jest atendimento + `qa:webchat-wa` + `qa:prep` |
| `npm run qa:prep` | ✅ | Mongo, 1 sessão WA, CSAT, WebChat, fallback, equipe, leads |
| `npm run build` + frontend | ✅ | CI/release gate 2026-06-27 |
| E2E Playwright | ✅ | 80/80 CI (incl. inbox + campanha limites) |
| Admin Ops backlog 2.12.60–63 | ✅ | LGPD portal, bridge dedup, infra degraded boot — ver [`concluidos/ENTREGA-AUDITORIA-HORIZONTAL-2.12.47-59.md`](./concluidos/ENTREGA-AUDITORIA-HORIZONTAL-2.12.47-59.md) |

**Conclusão técnica:** implementação e regressão automatizada **OK**. Fase 1 permanece aberta **apenas** por QA manual humano + confirmação de ausência de bug crítico em ciclo real.

---

## P0 — QA manual atendimento (bloqueia gate Fase 1)

| # | O quê | Doc | Quem |
|---|-------|-----|------|
| 1 | Cenários WhatsApp § A (10 itens) | [`QA-FASE1-CHECKLIST.md`](./QA-FASE1-CHECKLIST.md) · [`QA-FASE1-ROTEIRO.md`](./QA-FASE1-ROTEIRO.md) | Benhur + celular cliente |
| 2 | Rotas painel § B (+ leads § B.1) | idem | Benhur |
| 3 | WebChat + fallback + bridge § C | [`QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`](./QA-WEBCHAT-WA-FALLBACK-BRIDGE.md) | Benhur |
| 4 | Presença, supervisor, alertas § E | [`QA-FASE1-ROTEIRO.md`](./QA-FASE1-ROTEIRO.md) Partes 5–7 | Benhur |
| 5 | Registrar resultado | Copiar [`QA-FASE1-RESULTADO-TEMPLATE.md`](./QA-FASE1-RESULTADO-TEMPLATE.md) → `docs/concluidos/QA-FASE1-RESULTADO-YYYY-MM-DD.md` | Benhur |
| 6 | Marcar gate § Estabilização | [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md) — só após § A–E sem falha crítica | Benhur |
| **7** | **Fallback fila WA nativa** (2.12.67) | [`QA-FASE1-ROTEIRO.md`](./QA-FASE1-ROTEIRO.md) **Parte 3c** · registro [`concluidos/QA-FASE1-RESULTADO-2026-06-28.md`](./concluidos/QA-FASE1-RESULTADO-2026-06-28.md) § Agendado | Benhur · **após deploy 2.12.67** |

Checklist 1 página: [`QA-FASE1-RAPIDO.md`](./QA-FASE1-RAPIDO.md)

---

## P1 — Admin Ops pós-auditoria (browser VPS)

| # | O quê | Doc |
|---|-------|-----|
| A1–D | Blocos A–D dashboard admin | [`concluidos/admin/RADARZAP-QA-MANUAL-POS-AUDITORIA-2.12.60-63.md`](./concluidos/admin/RADARZAP-QA-MANUAL-POS-AUDITORIA-2.12.60-63.md) |
| **E** | Alterar plano org no browser VPS + conferir `AuditLog` | idem § Bloco E · evidência: [`qa-results/qa-manual-pos-auditoria-2.12.60-63-TEMPLATE.json`](./qa-results/qa-manual-pos-auditoria-2.12.60-63-TEMPLATE.json) |

Automação local Bloco E: `npm run qa:admin-ops:bloco-e:local` (não substitui browser VPS).

---

## P2 — QA visual complementar (não bloqueia gate mínimo)

| Doc | Escopo |
|-----|--------|
| [`QA-WEBCHAT-CHATBOX-MODELS.md`](./QA-WEBCHAT-CHATBOX-MODELS.md) | Modelos visuais chatbox |
| [`IA-CREDITOS-E-CARTEIRA.md`](./IA-CREDITOS-E-CARTEIRA.md) § QA manual | Barra header IA/LM/WA |

---

## Backlog documentado (não é blocker Fase 1)

| Item | Doc | Estado código |
|------|-----|---------------|
| Import CSV `multipart` (upload arquivo) | [`CONTATOS-CSV-IMPORTACAO.md`](./CONTATOS-CSV-IMPORTACAO.md) | JSON `{ content \| csv }` ✅ · multipart ⏳ |
| Export por `clientId` dedicado | idem | Parcial — `export-csv` global ✅ |
| Cloud API Meta | [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md) § Fase 2 | Stub POST 503 |
| 21 upgrades produto | [`RADARZAP-PLANO-UPGRADES.md`](./RADARZAP-PLANO-UPGRADES.md) | Backlog pós-gate |
| PREPARACAO-PRODUCAO / PRODUCTION | [`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md) · [`PREPARACAO-PRODUCAO-EXECUCAO.md`](./PREPARACAO-PRODUCAO-EXECUCAO.md) · [`COOLIFY-DEPLOY.md`](./COOLIFY-DEPLOY.md) | 🔄 Coolify + branch `layout-v3` |
| Branch `layout-v3` | docs `RADARZAP-LAYOUT-V3-*` | Release alvo UI v3 + deploy Coolify |
| SECURITY_* (raiz) | `SECURITY_CHECKLIST.md` | Go-live — após Fase 3 |

---

## O que **não** precisa mais de processo aberto

| Antes “pendente” | Situação atual |
|------------------|----------------|
| Sync visitante WebChat → `clientReplies` ticket | ✅ `InboxService.syncWebChatVisitorMessageToTicket` — ver [`WEBCHAT.md`](./WEBCHAT.md) § Chamados |
| TOP 01–21 fora de `concluidos/` | ✅ Arquivados em [`concluidos/top/`](./concluidos/top/) |
| Admin Ops docs na raiz `docs/admin/` | ✅ Hub em [`concluidos/admin/`](./concluidos/admin/) — redirect [`admin/README.md`](./admin/README.md) |
| Plano GG / visão produto na raiz | ✅ [`concluidos/PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md`](./concluidos/PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md) |

---

## Ao fechar tudo P0 + P1

1. Atualizar [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md) — marcar gate § Estabilização.
2. Atualizar [`RADARZAP-SISTEMA-COMPLETO.md`](./RADARZAP-SISTEMA-COMPLETO.md) status.
3. Registrar em [`CHANGELOG.md`](./CHANGELOG.md) + [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md).
4. Concluir itens restantes em [`PREPARACAO-PRODUCAO-EXECUCAO.md`](./PREPARACAO-PRODUCAO-EXECUCAO.md) § go-live (domínio, staging, smoke).
5. Seguir [`PRODUCTION.md`](./PRODUCTION.md) para cutover final.
