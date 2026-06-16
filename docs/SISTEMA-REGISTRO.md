# RadarZap v2 — registro do sistema

> Espelho versionado de `.cursor/rules/radarzap-v2-system-registry.mdc` (pasta `.cursor/` não vai ao git).

**Versão atual:** `2.8.7` (`package.json`) · **Última revisão doc:** 2026-06-15

Documentação por módulo: `MENU-PAGES-REGISTRY.md`, `INBOX-ATENDIMENTO.md`, `TICKET-ATENDIMENTO.md`, `EQUIPE-RBAC.md`, `CONSENTIMENTO-LGPD.md`, `RADARZAP-V2-MIGRACAO.md`, `ROADMAP-COMPLETUDE.md`, **`PREPARACAO-PRODUCAO.md`** (infra/env/segurança — usar agora), **`PRODUCTION.md`** (runbook go-live — só quando 100% pronto), `BILLING.md`

---

## Changelog (semver interno)

| Versão | Escopo principal |
|--------|------------------|
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

**Ao entregar feature nova:** incrementar patch (`2.2.x`) ou minor (`2.3.0`) em `package.json` e adicionar linha nesta tabela.

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
| Equipe/RBAC | `customRoles[]`, `roleKey`, preset CUSTOM oculto na UI |
| Inbox | `clientVisible`, `internalRank`, escalação na transferência |
| Consentimento | `consentRenewalApprovals` 0–2, `/contact?consent=waiting`, fila `pendingOutboundDeliveries` até aceite `1` |
| Tickets Inbox | Janela cliente 12h pós-envio equipe; grace 30min; menu follow-up após 2h |
| Painel | scroll do navegador; `Layout.tsx` `min-h-screen` |
| Design system (2.8) | Tokens CSS `--rz-*`; `RadarPageShell`, `PageHeader`, `LoadingState`/`EmptyState`/`ErrorState`; `inputCls`/`selectCls`; Sonner + `ToastContext` legado |

---

## Modelos / campos recentes

| Modelo | Campo | Desde |
|--------|-------|-------|
| `Organization` | `customRoles[]` | 2.1.0 |
| `CompanyMember` | `customRoleId` | 2.1.0 |
| `InboxDepartment` | `clientVisible`, `internalRank` | 2.1.0 |
| `InboxSettings` | `inactivityAutoCloseEnabled`, `inactivityCloseMinutes`, `inactivityWarningMinutes`, `queueSlaAlertMinutes` | 2.2.1 |
| `InboxSettings` | `ticketTeamResponseHours` | 2.7.0 |
| `InboxConversation` | `lastOutboundAt`, `inactivityWarnedAt`, `queueSlaNotifiedAt` | 2.2.1 |
| `InboxTicket` | `lastTeamMessageAt` | 2.6.3 |
| `InboxTicket` | `teamSlaDueAt`, `teamSlaBreachedAt`, `lastStatusChangeAt` | 2.7.0 |
| `Destination` | `pendingTicketMenuChoices[]`, `pendingTicketTargetRef` | 2.7.0 |
| `AiConversationState` | `targetTicketRef` | 2.6.4 |
| `AiConversationState` | `pendingTicketChoices[]` | 2.6.7 |

---

## Protocolo ao criar ou alterar features

1. Implementar backend + frontend nos padrões do projeto
2. Atualizar `MENU-PAGES-REGISTRY.md` se rota/menu/API mudou
3. Atualizar doc do módulo se comportamento de domínio mudou
4. Atualizar **este arquivo** e `.cursor/rules/radarzap-v2-system-registry.mdc`
5. Versionar `package.json` quando fizer sentido
6. **Commit e push** ao concluir a tarefa (não deixar alterações locais sem enviar)
7. **Deploy dedicado:** preparar com `PREPARACAO-PRODUCAO.md`; executar `PRODUCTION.md` só quando sistema **100% pronto**
8. **Roadmap/produção:** atualizar `ROADMAP-COMPLETUDE.md` e `PREPARACAO-PRODUCAO.md` quando feature impactar infra ou segurança
9. Nunca commitar `sessions/`, `.env`, credenciais
