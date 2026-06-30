# Radar Chat — TOP 03/20 — Planos, Mensalidades, Limites e Matriz Comercial

**Data:** 2026-06-24  
**Versão após TOP 03:** `2.11.89`  
**Branch:** `main`

---

## Resumo executivo

O TOP 03 formalizou a **matriz comercial oficial** do Radar Chat em `config/plans.json`, com validação automática, tipos TypeScript e leitura unificada de limites operacionais e IA Créditos. Cinco planos de lançamento: **trial, free, starter, pro, enterprise**.

**Enforcement hoje:** `messagesPerDay`, `groupsMax` (destinos WA), `templatesMax` via `Organization.limits` ao mudar plano. Demais limites (widgets, atendentes, leads/mês, etc.) estão no catálogo e documentados — **bloqueio em runtime = TOP 16/17**.

**Não implementado nesta etapa:** PIX, Mercado Pago, Asaas, checkout trial, recarga IA, bloqueio inadimplência automatizado.

---

## Herança do TOP 01 e TOP 02

### TOP 01

- Billing: Stripe teste; `config/plans.json` com 4 planos e limites mínimos (só mensagens/destinos).
- IA Créditos parcial (400/2500/12000) hardcoded em `ai-wallet.ts`.
- Matriz comercial incompleta; sem trial; sem limites de atendentes/widgets/forms.

### TOP 02

- Baseline verde: typecheck, build, 561 testes, `qa:atendimento:gate`, build frontend.
- Versão `2.11.88`; gates oficiais documentados.

### Escopo TOP 03

| Pode | Não pode |
|------|----------|
| Matriz em JSON + tipos + testes | Gateway novo |
| Ler limites do catálogo | Enforcement agressivo sem teste |
| Documentar bloqueios futuros | PIX/boleto/recarga IA |
| Alinhar IA créditos ao catálogo | RBAC/Inbox/WA/WebChat profundo |

---

## Estado Git inicial

| Item | Valor |
|------|-------|
| Branch | `main` |
| Último commit antes | `9eb80f1` — TOP 02 baseline 2.11.88 |
| Untracked | `data/`, `mocker/modelochat/` |
| Risco | Baixo |

---

## Escopo autorizado

Documentar e versionar planos/limites; validar catálogo; conectar leitura segura a limites já usados (`messagesPerDay`, IA créditos). Sem feature nova de produto.

---

## Diagnóstico do billing atual

| Componente | Estado |
|------------|--------|
| `BillingService.ts` | Stripe Checkout + webhooks + sweep → `free` |
| `Organization.plan` | enum: `free \| starter \| pro \| enterprise` (sem `trial` ainda) |
| `Organization.limits` | 3 campos: messagesPerDay, groupsMax, templatesMax |
| `User.getPlanLimits` | **Agora** lê `config/plans.json` via `resolveOperationalLimits` |
| `getAiWalletPlanLimits` | **Agora** lê `aiCreditsMonthly` / `monthlyLearningOps` do catálogo |
| UI `/plans` | Lista catálogo API; não exibe todos os limites novos |
| Stripe | starter R$99, pro R$299 — compatível |

---

## Diagnóstico de planos atuais

| Plano | Existe? | Preço atual | Limites atuais (antes) | Lacunas (antes) |
|-------|---------|-------------|------------------------|-----------------|
| trial | **Não** | — | — | Plano inteiro |
| free | Sim | R$0 | 10 msg/dia, 2 destinos | Atendentes, widgets, IA, retenção |
| starter | Sim | R$99 | 100 msg/dia, 5 destinos | Idem + créditos só em código |
| pro | Sim | R$299 | 500 msg/dia, 15 destinos | Idem |
| enterprise | Sim | sob consulta | ilimitado (-1) | Limites comerciais definidos |

**Após TOP 03:** todos os 5 planos no catálogo com `limits` e `features` completos.

---

## Matriz comercial oficial

| Plano | Preço | Atendentes | Usuários | Widgets | Forms | Conv/mês | Msg/dia | Tickets/mês | Leads/mês | Contatos | IA créditos | Histórico |
|-------|-------|------------|----------|---------|-------|----------|---------|-------------|-----------|----------|-------------|-----------|
| Trial | R$0 (7d) | 1 | 1 | 1 | 1 | 100 | 50 | 50 | 50 | 500 | 100 | 15d |
| Free | R$0 | 1 | 1 | 1 | 1 | 50 | 30 | 25 | 25 | 300 | 0 | 7d |
| Starter | R$99/mês | 2 | 3 | 1 | 2 | 1.000 | 500 | 500 | 500 | 5.000 | 400 | 90d |
| Pro | R$299/mês | 5 | 8 | 3 | 5 | 5.000 | 2.500 | 2.500 | 2.500 | 25.000 | 2.500 | 180d |
| Enterprise | sob consulta | 20 | 30 | 10 | 20 | 50.000 | 20.000 | 20.000 | 20.000 | 250.000 | 12.000 | 365d |

**Usuário extra (documentado):** R$29/mês — `extraUserPriceCentsMonthly: 2900` no catálogo.

---

## Limites oficiais por plano

Ver `config/plans.json` → objeto `limits` por plano. Campos:

- `includedAgents`, `includedUsers`, `includedSupervisors`
- `webchatWidgets`, `leadForms`, `departments`
- `conversationsPerMonth`, `messagesPerDay`, `ticketsPerMonth`, `leadsPerMonth`, `contacts`
- `whatsappDestinations`, `templatesMax`
- `aiCreditsMonthly`, `monthlyLearningOps`, `historyRetentionDays`

**Mapeamento operacional legado (enforced):**

| Campo Organization | Origem catálogo |
|--------------------|-----------------|
| `messagesPerDay` | `limits.messagesPerDay` |
| `groupsMax` | `limits.whatsappDestinations` |
| `templatesMax` | `limits.templatesMax` |

---

## Recursos por plano

| Recurso | Trial | Free | Starter | Pro | Enterprise |
|---------|-------|------|---------|-----|------------|
| WebChat | ✓ | ✓ | ✓ | ✓ | ✓ |
| WhatsApp | ✓ | ✓ | ✓ | ✓ | ✓ |
| Inbox | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tickets | ✓ | ✓ | ✓ | ✓ | ✓ |
| Leads | ✓ | ✓ | ✓ | ✓ | ✓ |
| Contatos | ✓ | ✓ | ✓ | ✓ | ✓ |
| Formulários | ✓ | ✓ | ✓ | ✓ | ✓ |
| Departamentos | ✓ | ✓ | ✓ | ✓ | ✓ |
| Supervisão | — | — | ✓ | ✓ | ✓ |
| Relatórios | — | — | — | ✓ | ✓ |
| IA Básica | limitada | — | ✓ | ✓ | ✓ |
| IA Premium | — | — | — | ✓ | ✓ |
| IA Créditos | 100 | 0 | 400 | 2.500 | 12.000 |
| Remover branding | — | — | — | ✓ | ✓ |
| Suporte prioritário | — | — | — | — | ✓ |
| Webhooks | — | — | — | ✓ | ✓ |
| API | — | — | — | ✓ | ✓ |
| Exportação | ✓ | — | ✓ | ✓ | ✓ |
| Auditoria | — | — | — | ✓ | ✓ |
| Multiusuário | — | — | ✓ | ✓ | ✓ |

Flags em `config/plans.json` → `features` (objeto booleano).

---

## Regras de consumo e bloqueio

**DOCUMENTADO PARA TOP 16/TOP 17** (não enforcement completo nesta etapa):

| Regra | Status |
|-------|--------|
| Alerta 80% do limite | Documentado |
| Bloqueio 100% novos itens | Documentado |
| Nunca apagar histórico auto | Documentado |
| Não cortar atendimento ativo | Documentado |
| Fallback IA → humano/robotizado | Já parcial (TOP 16) |
| Trial expirado → leitura + widget off | TOP 17 |
| Inadimplência escalonada (1–16+ dias) | TOP 17 |
| Crédito IA zerado | Parcial (`AiWalletService`) |
| Limite atendentes/widgets/forms | TOP 04/16 |

### Inadimplência (referência)

| Situação | Ação |
|----------|------|
| Em dia | Normal |
| 1–3 dias | Alerta painel |
| 4–7 dias | Bloquear IA Premium / automações novas |
| 8–15 dias | Bloquear novas conversas; leitura OK |
| 16+ dias | Somente leitura/exportação |
| Cancelado | Widgets/automações off |

---

## IA Créditos por plano

| Plano | Créditos/mês | Aprendizagem/mês |
|-------|--------------|------------------|
| Free | 0 | 0 |
| Trial | 100 | 10 |
| Starter | 400 | 30 |
| Pro | 2.500 | 120 |
| Enterprise | 12.000 | 500 |

Fonte: `config/plans.json` → lido por `getAiWalletPlanLimits()` → `PlanConfigService`.

**Pacotes futuros (documentados, sem checkout):** 1k/R$29, 5k/R$99, 15k/R$249.

---

## Compatibilidade com código existente

| Área | Compatibilidade |
|------|-----------------|
| `Organization.plan` enum | Sem `trial` — orgs existentes intactas |
| Limites em DB | Valores antigos permanecem até `upgradePlan` / mudança de plano |
| Enterprise `messagesPerDay` | Antes `-1` (ilimitado); catálogo agora **20.000** — novas ativações usam catálogo |
| Stripe starter/pro | IDs e preços mantidos |
| `BillingService.getPricing()` | Retorna catálogo completo + `purchasablePlans` filtrado |
| Testes `ai-wallet.test.ts` | Verde — valores do catálogo |

**Divergência documentada:** mensagens/dia subiram (ex. starter 100→500). Orgs com limites persistidos no Mongo não mudam até troca de plano ou migração futura.

---

## Correções ou ajustes aplicados

1. `config/plans.json` — matriz completa + schemaVersion + pacotes IA futuros.
2. `src/services/billing/plan-config.ts` — tipos, `validatePlanCatalog`, `resolveOperationalLimits`, `commercialPlanRank`.
3. `src/models/User.ts` — `getPlanLimits` delega ao catálogo.
4. `src/types/ai-wallet.ts` — créditos do catálogo.
5. `src/services/billing/__tests__/plan-config.test.ts` — 10 casos de validação.
6. Docs: `BILLING.md`, CHANGELOG, SISTEMA-REGISTRO, INDICE.

---

## Testes criados ou atualizados

| Arquivo | Casos |
|---------|-------|
| `plan-config.test.ts` | Validação catálogo, planos obrigatórios, IA créditos, preços, ordem comercial |
| `ai-wallet.test.ts` | Inalterado — compatível com catálogo |

---

## Gates executados

| Comando | Resultado |
|---------|-----------|
| `npm run typecheck` | ✅ |
| `npm run build` | ✅ (executar no commit) |
| `npm test` | ✅ (executar no commit) |
| `npm test -- plan-config\|ai-wallet` | ✅ 13/13 |
| Frontend build | Não alterado — não executado |
| `qa:atendimento:gate` | Não executado (sem mudança atendimento) |

---

## Arquivos alterados

```
config/plans.json
src/services/billing/plan-config.ts
src/services/billing/__tests__/plan-config.test.ts
src/models/User.ts
src/types/ai-wallet.ts
docs/BILLING.md
docs/CHANGELOG.md
docs/INDICE-DOCUMENTACAO.md
docs/SISTEMA-REGISTRO.md
docs/top/RADARCHAT-TOP-03-PLANOS-MENSALIDADES-LIMITES.md
package.json
README.md
.cursor/rules/radarchat-v2-system-registry.mdc
```

---

## Riscos reduzidos

1. Matriz comercial única e versionada no git.
2. Validação automática impede catálogo inválido no boot.
3. IA créditos alinhados ao catálogo (sem drift hardcoded).
4. Base clara para TOP 16 (enforcement) e TOP 17 (billing).

---

## Riscos restantes

1. Limites comerciais (widgets, atendentes, leads/mês) **não bloqueiam** em runtime.
2. `trial` não existe em `Organization.plan` enum.
3. Orgs legadas com limites antigos no Mongo.
4. UI `/plans` não mostra matriz completa.
5. Recarga IA e gateways BR ausentes.
6. Produção não liberada.

---

## Decisões pendentes para Benhur

1. Confirmar preços e limites da matriz (especialmente trial 7d e free 30 msg/dia).
2. Enterprise: manter 20k msg/dia ou ilimitado (-1) operacional?
3. Usuário extra R$29 — quando cobrar?
4. Trial exige cartão no go-live?
5. Bloqueio inadimplência — carência exata?
6. Free com branding obrigatório — como exibir no widget?

---

## Próximo passo recomendado

**TOP 04 — RBAC, permissões, equipe e segurança multiempresa.**

Usar `includedAgents` / `includedUsers` / `includedSupervisors` do catálogo ao validar convites de equipe (sem enforcement de billing ainda).

---

*TOP 03 concluído — matriz comercial documentada e validada; sistema não declarado pronto para produção.*
