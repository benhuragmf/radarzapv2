# Radar Chat — TOP 06/20 — Modos de Atendimento

**Data:** 2026-06-24  
**Versão após TOP 06:** `2.11.92`  
**Branch:** `main`

---

## Resumo executivo

O TOP 06 consolidou os **modos oficiais de atendimento** do Radar Chat: `disabled` (humano/manual), `robotic`, `basic_triage`, `premium_assistant` e **`hybrid`** (implementado de forma mínima e segura). O tipo central `attendance-mode.ts` ganhou normalizador, helpers de cadeia (menu/triagem/premium), separação explícita modo × provedor × créditos × fila, fallback humano documentado e testado, e correção do modo `disabled` para não exibir menu robotizado no WhatsApp.

**Gates:** typecheck, build, 609 testes, `qa:atendimento:gate`, build frontend — verdes.

---

## Herança dos TOPs anteriores

### TOP 01

Modos `disabled`, `robotic`, `basic_triage`, `premium_assistant` existiam; `hybrid` ausente; risco de confusão entre `attendanceMode` e `AiSettings.mode` legado; fallback IA mal definido em alguns caminhos.

### TOP 02

Baseline verde; gates obrigatórios para mudanças em atendimento.

### TOP 03

Matriz comercial; IA Créditos por plano (Free 0, Trial 100, Starter 400, Pro 2500, Enterprise 12000). Recarga IA → TOP 16; billing → TOP 17.

### TOP 04

RBAC/equipe; supervisor operacional; limites de equipe por plano.

### TOP 05

Somente `online` recebe novo atendimento; `supervisor_online` não recebe fila; limite simultâneo por plano; fila segura.

### Esta etapa fecha

Modos oficiais, adapter legado, modo híbrido mínimo, separação modo/provedor/créditos/fila, fallback humano, testes, documentação.

### Esta etapa não faz

Billing novo, recarga IA (TOP 16), gateway PIX (TOP 17), redesign Inbox/WebChat, alteração profunda de presença/fila, declaração de produção pronta.

---

## Estado Git inicial

| Item | Valor |
|------|-------|
| Branch | `main` |
| Último commit antes | `a584dd3` — `chore(top): status presenca e fila segura 2.11.91` |
| Arquivos modificados antes | Nenhum (working tree limpo exceto untracked) |
| Untracked (não commitados) | `data/`, `mocker/modelochat/` |
| Risco de misturar alterações | Baixo |

---

## Escopo autorizado

Tipos de modo, adapter/backfill, roteamento humano/robô/IA Básica/IA Premium/híbrido, fallback, UI mínima (`AiAtendimento`), testes, documentação.

---

## Diagnóstico atual dos modos

| Item | Existe? | Arquivo | Observação |
|------|---------|---------|------------|
| Tipo central `attendanceMode` | Sim | `src/types/attendance-mode.ts` | 5 modos + helpers TOP 06 |
| Adapter legado `AiSettings.mode` | Sim | `attendance-mode.ts`, `AiSettingsService.ts` | Precedência: `attendanceMode` > legado > `disabled` |
| Backfill/lazy migration | Sim | `AiSettingsService.getSettingsDoc` | `syncAttendanceModeFromLegacy` |
| Labels frontend | Sim | `frontend/src/lib/attendanceMode.ts` | Card híbrido + humano/manual |
| API salvar modo | Sim | `PATCH /platform/ai/settings` | `attendanceSettingsPatchFromSelection` |
| WebChat usa modo | Sim | `WebChatService.runVisitorAutomationPipeline` | disabled → fila; híbrido encadeado |
| WhatsApp usa modo | Sim | `InboxService` BOT_TRIAGE | Rotas por modo; híbrido dedicado |
| Inbox usa modo | Sim | `InboxService` | Humano, robô, IA, híbrido |
| Testes existentes | Sim | `attendance-mode.test.ts`, webchat robotic/basic | +7 casos híbrido/normalizador |
| Modo híbrido | Sim | Tipo + fluxo WA/WebChat | Mínimo seguro |
| Fallback humano | Sim | `routeHumanOnlyFromBotTriage`, `escalateToQueue` | Testado indiretamente |
| Fallback crédito IA | Sim | `shouldRunGenerativeAi`, `AiUsageMeterService` | Sem crédito → humano/fila |

---

## Modos oficiais

| Código | Nome no produto | Objetivo |
|--------|-----------------|----------|
| `disabled` | Humano/manual | Sem robô nem IA; fila humana direta |
| `robotic` | Robotizado | Menu numerado, setores, sem LLM |
| `basic_triage` | IA Básica | Classificar e encaminhar; local-first |
| `premium_assistant` | IA Premium | Assistente conversacional com fallback |
| `hybrid` | Híbrido | Menu → triagem básica → premium opcional → humano |

---

## Separação entre modo, provedor IA, créditos e fila

```
attendanceMode = basic_triage | premium_assistant | hybrid | robotic | disabled
aiProvider/credential = radarchat | company | none  (AiSettings.mode legado)
aiCredits = carteira mensal / metering (AiUsageMeterService)
queue/presence = TOP 05 — somente online recebe fila
department = setor de encaminhamento (InboxDepartment)
```

Trocar modo **não** apaga credencial. Modos `disabled` e `robotic` **não** consomem IA mesmo com provedor configurado.

---

## Modo humano/manual

- Não chama robô nem IA no WebChat (`escalateToQueue` direto).
- WhatsApp: `routeHumanOnlyFromBotTriage` — `WAITING_QUEUE` + round-robin (TOP 05).
- Não consome IA Créditos.

---

## Modo robotizado

- Menu `buildInboxTriageMenu` / `parseInboxMenuChoice`.
- Sem LLM; `mode: disabled, enabled: false` no legado.
- Opção inválida → hint; pedido humano via opção de menu.
- WebChat e WhatsApp.

---

## IA Básica

- `AiBasicTriageService` / `WebChatBasicTriageService`.
- Classificador local `classifyLocal`; LLM opcional só com flag e crédito.
- Confiança baixa → humano/fila ou clarify (não conversa longa).
- No híbrido: passa para premium se não resolver.

---

## IA Premium

- `AiConversationService` + `effectiveWebChatPremiumAi`.
- KB, skills, transfer rules, metering.
- Falha/crédito/pedido humano → fila (`shouldEscalate`, `routeHumanOnlyFromBotTriage`).

---

## Modo híbrido

**Status:** implementado (mínimo seguro).

1. Menu robotizado quando opção válida ou primeira interação.
2. Texto livre → triagem básica (`modeUsesBasicTriageChain`).
3. Se credencial ativa → IA Premium (`shouldRunGenerativeAi`).
4. Falha em qualquer etapa → fila humana.
5. WebChat: `runVisitorAutomationPipeline`; WA: `handleHybridBotTriage`.
6. Texto livre no menu híbrido **não** repete hint inválido (pass-through).

---

## Regras de fallback

| Situação | Fallback |
|----------|----------|
| IA indisponível | humano/fila |
| Crédito IA zerado | triagem local ou humano/fila |
| Confiança baixa | humano/fila ou clarify (básica) |
| Cliente pede humano | humano/fila |
| Opção inválida (robotic) | hint; híbrido → triagem |
| Nenhum atendente online | fila + mensagem espera (TOP 05) |
| Fora de horário | mensagem configurada |
| Erro inesperado | humano/fila + log |

---

## Compatibilidade com empresas legadas

- `resolveAttendanceMode`: campo persistido > inferência de `mode` legado.
- `radarchat`/`company` sem `attendanceMode` → `premium_assistant`.
- `disabled` legado → `disabled`.
- Valor inválido → `normalizeAttendanceMode` → `disabled`.

---

## WebChat e WhatsApp

| Modo | WebChat | WhatsApp |
|------|---------|----------|
| disabled | Fila direta | Fila direta |
| robotic | Menu robotizado | `handleStandardBotTriage` |
| basic_triage | Triagem básica | `AiBasicTriageService` |
| premium_assistant | IA Premium widget | `AiConversationService` |
| hybrid | Pipeline encadeado | `handleHybridBotTriage` |

Bridge WA e comandos `!` não alterados nesta etapa.

---

## Correções ou ajustes aplicados

- `disabled` no WhatsApp não caía mais em menu robotizado.
- Modo híbrido adicionado ao tipo, schema Mongo, UI e fluxos.
- `isAiActive` e `shouldRunGenerativeAi` incluem híbrido com credencial.
- `attendanceSelectionFromSettings` preserva credencial no híbrido.
- Pipeline WebChat unificado `runVisitorAutomationPipeline`.

---

## Testes criados ou atualizados

- `src/types/__tests__/attendance-mode.test.ts` — 16 casos (+ híbrido, normalizador, helpers).
- `src/services/webchat/__tests__/webchat-robotic-triage.service.test.ts` — +2 híbrido.
- `e2e/attendance-modes.spec.ts` — 5 modos na UI.

Total projeto: **609** testes (`npm test`).

---

## Gates executados

```bash
npm run typecheck          # verde
npm run build              # verde
npm test                   # 609 passed
npm run qa:atendimento:gate # verde
cd src/services/web-dashboard/frontend && npm run build  # verde
```

---

## Arquivos alterados

| Área | Arquivos principais |
|------|---------------------|
| Tipos | `src/types/attendance-mode.ts` |
| IA | `AiBasicTriageService.ts`, `AiSettingsService.ts` |
| Inbox | `InboxService.ts` |
| WebChat | `WebChatService.ts`, `webchat-robotic-triage.service.ts`, `webchat-basic-triage.service.ts`, `WebChatAiService.ts` |
| Frontend | `attendanceMode.ts`, `AiAtendimento.tsx`, `AttendanceModePicker.tsx` |
| Testes | `attendance-mode.test.ts`, `webchat-robotic-triage.service.test.ts`, `e2e/attendance-modes.spec.ts` |
| Versão | `package.json` → `2.11.92` |
| Docs | Este arquivo, `CHANGELOG.md`, `SISTEMA-REGISTRO.md`, `INDICE-DOCUMENTACAO.md` |

---

## Riscos reduzidos

- Confusão modo vs provedor documentada e refletida na UI.
- `disabled` não disfarçava menu robotizado no WA.
- Híbrido com pass-through evita loop de hint inválido.
- Valor inválido de modo não quebra runtime.

---

## Riscos restantes

- Híbrido no WA sem teste de integração dedicado (cobertura unitária + gate existente).
- Empresas legadas em `premium_assistant` implícito continuam como antes — validar QA manual por tenant.
- Recarga/carteira IA ainda depende de TOP 16 para produto comercial completo.

---

## Decisões pendentes para Benhur

1. Híbrido deve exibir IA Básica LLM fallback por padrão ou só local no primeiro release?
2. Modo `disabled` no WebChat deve enviar mensagem de boas-vindas antes da fila?
3. Prioridade do TOP 07 na sequência oficial dos 20 passos.

---

## Próximo passo recomendado

**TOP 07** — conforme roteiro em `docs/top/` (consultar `RADARCHAT-TOP-01-DIAGNOSTICO-INICIAL.md` para escopo da próxima etapa). Manter gates verdes; não avançar billing (TOP 17) nem recarga IA (TOP 16) antes da hora.
