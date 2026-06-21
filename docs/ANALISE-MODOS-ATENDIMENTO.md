# RELATÓRIO DE ANÁLISE — RADARZAP MODOS DE ATENDIMENTO

**Versão analisada:** `2.10.105` (`package.json`)  
**Data da análise:** 2026-06-19  
**Escopo:** somente leitura — nenhuma implementação de código  
**Objetivo:** mapear o que já existe antes de evoluir para 4 modos de atendimento + separação modo × provedor

---

## Índice

1. [Status geral](#1-status-geral)
2. [Stack identificada](#2-stack-identificada)
3. [Arquitetura atual](#3-arquitetura-atual)
4. [Mapa de arquivos importantes](#4-mapa-de-arquivos-importantes)
5. [O que já existe](#5-o-que-já-existe)
6. [O que está parcial](#6-o-que-está-parcial)
7. [O que está ausente](#7-o-que-está-ausente)
8. [Compatibilidade com os 4 modos](#8-compatibilidade-com-os-4-modos)
9. [Separação entre modo e provedor](#9-separação-entre-modo-e-provedor)
10. [Banco de dados](#10-banco-de-dados)
11. [Backend — endpoints](#11-backend--endpoints)
12. [Frontend — telas](#12-frontend--telas)
13. [Custos e limites](#13-custos-e-limites)
14. [Segurança](#14-segurança)
15. [Testes existentes](#15-testes-existentes)
16. [Riscos antes de implementar](#16-riscos-antes-de-implementar)
17. [Melhor caminho recomendado](#17-melhor-caminho-recomendado)
18. [O que NÃO fazer agora](#18-o-que-não-fazer-agora)
19. [Conclusão](#19-conclusão)

---

## 1. Status geral

O RadarZap v2 é um sistema **maduro e quase completo** para atendimento WhatsApp + WebChat + Inbox, com camada de IA já funcional em código (não só mock de UI).

O que **não existe** hoje é um conceito unificado de **“modo de atendimento”** com os 4 níveis desejados. O campo `AiSettings.mode` (`radarzap` | `company` | `disabled`) mistura **provedor/credencial** com **ligar/desligar IA**, enquanto o **bot robotizado** (menu 1–2–3–4) vive em outro lugar (`InboxSettings` + `inbox-triage`), independente da tela de IA.

| Conceito desejado | Situação atual |
|---|---|
| Desativado | Parcial — `mode: disabled` desliga LLM; bot WA e fila continuam |
| Robotizado | **Forte no WhatsApp**; **fraco/ausente no WebChat** |
| IA Básica (triagem barata) | Parcial — regras locais + heurísticas; sem orquestrador nem classificador JSON dedicado |
| IA Premium | **Forte** — equivale ao que hoje é “IA ativa” com KB/skills/memória |

---

## 2. Stack identificada

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js + TypeScript |
| Backend HTTP | Express (`DashboardService.ts`, `APIGateway`) |
| Banco | **MongoDB** via Mongoose (`src/models/`) — sem Prisma/Sequelize/migrations SQL |
| Cache/filas | Redis + BullMQ |
| WhatsApp | Baileys (`@whiskeysockets/baileys`) — `WhatsAppService` |
| Discord | discord.js — `DiscordBotService` |
| Frontend painel | **React 18 + Vite** em `src/services/web-dashboard/frontend/` |
| Estado UI | TanStack Query, React Router |
| Design system | `frontend/src/design-system/` (tokens `--rz-*`) |
| Testes backend | **Jest** (~69 arquivos `*.test.ts` em `src/`) |
| E2E | **Playwright** (`e2e/`, 3 specs) |
| Auth painel | express-session + Discord OAuth |
| API externa | `/api` + header `X-API-Key` |
| WebChat público | `/api/webchat/public`, `widget.js`, Socket.IO |

### Comandos reais (`package.json`)

| Comando | Função |
|---|---|
| `npm run dev` | Backend principal |
| `npm run dashboard:frontend` | Vite do painel |
| `npm run build` | Build backend |
| `npm test` | Jest |
| `npm run test:e2e` | Playwright |
| `npm run qa:gate` | test + build backend + frontend |
| `npm run qa:webchat-wa` | Subset WebChat + WA |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run docker:infra` | Redis + MongoDB |

### Onde ficam as áreas do projeto

| # | Área | Localização |
|---|---|---|
| 1 | Rotas principais backend | `src/index.ts`, `DashboardService.ts` |
| 2 | Rotas React | `frontend/src/App.tsx` |
| 3 | Componentes painel | `frontend/src/pages/`, `frontend/src/components/` |
| 4 | Serviços IA | `src/services/ai/` |
| 5 | Bot/triagem | `src/services/inbox/`, `src/constants/inbox-triage.ts` |
| 6 | Config widget | `src/models/WebChatWidget.ts`, `frontend/.../WebChat.tsx` |
| 7 | Fluxos WebChat | `src/services/webchat/`, `webchat/widget.js` |
| 8 | Fluxos WhatsApp | `src/services/whatsapp/`, `InboxService` |
| 9 | Setores/chamados/inbox | `src/models/InboxDepartment.ts`, `InboxTicket.ts`, `InboxService` |
| 10 | Tenant/org | `src/models/Organization.ts`, `CompanyMember.ts` |
| 11 | Planos/limites | `Organization.plan`, `getAiPlanLimits()` |
| 12 | Logs/métricas | `AuditLog`, `SystemLog`, `AiUsage` |
| 13 | Schemas/banco | `src/models/*.ts` (Mongoose) |
| 14 | Testes | `src/**/__tests__`, `e2e/` |

---

## 3. Arquitetura atual

Não há um `OrchestratorService` central. A decisão de roteamento é distribuída entre:

- `InboxService` — inbound WhatsApp, bot fixo, fila, assign
- `AiConversationService` — IA no WhatsApp/Inbox
- `WebChatService` — sessão, mensagens, auto-reply
- `WebChatAiService` — IA no widget
- Utilitários: `inbox-triage.ts`, `webchat-ai-triage.util.ts`, `AiEscalationService`, `AiAutoResolveService`

### Fluxo simplificado

```
Cliente envia mensagem
        ↓
   Canal? (WA / WebChat)
        ↓
   Horário comercial / CSAT / consentimento
        ↓
   IA ativa? (AiSettings.enabled + mode !== disabled)
        ↓
   ┌─ Sim → AiAutoResolve (KB/skill sem LLM)?
   │         ↓ miss
   │         AiProviderService (LLM)
   │         ↓
   │         Escalar? → fila / humano / setor
   │
   └─ Não → handleStandardBotTriage (menu 1-2-3-4 setores) [WA]
            WebChat: pré-chat → FAQ → auto-reply fixo ou IA
```

### WebChat — comportamento IA observado

- `autoReplyEnabled` ✅ + `autoReplyUseAi` ❌ (default) → bot envia **uma vez** mensagem fixa; mensagens seguintes **não** disparam bot (exceto IA).
- Para IA contínua: marcar **"Usar IA da empresa"** no widget + IA ativa em **IA Atendimento** (`enabled`, `mode !== disabled`, API key/plano).
- Arquivos: `webchat-bot.util.ts`, `WebChatService.maybeAutoReply()`, `WebChatAiService.getAvailability()`.

---

## 4. Mapa de arquivos importantes

| Área | Arquivo/pasta | Função | Observação |
|---|---|---|---|
| Entry | `src/index.ts` | Sobe WA, Discord, Dashboard, filas | Microserviços por env |
| API painel | `src/services/web-dashboard/DashboardService.ts` | Rotas `/api/*` | Monolito de rotas |
| Rotas React | `frontend/src/App.tsx` | Rotas do painel | |
| Menu | `frontend/src/lib/navConfig.ts` | Sidebar + permissões | |
| IA — UI | `frontend/.../AiAtendimento.tsx` | 12 abas IA | `/platform/inbox/ia` |
| IA — config | `src/models/AiSettings.ts`, `AiPrompt.ts` | Persistência | `mode` mistura conceitos |
| IA — runtime WA | `src/services/ai/AiConversationService.ts` | Fluxo LLM WhatsApp/Inbox | |
| IA — runtime WebChat | `src/services/webchat/WebChatAiService.ts` | IA no widget | Depende `autoReplyUseAi` |
| IA — economia | `src/services/ai/AiAutoResolveService.ts` | KB/skill sem LLM | Score textual |
| IA — KB | `src/services/ai/AiKnowledgeBaseService.ts` | Busca textual | Sem embeddings/RAG vetorial |
| IA — custos | `src/services/ai/AiUsageMeterService.ts` | Limites diário/mensal | Conta chamadas LLM |
| IA — escalação | `src/services/ai/AiEscalationService.ts` | Regras transferência | |
| Bot WA | `src/constants/inbox-triage.ts` | Menu 1–4 setores | `parseInboxMenuChoice` |
| Bot WA | `src/services/inbox/InboxService.ts` | `handleStandardBotTriage` | Fallback quando IA off |
| Bot — textos | `src/models/InboxSettings.ts` | Saudações, menu, horário | Separado de `AiSettings` |
| Bot — UI | `frontend/.../InboxBotSettings.tsx` | Triagem e Bot | `/platform/inbox/bot` |
| WebChat | `src/services/webchat/WebChatService.ts` | Sessão, mensagens, auto-reply | |
| WebChat — widget | `src/services/web-dashboard/webchat/widget.js` | Embed visitante | |
| WebChat — config | `src/models/WebChatWidget.ts` | `autoReplyUseAi`, FAQ, horários | |
| WebChat — UI | `frontend/.../WebChat.tsx` | Editor widget | |
| Setores | `src/models/InboxDepartment.ts` | `menuKey` 1–4 | `clientVisible` |
| Inbox | `src/services/inbox/InboxService.ts` | Lista, assign, transfer | |
| Tickets | `src/models/InboxTicket.ts` | Chamados | |
| Respostas rápidas | `InboxSettings.quickReplies` | Atalhos da equipe (`/bd`) | Não é menu visitante |
| Tenant | `src/models/Organization.ts` | `plan`, papéis custom | `clientId` = org |
| RBAC | `src/auth/rbac/*` | Capabilities | `INBOX_AI_MANAGE` etc. |
| Planos IA | `src/types/ai-assistant.ts` | `getAiPlanLimits(plan)` | free = 0 IA RadarZap |
| Busca textual IA | `src/utils/ai-text-match.ts` | `scoreAiTextMatch` | Sem vetores |
| Testes IA | `src/services/ai/__tests__/` | escalation, auto-resolve | |

---

## 5. O que já existe

### 5.1 IA

| Item | Existe? | Onde | Completo? | Backend? | Banco? | WA? | WebChat? | Testes? |
|---|---|---|---|---|---|---|---|---|
| Config IA tenant | ✅ | `AiSettings`, `AiPrompt` | Completo | ✅ | ✅ | ✅ | ✅ | Parcial |
| Modo operação | ⚠️ | `AiMode`: radarzap/company/disabled | Mistura provedor+on/off | ✅ | ✅ | ✅ | ✅ | — |
| Provedor | ✅ | `AiSettings.provider` | openai/gemini | ✅ | ✅ | ✅ | ✅ | — |
| API Key | ✅ | `encryptedApiKey` + vault | Criptografada | ✅ | ✅ | ✅ | ✅ | — |
| Modelo | ✅ | `llmModel` + catálogo | Completo | ✅ | ✅ | ✅ | ✅ | — |
| Nome assistente | ✅ | `AiPrompt.agentName` | Completo | ✅ | ✅ | ✅ | ✅ | — |
| Saudações | ✅ | `AiPrompt` + blueprint | WA sim; WC parcial | ✅ | ✅ | ✅ | Parcial | — |
| Base conhecimento | ✅ | `AiKnowledgeBase` | Busca por score | ✅ | ✅ | ✅ | ✅ | ✅ |
| Skills | ✅ | `AiSkill` + aprovação | Completo | ✅ | ✅ | ✅ | ✅ | Parcial |
| Memória | ✅ | `AiMemory` + aprovação | Completo | ✅ | ✅ | ✅ | ✅ | Parcial |
| Regras transferência | ✅ | `transferRules` | Completo | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dados a coletar | ✅ | `AiPrompt` | Completo | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auto-resolve (sem LLM) | ✅ | `AiAutoResolveService` | KB + skill | ✅ | ✅ | ✅ | ✅ | ✅ |
| LLM conversacional | ✅ | `AiProviderService` | Completo | ✅ | — | ✅ | ✅ | Parcial |
| Testar IA | ✅ | `POST /platform/ai/test` | Completo | ✅ | — | — | — | — |
| Logs/custos UI | ⚠️ | Aba Logs | Totais apenas | ✅ | ✅ | — | — | — |
| Embeddings/RAG | ❌ | — | — | — | — | — | — | — |
| Classificador JSON | ❌ | — | — | — | — | — | — | — |
| Prompts | ✅ | `AiPrompt`, blueprint | Completo | ✅ | ✅ | ✅ | ✅ | — |
| Fallback | ✅ | `AI_FALLBACK_STANDARD`, auto-reply | Completo | ✅ | — | ✅ | ✅ | ✅ |
| Resumo atendente | ✅ | `AiConversationService` | Parcial | ✅ | — | ✅ | Parcial | — |
| Classificação intenção | ⚠️ | `ticket-client-intent`, heurísticas | Parcial | ✅ | — | ✅ | Parcial | ✅ |

### 5.2 Bot robotizado

| Item | WhatsApp | WebChat |
|---|---|---|
| Menu numérico setores | ✅ `inbox-triage` | ❌ |
| Botões / fluxo guiado | ✅ texto numérico | ❌ menu setorial |
| Respostas fixas | ✅ `InboxSettings` | ✅ `autoReplyMessage` |
| Escolha de setor | ✅ `menuKey` | ⚠️ `defaultDepartmentId` na escalação |
| Opção inválida | ✅ `invalidMenuHint` | ❌ |
| Voltar ao menu | ✅ | ❌ |
| Falar com humano | ✅ escalação | ✅ `aiEscalationPolicy` |
| Abrir chamado | ✅ tickets | ✅ `ticketLookupEnabled` |
| Coletar dados básicos | ✅ via IA/bot | ✅ pré-chat |
| Horário comercial | ✅ | ✅ |
| Sem IA externa | ✅ | ✅ se `autoReplyUseAi=false` |

**Melhor caminho para robotizado:** reaproveitar `inbox-triage` + `handleStandardBotTriage` (WA pronto); estender WebChat com camada pequena — **não** criar fluxo novo do zero.

### 5.3 Triagem, setores, inbox, webchat, WhatsApp

| Domínio | Estado | Onde |
|---|---|---|
| Triagem WA | Completo | `InboxService` + `inbox-triage` |
| Triagem WebChat | Parcial | `webchat-ai-triage.util.ts` |
| Setores | Completo | `InboxDepartment`, UI setores |
| Inbox unificado | Completo | WA + WebChat (`wc:` IDs) |
| Respostas rápidas | Completo (equipe) | `InboxSettings.quickReplies` |
| Automações | Existe | `BirthdayAutomationRule`, `RulesEngine` — não é menu visitante |
| Formulário inicial | Completo | WebChat pré-chat configurável |
| Horário | Completo | `InboxSettings` + `WebChatWidget` |

### 5.4 Custos, logs, limites

| Item | Estado | Onde |
|---|---|---|
| Limite diário/mensal/conversa | Completo | `AiSettings`, `AiUsageMeterService` |
| Limite por plano | Completo | `getAiPlanLimits(Organization.plan)` |
| Bloqueio ao atingir limite | Completo | `AiUsageMeterService` |
| Estimativa custo | Parcial | `ai-model-catalog.ts` |
| Tokens entrada/saída | Parcial | Estimativa; não ledger completo na UI |
| Logs de erro IA | Parcial | `SystemLog` / fluxo interno |
| Simulação custo | Parcial | `estimateTypicalTurnCostUsd` na UI provedor |

---

## 6. O que está parcial

1. **Separação modo × provedor** — UI com 3 radios que misturam os dois conceitos (`AiAtendimento.tsx` aba Geral).
2. **IA Básica** — economia existe (`AiAutoResolveService`, heurísticas WebChat) mas sem modo nomeado nem pipeline “local primeiro, LLM só se confiança baixa”.
3. **Robotizado no WebChat** — FAQ/quick replies da KB ≠ menu 1–2–3–4.
4. **Logs de custo** — contagem de chamadas; tokens/custo por turno não expostos na UI.
5. **Orquestrador único** — lógica duplicada entre WA e WebChat.
6. **Desativado “puro”** — com IA off, WA ainda roda bot fixo (comportamento documentado na UI).
7. **Testes E2E de IA/bot** — smoke de login apenas.
8. **Config “usar IA” duplicada** — global em IA Atendimento + `autoReplyUseAi` no WebChat.

---

## 7. O que está ausente

Confirmado por busca no código (`attendanceMode`, embeddings, orchestrator dedicado):

- Campo `attendanceMode` ou equivalente com os 4 modos.
- Provedor “local/interno” (só `openai` | `gemini` hoje).
- Embeddings / RAG vetorial.
- Classificador estruturado `{ intent, sector, urgency, sentiment, confidence, needs_human }`.
- Menu robotizado no WebChat igual ao WhatsApp.
- Orquestrador central de atendimento.
- Migrations SQL (projeto usa MongoDB + Mongoose).

---

## 8. Compatibilidade com os 4 modos

| Modo | Base existe? | Onde reaproveitar | O que falta | Risco | Recomendação |
|---|---|---|---|---|---|
| **1. Desativado** | Parcial | `mode: disabled`, `enabled: false` | Flag “sem bot” se desejado; alinhar WebChat | Médio | Renomear + documentar; não desligar bot WA sem decisão de produto |
| **2. Robotizado** | Forte (WA) | `inbox-triage`, `InboxSettings`, setores | Réplica no WebChat; toggle único | Médio | Reaproveitar `handleStandardBotTriage`; adaptar WebChat |
| **3. IA Básica** | Parcial | `AiAutoResolveService`, `webchat-ai-triage.util`, `transferRules`, `ticket-client-intent` | Modo dedicado; classificador local; gate LLM | Alto | Camada fina antes do LLM |
| **4. IA Premium** | Forte | `AiConversationService`, KB/skills/memory, limites | Renomear na UI | Baixo | É o comportamento atual da IA ativa |

### Viabilidade por modo (detalhe)

#### 1. Desativado

- Sem IA externa: ✅ (`mode: disabled`).
- Humano/fila/respostas rápidas/chamados: ✅ continuam.
- Mensagens essenciais (saudação, fora de horário): ✅ `InboxSettings`, `WebChatWidget`.
- Custo IA zero: ✅.
- **Gap:** bot fixo WA ainda roda — UI já diz “usa bot fixo, fila e humano”.

#### 2. Atendimento Robotizado

- Menu 1–2–3–4: ✅ WhatsApp (`DEFAULT_INBOX_DEPARTMENTS`, `parseInboxMenuChoice`).
- Exemplo “1 Comercial, 2 Suporte…”: ✅ configurável via setores + textos.
- Sem IA externa: ✅.
- WebChat: ❌ não tem menu numérico equivalente.

#### 3. IA Básica — Triagem Inteligente

- Classificação local sem custo: ⚠️ `scoreAiTextMatch`, `classifyTransferIntent`, keywords.
- Detecta pedido de humano: ✅ `transferRules.onHumanRequest`.
- Detecta irritação/sensível: ✅ regras escalação.
- Só chama LLM em ambiguidade: ❌ não implementado como gate explícito.
- Saída JSON estruturada: ❌ não existe.

#### 4. IA Premium — Assistente Virtual

- Base de conhecimento: ✅.
- Skills/memória aprovadas: ✅.
- Regras empresa: ✅ `AiPrompt`, `transferRules`.
- Limites e logs: ✅ parcial.
- Resumo para humano: ✅ parcial no fluxo WA.

---

## 9. Separação entre modo e provedor

### Campos atuais

```typescript
// src/types/ai-assistant.ts
type AiMode = 'radarzap' | 'company' | 'disabled';
type AiProvider = 'openai' | 'gemini';
```

| Valor atual `mode` | Significado real hoje |
|---|---|
| `disabled` | IA LLM desligada |
| `radarzap` | IA ligada + credencial RadarZap + limites do plano |
| `company` | IA ligada + API key do tenant |

### Proposta compatível (spec — não implementada)

| Novo conceito | Campo sugerido | Valores |
|---|---|---|
| Modo atendimento | `attendanceMode` | `disabled` \| `robot` \| `triage_basic` \| `assistant_premium` |
| Provedor/credencial | renomear semântica de `mode` → `credentialSource` | `radarzap` \| `company` \| `none` |
| Provedor LLM | manter `provider` | `openai` \| `gemini` |

### Mapeamento legado sugerido

| `mode` antigo | `attendanceMode` | `credentialSource` |
|---|---|---|
| `disabled` | `disabled` ou `robot`* | `none` |
| `radarzap` | `assistant_premium` | `radarzap` |
| `company` | `assistant_premium` | `company` |

\*Se quiser manter bot WA ao “desligar IA”, mapear para `robot` em vez de `disabled` puro.

### O que precisa mudar

| Alteração | Necessário? |
|---|---|
| Migration SQL | ❌ (Mongo) |
| Novo campo Mongoose | ✅ recomendado |
| Só enum | ⚠️ insuficiente — `mode` usado em muitos pontos |
| Só UI | ⚠️ labels apenas; comportamento não muda |
| Backend | ✅ para comportamento real |
| Adaptar fluxo mensagens | ✅ gate no início de `handleInbound` / `maybeAutoReply` |
| Adaptar WhatsApp | ✅ |
| Adaptar WebChat | ✅ |
| Adaptar testes | ✅ |

---

## 10. Banco de dados

**ORM:** Mongoose. **Sem migrations SQL.** Mudanças futuras = schema + script backfill opcional.

### Coleções relevantes

| Coleção | Modelo | Resolve |
|---|---|---|
| `aiSettings` | `AiSettings` | Config IA, limites, transferRules |
| `aiPrompts` | `AiPrompt` | Prompts, coleta, autoResolveEnabled |
| `aiKnowledgeBase` | `AiKnowledgeBase` | Base conhecimento |
| `aiSkills` | `AiSkill` | Skills |
| `aiMemories` | `AiMemory` | Memória |
| `aiUsage` | `AiUsage` | Contadores uso |
| `aiConversationStates` | `AiConversationState` | Estado triagem IA |
| `platformAiBlueprints` | `PlatformAiBlueprint` | Blueprint plataforma |
| `inboxSettings` | `InboxSettings` | Bot textos, horário, quick replies equipe |
| `inboxDepartments` | `InboxDepartment` | Setores + menuKey |
| `inboxTickets` | `InboxTicket` | Chamados |
| `inboxConversations` | `InboxConversation` | Conversas WA |
| `webChatWidgets` | `WebChatWidget` | Config widget |
| `webChatConversations` | `WebChatConversation` | Conversas site |
| `webChatMessages` | `WebChatMessage` | Mensagens site |
| `organizations` | `Organization` | Tenant, plan |
| `companyMembers` | `CompanyMember` | RBAC |
| `auditLogs` | `AuditLog` | Auditoria |
| `systemLogs` | `SystemLog` | Logs sistema |

### Campos que faltam (futuro)

- `attendanceMode` em `AiSettings` (ou documento de config unificado).
- Opcional: contadores separados `basicLlmCalls` / `premiumLlmCalls` em `AiUsage`.

### Riscos de migração

- **Alto:** renomear `mode` sem backfill.
- **Médio:** adicionar campo com default derivado do valor antigo na leitura.
- **Baixo:** JSON temporário em campo existente para protótipo (não recomendado como destino final).

---

## 11. Backend — endpoints

| Método | Rota | Arquivo | O que faz | Atende ideia? | Ajuste futuro |
|---|---|---|---|---|---|
| GET | `/api/platform/ai/settings` | `DashboardService.ts` | Payload completo IA | Parcial | Incluir `attendanceMode` |
| PATCH | `/api/platform/ai/settings` | idem | Salva IA + prompt + KB | Parcial | Validar modo × provedor |
| POST | `/api/platform/ai/test` | idem | Testa LLM | ✅ | — |
| GET | `/api/platform/ai/usage` | idem | Uso/limites | ✅ | Detalhar por modo |
| POST | `/api/platform/ai/skills/:id/approve` | idem | Aprova skill | ✅ | — |
| POST | `/api/platform/ai/memory/:id/approve` | idem | Aprova memória | ✅ | — |
| DELETE | `/api/platform/ai/key` | idem | Remove API key | ✅ | — |
| GET/PATCH | `/api/platform/inbox/settings` | idem | Bot, horário, CSAT | ✅ | Link com modo robot |
| CRUD | `/api/platform/inbox/departments` | idem | Setores | ✅ | — |
| * | `/api/webchat/public/*` | `webchat-public.routes.ts` | API pública widget | Parcial | Menu robotizado WC |
| — | Inbound WA | `WhatsAppService` → `InboxService` | Roteamento interno | Parcial | Gate `attendanceMode` |
| — | Transfer humano | `AiEscalationService`, `InboxService` | Escalação | ✅ | — |

**Risco de alteração:** alto em `InboxService.handleInbound` e `WebChatService.maybeAutoReply` — pontos de entrada de todos os modos.

---

## 12. Frontend — telas

### IA de Atendimento (`AiAtendimento.tsx` — `/platform/inbox/ia`)

| Aba | ID | Estado | Salva backend? |
|---|---|---|---|
| Geral | `geral` | 3 radios mode (mistura conceitos) | ✅ |
| Saudações | `saudacoes` | Completo | ✅ |
| Provedor | `provedor` | Completo | ✅ |
| Economia e regras | `regras` | Completo | ✅ |
| Dados a coletar | `coleta` | Completo | ✅ |
| Base de conhecimento | `kb` | Completo | ✅ |
| Skills | `skills` | Completo + aprovação | ✅ |
| Memória | `memory` | Completo + aprovação | ✅ |
| Limites de uso | `limites` | Completo | ✅ |
| Regras de transferência | `transferencia` | Completo | ✅ |
| Logs e custos | `logs` | Parcial (totais) | ✅ leitura |
| Testar IA | `testar` | Completo | ✅ |

### Outras telas

| Tela | Arquivo | Rota | Observação |
|---|---|---|---|
| Triagem e Bot | `InboxBotSettings.tsx` | `/platform/inbox/bot` | Textos menu WA — reaproveitar para robotizado |
| Setores | `InboxSetores.tsx` | `/platform/inbox/setores` | menuKey 1–4 |
| Respostas rápidas | `InboxRespostas.tsx` | `/platform/inbox/respostas` | Atalhos equipe, não visitante |
| WebChat | `WebChat.tsx` | `/platform/webchat` | `autoReplyUseAi` duplica config IA |
| Inbox | `Inbox.tsx` | `/platform/inbox` | Lista unificada WA + WC |

### Recomendação UI (sem implementar)

1. Aba **Geral** → cards dos 4 modos (substituir 3 radios).
2. Aba **Provedor** → separada (RadarZap / chave própria / nenhum).
3. Manter KB, Skills, Memória, Transferência, Limites, Logs.
4. Link/seção **Fluxo robotizado** → reutilizar `/platform/inbox/bot` (não duplicar formulário).
5. WebChat → `autoReplyUseAi` derivado do modo global ou read-only com explicação.

---

## 13. Custos e limites

### Estado atual

| Modo desejado | Custo IA hoje | Suporte |
|---|---|---|
| Robotizado | Zero | ✅ bot sem LLM |
| IA Básica | Quase zero | ⚠️ auto-resolve existe; LLM não gated por confiança |
| IA Premium | Controlado | ✅ limites + bloqueio |

### Implementação existente

- `AiUsageMeterService` — resolve limites (plano vs company), incrementa uso, bloqueia LLM.
- `AiUsage` — contadores daily/monthly/conversation.
- `estimateTokenCostUsd` — estimativa por modelo no catálogo.
- Contagem principal: **chamadas LLM**, não tokens reais na UI de logs.

### Menor alteração segura (futuro)

1. Gate `triageLlmFallbackEnabled` + threshold de confiança local antes de chamar LLM.
2. Contadores opcionais `basicLlmCalls` / `premiumLlmCalls` em `AiUsage` (sem nova coleção).
3. UI logs: exibir tokens estimados por turno usando dados já retornados pelo provider quando disponíveis.

---

## 14. Segurança

| Risco | Nível | Mitigação |
|---|---|---|
| Expor API Key | Alto | `encryptedApiKey`, `select: false`, `AiCredentialVaultService` |
| Tenant isolation | Crítico | `clientId` em queries — não quebrar |
| Prompt injection | Alto | Regras transferência + escalação; revisar system prompts |
| LLM sem limite | Alto | `AiUsageMeterService` — reforçar no modo Básica |
| WebChat público | Médio | rate limit, token visitante, `allowedDomains` |
| RBAC IA | Médio | `Cap.INBOX_AI_MANAGE` |
| CSRF / sessão | Médio | middleware existente no dashboard |

---

## 15. Testes existentes

### Jest — amostra relevante para modos

| Arquivo | Cobre |
|---|---|
| `AiAutoResolveService.test.ts` | KB/skill sem LLM |
| `ai-escalation.test.ts` | Regras transferência |
| `ai-context-collection.test.ts` | Coleta dados |
| `webchat-ai-triage.util.test.ts` | Heurísticas WebChat |
| `webchat-bot.util.test.ts` | Auto-reply widget |
| `inbound-routing.test.ts` | Roteamento inbound |
| `ticket-client-intent.test.ts` | Intenção cliente |
| `AiKnowledgeBaseService.faq-catalog.test.ts` | FAQ/KB |
| `ai-text-match.test.ts` | Score textual |

### Playwright

| Arquivo | Cobre |
|---|---|
| `e2e/atendimento-smoke.spec.ts` | Rotas atendimento exigem login |
| `e2e/login.spec.ts` | Login |
| `e2e/pwa.spec.ts` | PWA |

### Comandos de validação

```bash
npm test
npm run qa:gate
npm run qa:webchat-wa
npm run test:e2e
npm run typecheck
```

### Testes a criar antes de implementar modos

1. Mapeamento `attendanceMode` ↔ legado `mode`.
2. Modo robotizado não chama LLM (WA + WebChat).
3. Modo básica: local primeiro, LLM só abaixo do threshold.
4. Regressão `AiUsageMeterService` por modo.
5. E2E autenticado: fluxo IA no WebChat com `autoReplyUseAi`.

---

## 16. Riscos antes de implementar

| Risco | Impacto | Mitigação |
|---|---|---|
| Duplicar config IA | Alto | Um `attendanceMode`; WebChat deriva |
| Misturar modo e provedor | Alto | Dois campos + migração documentada |
| Quebrar WhatsApp inbound | Crítico | Feature flag; `inbound-routing` tests |
| Quebrar WebChat | Crítico | `qa:webchat-wa` |
| Perder config antiga `mode` | Alto | Script backfill Mongo |
| Aumentar custo IA | Alto | Gate modo Básica antes de refactor Premium |
| Criar fluxo paralelo | Alto | Adaptar serviços existentes |
| UI confusa (2 lugares “usar IA”) | Médio | Unificar; WebChat read-only |
| Migration desnecessária | Baixo | Mongo: add field + default computed |
| Quebrar tenant isolation | Crítico | Testes multi-tenant |
| Quebrar plano/permissão | Alto | `getAiPlanLimits` inalterado até revisão |

---

## 17. Melhor caminho recomendado

### Fase 0 — Segurança e backup

- Export amostra `aiSettings` + `inboxSettings` + `webChatWidgets` de staging.
- Rodar `npm run qa:gate` como baseline.
- Documentar: “IA off = bot WA ligado” é comportamento atual.
- **Risco:** baixo | **Esforço:** 0,5 dia | **Pode agora:** sim

### Fase 1 — Reorganização conceitual

- Definir `AttendanceMode` + `AiCredentialSource` em `src/types/ai-assistant.ts`.
- Documentar mapeamento legado (este arquivo + `SISTEMA-REGISTRO`).
- **Arquivos:** `ai-assistant.ts`, docs | **Risco:** baixo | **Esforço:** 1 dia

### Fase 2 — UI mínima

- Cards 4 modos em `AiAtendimento.tsx` aba Geral; provedor separado.
- Salvar ainda no schema antigo com adapter no frontend.
- **Risco:** médio | **Esforço:** 2–3 dias | **Depende:** Fase 1

### Fase 3 — Backend mínimo

- Add `attendanceMode` em `AiSettings` com default computado na leitura.
- Adapter em `AiSettingsService.getFullPayload` / PATCH.
- Script backfill opcional.
- **Risco:** médio-alto | **Esforço:** 2–4 dias

### Fase 4 — Robotizado

- Extrair lógica menu de `handleStandardBotTriage` para util compartilhado.
- WebChat: menu setorial antes de IA (reusa `InboxDepartment`).
- **Risco:** médio | **Esforço:** 3–5 dias

### Fase 5 — IA Básica

- Pipeline: heurísticas → `classifyLocal()` → LLM só se `confidence < threshold`.
- Reaproveitar `AiAutoResolveService`, `webchat-ai-triage.util`, `ticket-client-intent`.
- **Risco:** alto | **Esforço:** 5–8 dias | **Esperar:** Fases 3–4 estáveis

### Fase 6 — IA Premium

- Renomear modo; garantir KB/skills/memory só neste modo.
- **Risco:** baixo-médio | **Esforço:** 2–3 dias (maioria já existe)

### Fase 7 — Custos e limites

- Contadores por modo; UI logs com tokens estimados.
- **Risco:** médio | **Esforço:** 3–5 dias

### Fase 8 — Testes e QA

- Novos testes unit + QA manual WA/WebChat/Inbox/painel.
- **Risco:** baixo | **Esforço:** 3–5 dias

---

## 18. O que NÃO fazer agora

1. Criar segundo sistema de IA paralelo (`NewAiOrchestrator` gigante).
2. Nova coleção Mongo para “modos” se `aiSettings` resolve.
3. Remover ou renomear `AiMode` sem backfill.
4. Copiar Evolution/Sendfy.
5. Embeddings/RAG vetorial antes de fechar modos básicos.
6. Unificar WebChat e WA num único mega-handler sem testes.
7. Desligar bot WA automaticamente ao escolher “Desativado” sem decisão de produto.
8. Commitar `sessions/`, `data/`, credenciais.
9. Implementar os 4 modos de uma só vez.

---

## 19. Conclusão

O RadarZap **já tem ~70–80% da infraestrutura** para os 4 modos, mas organizada de forma **fragmentada** e com nomenclatura que **mistura provedor com comportamento**.

**Recomendação:** não implementar os 4 modos de uma vez. Começar por **Fase 0 + Fase 1 + Fase 2 (UI com adapter)** para validar UX; depois **Fase 3 (campo no banco)** e **Fase 4 (robotizado WebChat)**.

| Prioridade | Ação |
|---|---|
| Agora | Fase 0–2 (conceito + UI, sem quebrar backend) |
| Em seguida | Fase 3–4 (campo + robotizado WebChat) |
| Depois | Fase 5 (IA Básica com gate de confiança) |
| Já existe | Fase 6 (IA Premium = produto atual) |

Isso preserva WhatsApp, Inbox e WebChat que já estão quase prontos.

---

## Referências cruzadas

- `docs/INBOX-ATENDIMENTO.md` — triagem, fila, CSAT, escalação IA
- `docs/WEBCHAT.md` — widget, pré-chat, IA, escalação
- `docs/TICKET-ATENDIMENTO.md` — chamados e assistente ticket
- `docs/MENU-PAGES-REGISTRY.md` — rotas painel
- `docs/ROADMAP-COMPLETUDE.md` — gate estabilização Fase 1
- `.cursor/rules/radarzap-v2-system-registry.mdc` — changelog sistema

---

*Documento gerado por análise de código — sem alteração de implementação.*
