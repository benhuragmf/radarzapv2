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

## Modelos MongoDB

| Coleção | Propósito |
|---------|-----------|
| `inboxDepartments` | Filas/setores (Comercial, Financeiro, …) |
| `inboxConversations` | Ticket/conversa por contato + canal WA |
| `inboxMessages` | Histórico inbound/outbound/system |
| `inboxTransfers` | Auditoria de transferências |

### InboxDepartment

- `clientId` — tenant (Organization._id)
- `name`, `description`, `menuKey` (`1`–`4` no bot fixo)
- `memberUserIds[]` — atendentes; vazio = todos com `inbox:view`
- `isActive`, `sortOrder`

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

## Permissões

| Capability | OWNER | ADMIN | ATTENDANT |
|------------|-------|-------|-----------|
| `inbox:view` | ✓ | ✓ | ✓ |
| `inbox:reply` | ✓ | ✓ | ✓ |
| `inbox:transfer` | ✓ | ✓ | ✓ |
| `inbox:department:manage` | ✓ | ✓ | — |

## Integração WhatsApp

- **Entrada:** `WhatsAppService` → `messages.upsert` → `ConsentService` → `InboxService`
- **Saída:** `InboxService` → `WhatsAppService.sendManualMessage` (`skipConsentCheck` para respostas de atendimento)
- **Grupos:** ignorados (só contatos 1:1)
- **Consentimento inbound:** quem escreve primeiro não recebe prompt 1/2 — vai direto ao menu. Campanhas/envios ativos continuam com `assertCanSend` (LGPD outbound)
- **Menu 1–4:** exclusivo do atendimento (não é mais o fluxo de opt-in)

## Menu fixo (Fase 1)

```txt
Olá! Escolha o setor:

1 - Comercial
2 - Financeiro
3 - Suporte
4 - Falar com atendente
```

Palavras-chave: `comercial`, `financeiro`, `suporte`, `atendente`.

## Fases futuras

| Fase | Escopo |
|------|--------|
| 2 | Bot configurável (`InboxBotFlow` / passos no painel) |
| 3 | Round-robin, supervisor, relatórios, WebSocket tempo real |
| 4 | `WhatsAppChannelProvider` — Cloud API Meta (planos Enterprise) |

## Painel

| Rota | Componente |
|------|------------|
| `/platform/inbox` | `pages/menu/Inbox.tsx` |
| `/platform/inbox/setores` | `pages/menu/InboxSectors.tsx` |
| `/settings/team` | `TeamMembers.tsx` — convidar atendentes |

Menu: **Plataforma → Atendimento → Inbox** / **Setores do Inbox**

## Apresentação do atendente

Ao **assumir** ou **responder** pela primeira vez, o cliente recebe no WhatsApp:

`Olá! Sou *{nome}* e vou dar continuidade ao seu atendimento.`

O nome vem do perfil do usuário no painel (Google/Discord).
