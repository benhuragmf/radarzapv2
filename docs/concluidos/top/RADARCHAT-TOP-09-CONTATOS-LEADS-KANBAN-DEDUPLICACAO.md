# Radar Chat — TOP 09/20 — Contatos, Leads, Kanban e Deduplicação

**Data:** 2026-06-24  
**Versão após TOP 09:** `2.11.95`  
**Branch:** `main`

---

## Resumo executivo

O TOP 09 consolidou a base comercial **Contatos × Leads × Kanban**: diferença oficial documentada, funil mapeado (`lead-stage.util.ts`), deduplicação centralizada (`lead-dedupe.util.ts`), regras inbound (`lead-inbound.util.ts`), capabilities dedicadas `leads:*` / `contacts:*`, ajuste crítico **WhatsApp/WebChat genérico não cria lead** (intenção comercial no 1º contato), Kanban com rótulos alinhados ao funil, testes e gates verdes.

---

## Herança dos TOPs anteriores

### TOP 01

Contatos (`Destination`), leads (`LeadCapture`), Kanban, dedupe por telefone; risco de duplicidade e confusão Contato/Inbox/Lead.

### TOP 02

Baseline verde (typecheck, build, test, gate).

### TOP 03

Limites `leadsPerMonth`, `contacts`, `leadForms` — sem billing agressivo nesta etapa.

### TOP 04

RBAC; Marketing custom; Leads usava `consent:view` — **resolvido** com `leads:*`.

### TOP 05

Leads não atribuem conversa a agente indisponível (herda fila TOP 07).

### TOP 06

IA/bot comercial via `hasCommercialLeadIntent` — sem LLM.

### TOP 07

Inbox/fila consolidada; lead vincula conversa sem refazer fila.

### TOP 08

Tickets consolidados; lead não vira ticket automaticamente.

### Esta etapa fecha

Diferença Contato/Lead, funil Kanban, dedupe, permissões, inbound seguro, testes.

### Esta etapa não faz

Formulários embed profundo (TOP 10), redesign WebChat (TOP 11), WhatsApp Cloud (TOP 12), billing, produção pronta.

---

## Estado Git inicial

| Item | Valor |
|------|-------|
| Branch | `main` |
| Último commit | `5cfcd1b` — `chore(top): tickets chamados e tk 2.11.94` |
| Untracked (não commitar) | `data/`, `mocker/modelochat/` |
| Risco | Baixo |

---

## Escopo autorizado

Contatos, leads, Kanban, deduplicação, origem/canal, vínculo Inbox/Ticket, permissões, testes, documentação.

---

## Diagnóstico atual de contatos

| Item | Existe? | Arquivo | Observação |
|------|---------|---------|------------|
| Modelo | Sim | `src/models/Destination.ts` | Contato = `Destination` |
| Telefone | Sim | `identifier` | E.164 via `normalizeContactPhoneE164` |
| E-mail | Sim | `email` | Opcional |
| Nome | Sim | `name` | |
| Origem | Sim | metadata/tags | WhatsApp inbound cria/atualiza |
| Consentimento LGPD | Sim | `ConsentService` | `consent:view` / aprovações |
| Vínculo WhatsApp | Sim | `InboxService` | Todo inbound |
| Vínculo WebChat | Sim | `webchat-destination-link.util.ts` | Com telefone/e-mail |
| Vínculo Inbox | Sim | `InboxConversation.destinationId` | |
| Vínculo Ticket | Sim | `InboxTicket.destinationId` | Opcional |
| Deduplicação | Sim | phone normalizado | Por `clientId` |
| Importação CSV | Sim | `contact-csv-import` | |
| Grupos/listas | Sim | `ContactGroup` | |
| Permissões | Sim | `consent:view`, `contacts:*` (TOP 09) | |
| API | Sim | `/destinations`, `/contact-groups` | |
| UI | Sim | `/contact`, `/platform/contacts` | |

---

## Diagnóstico atual de leads

| Item | Existe? | Arquivo | Observação |
|------|---------|---------|------------|
| Modelo | Sim | `LeadCapture.ts` | |
| Origem | Sim | `origin` enum | whatsapp, webchat, site, manual… |
| Estágio | Sim | `status` | 7 valores persistidos |
| Responsável | Sim | `assignedUserId` | Assumir atendimento |
| Contato vinculado | Sim | `destinationId` | |
| Conversa vinculada | Sim | `inboxConversationId`, metadata WC | |
| Ticket vinculado | Não direto | — | Via conversa/contato |
| Formulário | Sim | `formId` | |
| UTM | Sim | `utm` | |
| Deduplicação | Sim | `tryCreateInboundLead` | Lead aberto por phone |
| Kanban | Sim | `LeadKanbanBoard.tsx` | Drag/drop via PATCH |
| API | Sim | `/leads/captures` | Paginado |
| UI | Sim | `/platform/leads` | |
| Permissões | Sim | `leads:*` (TOP 09) | |
| Testes | Sim | `lead-*-inbound.test.ts` | Gate inclui leads |

---

## Diagnóstico atual do Kanban

| Fluxo | Existe? | Lacuna |
|-------|---------|--------|
| Tela Kanban | Sim | — |
| Drag and drop | Sim | PATCH status |
| Colunas por status | Sim | Mapeadas ao funil TOP 09 |
| Contadores | Sim | Stats cards |
| Filtro origem | Sim | Toolbar |
| Filtro atendente | Sim | `assigneeId` |
| Detalhe lead | Sim | Painel lateral |
| Abrir conversa | Sim | `open-inbox` |
| Criar ticket | Não direto | Via Inbox |
| Converter contato | Sim | `convert` |
| Histórico | Sim | `history[]` |
| `proposal_sent` / `no_response` | Parcial | Mapeados em adapter; sem coluna dedicada |

---

## Diagnóstico de deduplicação

| Regra | Estado |
|-------|--------|
| Contato por telefone (mesma org) | `Destination` + normalização E.164 |
| Lead aberto por telefone | `OPEN_LEAD_STATUSES` + `tryCreateInboundLead` |
| Lead por e-mail | Índice `{ clientId, email }` |
| Cross-tenant | Queries sempre com `clientId` |
| Lead fechado → novo futuro | `canCreateNewLeadAfterClosed` |
| Helpers | `lead-dedupe.util.ts` |

---

## Diagnóstico de vínculo com Inbox e Tickets

- Lead → `inboxConversationId` / `wc:{id}` no Inbox unificado.
- `openInboxForCapture` cria conversa sem duplicar se já vinculada.
- Ticket não gera lead automaticamente; suporte permanece em ticket.
- Intenção comercial em conversa aberta → `maybeCapture*CommercialIntent`.
- Cross-tenant bloqueado por `clientId` em todos os serviços.

---

## Diferença oficial entre Contato e Lead

| Entidade | Função |
|----------|--------|
| **Contato** | Pessoa conhecida na base (`Destination`) |
| **Lead** | Oportunidade comercial (`LeadCapture`) |
| **Inbox** | Conversa em tempo real |
| **Ticket** | Solicitação rastreável (TK) |
| **Kanban** | Organização comercial do lead |

Um contato pode existir sem lead. Lead deve ter contato ou dados mínimos para conversão.

---

## Regras oficiais de criação de contato

### WhatsApp

Sempre cria/atualiza contato; normaliza telefone; origem WhatsApp; **não** cria lead sem intenção comercial (TOP 09).

### WebChat

Contato quando há telefone/e-mail no pré-chat; visitante anônimo não força contato completo.

### Manual / Formulário

Validação + dedupe; formulário preparado para TOP 10.

---

## Regras oficiais de criação de lead

| Origem | Auto lead? |
|--------|------------|
| Formulário público | Sim |
| WhatsApp genérico (`oi`) | **Não** (2.11.95) |
| WhatsApp comercial | Sim |
| WhatsApp retorno (nova conversa) | Sim |
| WebChat genérico (1º contato) | **Não** (2.11.95) |
| WebChat retorno | Sim |
| Intenção comercial (classificador) | Sim |
| Manual atendente | Sim |
| Ticket suporte | Não |

Implementação: `shouldCreateLeadFromWhatsAppInbound` / `shouldCreateLeadFromWebChatSession`.

---

## Funil Kanban oficial

| Produto | Persistido | Coluna UI |
|---------|------------|-----------|
| `new` | `new` | Novo lead |
| `contact_attempt` | `in_review` | Tentando contato |
| `in_service` | `in_progress` | Em atendimento |
| `qualified` | `qualified` | Qualificado |
| `proposal_sent` | `qualified` | (adapter) |
| `won` | `converted` | Fechado / Ganho |
| `lost` | `lost` / `spam` | Perdido |
| `no_response` | `lost` | (adapter) |

Helper: `src/types/lead-stage.util.ts`.

---

## Deduplicação oficial

1. Telefone/e-mail normalizados por organização.
2. Lead aberto atualizado, não duplicado (`tryCreateInboundLead`).
3. Cross-tenant nunca deduplica entre empresas.
4. Lead `converted`/`lost` permite novo lead futuro.

---

## Permissões de Leads e Contatos

| Capability | Uso |
|------------|-----|
| `leads:view` | Listar/ver leads |
| `leads:manage` | Criar, converter, vincular |
| `leads:kanban:manage` | Mover etapas (PATCH) |
| `leads:export` | Export (reservado) |
| `contacts:view` | Ver contatos (espelha operação) |
| `contacts:manage` | Gerenciar contatos |

**Cargos:** Owner/Admin total; Manager view+kanban; Attendant view; Marketing manage; Financeiro sem leads; Viewer `leads:view`.

API: `requireAnyCapability` com fallback `consent:view` / `send:destination:manage` para compatibilidade.

---

## WhatsApp, WebChat e origem do lead

- **WhatsApp:** contato sempre; lead só comercial/retorno.
- **WebChat:** contato com dados; lead com intenção ou retorno.
- **Formulário:** lead + contato conforme `contactMode`.
- **Manual:** `POST /leads/captures`.
- Origem preservada em `origin` + `utm`.

---

## Correções ou ajustes aplicados

1. `lead-stage.util.ts`, `lead-dedupe.util.ts`, `lead-inbound.util.ts`.
2. `maybeCaptureWhatsAppInbound` / `maybeCaptureWebChatSession` — gate comercial.
3. Capabilities `leads:*`, `contacts:*` + presets + Marketing custom.
4. API `/leads/*` com guards dedicados.
5. Frontend: `canAny`, Kanban labels, permissões Leads.tsx.
6. Testes inbound + RBAC + helpers.

---

## Testes criados ou atualizados

| Arquivo | Cobertura |
|---------|-----------|
| `lead-stage.util.test.ts` | Funil oficial |
| `lead-dedupe.util.test.ts` | Phone/email dedupe |
| `lead-inbound.util.test.ts` | Regras WA/WebChat |
| `lead-whatsapp-inbound.test.ts` | Oi não cria lead |
| `lead-webchat-inbound.test.ts` | Pré-chat genérico |
| `capabilities-rbac.test.ts` | leads:* por papel |
| Existentes | commercial-intent, conversation-sync |

---

## Gates executados

```bash
npm run typecheck          # verde
npm run build              # verde
npm test                   # verde
npm run qa:atendimento:gate # verde (inbound alterado)
cd src/services/web-dashboard/frontend && npm run build  # verde
```

---

## Arquivos alterados

- `src/types/lead-stage.util.ts`, `lead-dedupe.util.ts`, `lead-inbound.util.ts` + testes
- `src/services/leads/LeadFormService.ts`
- `src/auth/rbac/capabilities.ts`, `companyRolePresets.ts`
- `src/types/org-custom-role.ts`
- `src/services/web-dashboard/DashboardService.ts`
- Frontend: `auth.ts`, `navConfig.ts`, `ProtectedRoute.tsx`, `Leads.tsx`, `leadUi.ts`
- Docs: TOP 09, CHANGELOG, SISTEMA-REGISTRO, LEADS-FORMULARIO, INDICE
- `package.json` → `2.11.95`

---

## Riscos reduzidos

- WhatsApp `oi` não vira lead automaticamente.
- Deduplicação documentada e testada.
- Permissões dedicadas com fallback legado.
- Funil produto mapeado sem renomear persistido.
- Cross-tenant mantido por `clientId`.

---

## Riscos restantes

- Org existentes com papel Marketing antigo (sem `leads:*`) — fallback `consent:view`.
- `proposal_sent` / `no_response` sem coluna Kanban dedicada.
- Lead → ticket direto não implementado.
- Atendente editar só leads atribuídos — filtro fino pendente.
- Billing `leadsPerMonth` não enforced (TOP 17).

---

## Decisões pendentes para Benhur

1. Retorno WhatsApp/WebChat sem intenção comercial deve continuar gerando lead?
2. Coluna Kanban dedicada para `proposal_sent` / `no_response`?
3. Migrar papéis custom existentes para `leads:*` automaticamente?

---

## Próximo passo recomendado

**TOP 10 — Formulários públicos/embed:** captura avançada, campos custom, embed profundo — sem redesenhar Leads/Kanban.
