# RadarZap — Changelog

Registro append-only de entregas versionadas. Protocolo: [`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md).

Espelho resumido: [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md).

---

---

---

---

---

---

---

---

---

## [2.12.5] — 2026-06-24

### TOP 19 — QA final, regressão e checklist pré-go-live

- Gates obrigatórios verdes: typecheck, build, 772 testes Jest, `qa:atendimento:gate`, E2E 38/38.
- Doc: `docs/top/RADARZAP-TOP-19-QA-FINAL-REGRESSAO-GO-LIVE.md` — roteiro manual TOP 20, checklist pré-go-live.
- Fix E2E: seletores Inbox (título no Header) e radio RadarZap (strict mode).
- Produção não declarada pronta; deploy não executado.

---

## [2.12.4] — 2026-06-24

### TOP 18 — Auditoria, segurança, LGPD e hardening

- `mask-secret.util.ts`; redact em `AttendanceEvent`, `AuditLog`, logger.
- Eventos: `ticket.public_lookup_failed`, `form.blocked`, `billing.*`.
- Doc: `docs/top/RADARZAP-TOP-18-AUDITORIA-SEGURANCA-LGPD-HARDENING.md`.

---

## [2.12.3] — 2026-06-24

### TOP 17 — Billing, assinaturas, limites e bloqueios

- Helpers `billing-state.util.ts`, `plan-limit.util.ts`, `plan-limit-enforcement.ts`.
- Checkout Stripe pacotes IA (`POST /billing/checkout/ai-credits`); webhook idempotente → `purchasedCredits`.
- Enforcement: `webchatWidgets`, `leadsPerMonth`, `contacts`, `ticketsPerMonth`.
- `invoice.payment_failed` → `past_due` + grace 3 dias documentado.
- Doc: `docs/top/RADARZAP-TOP-17-BILLING-ASSINATURAS-LIMITES-BLOQUEIOS.md`.

---

## [2.12.2] — 2026-06-24

### TOP 16 — IA Créditos, carteira, consumo e fallback

- Helpers `ai-credit-alerts.util.ts`, `ai-credit-packages.util.ts`; `canConsumeAiCredits`, eventos `ai.credits.*`.
- Gate reforçado WebChat + `AiProviderService`; APIs `credit-packages` e `wallet/purchased` (sem checkout).
- Doc [`top/RADARZAP-TOP-16-IA-CREDITOS-CARTEIRA-CONSUMO-FALLBACK.md`](./top/RADARZAP-TOP-16-IA-CREDITOS-CARTEIRA-CONSUMO-FALLBACK.md); §19 doc mestre.

---

## [2.12.1] — 2026-06-24

### TOP 15 — IA Premium, base de conhecimento e handoff

- Helpers `premium-ai.util.ts`: gate central, limites resposta, sanitização, handoff pré-chamada, anti-segredo.
- Eventos `ai.premium.*` em `AttendanceEvent`; integração `WebChatAiService` + `InboxService.sendAiReply`.
- Doc [`top/RADARZAP-TOP-15-IA-PREMIUM-KB-HANDOFF.md`](./top/RADARZAP-TOP-15-IA-PREMIUM-KB-HANDOFF.md); §18 doc mestre.

---

## [2.12.0] — 2026-06-24

### TOP 14 — IA Básica, triagem e encaminhamento

- Intenções `ticket_status`, `complaint`, `partnership`; threshold roteamento 0.75.
- Helpers `basic-triage.util.ts` (produto, confiança, ação, anti-bridge, auditoria).
- Evento `triage.classified`; integração WA + WebChat.
- Doc [`top/RADARZAP-TOP-14-IA-BASICA-TRIAGEM-ENCAMINHAMENTO.md`](./top/RADARZAP-TOP-14-IA-BASICA-TRIAGEM-ENCAMINHAMENTO.md).

---

## [2.11.99] — 2026-06-24

### TOP 13 — Bridge WebChat ↔ WhatsApp

- Helpers `webchat-bridge.util.ts` (anti-loop, idempotência, estados, cross-tenant).
- Dedupe encaminhamento visitante→WA; bloqueio eco em resposta atendente.
- Eventos `bridge.message_forwarded`, `bridge.loop_prevented`.
- Doc [`top/RADARZAP-TOP-13-BRIDGE-WEBCHAT-WHATSAPP.md`](./top/RADARZAP-TOP-13-BRIDGE-WEBCHAT-WHATSAPP.md).

---

## [2.11.98] — 2026-06-24

### TOP 12 — WhatsApp, sessão, QR, reconexão, comandos e documentação consolidada

- Helpers `whatsapp-session.util.ts` (status produto, RBAC sessão, sanitização outbound, cross-tenant).
- `isWhatsappTeamCommand` em comandos equipe WA.
- Documentação mestre [`RADARZAP-SISTEMA-COMPLETO.md`](./RADARZAP-SISTEMA-COMPLETO.md).
- Doc [`top/RADARZAP-TOP-12-WHATSAPP-SESSAO-QR-RECONEXAO-COMANDOS.md`](./top/RADARZAP-TOP-12-WHATSAPP-SESSAO-QR-RECONEXAO-COMANDOS.md).

---

## [2.11.97] — 2026-06-24

### TOP 11 — WebChat, widget, fallback e experiência do visitante

- Helpers `webchat-public.util.ts` (sanitização, fila, gate IA Premium, assinatura config).
- Widget: `outsideHoursMessage`, mensagem oficial de fila, sync expandida no refresh.
- IA Premium indisponível escala para fila humana; mensagens de escalação unificadas.
- Testes `webchat-public.util`, `webchat-public-security`; doc [`top/RADARZAP-TOP-11-WEBCHAT-WIDGET-FALLBACK-EXPERIENCIA.md`](./top/RADARZAP-TOP-11-WEBCHAT-WIDGET-FALLBACK-EXPERIENCIA.md).

---

## [2.11.96] — 2026-06-24

### TOP 10 — Formulários públicos, embed e captura de leads

- Validação central `lead-form-submit.util.ts`; limite `leadForms` por plano em `createForm`/`duplicateForm`.
- Submit público: dedupe lead aberto (TOP 09); resposta sem `captureId`; UTM no webhook.
- Testes `lead-form-*`; documento [`top/RADARZAP-TOP-10-FORMULARIOS-PUBLICOS-EMBED-CAPTURA-LEADS.md`](./top/RADARZAP-TOP-10-FORMULARIOS-PUBLICOS-EMBED-CAPTURA-LEADS.md).

---

## [2.11.95] — 2026-06-24

### TOP 09 — Contatos, leads, Kanban e deduplicação

- Helpers `lead-stage.util.ts`, `lead-dedupe.util.ts`, `lead-inbound.util.ts` (funil oficial, dedupe, regras inbound).
- Capabilities `leads:view|manage|kanban:manage|export` e `contacts:view|manage`; API `/leads/*` com fallback legado.
- WhatsApp/WebChat genérico não cria lead automático (exige intenção comercial no 1º contato).
- Kanban: rótulos alinhados ao funil TOP 09.
- Documento [`top/RADARZAP-TOP-09-CONTATOS-LEADS-KANBAN-DEDUPLICACAO.md`](./top/RADARZAP-TOP-09-CONTATOS-LEADS-KANBAN-DEDUPLICACAO.md).

---

## [2.11.94] — 2026-06-24

### TOP 08 — Tickets, chamados, TK e rastreabilidade

- Helpers `ticket-status.util.ts` (estados de produto, `canCustomerReplyToTicket`) e `ticket-sla-priority.util.ts` (metas SLA por prioridade).
- Auditoria `AttendanceEvent`: `ticket.reopened`, `ticket.assigned`.
- Testes: status/SLA, notas internas fora da consulta pública, token ≠ TK, reabertura auditada.
- Documento [`top/RADARZAP-TOP-08-TICKETS-CHAMADOS-TK-RASTREABILIDADE.md`](./top/RADARZAP-TOP-08-TICKETS-CHAMADOS-TK-RASTREABILIDADE.md).

---

## [2.11.93] — 2026-06-24

### TOP 07 — Inbox, conversas, fila e transferência

- Helpers `inbox-conversation-status.util.ts`, `inbox-org-access.util.ts`, `inbox-queue-eligibility.util.ts`.
- Fila: round-robin via `filterQueueEligibleAgentIds`; assumir valida presença+capacidade.
- Transferência: bloqueio conversa alheia; audit `inbox.queued|assigned|transferred|reassigned`.
- Eventos painel `inbox:assigned`, `inbox:transferred`.
- Anti cross-tenant em `getConversationIfAllowed`.
- Doc: `docs/top/RADARZAP-TOP-07-INBOX-CONVERSAS-FILA-TRANSFERENCIA.md`.

---

## [2.11.92] — 2026-06-24

### TOP 06 — modos de atendimento unificados

- Modos oficiais: `disabled`, `robotic`, `basic_triage`, `premium_assistant`, **`hybrid`**.
- Tipo central ampliado: `normalizeAttendanceMode`, helpers de cadeia, separação modo/provedor/créditos/fila.
- WhatsApp: `disabled` → fila humana direta; híbrido `handleHybridBotTriage`.
- WebChat: `runVisitorAutomationPipeline` com fallback humano.
- UI: card Híbrido + provedor IA em Premium/Híbrido.
- Doc: `docs/top/RADARZAP-TOP-06-MODOS-ATENDIMENTO.md`.

---

## [2.11.91] — 2026-06-24

### TOP 05 — status operacional, presença e fila segura

- Helper `agent-availability.ts`; regra central somente `online` na fila.
- `supervisor_online` validado no socket heartbeat; mensagem de erro oficial.
- Limite simultâneo por plano em `config/plans.json` (`maxConcurrentChatsPerAgent`).
- Alerta `inbox:agent_offline_risk` ao desconectar com chats ativos.
- Testes: `agent-availability`, `inbox-agent-presence-api`, plan-config.
- Documento `docs/top/RADARZAP-TOP-05-STATUS-PRESENCA-FILA.md`.

---

## [2.11.90] — 2026-06-24

### TOP 04 — RBAC, permissões, equipe e segurança multiempresa

- Matriz oficial de cargos/permissões documentada em `docs/top/RADARZAP-TOP-04-RBAC-PERMISSOES-EQUIPE-SEGURANCA.md`.
- Limites de equipe por plano (`includedUsers`, `includedAgents`, `includedSupervisors`) no convite e troca de cargo — `team-plan-limits.ts`.
- Papéis custom sugeridos: Financeiro, Marketing/Leads, Somente leitura (`defaultOrgCustomRoles`).
- Auditoria `AuditLog` em convite, alteração de cargo e remoção de membro.
- Testes: `capabilities-rbac`, `team-plan-limits`, `organization-team-cross-tenant`.

---

## [2.11.89] — 2026-06-24

### TOP 03 — planos, mensalidades e limites comerciais

- Matriz comercial oficial em `config/plans.json` (trial, free, starter, pro, enterprise).
- Validador de catálogo e tipos em `plan-config.ts`; limites operacionais via `resolveOperationalLimits`.
- IA Créditos por plano lidos do catálogo (`ai-wallet.ts`).
- Testes ampliados em `plan-config.test.ts`.
- Documento `docs/top/RADARZAP-TOP-03-PLANOS-MENSALIDADES-LIMITES.md`.

---

## [2.11.88] — 2026-06-24

### TOP 02 — baseline gates e governança

- Corrigido baseline TypeScript backend (`WebChatService`: datas ISO, badge setor, tipo `inactivitySla` no detalhe Inbox).
- Corrigido build frontend estrito (`InboxBotSettings`: campo `inactivityCloseGracefulQuickCode` tipado).
- Corrigido teste integração CSAT — mock `ConsentService.findContactDestinationForInbound`.
- CI frontend alinhado: `npm run build` (`tsc -b && vite build`) em vez de só `vite build`.
- Documento `docs/top/RADARZAP-TOP-02-GOVERNANCA-BASELINE-GATES.md` e gates oficiais TOP 02/20.

---

## [2.11.87] — 2026-06-24

### UI — Inbox e IA mais compactos (1080p)

- Layout viewport: `main` flex sem `calc(100dvh)` duplicado — corrige corte do composer/rodapé.
- Inbox: nav oculta com conversa aberta; visitantes recolhíveis; filtros com wrap; lista e painel direito mais estreitos.
- IA Atendimento: `PlatformPage`/`PageHeader` compact; stats row horizontal; blueprint em `<details>`.
- Componentes: `InboxStatsRow`, `InboxAtendimentoNav`, `InboxLiveVisitors` modo compact.

## [2.11.86] — 2026-06-24

### Fix — detalhe de chamados WebChat no painel

- **Sintoma:** tickets apareciam em **Atendimento → Chamados**, mas ao clicar **Abrir** a tela mostrava *Ticket não encontrado*.
- **Causa:** `GET /api/inbox/tickets/:ref` para `channel: webchat_site` chama `WebChatService.getDetailForInbox`; faltavam imports em `WebChatService.ts` (`loadInboxSettings`, `departmentBadgeFieldsFrom`, `WebhookDispatcherService`, bridge/fallback/painel) → `ReferenceError` em runtime.
- **Correção:** imports restaurados; `InboxTicketDetail.tsx` exibe a mensagem real da API (não só *não encontrado*).
- **Refs `TK-…`:** geração em `generateInboxTicketRef()` passa a usar alfabeto sem `0`/`O`/`1`/`I`/`L` (refs antigas em base36 continuam válidas — copie da lista ou use **Abrir**).
- **Vários TK do mesmo cliente:** esperado — cada sessão WebChat ou conversa convertida cria um chamado independente.
- Docs: `INBOX-ATENDIMENTO.md` § Lista × detalhe; `TICKET-ATENDIMENTO.md` § Referência `TK-…`; `WEBCHAT.md` § Chamados.

## [2.11.85] — 2026-06-24

### Docs — cobrança LLM × IA

- [`IA-CREDITOS-E-CARTEIRA.md`](./IA-CREDITOS-E-CARTEIRA.md) § Como funciona a cobrança: guia produto, tabelas LM/IA, exemplos de débito, fluxo mermaid.

## [2.11.84] — 2026-06-24

### IA — créditos, carteira mensal e barra do painel

- Carteira mensal por empresa: franquia do plano + créditos comprados; débito proporcional ao custo real de cada LLM RadarZap (`AI_CREDIT_USD_UNIT`).
- Cota de **aprendizagem** (skills/memória automáticas) com limite mensal por plano.
- Barra superior: WhatsApp (todos com `inbox:view`), saldo **IA** e **LM** (`usado/total`) só com `inbox:ai:balance:view`.
- `GET /api/platform/ai/balance`, `GET /api/inbox/whatsapp-status`.
- Doc canônico: [`IA-CREDITOS-E-CARTEIRA.md`](./IA-CREDITOS-E-CARTEIRA.md).

## [2.11.83] — 2026-06-21

### Inbox — triagem visível para atendentes (configurável)

- Novo toggle em **Triagem e Bot → Triagem — visibilidade no Inbox** (`attendantTriageVisible`, padrão desligado).
- Dono/admin liberam conversas em `bot_triage` (antes da escolha do setor) para atendentes dos setores verem e assumirem no painel (WA + WebChat).

## [2.11.82] — 2026-06-21

### Inbox — triagem configurável

- Dono define tempos e mensagens de inatividade na triagem (`triageWarningMinutes`, `triageCloseAfterWarningMinutes`, mensagens custom).
- Padrão: 2 min → "Você está aí?"; +1 min → "Conversa encerrada por inatividade."
- UI em `/platform/inbox/bot` — card **Triagem — inatividade do visitante**.

## [2.11.81] — 2026-06-21

### Inbox — triagem

- Cronômetro **sem atendimento humano** na lista e no chat (`bot_triage`, WA + WebChat).
- Encerramento automático na triagem quando o cliente não interage (mesmo SLA de inatividade do Bot).
- `triageWaitSince` / `triageElapsedSec` / `triageUrgency` na API unificada.

## [2.11.80] — 2026-06-21

### Inbox — badge por setor + fix numeração Menu WhatsApp

- Badge na lista alinhado a **Setores**: nome do setor (público) ou **2ª instância** (interno); tags empilhadas ao lado do status.
- **Menu 1,2,3…** só para setores **ativos** e públicos; internos usam `i1`; inativos liberam número (`o1`).
- Reparo automático ao abrir Setores/Inbox; fix `clientOid` duplicado em `listConversations`.

---

## [2.11.79] — 2026-06-21

### Inbox — badge Lead/Comercial na lista (correção UX)

- Badge roxo **Comercial** (ou nome do setor) na **lista lateral** e no **header** do chat, ao lado de WhatsApp/Site e status — não na timeline.
- API `listConversations` / `getConversationDetail`: campos `isLeadEntry` e `leadSectorLabel` (vínculo `LeadCapture.inboxConversationId` ou setor comercial).
- Removido card visual na mensagem de sistema do chat (2.11.78).

## [2.11.78] — 2026-06-23

### Inbox — card do setor Comercial no chat (Lead) *(substituído por 2.11.79)*

- Mensagem de abertura da Central de Leads renderiza **card visual** (setor, Lead, origem, atendente, motivo).
- Backend inclui linha `Setor: …` na mensagem de sistema para histórico.

---

## [2.11.77] — 2026-06-23

### Leads — abrir atendimento cria conversa Lead no Inbox

- **Abrir atendimento** na Central de Leads cria conversa `in_progress` (não reutiliza triagem bot ociosa).
- Setor **Comercial/Lead** + segmento **Lead** + tag no contato; mensagem de sistema com origem da captura.
- Conversa encerrada vinculada ao lead não bloqueia nova abertura.

---

## [2.11.76] — 2026-06-23

### Leads — fix Abrir atendimento (cria conversa no Inbox)

- Lead com contato vinculado sem conversa: botão **Abrir atendimento** (não "Assumir") — chama `POST /open-inbox` e cria ou reutiliza conversa no Inbox.
- Kanban, lista e painel lateral alinhados; toast "Conversa aberta no Inbox".

---

## [2.11.75] — 2026-06-23

### Leads — paridade WebChat no detalhe + refresh ao assumir

- Painel lateral e aba **Conversa**: link Inbox para leads WebChat (`wc:`).
- **Assumir atendimento** em conversa WA existente promove status para `in_progress` e emite refresh.
- Kanban: atalho **Inbox** no hover quando lead já tem conversa aberta.

---

## [2.11.74] — 2026-06-23

### Leads — classificador comercial + refresh tempo real

- Intenção comercial usa **classificador local** (`classifyLocal`) — evita confundir financeiro/suporte; frases explícitas como fallback.
- Evento socket silencioso `lead:updated` atualiza Kanban/lista ao mudar status (ex.: encerrar atendimento).
- Modo Lista: link **Inbox** também para leads WebChat (`wc:`).

---

## [2.11.73] — 2026-06-23

### Leads — lista + sync ao encerrar atendimento

- Modo **Lista**: ações rápidas Assumir, WhatsApp e Salvar como contato (paridade com Kanban).
- Ao encerrar conversa **Inbox** ou **WebChat**, lead `in_progress` vinculado passa automaticamente para **Qualificado**.

---

## [2.11.72] — 2026-06-23

### Leads — intenção comercial + ações Kanban

- Lead automático por palavras-chave comerciais em conversa WA/WebChat aberta (contato existente).
- Kanban: WhatsApp inline e Salvar como contato no hover; util `hasCommercialLeadIntent`.

## [2.11.71] — 2026-06-23

### Leads — retorno WA/WebChat + Assumir no Kanban

- Lead automático quando cliente existente abre nova conversa WhatsApp ou nova sessão WebChat.
- Assumir atendimento atribui responsável no lead; botão rápido Assumir no hover do Kanban.

## [2.11.70] — 2026-06-23

### Leads — WebChat inbound + notificação painel

- Nova sessão WebChat (telefone desconhecido) gera lead com origem `webchat` e vínculo `wc:` no Inbox.
- Evento `lead:new_entry` no sino; página Leads atualiza via socket.
- E2E Leads alinhado às métricas operacionais.

## [2.11.69] — 2026-06-23

### Leads — WhatsApp inbound + captura manual

- Primeiro contato WhatsApp gera `LeadCapture` automaticamente (`maybeCaptureWhatsAppInbound` + hook no Inbox).
- Botão **Capturar lead** e `POST /leads/captures` para entrada manual.
- Filtros operacionais: `origins` (multi-origem) e `openOnly` alinhados aos cards de métricas.
- Kanban: motivo opcional ao marcar Perdido/Spam via drag.

## [2.11.68] — 2026-06-23

### UX — Leads: Central de Entrada Comercial

- Métricas operacionais (Novos, WhatsApp aguardando, Site/Formulários, Sem responsável, etc.) com clique para filtrar.
- Textos amigáveis, abas Conversa/Contato, bloco "Próxima ação", Kanban com coluna Aguardando e cards informativos.
- Modo Lista em tabela com ações rápidas; filtro por responsável; stats `operational` na API.

## [2.11.67] — 2026-06-23

### UX — Leads: layout CRM com painel lateral

- Aba Capturas: Kanban/lista + detalhe lateral fixo (420px), sem rolagem da página inteira.
- Painel com abas internas (Resumo, Atendimento, Listas, Histórico), ação primária destacada e menu Mais.
- Cards e funil compactos; filtros em barra + drawer avançado; preferência Lista/Kanban em localStorage.
- Mobile: detalhe em drawer full screen; Kanban com scroll interno por coluna.

## [2.11.66] — 2026-06-23

### Feat — Leads: vínculo com contato, WhatsApp inline e temperatura

- **Vincular contato**: modal com busca (`GET /leads/contacts-search`) e vínculo sem converter (`POST …/link`).
- **WhatsApp**: painel inferior com composer + respostas rápidas; envia via Inbox (abre conversa se necessário).
- **Temperatura do lead** (Fria / Morna / Quente) substitui o seletor de status duplicado no detalhe; badge no cabeçalho.

## [2.11.65] — 2026-06-23

### Feat — Leads: Kanban, embed completo, preview inline, responsável padrão

- **Kanban** na aba Capturas (drag-and-drop de status).
- **form.js**: select/checkbox/hidden, tema claro/escuro/auto, tamanho compact/padrão/largo, logo RadarZap.
- **Integrar no site**: pré-visualização iframe inline + alerta de domínios.
- **Responsável padrão**: seletor de equipe (`GET /leads/assignees`), nome no detalhe do lead.
- Editor: bloco Aparência; opções de select no editor de campos.
- E2E `e2e/leads-panel.spec.ts`; mocks ampliados.

### Fix — Notificações painel (offline / mutations)

- Sonner apenas — removido fallback `window.alert()` duplicado.
- Dedupe de toasts de API offline (5 s); mensagem unificada ao reiniciar o servidor.
- Kanban: não dispara PATCH se o status já é o mesmo.

## [2.11.64] — 2026-06-23

### Feat — Leads: hub completo captura → qualificação → conversão

- Cards de métricas (`GET /leads/stats`), funil visual, filtros avançados (origem, formulário, lista, período, consentimento).
- Painel de detalhe com histórico, deduplicação, conversão/vínculo a contato, listas, UTM e badges LGPD.
- Aba **Listas e segmentos** com atalhos ao módulo Contatos (`GET /leads/segments-summary`).
- Formulários: destino do lead (status inicial, listas, tags, modo contato), consentimento/honeypot, duplicar, stats por form.
- API: `POST …/convert`, `…/add-to-groups`, `DELETE …/captures/:id`, webhooks `lead.*`.
- Status `qualified` e `spam`; embed com UTM, consentimento e honeypot.

## [2.11.63] — 2026-06-23

### Feat — Leads: excluir formulário + campos customizados

- Botão **Excluir** no card e no editor (API DELETE já existia).
- Editor de campos: ativar/desativar e-mail e mensagem (com obrigatório), adicionar/remover campos extras.
- `customFields` no embed `form.js` e metadados na captura; proxy Vite `/leads`.

## [2.11.62] — 2026-06-23

### Feat — Leads: hub de integração no painel

- Aba **Integrar no site** em `/platform/leads`: embed padrão, API/fetch, HTML, WordPress (CF7), Elementor e construtores.
- Snippets copiáveis por formulário; domínios permitidos no editor; `GET /leads/forms` também com `consent:view`.

## [2.11.61] — 2026-06-23

### Fix — Leads preview "Formulário indisponível"

- GET `/api/leads/public/forms/:key/config` sem checagem de origem (validada no submit).
- `isWebChatOriginAllowed`: em dev, permite request sem Origin/Referer (preview same-origin).
- `form.js` exibe mensagem de erro da API.

## [2.11.60] — 2026-06-23

### Fix — Preview Leads embed vazio

- `form.js`: fallback quando `document.currentScript` é null (script injetado dinamicamente na preview).
- Preview dev auto-carrega formulário ativo via `GET /api/leads/dev/preview-config` (sem `?key=` na URL).

## [2.11.59] — 2026-06-23

### QA — Preview embed Leads + setup script

- `GET /leads/preview.html?key=lfm_…` — página de teste para QA § B.1.
- `npm run qa:leads:setup` — garante formulário ativo, `localhost` em `allowedDomains`, imprime URL.
- `qa:prep` lista formulários Leads ativos.

## [2.11.58] — 2026-06-22

### Feat — Lead → Inbox em um clique

- `POST /api/leads/captures/:id/open-inbox` (`inbox:reply`): cria ou reutiliza conversa, mensagem de sistema com dados do formulário, atribui ao atendente.
- Campo `inboxConversationId` em `LeadCapture`; botões **Iniciar atendimento** / **Continuar no Inbox** na UI Leads.
- `InboxService.openConversationFromLead`; E2E mock da rota.

## [2.11.57] — 2026-06-22

### Feat — Formulário público de Leads + fila por capacidade do atendente

- **Leads:** modelos `LeadForm` / `LeadCapture`, API pública `/api/leads/public`, embed `/leads/form.js`, menu **Contatos → Leads** (`/platform/leads`).
- Captura cria/atualiza `Destination` + segmento Lead (`ContactAutoSegmentService.tagLeadFromForm`).
- **Fila:** `maxConcurrentChatsPerAgent` (padrão 1), round-robin ignora atendentes no limite (Inbox + WebChat + bridge WA), mensagem com posição na fila, scan `processBusySuggestedPriority`.
- E2E mock `/platform/leads`; deep link `?search=` no Inbox; ação **Abrir Inbox** no detalhe do lead.

---

## [2.11.56] — 2026-06-22

### Fix — loop infinito presença no painel

- **Maximum update depth:** callbacks de presença em `actionsRef`; `setPresenceLocal` e sync `/inbox/presence/me` só atualizam quando o valor muda.
- **Build QA:** `CardTitle` aceita `className` (corrige `TeamMembers` / `qa:fase1:e2e`).
- **E2E local:** Playwright limita workers paralelos fora do CI (evita timeout no preview :4174).

---

## [2.11.55] — 2026-06-22

### Fix — bridge WA→WebChat com delay curto

- Respostas via bridge WhatsApp usam humanização **reduzida** (~0,35–1,1s) em vez de zero ou o delay do painel (1,5–10s).
- Painel continua com delay completo para parecer digitação natural no widget.

---

## [2.11.54] — 2026-06-22

### Fix — bridge WA → WebChat instantâneo

- Respostas do atendente via **bridge WhatsApp** (`!assumir`) usam delay curto (~0,35–1,1s) antes de aparecer no widget — não o delay longo do painel (1,5–10s).
- Sincronização do comentário no ticket roda em background para não bloquear a entrega da mensagem.

---

## [2.11.53] — 2026-06-22

### Fix — presença atendentes + fallback WA rotativo

- **Presença:** heartbeat inicial não rebaixa mais atendentes para `offline` (socket ativo → `online` no supervisor e round-robin).
- **Fallback WebChat:** alerta WhatsApp **um atendente por vez** (WA verificado na equipe); sem `!assumir` no timeout → próximo; esgotados → telefones manuais em `whatsappFallbackAlertPhones`.
- Escalação sem ninguém online no painel dispara alerta imediato ao 1º atendente com WA.

---

## [2.11.52] — 2026-06-22

### Fix — OTP WhatsApp perfil

- OTP de confirmação usa `sendOperationalTextMessage` — **não exige** número em Contatos/consentimento.
- Resolve variantes BR (9º dígito) via `onWhatsApp` antes do envio.

## [2.11.51] — 2026-06-22

### Fix — Meu perfil

- **Fix:** `/settings#perfil` travava em "Carregando perfil…" — frontend chamava `/api/auth/me/*` mas rotas estão em `/auth/me/*`; `sessionApi` no painel.

## [2.11.50] — 2026-06-22

### Equipe / Perfil — política e confirmações

- Dono define se atendentes **podem editar** dados em Meu perfil (`teamSettings.allowMembersEditOwnProfile`; padrão: bloqueado).
- Empresa cadastra nome, e-mail e WhatsApp; atendente **sempre confirma** e-mail (OTP) e WhatsApp (OTP), mesmo com edição bloqueada.
- Login **Google** dispensa confirmação de e-mail (já verificado pelo OAuth).
- API: `GET/PATCH /organization/team-settings`, `PATCH /team/members/:id/profile`, `POST /auth/me/email/*`.

## [2.11.49] — 2026-06-22

### Equipe / Perfil — verificação WhatsApp

- Dono/admin **pode** cadastrar WhatsApp do membro na equipe, mas o número **só é salvo após OTP** enviado ao próprio número.
- Membro também confirma em **Meu perfil** com o mesmo fluxo de código de segurança.
- Quando admin inicia o cadastro, o **dono da empresa** recebe aviso de auditoria no WhatsApp verificado dele.
- API: `POST /team/members/:id/whatsapp/request-code`, `…/confirm`, `DELETE …/whatsapp`.

## [2.11.48] — 2026-06-22

### Equipe / Perfil / Inbox

- WhatsApp pessoal: só o próprio membro cadastra com **código OTP** enviado no WA da empresa (`/auth/me/whatsapp/*`).
- Admin não edita mais telefone no modal de papel — `/settings#perfil` + link no header.
- Atendente sem setor atribuído **não vê** filas abertas — só conversas atribuídas a ele (WA + WebChat).

## [2.11.47] — 2026-06-22

### Painel / Notificações

- Notificações do sino **persistidas no Redis** — sobrevivem ao F5 (últimos 80 eventos / 14 dias).
- API: `GET /panel/notifications`, `POST …/read`, `POST …/read-all`, `POST …/ingest` (WA client).
- Página **Ver todas**: `/dashboard/notificacoes` + link no balão do sino.

## [2.11.46] — 2026-06-22

### WhatsApp / Sessões

- **Fix:** erro 440 (conexão substituída) — bloqueia auto-reconnect em loop; exige connect manual.
- **Fix:** dev lock mata processo órfão no hot-reload (ts-node-dev) antes de restaurar WA — causa raiz do 440 em dev.
- **Fix:** **Novo QR** usa `refreshQr` (reinicia socket sem apagar credenciais) em vez de `forceQr`.

## [2.11.45] — 2026-06-22

### WhatsApp / Sessões

- **Fix:** deadlock após escanear QR (código 515 `restartRequired`) — `sessionCreatePromises` impedia nova socket.
- **Fix:** reconexão agendada não bloqueia mais pedido explícito de connect; timers cancelados no `abort`.
- **Fix:** cooldowns de reconexão excessivos revertidos (2s→30s exponencial); auto-reconnect 60s.
- **Fix:** botão **Novo QR** envia `forceQr: true` para gerar QR fresco.

## [2.11.44] — 2026-06-22

### Inbox / Supervisão

- Chat interno: menção `@supervisor` dispara notificação no sino (`inbox:supervisor_help`) para quem tem `inbox:supervise`.
- Dashboard supervisor: card **Pedidos de ajuda**, badge nas conversas ativas e preview da mensagem interna.

---

## [2.11.43] — 2026-06-22

### Estabilidade WhatsApp

- Fix loop conectar/desconectar: `connectInstance` idempotente (não aborta sessão ativa); uma promise por `createWhatsAppSession` (evita erro 440 / ban).
- Reconexão automática: cooldown 30–120s, máx. 5 tentativas; auto-reconnect a cada 5 min via `restoreSession` (sem `abort`).
- Eventos painel: remove pub/sub duplicado; alertas WA com debounce 60s; erro 440 orienta reconexão manual.
- Dev: `ts-node-dev` ignora `sessions/`, `data/`, `test-results/` (Baileys gravava creds e reiniciava o backend em loop).

---

## [2.11.42] — 2026-06-22

### Equipe

- Fix convite de membro: índice `companyMembers` permite vários convites pendentes por empresa (partial `userId`).
- Convite vincula conta existente imediatamente (`linkedAccount`); login Google associa todos os convites pendentes do e-mail (multi-empresa).

---

## [2.11.41] — 2026-06-22

### Testes

- E2E presença operacional: `e2e/qa-fase1-presence.spec.ts` (seletor status + PATCH).
- Script `npm run qa:fase1:all` (Playwright + gate Jest); `qa:fase1:e2e` faz build do frontend antes do preview.
- Fix `InboxSectors.tsx`: `useMemo` antes do guard `canManage` (violação Rules of Hooks quebrava página após `auth/me` async).
- Docs QA: `QA-FASE1-RAPIDO.md`, `QA-FASE1-CHECKLIST.md` atualizados (§ B coberto por E2E mock).

---

## [2.11.40] — 2026-06-22

### Testes

- E2E Playwright § B painel: `e2e/qa-fase1-panel.spec.ts` (tickets, setores, bot, respostas, relatórios, webchat) — `npm run qa:fase1:e2e` (32 testes).
- Fix mock `webchat/stats` no fixture E2E (rota única `/api/webchat/**`).

---

## [2.11.39] — 2026-06-22

### Documentação

- Arquivados em `docs/concluidos/`: `ENTREGA-ATENDIMENTO-2.11.24-28.md`, `ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md`; links atualizados em todo o repo.

---

## [2.11.38] — 2026-06-22

### Corrigido

- CI: `npm audit` — override `undici@6.27.0` (vulnerabilidade high via `discord.js`).

---

## [2.11.37] — 2026-06-22

### Corrigido

- E2E Supervisor: seletor strict mode para métrica «Em atendimento» (`inbox-authenticated.spec.ts`).

### Documentação

- `INDICE-DOCUMENTACAO.md` § QA; `SISTEMA-REGISTRO.md` 2.11.36; `qa-prep` aponta KICKOFF.

---

## [2.11.36] — 2026-06-22

### Corrigido

- Build TypeScript: import `CampaignDispatchService` / `CampaignPriority` em `DashboardService.ts`.

### Documentação

- `QA-FASE1-KICKOFF.md` — ponto de partida gate humano; checklist/ROADMAP sincronizados (2.11.35).

---

## [2.11.35] — 2026-06-22

### Adicionado

- Testes integrados `inbox-inbound-order.integration.test.ts` — ordem ticket → consent → inbox (espelho `WhatsAppService`), CSAT antes de ticket/inbox, complemento ticket, consent bloqueia inbox.

---

## [2.11.34] — 2026-06-22

### Adicionado

- Audit log append-only `AttendanceEvent` para ticket: `ticket.created`, `ticket.client_replied`, `ticket.closed` em `InboxService` (meta sem corpo de mensagem).
- Testes `attendance-audit.service.test.ts` e `inbox-ticket-audit.integration.test.ts` no gate.

---

## [2.11.33] — 2026-06-22

### Adicionado

- Webhooks outbound: `ticket.created`, `ticket.client_replied`, `ticket.closed`, `webchat.bridge.started`, `webchat.bridge.closed` — em `InboxService`, `webchat-whatsapp-bridge.service.ts`, catálogo `WEBHOOK_EVENTS` e UI Webhooks.
- Testes `webhook-events.test.ts` e `webchat-bridge-webhook.test.ts` no gate `qa:atendimento:gate`.
- Doc `WEBHOOKS.md` § payloads ticket/bridge.

---

## [2.11.32] — 2026-06-22

### Adicionado

- E2E Playwright autenticado (mock API): `e2e/inbox-authenticated.spec.ts` — Inbox (lista, fila, thread, Assumir, banner WebChat) + Supervisor (métricas, abas fila/atendimento).
- Fixture `e2e/fixtures/mock-inbox-api.ts` — mock `/auth/me` + APIs Inbox/Supervisor/presença.

---

## [2.11.31] — 2026-06-22

### Adicionado

- Testes integrados `inbox-ticket-inbound.integration.test.ts` — `handleTicketInboundMessage`: novo atendimento, janela 12h, expires inflado, competição fila, CSAT primeiro.

---

## [2.11.30] — 2026-06-22

### Adicionado

- Testes integrados `inbox-csat-reply.integration.test.ts` — `tryHandleCsatReply` + ordem CSAT em `handleInboundMessage` (6 casos no gate).

---

## [2.11.29] — 2026-06-22

### Adicionado

- Testes `panel-critical-alerts.service.test.ts` — cota mensagens/IA, dedup, config fallback e IA sem chave.
- Gate `qa:atendimento:gate` inclui `panel-critical-alerts`.

---

## [2.11.28] — 2026-06-21

Doc detalhada: [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./concluidos/ENTREGA-ATENDIMENTO-2.11.24-28.md).

### Adicionado

- **Fallback WhatsApp deferido:** campo `whatsappFallbackAcceptTimeoutSeconds` (30–900s, padrão 60); após escala na fila aguarda aceite no painel; scan ~60s (`processWebChatFallbackAcceptTimeouts`); evento `webchat:fallback_missed` (urgente, `targetUserId`).
- **Notificações críticas (sino vermelho):** `src/types/panel-events.ts` + `PanelCriticalAlertsService` — plano, cota IA/mensagens, config incompleta; urgentes operacionais: `whatsapp:disconnected`, `inbox:queue_sla`, `inbox:ticket_sla`.
- Eventos `billing:*`, `ai:quota_*`, `system:critical_config` — `ownerOnly` (`billing:view`).

### Corrigido

- **WebChat IA Básica:** `WebChatBasicTriageService` / `isBasicTriageMode` — não cai no menu robotizado na 1ª mensagem.
- **Fallback com atendente online:** presença por heartbeat (`availableForQueue`); fallback removido de `escalateToQueue` imediato.
- **Testes:** mock `whatsapp-send-policy` em `WhatsAppService.test.ts`.

---

## [2.11.25] — 2026-06-21

Doc detalhada: [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./concluidos/ENTREGA-ATENDIMENTO-2.11.24-28.md) §3.

### Adicionado

- **Status operacional:** `online`, `ausente`, `ocupado`, `offline`, `supervisor_online` — seletor header, auto-ausente por inatividade, RR/fila por `availableForQueue`.
- API `GET/PATCH /inbox/presence/me`, `GET /inbox/presence/team`, `PATCH /inbox/presence/:userId`, `GET /inbox/presence/config`.
- Campo `presenceIdleTimeoutSeconds` (60–3600s, padrão 300); constantes `src/constants/agent-presence.ts`.
- Frontend: `agentPresenceContext`, `useAgentPresenceHeartbeat`, `AgentStatusSelector`.

---

## [2.11.24] — 2026-06-21

Doc detalhada: [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./concluidos/ENTREGA-ATENDIMENTO-2.11.24-28.md) §2.

### Adicionado

- **Supervisão avançada:** `GET /inbox/supervisor/dashboard` — equipe, presença, conversas ativas WA+WebChat, fila unificada, métricas 7d (TMA, puxar fila, CSAT).
- `InboxSupervisorDashboardService`, tipos `inbox-supervisor.ts`, `SupervisorMonitorDrawer`.
- Reassign supervisor inclui IDs `wc:`.

---

## [2.11.16] — 2026-06-21

### Adicionado / corrigido

- Auditoria completa reescrita: [`ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md`](./concluidos/ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md) (revisão 2, evidências no código).
- Script `npm run qa:atendimento:gate` — jest atendimento crítico + `qa:webchat-wa`.
- Anti-loop alerta fallback WebChat: ignora telefones que coincidem com sessão Baileys (`filterFallbackAlertPhones`).

---

## [2.11.15] — 2026-06-21

### Documentação

- Pasta [`concluidos/`](./concluidos/README.md) — 12 entregas finalizadas arquivadas (fases modos 1–8, FAQ WA, upgrade Inbox, audit menus).
- Links atualizados em índice, consolidado, CHANGELOG e protocolo de versionamento.

---

## [2.11.14] — 2026-06-21

### Documentação

- Consolidação rascunhos GG → `PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md`, [`ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md`](./concluidos/ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md), `RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md`.
- `TICKET-ATENDIMENTO.md` § mensagens visíveis vs `!nota` interna.
- `INDICE-DOCUMENTACAO.md` atualizado.

---

## [2.11.13] — 2026-06-21

### Adicionado

- Chamado WebChat: mensagens ao cliente (`comments`) publicadas no chat e consulta TK+token; `!nota` e notas internas só equipe.
- Bridge WA `TK-…` sincroniza `comments`; visitante sincroniza `clientReplies`.

---

## [2.11.11] — 2026-06-21

### Corrigido

- Consulta pública: oculta intake/bridge; rejeita assunto placeholder do alerta WA `!abrir`.

---

## [2.11.10] — 2026-06-21

### Corrigido

- Atualização de chamado WebChat enviada ao visitante (não WhatsApp); consulta TK+token prioriza token e ampliada.

---

## [2.11.9] — 2026-06-19

### Adicionado / alterado

- Menu `!ajuda` reorganizado por seções (atendimento, consulta, encerrar).
- **`!abertos`** / **`!meus`** — listar chamados abertos ou atribuídos ao atendente.
- **`!nota TK-…`** — nota interna no chamado.
- **`!abrir TK-… motivo`** — texto após a referência vira assunto + nota interna (@setores); visitante só recebe token.

---

## [2.11.8] — 2026-06-19

### Adicionado

- Comando WhatsApp **`!abrir TK-XXXX`** (alias `!abrirchamado`) — abre chamado formal no chat do site e envia token ao visitante (paridade com painel Inbox).
- Alerta fallback WA e `!ajuda` atualizados com `!abrir`.

---

## [2.11.7] — 2026-06-19

### Corrigido

- **`!assumir`** no WebChat volta a **não abrir chamado** — só assume conversa + bridge WhatsApp.
- Abertura formal + token ao visitante permanecem só em **Inbox → Abrir chamado** (ou IA quando configurada).
- **`!token`** exige chamado já aberto no painel.

---

## [2.11.6] — 2026-06-19

### Corrigido (revertido em 2.11.7)

- ~~`!assumir` abria chamado automaticamente~~ — comportamento incorreto para o produto.

---

## [2.11.5] — 2026-06-19

### Adicionado / alterado

- **WebChat painel:** editor guiado (navegação lateral, simples/avançado, visão geral, barra de salvar, duplicar widget).
- **Preview:** `livePreviewTemplateId`, prévia interativa Chat Box, fixes overlay e sessão local.
- **Widget/API:** `previewTemplateId` na config pública; localhost liberado em dev; notas de contato truncadas (2000 chars).

### Documentação

- `docs/WEBCHAT.md` — seção contrato painel ↔ widget (2.10.100–2.10.105).

---

## [2.11.4] — 2026-06-19

### Adicionado

- **Fase 8:** E2E Playwright autenticado (mock API) dos 4 modos em `/platform/inbox/ia`.
- Fixtures `e2e/fixtures/mock-panel-api.ts` + spec `e2e/attendance-modes.spec.ts`.
- `data-testid` nos cards de `AttendanceModePicker`.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-8.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-8.md)

---

## [2.11.3] — 2026-06-19

### Adicionado

- **Fase 7:** campo `usageKind` em `AiUsage` — contadores Premium vs IA Básica (LLM fallback).
- `GET /platform/ai/usage` retorna `totals.byKind` e linhas tipadas.
- UI Logs: breakdown por modo + tabela de chamadas; Geral mostra uso diário por modo.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-7.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-7.md)

---

## [2.11.2] — 2026-06-19

### Alterado

- **Fase 6:** WebChat alinhado ao modo global — IA Premium conversacional só com `premium_assistant` + toggle do widget.
- `GET /webchat/ai-status` retorna `attendanceMode`, `premiumAiAllowed`, `globalModeHint`.
- UI WebChat: checkbox renomeado; desabilitado fora de Premium.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-6.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-6.md)

---

## [2.11.1] — 2026-06-19

### Adicionado

- **IA Básica (Fase 5):** modo `basic_triage` com classificador local, auto-resolve KB/skills, encaminhamento por setor (WA + WebChat).
- `AiBasicTriageService`, `WebChatBasicTriageService`, `basic-triage-classifier.ts`.
- Campo `basicTriageLlmFallbackEnabled` em `AiPrompt` — LLM RadarZap opcional em ambiguidade.
- `AiProviderService.completeForBasicTriage()` — fallback econômico.

### Alterado

- UI `/platform/inbox/ia`: card IA Básica habilitado; banner e toggle LLM fallback.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-5.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-5.md)
- Consolidado modos atualizado para `2.11.1`.

---

## [2.11.0] — 2026-06-19

### Adicionado

- **Governança:** protocolo oficial de versionamento e documentação em `.md` ([`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md)).
- **Índice:** [`INDICE-DOCUMENTACAO.md`](./INDICE-DOCUMENTACAO.md) com mapa de todos os docs relevantes.
- **Modos de atendimento (baseline minor):** Fases 1–4 agrupadas sob versão de produto `2.11.0`.

### Documentação

- Consolidado modos: [`RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`](./RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md).
- Análise: [`ANALISE-MODOS-ATENDIMENTO.md`](./concluidos/ANALISE-MODOS-ATENDIMENTO.md).
- Fases: [`PHASE-1`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-1.md), [`PHASE-3`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-3.md), [`PHASE-4`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-4.md).
- [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md) sincronizado até `2.11.0`.

**Commits:** `171b078`, `f899af0`, `b240284`, `2cc2b2a`

---

## [2.10.108] — 2026-06-19

### Adicionado

- WebChat: menu robotizado quando `AiSettings.attendanceMode === robotic` (`WebChatRoboticTriageService`, reusa `inbox-triage.ts`).

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-4.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-4.md)

**Commit:** `f899af0`

---

## [2.10.107] — 2026-06-19

### Adicionado

- Campo `attendanceMode` em `AiSettings` (Mongo) com backfill lazy.
- API `GET/PATCH /platform/ai/settings` inclui `settings.attendanceMode`.
- `isAiActive()` exige `premium_assistant`; helper `shouldRunGenerativeAi()`.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-3.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-3.md)

**Commit:** `b240284`

---

## [2.10.106] — 2026-06-19

### Adicionado

- Tipos e adapter `src/types/attendance-mode.ts` (modo × provedor legado).
- UI `/platform/inbox/ia`: 4 cards de modo + seção Provedor da IA.
- Componentes `AttendanceModePicker`, `lib/attendanceMode.ts`.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-1.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-1.md)
- [`ANALISE-MODOS-ATENDIMENTO.md`](./concluidos/ANALISE-MODOS-ATENDIMENTO.md)

**Commit:** `2cc2b2a`

---

## Entregas anteriores

Ver changelog completo em [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md) (versões `2.0.0` – `2.10.105` e demais patches WebChat/Inbox).

---

## Próxima entrada (template)

```markdown
## [2.11.x] — YYYY-MM-DD

### Adicionado / Alterado / Corrigido
- …

### Documentação
- …

**Commit:** `…`
```
