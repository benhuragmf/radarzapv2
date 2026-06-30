# Radar Chat — TOP 16/20 — IA Créditos, Carteira, Consumo e Fallback

**Data:** 2026-06-24  
**Versão após TOP 16:** `2.12.2`  
**Branch:** `main`

---

## Resumo executivo

O TOP 16 consolidou **IA Créditos** como proteção anti-prejuízo: carteira mensal por plano (`AiWalletService`), consumo proporcional (`AiUsageMeterService` / `AiUsage`), gate antes de provider externo, fallback humano/fila sem expor “sem créditos” ao cliente, alertas 80/90/100%, catálogo de pacotes extras (sem checkout), APIs de saldo/pacotes/ajuste manual, eventos `ai.credits.*` e testes.

Billing Stripe/checkout real → TOP 17.

---

## Herança dos TOPs anteriores

| TOP | Herança |
|-----|---------|
| 03 | Matriz créditos Free 0 … Enterprise 12000; pacotes 1k/5k/15k referência |
| 06 | Modos: só etapas com LLM consomem |
| 14 | IA Básica local grátis; LLM fallback com gate |
| 15 | IA Premium com gate crédito; recarga ficou TOP 16 |
| 11–13 | WebChat/WA/Bridge inalterados nesta etapa |

### Esta etapa fecha

Carteira, metering, gates, alertas, pacotes estruturais, fallback, painel/API, testes.

### Esta etapa não faz

Stripe checkout, PIX, boleto, billing enforcement completo (TOP 17).

---

## Estado Git inicial

| Item | Valor |
|------|-------|
| Branch | `main` |
| Último commit antes | `c9100d4` — `chore(top): ia premium kb e handoff 2.12.1` |
| Modificados antes | Nenhum |
| Untracked | `data/`, `mocker/modelochat/` (não commitar) |

---

## Escopo autorizado

`AiWalletService`, `AiUsageMeterService`, `AiUsage`, alertas, pacotes, painel/API, fallback, testes, documentação.

---

## Diagnóstico atual da carteira IA

| Item | Existe? | Arquivo | Observação |
|------|---------|---------|------------|
| Carteira org | Sim | `Organization.aiWallet` | `purchasedCredits`, `learningOpsUsed`, `periodStart` |
| Saldo mensal | Sim | `AiWalletService.getSnapshot` | plano + purchased − uso mês |
| Crédito extra | Sim | `purchasedCredits` | `addPurchasedCredits` |
| Consumo | Sim | `AiUsage` + `recordUsage` | `creditWeight`, `usageKind` |
| Metering | Sim | `AiUsageMeterService` | gate + agregação |
| Gate | Sim | `canConsumeAiCredits` | via `getUsageSnapshot` |
| Reset mensal | Sim | `ensureMonthlyPeriod` | learning ops; franquia por calendário |
| Alertas | Sim | `ai-credit-alerts.util` + painel | 80/90/100% |
| Pacotes extras | Sim | `config/plans.json` + util | sem checkout |
| Painel | Sim | barra IA/LM + `/platform/ai/balance` | |
| API | Sim | balance, packages, wallet/purchased | RBAC |
| Testes | Sim | wallet, credits, alerts, packages | gate QA |

---

## Diagnóstico de créditos por plano

| Plano | Catálogo | Runtime (`getAiWalletPlanLimits`) |
|-------|----------|-----------------------------------|
| Free | 0 | 0 |
| Trial | 100 | 100 |
| Starter | 400 | 400 |
| Pro | 2500 | 2500 |
| Enterprise | 12000 | 12000 |

Fonte: `config/plans.json` → `PlanConfigService.getCommercialLimits`.

---

## Diagnóstico de consumo e metering

- Autorização: `getUsageSnapshot` antes de `AiProviderService.complete` / `completeForBasicTriage`.
- Registro: `recordUsage` após chamada; evento `ai.credits.consumed` (Radar Chat).
- Proporcional: `aiCreditsFromActualCost` (1 crédito ≈ US$0,01).
- Chave própria: débito 0 na carteira Radar Chat.
- Idempotência: uma linha `AiUsage` por chamada.
- Erro pré-provider: não consome; evento `ai.credits.blocked`.

---

## Diagnóstico de gates por modo

| Modo | Consome? | Gate |
|------|----------|------|
| `disabled` | Não | — |
| `robotic` | Não | — |
| `basic_triage` local | Não | — |
| `basic_triage` LLM | Sim | `getUsageSnapshot` |
| `premium_assistant` | Sim | `getUsageSnapshot` |
| `hybrid` menu/local | Não | — |
| `hybrid` premium/LLM | Sim | `getUsageSnapshot` |

---

## Diagnóstico WebChat

- Premium Radar Chat: `getAvailability` verifica carteira; sem crédito → mensagem segura + `shouldEscalate`.
- Provider: gate em `AiProviderService.complete`.
- FAQ/auto-resolve local: sem débito.

---

## Diagnóstico WhatsApp

- `AiConversationService.handleInbound`: gate `getUsageSnapshot` → `releaseToStandardTriage`.
- Comandos `!`: antes da IA (TOP 12).
- Cliente não vê motivo de créditos.

---

## Diagnóstico Bridge

- Bridge ativa: sem automação IA visitante (TOP 13) — sem consumo.

---

## Diagnóstico de alertas de cota

| Nível | Implementação |
|-------|---------------|
| 80% | `warning_80` → painel `ai:quota_low` |
| 90% | `warning_90` → título crítico |
| 100% | `exhausted` → bloqueio + `ai:quota_exceeded` |

Dedupe: `shouldEmitAiCreditAlert` (só sobe de nível).

---

## Diagnóstico de pacotes extras de créditos

| Pacote | Créditos | Preço ref. | Status |
|--------|----------|------------|--------|
| pack_1k | 1000 | R$29 | documented_future |
| pack_5k | 5000 | R$99 | documented_future |
| pack_15k | 15000 | R$249 | documented_future |

`GET /platform/ai/credit-packages` — `checkoutEnabled: false`.

---

## Diagnóstico de painel e APIs

| Rota | Permissão | Função |
|------|-----------|--------|
| `GET /platform/ai/balance` | `inbox:ai:balance:view` | Saldo + LM |
| `GET /platform/ai/credit-packages` | `inbox:ai:balance:view` | Catálogo |
| `POST /platform/ai/wallet/purchased` | `billing:manage` | Ajuste manual (sem Stripe) |
| `GET /platform/ai/usage` | `inbox:ai:manage` | Histórico |

Cross-tenant: filtro `auth.clientId`.

---

## Regras oficiais da carteira IA

Saldo = franquia plano + `purchasedCredits` − consumo mês. Saldo nunca negativo no snapshot (`Math.max(0)`).

---

## Regras oficiais de consumo

LLM Radar Chat debita; local/handoff/bridge/comando não debitam.

---

## Regras oficiais de bloqueio e fallback

Sem crédito → não chama provider → fila/triagem; mensagem cliente: `AI_CREDITS_CLIENT_FALLBACK_MESSAGE`.

---

## Regras oficiais de alertas

`resolveAiCreditUsageLevel` + `buildAiCreditAlertMessage`.

---

## Regras oficiais de pacotes extras

Catálogo estático; cobrança TOP 17.

---

## Eventos, logs e rastreabilidade

`ai.credits.checked|consumed|blocked|low_balance|exhausted|adjusted|monthly_reset` em `AttendanceEvent`. Sem API key/prompt.

---

## Atualização da documentação mestre

§19 `RADARCHAT-SISTEMA-COMPLETO.md`, `IA-CREDITOS-E-CARTEIRA.md`, índice, changelog → `2.12.2`.

---

## Correções ou ajustes aplicados

- `ai-credit-alerts.util.ts`, `ai-credit-packages.util.ts`
- `canConsumeAiCredits`, mensagens fallback, `recordAiCreditAttendanceEvent`
- `PanelCriticalAlertsService` alertas 80/90/100
- `WebChatAiService` gate créditos + fallback seguro
- `AiProviderService` evento blocked
- `AiUsageMeterService` evento consumed
- APIs credit-packages e wallet/purchased

---

## Testes criados ou atualizados

- `ai-credit-alerts.util.test.ts`
- `ai-credit-packages.util.test.ts`
- `ai-wallet.test.ts` (planos + canConsume)
- Suites existentes `ai-credits`, `plan-config`, `panel-critical-alerts`

---

## Gates executados

| Gate | Resultado |
|------|-----------|
| `npm run typecheck` | Verde |
| `npm run build` | Verde (widget `2.12.2`) |
| `npm test` | Verde — 124 suites, 749 testes |
| `npm run qa:atendimento:gate` | Verde — inclui créditos/alerts/packages |
| Frontend build | Não alterado nesta etapa |

---

## Arquivos alterados

Ver `git diff --stat` pós-gates.

---

## Riscos reduzidos

- Provider sem gate de saldo bloqueado com auditoria.
- Cliente não vê “sem créditos”.
- Alertas graduais 80/90/100.
- Pacotes documentados sem checkout acidental.

---

## Riscos restantes

- Checkout Stripe / PIX (TOP 17).
- Reset automático de `purchasedCredits` / downgrade — política comercial pendente.
- Canal em `recordUsage` ainda `unknown` em alguns caminhos.

---

## Decisões pendentes para Benhur

1. Expirar `purchasedCredits` após N meses?
2. Acumular franquia mensal não usada?
3. Expor compra de pacotes na UI antes do Stripe TOP 17?

---

## Próximo passo recomendado

**TOP 17 — Billing:** Stripe checkout pacotes, assinaturas, enforcement de plano, bloqueios por excedente.
