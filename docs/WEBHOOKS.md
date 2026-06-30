# Webhooks outbound — RadarZap v2

Integrações externas recebem eventos via **POST HTTPS** com assinatura HMAC.

## Configuração

Painel: **Configurações → Webhooks** (`/settings#api-webhooks`)

- URL deve começar com `https://`
- Secret exibido **uma vez** ao criar (`whsec_…`)
- Eventos selecionáveis na API; UI padrão: `campaign.sent`, `campaign.failed`

## Eventos

| Evento | Quando dispara |
|--------|----------------|
| `campaign.sent` | Campanha/disparo concluído com sucesso |
| `campaign.failed` | Campanha falhou ou cancelada |
| `consent.updated` | Status LGPD do contato mudou |
| `session.connected` | WhatsApp conectou |
| `session.disconnected` | WhatsApp desconectou |
| `inbox.conversation.created` | Nova conversa Inbox |
| `inbox.message.received` | Mensagem inbound do cliente |
| `inbox.conversation.resolved` | Atendente finalizou conversa |
| `inbox.conversation.closed` | Conversa encerrada por inatividade (`/enc` ou timeout automático) |
| `inbox.csat.rated` | Cliente respondeu pesquisa CSAT (1–5) após encerramento |
| `webchat.message.received` | Visitante enviou mensagem no chat do site |
| `webchat.conversation.escalated` | Conversa WebChat encaminhada para fila humana |
| `webchat.conversation.closed` | Conversa WebChat encerrada pelo atendente |
| `ticket.created` | Novo chamado (ticket) aberto no Inbox |
| `ticket.client_replied` | Cliente respondeu no ticket (mensagem real, não ack) |
| `ticket.closed` | Chamado encerrado pela equipe |
| `webchat.bridge.started` | Bridge bidirecional site ↔ WhatsApp ativado (`!assumir`) |
| `webchat.bridge.closed` | Bridge desativado |
| `discord.voice.join` | Alguém entrou em canal de voz monitorado (após regra + envio WA) |
| `discord.voice.leave` | Alguém saiu de canal de voz monitorado |
| `discord.member.join` | Membro entrou no servidor (monitor de eventos) |
| `discord.member.leave` | Membro saiu do servidor |
| `discord.member.kick` | Membro removido (kick) |
| `discord.member.ban` | Membro banido |
| `discord.message.matched` | Mensagem Discord bateu em regra e job WA foi enfileirado |
| `discord.message.edited` | Mensagem editada em canal monitorado (regra + envio WA) |
| `discord.message.reaction` | Nova reação em canal monitorado (regra + envio WA) |

### Payloads Discord (campo `data`)

**`discord.voice.join` / `discord.voice.leave`**
```json
{
  "event_id": "uuid",
  "trigger": "voice_join",
  "guild_id": "...",
  "guild_name": "Meu Servidor",
  "channel_id": "...",
  "channel_name": "Sala Geral",
  "monitor_type": "voice",
  "user_id": "...",
  "user_name": "João",
  "member_count": 3,
  "wa_jobs_enqueued": 1
}
```

**`discord.message.matched`**
```json
{
  "message_id": "discord-snowflake",
  "trigger": "message",
  "guild_id": "...",
  "guild_name": "Meu Servidor",
  "channel_id": "...",
  "channel_name": "ofertas",
  "author_id": "...",
  "author_name": "Bot Promo",
  "capture_kind": "promo",
  "rule_id": "...",
  "rule_name": "Promoções",
  "template_name": "dw-promo",
  "wa_jobs_enqueued": 2
}
```

**`discord.member.kick` / `discord.member.ban`**
```json
{
  "event_id": "uuid",
  "trigger": "member_kick",
  "guild_id": "...",
  "user_id": "...",
  "user_name": "Maria",
  "moderator_name": "Admin",
  "reason": "Spam",
  "wa_jobs_enqueued": 1
}
```

### Cooldown (anti-spam voz)

Variáveis de ambiente (opcional):

- `DISCORD_VOICE_COOLDOWN_SEC` — padrão **60** (reconexões na chamada)
- `DISCORD_MEMBER_COOLDOWN_SEC` — padrão **30**

Por monitor: `eventCooldownSec` em `PATCH /api/channels/:id/filters`.

### Payloads ticket / bridge (campo `data`)

**`ticket.created`**
```json
{
  "ticket_ref": "TK-ABC123",
  "conversation_id": "...",
  "status": "open",
  "contact_identifier": "5511999999999",
  "contact_name": "Maria",
  "assigned_user_id": null,
  "opened_by_user_id": "..."
}
```

**`ticket.client_replied`**
```json
{
  "ticket_ref": "TK-ABC123",
  "conversation_id": "...",
  "contact_identifier": "5511999999999",
  "body_preview": "Primeiros 500 chars",
  "media_type": null
}
```

**`ticket.closed`**
```json
{
  "ticket_ref": "TK-ABC123",
  "conversation_id": "...",
  "closed_at": "2026-06-22T12:00:00.000Z",
  "closed_by_user_id": "..."
}
```

**`webchat.bridge.started`**
```json
{
  "conversation_id": "...",
  "ticket_ref": "TK-ABC123",
  "agent_user_id": "...",
  "visitor_name": "Visitante"
}
```

**`webchat.bridge.closed`**
```json
{
  "conversation_id": "..."
}
```


```json
{
  "id": "uuid",
  "event": "campaign.sent",
  "created_at": "2026-06-05T12:00:00.000Z",
  "organization_id": "...",
  "data": { }
}
```

## Assinatura

Header: `X-RadarZap-Signature: t={unix},v1={hex}`

- `signed_payload = "{t}.{raw_json_body}"`
- `v1 = HMAC-SHA256(secret, signed_payload)`

Verificação: `src/utils/webhook-signature.ts` → `verifyWebhookSignature`

Headers adicionais: `X-RadarZap-Event`, `X-RadarZap-Delivery-Id`

## Entrega

- Fila BullMQ: `notifications` / job `webhook-deliver`
- Retry exponencial (padrão 5 tentativas)
- Env: `WEBHOOK_TIMEOUT_MS`, `WEBHOOK_MAX_RETRIES`, `WEBHOOK_RETRY_DELAY_MS`
- Serviço: `src/services/integrations/WebhookDispatcherService.ts`

**Requisito:** `npm run dev` com Redis + filas ativas (worker registrado no boot).

## API

- `GET/POST/PATCH/DELETE /api/integrations/webhooks`
- Auth: cookie painel ou capability `api:key:create`
