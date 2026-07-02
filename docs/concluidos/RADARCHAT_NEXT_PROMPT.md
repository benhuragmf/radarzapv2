# Prompt For RadarChat Repository

> **Arquivo — sessão Codex RadarGamer.** Contrato vivo: [`RADARCHAT_INTEGRATION_CONTRACT.md`](../RADARCHAT_INTEGRATION_CONTRACT.md) (`2.13.2`).

Use this prompt in a separate Codex thread with cwd set to the RadarChat
repository. Do not apply it inside RadarGamer.

```text
Continue from the real current state of the RadarChat repository.

Goal: implement or confirm the RadarGamer -> RadarChat inbound integration
contract without touching RadarGamer.

Constraints:
- Do not call production or staging.
- Do not call https://app.radarchat.com.br.
- Do not send real WhatsApp/chat messages.
- Do not expose or commit secrets, cookies, storageState or .env files.
- Do not create a RadarGamer commit from this repository.
- Preserve existing RadarChat production defaults unless explicitly changed and
  documented.

Required preflight:
- git status
- git log --oneline -10
- git rev-parse HEAD
- git diff --name-only
- list local ports/services if a smoke is needed

Implement or confirm:
- POST /api/integrations/radargamer/messages
- Authorization: Bearer <RADARCHAT_API_TOKEN>
- Idempotency-Key handling
- X-Source: radargamer
- payload fields: recipientPhone, templateKey, variables, sourceEventId,
  sourceUserId, sourceGuildId, priority, metadata
- response fields: accepted, messageId, status, queuedAt, rateLimit,
  correlationId
- 400/401/403/404/409/422/429/500/503 controlled errors
- opt-in/opt-out checks
- template validation
- queue enqueue without real send in QA
- safe logs with token/phone/message redaction
- compatibility aliases for old Radar Chat fields only if low risk:
  phone, message, userId, source

Tests:
- auth success/failure
- invalid payload
- idempotency duplicate
- template missing
- opt-out
- rate limit
- enqueue success
- enqueue failure
- no-real-send QA mode
- redaction

Docs:
- document the endpoint, headers, payload, response, errors, QA mode,
  rate limits, logs, templates, status lookup and compatibility window.

Final response:
- say whether production/staging/live app were accessed
- say whether any real WhatsApp/chat send occurred
- list tests/build run
- list remaining risks
```
