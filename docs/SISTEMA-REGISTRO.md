# RadarZap v2 — registro do sistema

> Espelho versionado de `.cursor/rules/radarzap-v2-system-registry.mdc` (pasta `.cursor/` não vai ao git).

**Versão atual:** `2.6.7` (`package.json`) · **Última revisão doc:** 2026-06-10

Documentação por módulo: `MENU-PAGES-REGISTRY.md`, `INBOX-ATENDIMENTO.md`, `TICKET-ATENDIMENTO.md`, `EQUIPE-RBAC.md`, `CONSENTIMENTO-LGPD.md`, `RADARZAP-V2-MIGRACAO.md`, `ROADMAP-COMPLETUDE.md`, `PRODUCTION.md`, `BILLING.md`

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

**Ao entregar feature nova:** incrementar patch (`2.2.x`) ou minor (`2.3.0`) em `package.json` e adicionar linha nesta tabela.

---

## Arquitetura rápida

| Camada | Onde |
|--------|------|
| Backend | `src/index.ts`, serviços em `src/services/*` |
| API painel + integrações | `src/services/web-dashboard/DashboardService.ts` — base `/api` |
| Auth/RBAC | `src/auth/rbac/*` |
| Frontend painel | `src/services/web-dashboard/frontend/src/` |
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

---

## Modelos / campos recentes

| Modelo | Campo | Desde |
|--------|-------|-------|
| `Organization` | `customRoles[]` | 2.1.0 |
| `CompanyMember` | `customRoleId` | 2.1.0 |
| `InboxDepartment` | `clientVisible`, `internalRank` | 2.1.0 |
| `InboxSettings` | `inactivityAutoCloseEnabled`, `inactivityCloseMinutes`, `inactivityWarningMinutes`, `queueSlaAlertMinutes` | 2.2.1 |
| `InboxConversation` | `lastOutboundAt`, `inactivityWarnedAt`, `queueSlaNotifiedAt` | 2.2.1 |
| `InboxTicket` | `lastTeamMessageAt` | 2.6.3 |
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
7. **Roadmap/produção:** atualizar `ROADMAP-COMPLETUDE.md` e `PRODUCTION.md` quando feature impactar lacunas ou deploy
8. Nunca commitar `sessions/`, `.env`, credenciais
