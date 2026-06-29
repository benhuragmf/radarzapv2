# RadarZap v2 — registro do sistema

> Espelho versionado de `.cursor/rules/radarzap-v2-system-registry.mdc` (pasta `.cursor/` não vai ao git).

**Versão atual:** `2.12.70` (`package.json`) · **Última revisão doc:** 2026-06-28

Documentação por módulo: [`INDICE-DOCUMENTACAO.md`](./INDICE-DOCUMENTACAO.md) · **Mestre:** [`RADARZAP-SISTEMA-COMPLETO.md`](./RADARZAP-SISTEMA-COMPLETO.md) · **Pendências humanas:** [`PENDENCIAS-HUMANAS-FASE1.md`](./PENDENCIAS-HUMANAS-FASE1.md) · **Resultado TOP 01–20:** [`concluidos/RADARZAP-RESULTADO-FINAL-TOP-01-20.md`](./concluidos/RADARZAP-RESULTADO-FINAL-TOP-01-20.md) · **QA manual:** [`QA-FASE1-RESULTADO-TEMPLATE.md`](./QA-FASE1-RESULTADO-TEMPLATE.md) · [`concluidos/`](./concluidos/README.md) · [`CHANGELOG.md`](./CHANGELOG.md) · [`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md) · `MENU-PAGES-REGISTRY.md`, `INBOX-ATENDIMENTO.md`, **`CONTATOS-CLASSIFICACAO.md`**, **`IA-CREDITOS-E-CARTEIRA.md`**, `TICKET-ATENDIMENTO.md`, `WEBCHAT.md`, `RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`, `EQUIPE-RBAC.md`, `CONSENTIMENTO-LGPD.md`, `RADARZAP-V2-MIGRACAO.md`, `ROADMAP-COMPLETUDE.md`, **`PREPARACAO-PRODUCAO.md`**, **`PRODUCTION.md`**, `BILLING.md`

---

## Changelog (semver interno)

| Versão | Escopo principal |
|--------|------------------|
| **2.12.70** | Layout v3 Fases 2–4 (menu, header, design system integrações) + Coolify compose/docs |
| **2.12.69** | Inatividade automática: mensagens editáveis + gate manual separado |
| **2.12.68** | Gate atalhos separado inatividade vs encerramento natural |
| **2.12.66** | IA Premium: sem KB não inventa planos/preços — resposta “não tenho informações confirmadas” |
| **2.12.65** | Fix LGPD opt-out × triagem IA — defer atendimento, keywords sem sim/ok |
| **2.12.64** | Docs: `PENDENCIAS-HUMANAS-FASE1.md`, arquivamento `concluidos/`, ROADMAP/WEBCHAT alinhados |
| **2.12.63** | AH-D04 portal LGPD tenant — export JSON + anonimização + eventos |
| **2.12.62** | AH-S01 degraded boot dev (Redis opcional); health `degraded` |
| **2.12.61** | AH-M05 bridge dedup Redis SET NX + fallback in-memory |
| **2.12.60** | Admin Ops: hub link aba IA em ai-blueprint/platform; depreciação GET `/admin/organizations` |
| **2.12.59** | AH-R08 rota consent block; AH-D03 doc audit IA; encerramento auditoria horizontal |
| **2.12.58** | AH-R07 health público mínimo + `/admin/ops/infra-health`; índice AttendanceEvent admin |
| **2.12.57** | AH-B02 dev billing flag; AH-M04 testes cross-tenant; AH-S05 doc bridge dedup |
| **2.12.56** | AH-S04 `/services/health` Mongo+Redis+filas; AH-S01 runbook SPOF Mongo/Redis |
| **2.12.55** | AH-R06 Socket.IO CORS + presença wcp_ HMAC; AH-M03 Inbox findById → clientId |
| **2.12.54** | AH-R05 ingest sino WA hardened + AH-D02 TTL AuditLog/AttendanceEvent |
| **2.12.53** | AH-E02 security-events: paginação `page` + fetch plan Mongo por fonte |
| **2.12.52** | AH-D01/W02 embed fail-closed prod + alerta painel domínios vazios |
| **2.12.51** | AH-E01 Admin Ops `?status=` — filtro Mongo sem full scan + status `manual` |
| **2.12.50** | AH-S03 timeout IA (`fetchWithTimeout`) + AH-S02 rate limit fail-closed prod |
| **2.12.49** | AH-R03/R04 rotas plano legado → Admin Ops + AuditLog |
| **2.12.48** | AH-R02 filas BullMQ tenant-scoped + sanitização `job.data` |
| **2.12.47** | AH-R01 `GET /api/stats` tenant-scoped |
| **2.12.46** | Auditoria horizontal segurança/dados/estabilidade + hardening WebChat anexo + leads GET origin |
| **2.12.45** | Admin Ops Etapa 10: Bloco E local, E2E plano/tenants, prep push |
| **2.12.44** | Admin Ops Etapa 9 + reconciliação 8–9 (verificação real docs×git) |
| **2.12.43** | Admin Ops Etapa 8: consolidação admin legado |
| **2.12.42** | Admin Ops Etapa 7: QA manual local, gate Mongo, commit seguro |
| **2.12.41** | Admin Ops Etapa 6: QA final, API docs, OpenAPI, anti-segredo |
| **2.12.40** | Admin Ops Etapa 5: feed global eventos críticos aba Segurança |
| **2.12.39** | Admin Ops Etapa 4: listagem empresas + ações trial/plano |
| **2.12.38** | Admin Ops: frontend `/admin/dashboard` com abas e summary global |
| **2.12.37** | Admin Ops: `GET /api/admin/ops/summary` — agregador dashboard global seguro |
| **2.12.19** | Classificação Pacote J: Supervisor `?class=` + atalhos Inbox nos relatórios |
| **2.12.18** | Classificação Pacote I: filtro `?class=` no Inbox (server-side WA + WebChat) |
| **2.12.17** | Classificação Pacote H: badges Supervisor, atalhos `/platform`, consolidação doc — `CONTATOS-CLASSIFICACAO.md`, `INBOX-ATENDIMENTO.md` |
| **2.12.16** | Classificação Pacote G: badges Inbox lista, doc módulo, testes filtros/CSV |
| **2.12.15** | Classificação Pacote F: `GET /destinations?class=`, export CSV contatos/stats |
| **2.12.14** | Classificação Pacote E: KPIs em `/platform/reports` |
| **2.12.13** | Classificação Pacote D: filtros `/contact?class=`, card WebChat Inbox |
| **2.12.12** | Classificação Pacote C: Leads stats/filtros/badges |
| **2.12.11** | Classificação Pacote B: automações + OpenAPI + bloqueio envio |
| **2.12.10** | Classificação Pacote A: segmentos dinâmicos + backfill |
| **2.12.9** | Conta: remover e-mail ao desvincular Google |
| **2.12.8** | Conta: desvincular Google (`DELETE /auth/account/google`) |
| **2.12.7** | Admin IA plataforma: credenciais criptografadas + relatório uso — `/admin/ai-platform` |
| **2.12.6** | TOP 20: congelamento/go-live controlado + TOP 21 extra: doc final única — `RADARZAP-RESULTADO-FINAL-TOP-01-20.md`, `concluidos/top/RADARZAP-TOP-21-DOCUMENTACAO-FINAL-UNICA-ORGANIZACAO.md` |
| **2.12.5** | TOP 19: QA final, regressão, checklist pré-go-live — `docs/concluidos/top/RADARZAP-TOP-19-QA-FINAL-REGRESSAO-GO-LIVE.md` |
| **2.12.4** | TOP 18: auditoria/segurança/LGPD/hardening — `docs/concluidos/top/RADARZAP-TOP-18-AUDITORIA-SEGURANCA-LGPD-HARDENING.md` |
| **2.12.3** | TOP 17: billing/assinaturas/limites/bloqueios — `docs/concluidos/top/RADARZAP-TOP-17-BILLING-ASSINATURAS-LIMITES-BLOQUEIOS.md` |
| **2.12.2** | TOP 16: IA Créditos/carteira/consumo/fallback — `docs/concluidos/top/RADARZAP-TOP-16-IA-CREDITOS-CARTEIRA-CONSUMO-FALLBACK.md` |
| **2.12.1** | TOP 15: IA Premium/KB/handoff — `docs/concluidos/top/RADARZAP-TOP-15-IA-PREMIUM-KB-HANDOFF.md` |
| **2.12.0** | TOP 14: IA Básica/triagem/encaminhamento — `docs/concluidos/top/RADARZAP-TOP-14-IA-BASICA-TRIAGEM-ENCAMINHAMENTO.md` |
| **2.11.99** | TOP 13: Bridge WebChat↔WhatsApp — `docs/concluidos/top/RADARZAP-TOP-13-BRIDGE-WEBCHAT-WHATSAPP.md` |
| **2.11.98** | TOP 12: WhatsApp/sessão/QR/reconexão/comandos + doc mestre — `docs/concluidos/top/RADARZAP-TOP-12-WHATSAPP-SESSAO-QR-RECONEXAO-COMANDOS.md`, `docs/RADARZAP-SISTEMA-COMPLETO.md` |
| **2.11.97** | TOP 11: WebChat/widget/fallback/experiência visitante — `docs/concluidos/top/RADARZAP-TOP-11-WEBCHAT-WIDGET-FALLBACK-EXPERIENCIA.md` |
| **2.11.96** | TOP 10: formulários públicos/embed/captura — `docs/concluidos/top/RADARZAP-TOP-10-FORMULARIOS-PUBLICOS-EMBED-CAPTURA-LEADS.md` |
| **2.11.95** | TOP 09: contatos/leads/Kanban/deduplicação — `docs/concluidos/top/RADARZAP-TOP-09-CONTATOS-LEADS-KANBAN-DEDUPLICACAO.md` |
| **2.11.94** | TOP 08: tickets/chamados TK, token público, SLA, rastreabilidade — `docs/concluidos/top/RADARZAP-TOP-08-TICKETS-CHAMADOS-TK-RASTREABILIDADE.md` |
| **2.11.93** | TOP 07: Inbox fila/atribuição/transferência — `docs/concluidos/top/RADARZAP-TOP-07-INBOX-CONVERSAS-FILA-TRANSFERENCIA.md` |
| **2.11.92** | TOP 06: modos atendimento unificados + híbrido mínimo — `docs/concluidos/top/RADARZAP-TOP-06-MODOS-ATENDIMENTO.md` |
| **2.11.91** | TOP 05: presença/fila — limite simultâneo por plano, supervisor_online no socket, offline risk — `docs/concluidos/top/RADARZAP-TOP-05-STATUS-PRESENCA-FILA.md` |
| **2.11.90** | TOP 04: RBAC/equipe — limites assentos por plano, papéis Financeiro/Marketing/Viewer, testes cross-tenant — `docs/concluidos/top/RADARZAP-TOP-04-RBAC-PERMISSOES-EQUIPE-SEGURANCA.md` |
| **2.11.89** | TOP 03: matriz comercial `config/plans.json`, validador planos, IA créditos do catálogo — `docs/concluidos/top/RADARZAP-TOP-03-PLANOS-MENSALIDADES-LIMITES.md` |
| **2.11.88** | TOP 02: baseline gates — fix TS `WebChatService`, frontend `InboxBotSettings`, mock CSAT, CI `tsc -b` frontend — `docs/concluidos/top/RADARZAP-TOP-02-GOVERNANCA-BASELINE-GATES.md` |
| **2.11.86** | Fix detalhe chamados WebChat (`WebChatService` imports); refs `TK-…` sem ambiguidade 0/O; erro real no painel — `INBOX-ATENDIMENTO.md` § Lista × detalhe |
| **2.0.0** | Migração limpa do v1; microserviços; painel `/api`; Baileys; campanhas; consentimento LGPD base |
| **2.0.x** | Inbox MVP (triagem, filas, bot, round-robin, WS); segmentos automáticos; tickets; mídia; respostas rápidas |
| **2.1.0** | Setores internos (`internalRank`); papéis custom ilimitados; consentimento 1x/2x; scroll navegador no painel |
| **2.2.0** | Webhooks outbound (HMAC, fila, retry, eventos Inbox); CI GitHub Actions |
| **2.2.1** | Inbox SLA: encerramento por inatividade (`/enc` + auto), aviso `/aus`, alerta fila parada, webhook `inbox.conversation.closed` |
| **2.2.2** | Convite de equipe por e-mail (Resend/SMTP), reenvio, `EmailService` |
| **2.3.0** | CI: build TypeScript backend; mobile: menu hamburger + Inbox responsivo |
| **2.4.0** | Billing Stripe: checkout, webhooks HMAC, pedidos, expiração, UI `/plans` e `/admin/payments` |
| **2.5.0** | Backup tenant JSON, CSAT Inbox, admin ops, Docker monolito, PWA manifest, Cloud API stub |
| **2.5.1** | Deploy CI (GHCR+SSH), E2E Playwright, OpenAPI rotas v2.5, touch mobile, docs |
| **2.5.2** | Segurança (IDOR, criptografia, `PRODUCTION.md` §8); consentimento: fila `pendingOutboundDeliveries` antes do conteúdo; tickets assíncronos: janela 12h, grace 30min, menu 2h (`sair`/`finalizar`) — ver `INBOX-ATENDIMENTO.md` |
| **2.6.0** | IA Atendimento: triagem WhatsApp (RadarZap / chave própria / **desativada = bot fixo apenas**), painel `/platform/inbox/ia`, fallback `ai_fallback_standard`, colisão menu inbox×ticket (`1`/`2`) — ver `INBOX-ATENDIMENTO.md` § Ordem inbound, § IA opcional, § Colisão |
| **2.6.1** | IA: confirmação de nome (`nameConfirmed`, `registryNameSnapshot`); ticket: ack curto (*Positivo*) inicia 12h sem prompt 30min, prioridade sobre triagem/IA — ver `TICKET-ATENDIMENTO.md`, `INBOX-ATENDIMENTO.md` § Coleta cadastro |
| **2.6.2** | Ticket: doc máquina de estados (nomenclatura 12h retorno / 2h captura / 30min complemento; `status` × `ticketInboundMode`); fix janela 12h no envio equipe; ack mantém janela (não inicia) e não captura durante IA — ver `TICKET-ATENDIMENTO.md`, `INBOX-ATENDIMENTO.md` § Tickets de acompanhamento |
| **2.6.3** | Ticket: menu pós-30min com 3 opções (complemento / novo / aguardar); campo `lastTeamMessageAt` — ver `TICKET-ATENDIMENTO.md` |
| **2.6.4** | IA Atendimento: complemento em ticket existente via `appendTicketClientReplyFromAi`, `targetTicketRef` em `AiConversationState`, JSON `shouldAppendToTicket` — ver `TICKET-ATENDIMENTO.md` § Complemento via IA |
| **2.6.5** | Fix IA+ticket: confirmação quando API cai mas dado foi salvo; ticket fechado → `client_replied`; inferência TK da última msg da IA |
| **2.6.6** | Fix IA+ticket: "não foi resolvido" não encerra conversa/CSAT; confirmação imediata ao complementar ticket |
| **2.6.7** | IA: menu numerado para escolher ticket entre múltiplos chamados (`pendingTicketChoices`) |
| **2.7.0** | Ticket: SLA equipe (24h), status enriquecidos, menu bot WhatsApp (`TicketClientMenuService`), ações rápidas painel — ver `TICKET-ATENDIMENTO.md` |
| **2.7.1** | Ticket+IA: classificação de intenção (`ticket-client-intent`), `AiTicketAssistService` (status/recusa/KB antes de gravar), mesmo assist no bot fixo — ver `TICKET-ATENDIMENTO.md` § Assistente inteligente |
| **2.7.2** | Fix IA+ticket: `human_request` (atendente) escala sem gravar; `exit_close` (sair, pode finalizar) não vira complemento |
| **2.8.0** | Design system painel: tokens `--rz-*`, `src/design-system/` (shell, estados, forms, Sonner), migração visual das páginas tenant/admin/discord |
| **2.8.1** | Design system polish: inbox/chat, logs, plataforma (automations, templates, contatos), integrações API, utilitários (`destinationUi`, `campaigns`) |
| **2.8.2** | Design system: migração final `gray-*` → tokens `--rz-*` em envios, contatos, inbox admin, Discord e páginas tenant restantes |
| **2.8.3** | Tokens preview WhatsApp (`--rz-wa-*`), contraste (`--rz-on-accent`), classes `rz-wa-preview-*` e `waPreviewPanelCls` |
| **2.8.4** | Tokens preview Discord (`--rz-discord-*`), OAuth login (`.rz-oauth-btn-*`), `discordPreviewPanelCls`, zero hex hardcoded no frontend |
| **2.8.5** | Consentimento LGPD com tokens; paleta WA centralizada; `searchFieldIconCls`, labels preview, `logLineMetaCls`, QR frame; doc `DESIGN-SYSTEM.md` |
| **2.8.6** | Inbox: presença online (socket), round-robin só atendentes online, alerta `priority_expired`, composer com rascunho + assign otimista, limpeza prioridade offline |
| **2.8.7** | Fix IA triagem: escalonamento imediato quando resposta promete encaminhamento; detecção "falar com comercial"; resolução setor pelo texto; scan recupera triagens travadas — ver `INBOX-ATENDIMENTO.md` § Escalação IA |
| **2.8.8** | Fix CSAT: pesquisa ao **Finalizar** (`resolveConversation`); `"avaliar"` não abre ticket; CSAT tem prioridade sobre ticket; status `resolved` + `closed` — ver `INBOX-ATENDIMENTO.md` § CSAT |
| **2.8.9** | Fix ticket: janela 12 h só renova em envio **via Ticket** (`sendTicketMessageToClient`); inbox/finalizar/CSAT não reativam TK antigo — ver `TICKET-ATENDIMENTO.md` § Janela de retorno |
| **2.8.10** | Ticket fechado: janela exige `lastTeamMessageAt` recente (ignora `clientReplyExpiresAt` inflado pelo inbox pré-2.8.9) — `ticket-reply-window.util.ts` |
| **2.8.11** | Fix CSAT: *ola* / novo atendimento libera Inbox com `csatPending`; só uma pesquisa pendente por contato — ver `INBOX-ATENDIMENTO.md` § CSAT |
| **2.9.0** | WebChat: widget `/webchat/widget.js`, API pública, painel `/platform/webchat`, socket — `WEBCHAT.md` |
| **2.9.1** | WebChat: editor de widget no painel, páginas teste `/webchat/widget.html` e `/webchat/demo.html`, proxy Vite `/webchat` |
| **2.9.2** | WebChat: conversas encerradas, stats não lidas, som no painel, nova conversa no widget |
| **2.9.3** | WebChat: badge menu, notificação browser, reabrir conversa, assign agente na 1ª resposta |
| **2.9.4** | WebChat: resposta automática por widget, nome do remetente no bubble, rate limit API pública |
| **2.9.5** | WebChat: modo IA na auto-resposta (`WebChatAiService`, fallback mensagem fixa) |
| **2.9.6** | WebChat: fila de escalação (`queueStatus`), setor padrão no widget, aba Na fila, `POST …/escalate`, auto-escalação IA |
| **2.9.7** | WebChat: horário comercial (herda Inbox ou custom), `isOnline` na API pública, aviso offline no widget |
| **2.9.8** | WebChat: status fila no widget visitante; webhooks `webchat.message.received`, `webchat.conversation.escalated/closed` |
| **2.9.9** | WebChat: ponte Inbox (banner, métrica, `webchat:escalated`, `myWaitingQueueCount`, deep link) |
| **2.10.0** | WebChat: lista unificada no Inbox (`?channel=all`, IDs `wc:`, reply/resolve no Inbox) |
| **2.10.1** | WebChat: round-robin na fila do site (prioridade/aceitar/puxar via Inbox) |
| **2.10.2** | WebChat: anexos de imagem no widget visitante |
| **2.10.3** | WebChat: atendente envia imagens no painel (WebChat + Inbox) |
| **2.10.4** | WebChat: PDF no widget/painel + legenda opcional em anexos |
| **2.10.5** | WebChat Inbox: paridade WhatsApp — assign obrigatório, quick replies `/bd` `/enc`, transferência, assumir da IA — ver `WEBCHAT.md` |
| **2.10.6** | WebChat fila global no Inbox — visível a todos atendentes (`inbox:view`), Assumir igual WhatsApp — ver `WEBCHAT.md` |
| **2.10.7** | `/platform/webchat` = histórico + widgets; atendimento ativo só no Inbox — ver `WEBCHAT.md` |
| **2.10.8** | Fix WebChat: IA continua em triagem após 1ª resposta; Finalizar não reabre conversa — ver `WEBCHAT.md` |
| **2.10.9** | Fix widget: encerramento reconhecido no visitante; botão fechar + rodapé sem composer — ver `WEBCHAT.md` |
| **2.10.10** | Rate limit WebChat: limiter dedicado; dev relaxado — ver `WEBCHAT.md` |
| **2.10.11** | Fix IA WebChat (contador usage); pré-chat nome/e-mail; widget aguarda formulário — ver `WEBCHAT.md` |
| **2.10.16** | WebChat: modelos de preview (clássico, tecnológico, SaaS, minimal) + aplicar visual no painel — ver `WEBCHAT.md` |
| **2.10.17** | WebChat widget: tema escuro (`appearance.theme`) alinhado ao modelo tecnológico — ver `WEBCHAT.md` |
| **2.10.18** | Atendimento: upgrade visual (Inbox 3 colunas, métricas, Tickets/Setores/Bot/Respostas/Supervisor/WebChat/IA/Relatórios), paginação server-side em `GET /inbox/tickets` — ver `concluidos/radarzap-inbox-upgrade.md` |
| **2.10.19** | CI: `npm audit` runtime (high+) verde — `npm audit fix`, nodemailer 9.0.1; kit QA Fase 1 (`qa:prep`, roteiro, E2E atendimento-smoke, `parseTicketListQuery`) |
| **2.10.70** | WebChat: consulta de chamado por `TK-…` + token no widget — `concluidos/RADARZAP_WHATSAPP_TICKET_FAQ_IMPLEMENTATION.md` |
| **2.10.71** | WebChat: FAQ/base de conhecimento com links e chips no widget |
| **2.10.72** | WebChat: fallback WhatsApp offline + presença heartbeat (`agent:heartbeat`) — `WEBCHAT.md` |
| **2.10.73** | WhatsApp: comandos `!assumir` / `!ticket` / `!encerrar` (whitelist Equipe) |
| **2.10.74** | WebChat: bridge bidirecional site ↔ WhatsApp após `!assumir` |
| **2.10.75** | Inbox: badge Bridge WA; docs QA fases A–F — commit `98b06c3` |
| **2.10.76** | QA: `npm run qa:webchat-wa`, `qa:prep` checa fallback + whitelist WA, template resultado |
| **2.10.77** | QA: `npm run qa:webchat-wa:setup`; label WhatsApp Equipe (bridge/comandos) |
| **2.10.78** | WhatsApp: `!encerrarchat` desativa bridge sem fechar chamado; `!encerrar` finaliza |
| **2.10.79** | WebChat: reenvio de token de consulta por WhatsApp (widget + `POST …/resend-token`) |
| **2.10.80** | WebChat: reenvio de token por e-mail + envio automático na abertura do chamado |
| **2.10.81** | Fix: consulta de token carrega `publicAccessTokenHash` (campo select:false) |
| **2.10.86** | WebChat: confirmação de leitura estilo WhatsApp (receipts widget + Inbox) |
| **2.10.83** | WebChat: OTP 2 etapas no reenvio de token de chamado |
| **2.10.87** | Hardening pós-auditoria: OTP Redis, rate limit receipts, lint, CSRF connect WA, backfill deliveredAt |
| **2.10.106** | Modos atendimento Fase 1: UI 4 cards + adapter `attendance-mode.ts` — `concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-1.md` |
| **2.10.107** | Modos atendimento Fase 3: `attendanceMode` em `AiSettings` + backfill — `concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-3.md` |
| **2.10.108** | Modos atendimento Fase 4: WebChat robotizado — `concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-4.md` |
| **2.11.0** | **Baseline modos de atendimento** (Fases 1–4) + protocolo versionamento/docs `.md` — `RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`, `VERSIONAMENTO-E-DOCUMENTACAO.md`, `CHANGELOG.md` |
| **2.11.1** | Modos Fase 5: IA Básica (`basic_triage`) — classificador local + KB + encaminhamento WA/WebChat — `concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-5.md` |
| **2.11.2** | Fase 6: WebChat alinhado ao modo global — IA Premium só com `premium_assistant` — `concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-6.md` |
| **2.11.9** | WA: menu !ajuda, !abertos, !meus, !nota; !abrir TK + motivo interno — `WEBCHAT.md` |
| **2.11.10** | Fix: atualização chamado WebChat ao visitante; consulta TK+token ampliada — `TICKET-ATENDIMENTO.md` |
| **2.11.11** | Consulta pública: filtra intake/bridge; assunto placeholder WA rejeitado — `TICKET-ATENDIMENTO.md` |
| **2.11.13** | Mensagens ao cliente vs `!nota` interna; sync comments/replies WebChat+bridge — `TICKET-ATENDIMENTO.md` |
| **2.11.14** | Docs: plano GG→oficial, auditoria estabilização, visão produto — `PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md` |
| **2.11.8** | Comando WhatsApp `!abrir` — abre chamado WebChat + token ao visitante — `WEBCHAT.md` |
| **2.11.7** | Fix: `!assumir` WebChat não abre chamado — só Abrir chamado no painel envia token — `WEBCHAT.md` |
| **2.11.6** | (revertido) `!assumir` abria chamado automaticamente |
| **2.11.5** | WebChat: editor guiado painel widgets, preview interativa, `previewTemplateId` na API pública — `WEBCHAT.md` |
| **2.11.4** | Fase 8: E2E Playwright modos de atendimento (mock auth) — `concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-8.md` |
| **2.11.3** | Fase 7: custos/logs LLM por modo (`usageKind` Premium vs Básica) — `concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-7.md` |
| **2.11.15** | Docs: pasta `concluidos/` — arquivar entregas finalizadas (fases modos, FAQ WA, upgrades UI) |
| **2.11.16** | Auditoria atendimento revisão 2; `qa:atendimento:gate`; anti-loop alerta fallback WebChat — [`ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md`](./concluidos/ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md) |
| **2.11.17** | Rate limit WA tipado + jitter; `GET /platform/health/atendimento`; `AttendanceEvent` bridge; `PILOT_MODE` — `PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md` |
| **2.11.24** | Supervisão avançada: dashboard equipe/presença/monitor conversa WA+WebChat, métricas 7d — `INBOX-ATENDIMENTO.md` § Supervisor |
| **2.11.25** | Presença operacional atendentes (`online`/`ausente`/`ocupado`/`offline`/`supervisor_online`); round-robin por disponibilidade — `INBOX-ATENDIMENTO.md` |
| **2.11.28** | Fallback WA deferido (`whatsappFallbackAcceptTimeoutSeconds`); sino vermelho alertas críticos (`panel-events.ts`, plano/IA/cota/config); fix IA Básica WebChat — `INBOX-ATENDIMENTO.md`, `WEBCHAT.md` |
| **2.11.29** | Testes `panel-critical-alerts.service.test.ts` no gate — dedup, cota msg/IA, config fallback/IA |
| **2.11.30** | Testes integrados CSAT inbound (`inbox-csat-reply.integration.test.ts`) — ordem antes de nova conversa |
| **2.11.31** | Testes integrados ticket inbound (`inbox-ticket-inbound.integration.test.ts`) — release/capture/competição |
| **2.11.32** | E2E Inbox/Supervisor autenticado (mock API) — `inbox-authenticated.spec.ts` |
| **2.11.33** | Webhooks outbound ticket/bridge — `ticket.*`, `webchat.bridge.*`; testes gate; `WEBHOOKS.md` |
| **2.11.34** | Audit log ticket — `AttendanceEvent` create/close/client_replied em `InboxService` |
| **2.11.35** | Testes ordem inbound integrados — `inbox-inbound-order.integration.test.ts` (ticket→consent→inbox) |
| **2.11.36** | Fix build `DashboardService` campanhas; `QA-FASE1-KICKOFF.md`; gate automático completo |
| **2.11.37** | Fix E2E Supervisor strict mode; índice QA; `qa-prep` → KICKOFF |
| **2.11.38** | Fix CI `npm audit` — override `undici@6.27.0` |
| **2.11.39** | Docs: ENTREGA + ANALISE-CRITICA arquivados em `docs/concluidos/` |
| **2.11.40** | E2E § B painel Fase 1 (`qa-fase1-panel.spec.ts`, 32 testes `qa:fase1:e2e`) |
| **2.11.41** | E2E presença + `qa:fase1:all`; fix Rules of Hooks `InboxSectors`; build antes do E2E (33 testes) |
| **2.11.42** | Fix convite equipe: índice multi-pendente + vínculo conta existente + login multi-empresa |
| **2.11.43** | Fix loop WA conectar/desconectar — idempotência, anti-440, reconexão com cooldown; dev: ignore-watch `sessions/` (evita restart loop ts-node-dev) |
| **2.11.48** | Perfil: OTP WA self-service; atendente sem setor só vê conversas atribuídas |
| **2.11.49** | Perfil: admin cadastra WA com OTP + auditoria ao dono; APIs `/team/members/:id/whatsapp/*` |
| **2.11.50** | Perfil: política `allowMembersEditOwnProfile`; confirmação e-mail OTP; Google dispensa e-mail; `EQUIPE-RBAC.md` § Perfil |
| **2.11.56** | Fix loop presença painel, bridge WebChat, lock WA único |
| **2.11.57** | Leads: formulário embed + fila por capacidade (`maxConcurrentChatsPerAgent`) — `LEADS-FORMULARIO.md` |
| **2.11.58** | Lead → Inbox: `POST …/captures/:id/open-inbox`, `inboxConversationId`, botão **Iniciar atendimento** — `LEADS-FORMULARIO.md` |
| **2.11.59** | QA Leads: preview `/leads/preview.html`, `npm run qa:leads:setup` — `QA-FASE1-RAPIDO.md` § B.1 |
| **2.11.84** | IA: créditos proporcionais, carteira mensal, cota aprendizagem, barra `IA`/`LM`/`WA`, `inbox:ai:balance:view` — `IA-CREDITOS-E-CARTEIRA.md` |

**Ao entregar feature nova:** seguir [`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md) — incrementar `package.json`, `CHANGELOG.md`, esta tabela.

---

## Arquitetura rápida

| Camada | Onde |
|--------|------|
| Backend | `src/index.ts`, serviços em `src/services/*` |
| API painel + integrações | `src/services/web-dashboard/DashboardService.ts` — base `/api` |
| Auth/RBAC | `src/auth/rbac/*` |
| Frontend painel | `src/services/web-dashboard/frontend/src/` — design system em `design-system/` |
| Modelos Mongo | `src/models/*` |
| Tipos compartilhados | `src/types/*` |

---

## Módulos (v2.1)

Ver detalhes em `EQUIPE-RBAC.md`, `INBOX-ATENDIMENTO.md`, `CONSENTIMENTO-LGPD.md`.

| Módulo | Destaques |
|--------|-----------|
| Equipe/RBAC | `customRoles[]`, `roleKey`, preset CUSTOM oculto; **perfil membro** OTP e-mail/WA + política edição (2.11.49–50) — `EQUIPE-RBAC.md` § Perfil |
| Inbox | `clientVisible`, `internalRank`, escalação na transferência; presença operacional + alertas críticos (2.11.25–2.11.28) |
| Consentimento | `consentRenewalApprovals` 0–2, `/contact?consent=waiting`, fila `pendingOutboundDeliveries` até aceite `1` |
| Tickets Inbox | Janela cliente 12h pós-envio equipe; grace 30min; menu follow-up após 2h |
| Painel | scroll do navegador; `Layout.tsx` `min-h-screen` |
| Design system (2.8) | Tokens CSS `--rz-*`; `RadarPageShell`, `PageHeader`, `LoadingState`/`EmptyState`/`ErrorState`; `inputCls`/`selectCls`; Sonner + `ToastContext` legado |
| Estabilização Fase 1 | `npm run qa:prep`; docs `QA-FASE1-*`; gate em `ROADMAP-COMPLETUDE.md` |
| Atendimento UI (2.10.18) | Upgrade visual — `concluidos/radarzap-inbox-upgrade.md`; paginação `GET /inbox/tickets` |

---

## Modelos / campos recentes

| Modelo | Campo | Desde |
|--------|-------|-------|
| `Organization` | `customRoles[]` | 2.1.0 |
| `Organization` | `teamSettings.allowMembersEditOwnProfile` | 2.11.50 |
| `Organization` | `aiWallet` (`purchasedCredits`, `learningOpsUsed`, `periodStart`) | 2.11.84 |
| `CompanyMember` | `customRoleId` | 2.1.0 |
| `CompanyMember` | `displayName`, `emailVerifiedAt` | 2.11.50 |
| `CompanyMember` | `whatsappPhoneVerifiedAt` | 2.11.49 |
| `InboxDepartment` | `clientVisible`, `internalRank` | 2.1.0 |
| `InboxSettings` | `inactivityAutoCloseEnabled`, `inactivityCloseMinutes`, `inactivityWarningMinutes`, `queueSlaAlertMinutes` | 2.2.1 |
| `InboxSettings` | `ticketTeamResponseHours` | 2.7.0 |
| `InboxSettings` | `whatsappFallbackEnabled`, `whatsappFallbackAlertPhones`, `whatsappFallbackVisitorMessage`, `agentPresenceTimeoutSeconds` | 2.10.72 |
| `InboxSettings` | `whatsappFallbackAcceptTimeoutSeconds` | 2.11.28 |
| `InboxSettings` | `presenceIdleTimeoutSeconds` | 2.11.25 |
| `InboxConversation` | `lastOutboundAt`, `inactivityWarnedAt`, `queueSlaNotifiedAt` | 2.2.1 |
| `InboxTicket` | `lastTeamMessageAt` | 2.6.3 |
| `InboxTicket` | `teamSlaDueAt`, `teamSlaBreachedAt`, `lastStatusChangeAt` | 2.7.0 |
| `Destination` | `pendingTicketMenuChoices[]`, `pendingTicketTargetRef` | 2.7.0 |
| `Destination` | `contactKind`, `contactOrigin`, `commercialStatus`, `temperature` | 2.12.10 |
| `AiConversationState` | `targetTicketRef` | 2.6.4 |
| `AiSettings` | `attendanceMode` | 2.10.107 |
| `AiPrompt` | `basicTriageLlmFallbackEnabled` | 2.11.1 |
| `AiUsage` | `usageKind` | 2.11.3 |
| `AiUsage` | `creditWeight` (créditos debitados por chamada) | 2.11.84 |

---

## Protocolo ao criar ou alterar features

**Obrigatório a partir de `2.11.0`:** [`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md)

1. Implementar backend + frontend nos padrões do projeto
2. **Incrementar** `package.json` e registrar em **`CHANGELOG.md`**
3. Atualizar `MENU-PAGES-REGISTRY.md` se rota/menu/API mudou
4. Atualizar doc de módulo (`.md`) se comportamento de domínio mudou
5. Features grandes: doc de fase + atualizar consolidado (ex. modos de atendimento)
6. Atualizar **`INDICE-DOCUMENTACAO.md`** se novo doc criado
7. Atualizar **este arquivo** e `.cursor/rules/radarzap-v2-system-registry.mdc`
8. **Commit e push** ao concluir (não deixar alterações locais sem enviar)
9. **Deploy:** `PREPARACAO-PRODUCAO.md` / `PRODUCTION.md` só quando gate estabilização OK
10. Nunca commitar `sessions/`, `.env`, credenciais
