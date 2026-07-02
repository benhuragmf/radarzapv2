# RadarChat Integration Contract - RadarGamer Inbound

**Version:** 2.13.2  
**Date:** 2026-06-30

This document describes the RadarChat side of the RadarGamer inbound message
contract. It is local implementation documentation only; it does not prove that
production, staging or `https://app.radarchat.com.br` was accessed.

## Endpoint

```http
POST /api/integrations/radargamer/messages
```

Headers:

- `Authorization: Bearer <RADARCHAT_API_TOKEN>`
- `Idempotency-Key: <stable source event id>`
- `X-Source: radargamer`
- `Content-Type: application/json`

The route is mounted in `DashboardService` before dashboard session/origin
middleware, because production exposes the dashboard app on port `3001`.

## Required Environment

- `RADARCHAT_API_TOKEN`: shared bearer token for RadarGamer.
- `RADARCHAT_RADARGAMER_CLIENT_ID`: RadarChat tenant/session owner that receives
  RadarGamer notifications.

Optional:

- `RADARCHAT_ALLOWED_SOURCES`: comma-separated allow-list, default `radargamer`.
- `RADARCHAT_RADARGAMER_RATE_LIMIT_PER_MINUTE`: default `30`.
- `RADARCHAT_INTEGRATION_QA_NO_SEND=true`: validate and accept locally without
  adding a `whatsapp-sending` job.
- `RADARCHAT_NO_REAL_SEND=true` or `QA_NO_REAL_SEND=true`: accepted aliases for
  local no-real-send QA.

## Payload

Canonical payload:

```json
{
  "recipientPhone": "+5511999999999",
  "templateKey": "radargamer.price_alert",
  "variables": {
    "message": "Preco caiu",
    "game": "Example Game"
  },
  "sourceEventId": "wishlist-alert-1",
  "sourceUserId": "user-1",
  "sourceGuildId": "guild-1",
  "priority": "high",
  "metadata": {
    "source": "radargamer",
    "channel": "whatsapp"
  }
}
```

Temporary legacy aliases:

- `phone` -> `recipientPhone`
- `message` -> `variables.message`
- `userId` -> `sourceUserId`
- `source` -> `metadata.source`

## Response

Success returns HTTP `202`:

```json
{
  "accepted": true,
  "messageId": "radargamer-...",
  "status": "queued",
  "queuedAt": "2026-06-30T12:00:00.000Z",
  "rateLimit": {
    "remaining": 29,
    "resetAt": "2026-06-30T12:01:00.000Z"
  },
  "correlationId": "req-..."
}
```

When no-real-send QA mode is enabled, `status` is `qa_no_real_send` and no
`whatsapp-sending` job is created.

## Behavior

- Authenticates the bearer token with timing-safe comparison.
- Requires `X-Source: radargamer` and matches `metadata.source`.
- Uses `Idempotency-Key` or `sourceEventId` for duplicate protection.
- Rate-limits by source, with Redis when available and in-memory fallback for
  local tests.
- Resolves the RadarChat tenant from `RADARCHAT_RADARGAMER_CLIENT_ID`.
- Validates phone, template key, required variables and WhatsApp message length.
- Requires the recipient to exist as an active contact with accepted opt-in.
- Renders the message in RadarChat and enqueues `whatsapp-sending/send-message`
  with `sendKind=marketing` and `consentOrigin=campaign`.
- Logs only redacted phone/correlation metadata; tokens and message bodies are
  not returned in errors.

## Current Templates

- `radargamer.price_alert`: requires `variables.message`.
- `radargamer.generic_message`: used for legacy `message` payloads; requires
  `variables.message`.

Unknown template keys return `404 TEMPLATE_NOT_FOUND`.

## Controlled Errors

- `400`: required field missing.
- `401`: bearer token missing or invalid.
- `403`: source not allowed or source mismatch.
- `404`: template or recipient not found.
- `409`: duplicate idempotency key.
- `422`: invalid phone, invalid template variables, inactive recipient or opt-in
  missing.
- `429`: integration rate limit exceeded.
- `500`: unexpected route failure.
- `503`: token/tenant not configured or queue unavailable.

## Local QA

Recommended local no-real-send check:

```bash
RADARCHAT_API_TOKEN=local-token \
RADARCHAT_RADARGAMER_CLIENT_ID=<tenantObjectId> \
RADARCHAT_INTEGRATION_QA_NO_SEND=true \
npm test -- --runInBand src/services/integrations/__tests__/radargamer-inbound.service.test.ts
```

Do not call production/staging and do not send real WhatsApp/chat messages when
validating the contract locally.

