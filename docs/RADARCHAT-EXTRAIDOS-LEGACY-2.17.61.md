# RadarChat — extratos essenciais (docs legacy)

**Versão:** `2.17.61` · **Atualizado:** 2026-07-01

Conteúdo **operacional** extraído de arquivos movidos para [`legacy/`](./legacy/README.md) (nota &lt; 8). Use este doc antes de abrir o arquivo completo em `legacy/`.

**Fontes vivas (nota ≥ 8):** [`INDICE-DOCUMENTACAO.md`](./INDICE-DOCUMENTACAO.md) · QA master [`RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md`](./RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md) · deploy [`COOLIFY-DEPLOY.md`](./COOLIFY-DEPLOY.md)

---

## 1. Gates automáticos vs manual (ex-`QA-FASE1-AUTOMATIZACAO.md`)

| Camada | Comando | Substitui manual? |
|--------|---------|-------------------|
| Unitário + integração | `npm run qa:atendimento:gate` | Parcial — lógica, não Baileys real |
| E2E painel (mock API) | `npm run qa:fase1:e2e` | Parcial — § B visual |
| **Manual celular + WA** | Checklist completo 2.17.61 | **Obrigatório** para gate Fase 1 |

**Fluxo recomendado:**

```txt
1. npm run qa:fase1:e2e
2. npm run qa:manual:start   # ou qa:atendimento:gate
3. RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md
```

Specs Playwright Fase 1: `e2e/inbox-authenticated.spec.ts`, `qa-fase1-panel.spec.ts`, `qa-fase1-presence.spec.ts`, `attendance-modes.spec.ts`.

---

## 2. Fallback fila WhatsApp nativa (ex-`QA-FASE1-ROTEIRO.md` § 3c)

**Painel:** `/platform/inbox/bot` → *Fallback WhatsApp (fila)* — vale WA + site.

| Config | Valor típico QA |
|--------|-----------------|
| `whatsappFallbackAcceptTimeoutSeconds` | 60 |
| `whatsappFallbackNoAgentTimeoutSeconds` | 10 |
| Número alerta | ≠ sessão Baileys |

| Quem | Ação | Esperado |
|------|------|----------|
| Cliente WA | Triagem → humano → fila | Painel *Na fila* |
| Atendente online | **Não** Assumir; aguarda 60s + ~60s scan | Alerta WA `TK-…` + `!assumir` |
| Atendente | Fica **Offline** com cliente na fila; 10s + scan | Alerta WA (sem atendente) |
| Atendente | `!assumir TK-…` ou Assumir no Inbox | *Em atendimento* + sino urgente |

Roteiro detalhado WebChat + bridge: [`legacy/QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`](./legacy/QA-WEBCHAT-WA-FALLBACK-BRIDGE.md).

---

## 3. Limites envio WhatsApp (ex-`QA-FASE1-ROTEIRO.md` § 4)

| Canal | Fila | Limite padrão |
|-------|------|---------------|
| Inbox / bot / ticket | `whatsapp-sending` (`conversation`) | ~10/min + jitter |
| Campanhas | `marketing` | ~2/min |
| Alertas fallback / OTP | `alert` | bucket separado |
| WebChat visitante | **Não** usa fila WA | ~12/min/conv → HTTP 429 |

Painéis: `/platform/wa-limits`, `/admin/settings`, `/queue`.

---

## 4. Integração RadarGamer inbound (ex-`RADARCHAT_INTEGRATION_CONTRACT.md`)

```http
POST /api/integrations/radargamer/messages
Authorization: Bearer <RADARCHAT_API_TOKEN>
Idempotency-Key: <source event id>
X-Source: radargamer
```

**Env obrigatório:** `RADARCHAT_API_TOKEN`, `RADARCHAT_RADARGAMER_CLIENT_ID`.

**QA sem envio real:** `RADARCHAT_INTEGRATION_QA_NO_SEND=true` (ou `RADARCHAT_NO_REAL_SEND=true`).

Payload mínimo: `recipientPhone`, `templateKey`, `variables`, `sourceEventId`. Resposta **202** `{ accepted, messageId, status: "queued" }`.

Contrato completo: [`legacy/RADARCHAT_INTEGRATION_CONTRACT.md`](./legacy/RADARCHAT_INTEGRATION_CONTRACT.md).

---

## 5. Import CSV contatos — modelo canônico (ex-`CONTATOS-CSV-IMPORTACAO.md`)

**API:** `POST /api/destinations/import-csv` · **UI:** `/platform/contacts`

| Campo | Chave CSV | Obrigatório |
|-------|-----------|-------------|
| Nome | `nome` (`name`) | Sim |
| Telefone | `telefone` (`phone`) | Sim — E.164 |
| Aniversário | `aniversario` | Não |
| Grupos | `grupos` (`tags`) | Não — `;` separado |
| E-mail | `email` | Não |
| Notas | `notas` | Não |

Perfis detectados: `google`, `apple`, `radarchat`, `generic`. Export: `GET /api/destinations/export-csv?profile=...`.

Spec completa + mapeamentos Google/Apple: [`legacy/CONTATOS-CSV-IMPORTACAO.md`](./legacy/CONTATOS-CSV-IMPORTACAO.md).

---

## 6. Produção e infra (ex-`PREPARACAO-PRODUCAO.md` / `PRODUCTION.md`)

| Necessidade | Doc ativo |
|-------------|-----------|
| Deploy Coolify (produção atual) | [`COOLIFY-DEPLOY.md`](./COOLIFY-DEPLOY.md) |
| Checklist segurança deploy | [`security/SECURITY_CHECKLIST.md`](./security/SECURITY_CHECKLIST.md) |
| Runbook SPOF Mongo/Redis | [`concluidos/operacao/RUNBOOK-SPOF-MONGO-REDIS.md`](./concluidos/operacao/RUNBOOK-SPOF-MONGO-REDIS.md) |
| Env completo / backup / VPS genérico | [`legacy/PREPARACAO-PRODUCAO.md`](./legacy/PREPARACAO-PRODUCAO.md) |
| Go-live checklist histórico | [`legacy/PRODUCTION.md`](./legacy/PRODUCTION.md) |

**Regra:** não executar runbook VPS completo antes do gate Fase 1 (`ROADMAP-COMPLETUDE.md`).

---

## 7. Registrar resultado QA manual

Template histórico: [`legacy/QA-FASE1-RESULTADO-TEMPLATE.md`](./legacy/QA-FASE1-RESULTADO-TEMPLATE.md).

**Padrão atual:** registrar no checklist completo (colunas OK/Falha/Notas) ou criar `docs/concluidos/RADARCHAT-QA-HUMANO-RESULTADO-<data>.md` espelhando [`concluidos/RADARCHAT-QA-HUMANO-RESULTADO-CATALOGO-ENDERECO-PIX-2.17.61-2026-07-01.md`](./concluidos/RADARCHAT-QA-HUMANO-RESULTADO-CATALOGO-ENDERECO-PIX-2.17.61-2026-07-01.md).

---

## 8. Outros módulos em legacy (consulta sob demanda)

| Tema | Arquivo legacy |
|------|----------------|
| Leads embed (detalhe além do doc vivo) | — manter [`LEADS-FORMULARIO.md`](./LEADS-FORMULARIO.md) ativo |
| Discord bot / regras | [`legacy/DISCORD-MONITORAMENTO.md`](./legacy/DISCORD-MONITORAMENTO.md) |
| PWA atendente desktop | [`legacy/MODO-ATENDENTE-DESKTOP.md`](./legacy/MODO-ATENDENTE-DESKTOP.md) |
| Onboarding por vertical | [`legacy/ONBOARDING-VERTICAL.md`](./legacy/ONBOARDING-VERTICAL.md) |
| Backlog upgrades pós-gate | [`legacy/RADARCHAT-PLANO-UPGRADES.md`](./legacy/RADARCHAT-PLANO-UPGRADES.md) |
| Migração v1 → v2 | [`legacy/RADARCHAT-V2-MIGRACAO.md`](./legacy/RADARCHAT-V2-MIGRACAO.md) |
| QA visual Layout v3 | [`legacy/RADARCHAT-LAYOUT-V3-09-FASE-4-5-QA-VISUAL-NAVEGAVEL.md`](./legacy/RADARCHAT-LAYOUT-V3-09-FASE-4-5-QA-VISUAL-NAVEGAVEL.md) |
| Botão Salvar + toast | [`legacy/design-system/CONFIG-SAVE-FEEDBACK.md`](./legacy/design-system/CONFIG-SAVE-FEEDBACK.md) |
| Inspiração mercado | [`legacy/referencias/REFERENCIAS-MERCADO-UPGRADES.md`](./legacy/referencias/REFERENCIAS-MERCADO-UPGRADES.md) |
