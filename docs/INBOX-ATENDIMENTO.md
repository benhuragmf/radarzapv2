# Inbox — atendimento WhatsApp (RadarZap)

Módulo proprietário de triagem, filas e atendimento humano via WhatsApp.

> **Referências externas** (Izing, Whaticket, Chatwoot, etc.) servem apenas para inspirar fluxos de mercado.  
> Nenhum código de terceiros é copiado. Contratos, modelos e UI são exclusivos do RadarZap.

## Fluxo (MVP — Fase 1)

```txt
Cliente envia mensagem no WhatsApp (contato 1:1) — ele iniciou o contato
↓
RadarZap localiza ou cria contato (aceite implícito para atendimento, sem pedir 1/2)
↓
InboxService → menu de triagem (bot fixo)
↓
Conversa aberta? Se não → cria + menu
↓
Cliente escolhe 1–4 (ou palavra-chave)
↓
Conversa entra na fila do setor (InboxDepartment)
↓
Atendente assume no painel (/platform/inbox)
↓
Atendente responde / transfere / finaliza
```

## Segmentos automáticos (Contatos)

No primeiro contato inbound (WhatsApp), o contato é salvo em **Contatos** e recebe o segmento **Atendimento** (criado automaticamente se não existir).

Se o cliente escolher um setor comercial na triagem (**Comercial**, **Vendas**, etc.), o contato também entra no segmento **Lead** — potencial cliente com interesse comercial.

| Segmento | Quando |
|----------|--------|
| **Atendimento** | Primeira mensagem inbound (Inbox / WhatsApp) |
| **Lead** | Triagem em setor Comercial/Vendas/Marketing |

Os segmentos aparecem em `/contact` na barra lateral de grupos, como qualquer outro segmento.

## Modelos MongoDB

| Coleção | Propósito |
|---------|-----------|
| `inboxDepartments` | Filas/setores (Comercial, Financeiro, …); `clientVisible: false` = interno (só equipe) |
| `inboxConversations` | Ticket/conversa por contato + canal WA |
| `inboxMessages` | Histórico inbound/outbound/system |
| `inboxTransfers` | Auditoria de transferências |

### InboxDepartment

- `clientId` — tenant (Organization._id)
- `name`, `description`, `menuKey` (`1`–`4` no bot fixo para setores **públicos**; internos usam `i2`, `i3`…)
- `clientVisible` — `true` = aparece no menu WhatsApp; `false` = **setor interno** (só equipe)
- `internalRank` — `0` = público; `2`–`5` = 2ª a 5ª instância (escalação na transferência)
- `memberUserIds[]` — atendentes; vazio = todos com `inbox:view`
- `isActive`, `sortOrder`

**Transferência entre setores internos:** atendente só pode transferir para setor de **rank imediatamente superior** (`InboxService.canUserTransferToDepartment`). Lista de setores para transferência filtra `canTransferTo`.

**UI setores** (`/platform/inbox/setores`): botões **Público / Interno** + dropdown **Instância interna** (desabilitado quando público).

### InboxConversation

- `clientId`, `destinationId`, `contactIdentifier`, `contactName`
- `departmentId`, `assignedUserId`
- `status` — ver enum abaixo
- `channel` — `whatsapp_qr` (MVP); futuro `whatsapp_cloud`
- `lastMessageAt`, `lastInboundAt`

### Status da conversa

| Status | Significado |
|--------|-------------|
| `bot_triage` | Aguardando escolha no menu |
| `waiting_queue` | Na fila do setor |
| `in_progress` | Atendente assumiu |
| `transferred` | Transição (volta para `waiting_queue`) |
| `resolved` | Finalizada pelo atendente |
| `closed` | Encerrada (futuro: timeout) |

## API REST (`/api/inbox/*`)

| Método | Rota | Cap | Descrição |
|--------|------|-----|-----------|
| GET | `/inbox/departments` | `inbox:view` | Lista setores (seed padrão se vazio) |
| GET | `/inbox/members` | `inbox:department:manage` | Equipe para vincular aos setores |
| POST | `/inbox/departments` | `inbox:department:manage` | Criar setor |
| PATCH | `/inbox/departments/:id` | `inbox:department:manage` | Editar setor / atendentes |
| GET | `/inbox/conversations` | `inbox:view` | Lista (`status`, `departmentId`, `mine`) |
| GET | `/inbox/conversations/:id` | `inbox:view` | Detalhe + mensagens |
| POST | `/inbox/conversations/:id/assign` | `inbox:reply` | Assumir |
| POST | `/inbox/conversations/:id/reply` | `inbox:reply` | Responder no WhatsApp |
| POST | `/inbox/conversations/:id/transfer` | `inbox:transfer` | Transferir setor |
| POST | `/inbox/conversations/:id/resolve` | `inbox:reply` | Finalizar |
| GET | `/inbox/settings` | `inbox:department:manage` | Config do bot |
| PATCH | `/inbox/settings` | `inbox:department:manage` | Salvar bot / horários / round-robin |
| GET | `/inbox/reports` | `inbox:reports:view` | Métricas de atendimento (`from`, `to`) |
| GET | `/inbox/supervisor/queue` | `inbox:supervise` | Fila ao vivo (supervisor) |
| POST | `/inbox/conversations/:id/reassign` | `inbox:supervise` | Reatribuir (`mode: suggest` \| `assign`) |

## Permissões

| Capability | OWNER | ADMIN | ATTENDANT |
|------------|-------|-------|-----------|
| `inbox:view` | ✓ | ✓ | ✓ |
| `inbox:reply` | ✓ | ✓ | ✓ |
| `inbox:transfer` | ✓ | ✓ | ✓ |
| `inbox:department:manage` | ✓ | ✓ | — |
| `inbox:reports:view` | ✓ | ✓ | — |
| `inbox:supervise` | ✓ | ✓ | — |

## Integração WhatsApp

- **Entrada:** `WhatsAppService` → `messages.upsert` → `ConsentService` → `InboxService`
- **Saída:** `InboxService` → `WhatsAppService.sendManualMessage` (`skipConsentCheck` para respostas de atendimento)
- **Grupos:** ignorados (só contatos 1:1)
- **Consentimento inbound:** quem escreve primeiro não recebe prompt 1/2 — vai direto ao menu. Campanhas/envios ativos continuam com `assertCanSend` (LGPD outbound)
- **Menu 1–4:** exclusivo do atendimento (não é mais o fluxo de opt-in)

## Bot configurável (Fase 2)

Coleção `inboxSettings` por tenant (`clientId`). Painel: `/platform/inbox/bot`.

| Campo | Uso |
|-------|-----|
| `welcomeWithCompany` / `welcomeGeneric` | Cabeçalho do menu (`{company}`) |
| `menuIntro` / `menuFooter` | Texto antes/depois das opções |
| `queueMessage` / `waitingMessage` | Confirmação na fila (`{department}`, `{waiting}`) |
| `outsideHoursMessage` | Fora do horário comercial |
| `invalidMenuHint` | Opção inválida (`{options}`) |
| `resolvedMessage` / `transferMessage` | Finalizar / transferir |
| `businessHoursEnabled` + `schedule` + `timezone` | Horário comercial (Intl timezone) |
| `roundRobinEnabled` | Indica prioridade (não força aceite) |
| `roundRobinPullTimeoutSeconds` | Segundos até outro atendente poder puxar (padrão 120) |
| `alertSoundEnabled` | Som no painel para eventos importantes |
| `alertOnNewChat` | Alerta quando entra conversa nova na fila |
| `alertOnNewMessage` | Alerta quando chega mensagem em conversa ativa |

API: `GET/PATCH /api/inbox/settings` (`inbox:department:manage`).

Setores continuam em `inboxDepartments` — o menu é montado dinamicamente a partir deles.

## Tempo real e round-robin (Fase 3)

- **WebSocket** (Socket.IO): sala `inbox:{clientId}` — eventos `inbox:conversation`, `inbox:message`
- **Round-robin (prioridade)**: ao entrar na fila, define `suggestedUserId` + `suggestedAt` — status permanece `waiting_queue` até aceite
- **UI**: borda amarela → escurece com cronômetro; atendente indicado clica **Aceitar prioridade**
- **Puxar**: outro atendente pode assumir se o indicado tem conversa `in_progress` ou após `roundRobinPullTimeoutSeconds`
- Painel Inbox usa `useInboxSocket` + polling de fallback (30s)

## Relatórios de atendimento (Fase 4)

Painel: `/platform/inbox/relatorios` (`inbox:reports:view`).

Métricas por período (`from` / `to` ISO):

- Tempo médio na fila (`queueEnteredAt` → `acceptedAt`)
- Tempo de primeira resposta e resolução
- Conversas por setor e por atendente

Serviço: `InboxReportsService`.

## Supervisor (Fase 4)

Painel: `/platform/inbox/supervisor` (`inbox:supervise` — OWNER/ADMIN).

- Fila ao vivo com status, setor, atendente e prioridade sugerida
- Reatribuir conversa: `suggest` (nova prioridade) ou `assign` (assume direto)
- Atualização via WebSocket + refresh manual

## Notificações no painel

- **Balão de eventos** no header (à esquerda do indicador *online*): `EventNotificationBell`
- Eventos via Socket.IO `panel:event` (`PanelNotifications`)
- Tipos: novo chat, nova mensagem, prioridade, WhatsApp desconectado/reconectado
- Som configurável em `/platform/inbox/bot` (alertas do painel)
- Hook: `usePanelSocket` + `EventNotificationContext`

## Estabilidade WhatsApp

- Reconexão automática com backoff exponencial (2s → 30s, até 8 tentativas)
- Evento `whatsapp:disconnected` no painel ao cair sessão (incl. 401)
- Monitoramento em `/platform/wa-status` e logs em `/platform/wa-logs`

## Fases futuras

| Fase | Escopo |
|------|--------|
| 5 | `WhatsAppChannelProvider` — Cloud API Meta (Enterprise). Spec produção: `PRODUCTION.md` §7 |

## Painel

| Rota | Componente |
|------|------------|
| `/platform/inbox` | `pages/menu/Inbox.tsx` |
| `/platform/inbox/setores` | `pages/menu/InboxSectors.tsx` |
| `/platform/inbox/bot` | `pages/menu/InboxBotSettings.tsx` |
| `/platform/inbox/supervisor` | `pages/menu/InboxSupervisor.tsx` |
| `/platform/inbox/relatorios` | `pages/menu/InboxReports.tsx` |
| `/settings/team` | `TeamMembers.tsx` — convidar atendentes |

Menu: **Plataforma → Atendimento → Inbox** / **Setores** / **Supervisor** / **Relatórios**

## Apresentação do atendente

Ao **assumir** ou **responder** pela primeira vez, o cliente recebe no WhatsApp:

`Olá! Sou *{nome}* e vou dar continuidade ao seu atendimento.`

O nome vem do perfil do usuário no painel (Google/Discord).
