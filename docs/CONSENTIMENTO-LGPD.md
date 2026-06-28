# Consentimento LGPD — contatos WhatsApp

Fluxo de opt-in/opt-out para envios **outbound** (campanhas, disparos). Atendimento **inbound** (Inbox) não exige prompt 1/2.

## Modelo `Destination` (contatos)

| Campo | Uso |
|-------|-----|
| `consentStatus` | `ConsentStatus` — aceite, pendente, recusas progressivas, bloqueio |
| `pendingOutboundCount` | Contador de mensagens permitidas antes de novo prompt |
| `pendingOutboundDeliveries` | Fila de payloads outbound aguardando aceite `1` (campanha/disparo não envia conteúdo antes do consentimento) |
| `consentRenewalApprovals` | **0–2** — quantas vezes o dono/admin aprovou nova tentativa após recusa |

## Regra das 3 recusas

1. Cliente recusa → status de recusa; dono pode **aprovar renovação** (1ª liberação)
2. Recusa de novo → 2ª liberação possível (`consentRenewalApprovals = 2`)
3. Terceira recusa → `REFUSED_THREE` — **definitivo**; nem `clearRefusal` libera

Serviço: `src/services/consent/ConsentService.ts` — `approveRenewal`, `clearRefusal`, `applyStatus`

## Fila antes do conteúdo (campanhas / disparos)

Quando o contato ainda não aceitou (`consentStatus` pendente), o `WhatsAppService` **não envia** o corpo da campanha. Em vez disso:

1. `ConsentService.queueOutboundUntilConsent` grava o payload em `pendingOutboundDeliveries` no `Destination`
2. O cliente recebe apenas o prompt LGPD (resposta `1` = aceite, `2` = recusa)
3. Após aceite, `flushPendingOutboundDeliveries` envia a fila na ordem

**Ordem no inbound:** consentimento → ticket fechado (se aplicável) → Inbox ao vivo. Resposta `1` em ticket fechado **não** é aceite LGPD — ver `INBOX-ATENDIMENTO.md` (tickets assíncronos).

## Opt-out (`sair`) × atendimento ativo (2.12.65)

- Prompt **1/2** continua só para **outbound**; quem **inicia** contato vai direto ao Inbox (`acceptInboundInitiated`).
- Durante triagem IA, fila, ticket ou conversa ativa, opt-out **não captura** respostas naturais (`sim`, nome, e-mail).
- Confirmação de cancelamento: keywords explícitas (`sair`, `confirmo`, …) — não `sim`/`ok`.
- `optOutConfirmPendingAt` obsoleto é limpo ao retomar contato inbound ou ao detectar atendimento ativo (`InboxService.hasActiveClientAtendimentoContext`).

## API

| Método | Rota | Cap |
|--------|------|-----|
| GET | `/consent/renewals` | `consent:approve-renewal` |
| POST | `/consent/renewals/:id/approve` | `consent:approve-renewal` |
| POST | `/destinations/:id/consent/request-renewal` | `consent:request-renewal` |
| POST | `/destinations/:id/consent/clear-refusal` | `consent:clear-refusal` |
| POST | `/destinations/:id/consent/block` | `consent:manual-block` |

## Portal LGPD titular (2.12.63 — AH-D04)

| Método | Rota | Cap |
|--------|------|-----|
| GET | `/lgpd/lookup?phone=` | `consent:view` |
| GET | `/lgpd/destinations/:id/export` | `consent:view` — JSON titular + histórico consentimento |
| POST | `/lgpd/destinations/:id/anonymize` | `consent:manual-block` — body `{ "confirm": "ANONIMIZAR", "reason?" }` |
| GET | `/lgpd/events` | `consent:view` — feed `lgpd.*` em `AttendanceEvent` |

Painel: **Consentimento → Portal LGPD** (`/platform/lgpd`).

Eventos: `lgpd.export_requested`, `lgpd.delete_requested`, `lgpd.anonymized` + `AuditLog` `lgpd.export` / `lgpd.anonymize`.

## Painel

| Rota | UI |
|------|-----|
| `/contact` | Lista de contatos + ações de consentimento |
| `/contact?consent=waiting` | **Aguardando aprovação** — renewals pendentes (`Destinations.tsx`) |

Menu: **Contatos → Aguardando aprovação** (`navConfig.ts`, perm `consent:approve-renewal`)

## Papéis típicos

- **Dono / Admin:** aprovar renovações, limpar recusa (dentro das regras)
- **Atendente 2ª instância (custom):** `consent:view` apenas — sem aprovar
