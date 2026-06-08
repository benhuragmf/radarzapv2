# Consentimento LGPD — contatos WhatsApp

Fluxo de opt-in/opt-out para envios **outbound** (campanhas, disparos). Atendimento **inbound** (Inbox) não exige prompt 1/2.

## Modelo `Destination` (contatos)

| Campo | Uso |
|-------|-----|
| `consentStatus` | `ConsentStatus` — aceite, pendente, recusas progressivas, bloqueio |
| `pendingOutboundCount` | Contador de mensagens permitidas antes de novo prompt |
| `consentRenewalApprovals` | **0–2** — quantas vezes o dono/admin aprovou nova tentativa após recusa |

## Regra das 3 recusas

1. Cliente recusa → status de recusa; dono pode **aprovar renovação** (1ª liberação)
2. Recusa de novo → 2ª liberação possível (`consentRenewalApprovals = 2`)
3. Terceira recusa → `REFUSED_THREE` — **definitivo**; nem `clearRefusal` libera

Serviço: `src/services/consent/ConsentService.ts` — `approveRenewal`, `clearRefusal`, `applyStatus`

## API

| Método | Rota | Cap |
|--------|------|-----|
| GET | `/consent/renewals` | `consent:approve-renewal` |
| POST | `/consent/renewals/:id/approve` | `consent:approve-renewal` |
| POST | `/destinations/:id/consent/request-renewal` | `consent:request-renewal` |
| POST | `/destinations/:id/consent/clear-refusal` | `consent:clear-refusal` |
| POST | `/destinations/:id/consent/block` | `consent:manual-block` |

## Painel

| Rota | UI |
|------|-----|
| `/contact` | Lista de contatos + ações de consentimento |
| `/contact?consent=waiting` | **Aguardando aprovação** — renewals pendentes (`Destinations.tsx`) |

Menu: **Contatos → Aguardando aprovação** (`navConfig.ts`, perm `consent:approve-renewal`)

## Papéis típicos

- **Dono / Admin:** aprovar renovações, limpar recusa (dentro das regras)
- **Atendente 2ª instância (custom):** `consent:view` apenas — sem aprovar
