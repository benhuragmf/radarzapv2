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

## Payload

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
