# IA — Créditos, carteira mensal e barra do painel

**Versão:** 2.11.84 · **Atualizado:** 2026-06-24

Documento canônico do sistema de **créditos IA RadarZap**, **carteira mensal por empresa**, **cota de aprendizagem** e **indicadores na barra superior** do painel.

Relacionado: [`INBOX-ATENDIMENTO.md`](./INBOX-ATENDIMENTO.md) § IA de triagem, [`EQUIPE-RBAC.md`](./EQUIPE-RBAC.md), [`BILLING.md`](./BILLING.md) (recarga futura via Stripe).

---

## Visão geral

| Conceito | O que é |
|----------|---------|
| **Crédito IA** | Unidade de cobrança proporcional ao **custo real** de cada chamada LLM na chave RadarZap (`estimatedCost` USD). |
| **Carteira mensal** | Franquia de créditos incluída no plano + créditos comprados (`purchasedCredits`) − gasto do mês. |
| **Chamada LM** | Uma resposta LLM na chave RadarZap ou própria; limite técnico diário/mensal por plano (anti-abuso). |
| **Aprendizagem** | Propostas automáticas de skill/memória ao escalar — consome **processamento**; cota mensal separada. |
| **~1× / ~2× (UI)** | **Expectativa** de gasto por módulo (Básica vs Premium) — **não** multiplica cobrança. |

**Princípio:** o dono paga pelo que o cliente **realmente consumiu** em LLM RadarZap. Premium **não** é cobrado em dobro automaticamente; o multiplicador 2× é só planejamento na escolha do modo.

---

## Franquia por plano

Definido em `src/types/ai-wallet.ts` → `getAiWalletPlanLimits(plan)`.

| Plano | Créditos IA/mês | Ops aprendizagem/mês |
|-------|-----------------|----------------------|
| Free | 0 | 0 |
| Starter | 400 | 30 |
| Pro | 2.500 | 120 |
| Enterprise | 12.000 | 500 |

Chamadas LM (limites técnicos, `getAiPlanLimits` em `src/types/ai-assistant.ts`):

| Plano | Diário | Mensal | Por conversa |
|-------|--------|--------|--------------|
| Starter | 30 | 400 | 20 |
| Pro | 120 | 2.500 | 40 |
| Enterprise | 500 | 12.000 | 60 |

---

## Conversão custo → crédito

`src/types/ai-credits.ts`:

- **`AI_CREDIT_USD_UNIT = 0.01`** — 1 crédito ≈ US$ 0,01 de custo estimado de LLM.
- **`aiCreditsFromActualCost(usd)`** — débito após cada chamada: `custo / 0.01`.
- Registro em `AiUsage.creditWeight` (coleção `aiUsage`).

**Chave própria** (`mode: company`): `creditWeight = 0` — não debita carteira RadarZap; limites contam **chamadas** da API da empresa.

**IA Básica — fallback LLM** na triagem: sempre usa chave RadarZap (`radarzap-basic-triage`), debita créditos mesmo se o Premium estiver em chave própria.

---

## Expectativa por módulo (somente UI)

`AI_MODULE_CREDIT_ESTIMATE` em `src/types/ai-credits.ts`:

| Módulo | Badge no painel | Significado |
|--------|-----------------|-------------|
| IA Básica | ~1 crédito/atendimento típico | Projeção ao escolher modo; triagem local/KB sem LLM = 0. |
| IA Premium | ~2 créditos/atendimento típico | Projeção de turnos conversacionais mais longos. |

Não entra no cálculo de débito — apenas orienta o dono na configuração.

---

## Carteira e bloqueio

### Modelo `Organization.aiWallet`

```ts
{
  purchasedCredits: number;   // extras comprados (Stripe futuro)
  learningOpsUsed: number;    // ops de aprendizagem no ciclo
  periodStart: Date;          // início do ciclo mensal
}
```

### Serviço `AiWalletService`

| Método | Função |
|--------|--------|
| `getSnapshot(clientId, creditsUsedMonth)` | Saldo, gasto, franquia, aprendizagem |
| `canSpendLlmCredits(wallet, pending)` | Bloqueia LLM RadarZap se saldo insuficiente |
| `canRunLearning(wallet)` | Bloqueia skill/memória aprendida se cota esgotada |
| `recordLearningOp(clientId, kind)` | +1 op ao propor skill ou memória |
| `addPurchasedCredits(clientId, amount)` | Recarga manual / futuro checkout |

### Quando o saldo esgota

1. LLM na chave RadarZap é **bloqueado** (`AiProviderService` / `AiUsageMeterService`).
2. Mensagem orienta: **recarregar** em Planos, **comprar créditos** ou **API própria** (`/platform/inbox/ia` → Provedor).
3. Alerta crítico no painel (`panel-critical-alerts.service` → `ai:quota_exceeded` / `ai:quota_low`).

### Fluxo de débito (ético)

```txt
Antes do LLM  → verifica carteira (pending ≈ custo típico do modelo)
              → verifica limite diário/mensal de CHAMADAS (1 por resposta)
Depois do LLM → grava AiUsage com creditWeight = custo real proporcional
Aprendizagem  → +1 learningOpsUsed (se dentro da cota)
```

Arquivos: `AiUsageMeterService.ts`, `AiProviderService.ts`, `AiSkillService.proposeFromConversation`, `AiMemoryService.proposeFromConversation`.

---

## API painel

| Método | Rota | Permissão | Resposta |
|--------|------|-----------|----------|
| GET | `/api/platform/ai/balance` | `inbox:ai:balance:view` | `{ wallet, llm }` — header e dono |
| GET | `/api/platform/ai/settings` | `inbox:ai:manage` | Payload completo IA Atendimento |
| GET | `/api/platform/ai/usage` | `inbox:ai:manage` | Logs + totais de créditos |
| GET | `/api/inbox/whatsapp-status` | `inbox:view` | Status WA da empresa (sem gestão de sessão) |

### `/api/platform/ai/balance`

```json
{
  "wallet": {
    "monthlyIncluded": 12000,
    "purchased": 0,
    "totalAllowance": 12000,
    "usedThisMonth": 2.1,
    "balance": 11997.9,
    "learningUsed": 3,
    "learningLimit": 500,
    "learningBalance": 497,
    "depleted": false,
    "learningDepleted": false,
    "actionHint": null
  },
  "llm": {
    "dailyUsed": 5,
    "dailyLimit": 500,
    "monthlyUsed": 12,
    "monthlyLimit": 12000,
    "meteringMode": "radarzap_calls"
  }
}
```

### `/api/inbox/whatsapp-status`

```json
{
  "status": "connected",
  "connected": true,
  "phoneNumber": "5511976904921",
  "profileName": "Empresa"
}
```

Usa `WhatsAppService.getSessionDetails` via `buildTenantSessionEntry` — **não** exige `whatsapp:session:view`.

---

## Barra superior do painel

Componente: `frontend/src/components/layout/HeaderStatusPills.tsx`

Integrado em `Header.tsx` (substitui a antiga `ContextBar` separada).

| Pill | Quem vê | Formato | Link |
|------|---------|---------|------|
| **WhatsApp** | `inbox:view` | Número + bolinha verde | `/sessions` (dono/admin) ou `/platform/inbox` (atendente) |
| **IA** | `inbox:ai:balance:view` | `usado/franquia` ex. `IA 2.1/12000` | `/platform/inbox/ia` |
| **LM** | `inbox:ai:balance:view` | `usado/limite` ex. `LM 12/12000` | `/platform/inbox/ia` |

Tooltip IA: gasto, franquia e **saldo restante**.

Alerta âmbar quando uso ≥ 90% da franquia; vermelho quando esgotado.

---

## Permissões (RBAC)

Nova capability: **`inbox:ai:balance:view`** — *"Ver saldo IA/LM na barra"*.

| Papel | `inbox:ai:balance:view` | `inbox:view` (WA status) |
|-------|-------------------------|---------------------------|
| Dono | ✅ | ✅ |
| Admin | ✅ | ✅ |
| Gerente | ✅ | ✅ |
| Atendente | ❌ (padrão) | ✅ |
| Custom | Dono marca em Equipe → Permissões | conforme `inbox:view` |

Grupo no painel de permissões: **Gestão Inbox** (`companyRolePresets.ts` → `inbox_gestao`).

Label UI: `TeamPermissionsEditor.tsx` → `'inbox:ai:balance:view': 'Ver saldo IA/LM na barra'`.

**Atendente** vê WhatsApp conectado/desconectado, mas **não** vê créditos IA/LM salvo o dono liberar explicitamente.

---

## UI — IA Atendimento (`/platform/inbox/ia`)

| Área | Conteúdo |
|------|----------|
| Cards de modo | Badges ~1× / ~2× (expectativa) |
| Carteira | Saldo, gasto/franquia, comprados, aprendizagem |
| Alerta | Saldo esgotado → link Planos + API própria |
| Aba Limites | Limites em chamadas LM; texto sobre créditos proporcionais |
| Aba Logs | Coluna **Créditos** por linha (gasto real) |
| Economia e regras | Contador aprendizagem `usado/limite` |

---

## Inbox — card WhatsApp

`Inbox.tsx` usa `GET /inbox/whatsapp-status` (não `/sessions`) para o card **On/Off** na grade de métricas — funciona para atendentes.

---

## Arquivos principais

| Camada | Arquivo |
|--------|---------|
| Tipos crédito | `src/types/ai-credits.ts` |
| Tipos carteira | `src/types/ai-wallet.ts` |
| Org | `src/models/Organization.ts` (`aiWallet`) |
| Uso LLM | `src/models/AiUsage.ts` (`creditWeight`) |
| Medição | `src/services/ai/AiUsageMeterService.ts` |
| Carteira | `src/services/ai/AiWalletService.ts` |
| Gate LLM | `src/services/ai/AiProviderService.ts` |
| Header UI | `frontend/.../HeaderStatusPills.tsx` |
| Testes | `src/utils/__tests__/ai-credits.test.ts`, `ai-wallet.test.ts` |

---

## Roadmap (não implementado)

- Checkout Stripe para **pacotes de créditos extras** (`addPurchasedCredits`).
- Página em `/plans` com pacotes de recarga IA.
- Admin: ajuste manual de franquia enterprise por cliente.

---

## Checklist QA manual

1. **Dono** — barra mostra `IA usado/total` e `LM usado/limite`; tooltip com saldo.
2. **Atendente** — vê pill WhatsApp conectado; **não** vê IA/LM (sem permissão).
3. **Dono** — libera `inbox:ai:balance:view` a papel custom → atendente passa a ver pills IA/LM após re-login.
4. **LLM RadarZap** — após esgotar carteira, IA bloqueia com mensagem de recarga/API própria.
5. **Aprendizagem** — ao esgotar cota mensal, `proposeFromConversation` não cria skill/memória (silencioso).
6. **Chave própria** — chamadas não debitam `creditWeight`; limites em chamadas.
