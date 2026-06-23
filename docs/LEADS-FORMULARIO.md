# Leads — formulário público

**Versão:** 2.11.62

## Objetivo

Permitir que a empresa incorpore um **formulário de captura** no site (embed), conecte **WordPress**, **Elementor**, landing pages ou formulários próprios via **API**, e gerencie os contatos no painel.

## Painel

- Menu: **Contatos → Leads** (`/platform/leads`)
- Abas: **Capturas** · **Integrar no site** · **Formulários**
- Permissões: visualizar capturas e códigos de integração `consent:view`; gerenciar formulários `send:destination:manage`

## Integrar no site (painel)

A aba **Integrar no site** oferece códigos prontos para copiar:

| Método | Uso |
|--------|-----|
| **Formulário RadarZap** | Script `form.js` — padrão recomendado |
| **API / JavaScript** | `fetch` ou cURL para site customizado |
| **HTML + formulário** | Formulário seu enviando JSON |
| **WordPress** | Bloco HTML, Contact Form 7, rodapé global |
| **Elementor e outros** | Widget HTML + guia para construtores |

Cada formulário tem chave `lfm_…` e endpoint:

`POST /api/leads/public/forms/{publicKey}/submit`

Body JSON: `{ name, phone, email?, message?, sourceUrl?, pageTitle? }`

## API autenticada (`/api/leads`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/leads/forms` | Lista formulários |
| POST | `/leads/forms` | Cria formulário |
| PATCH | `/leads/forms/:id` | Configura aparência/domínios |
| DELETE | `/leads/forms/:id` | Remove formulário |
| GET | `/leads/captures` | Lista leads (`status`, `search`, paginação) |
| GET | `/leads/captures/:id` | Detalhe |
| PATCH | `/leads/captures/:id` | Status / observações internas |
| POST | `/leads/captures/:id/open-inbox` | Abre ou reutiliza conversa Inbox e atribui ao atendente (`inbox:reply`) |

## Ação no painel — Iniciar atendimento

No detalhe de uma captura, atendentes com `inbox:reply` podem:

1. **Iniciar atendimento** — cria conversa Inbox (ou reutiliza aberta), grava mensagem de sistema com dados do formulário, atribui ao usuário logado e navega para `/platform/inbox?conv=…`.
2. **Continuar no Inbox** — quando já existe `inboxConversationId` vinculado.
3. **Buscar no Inbox** — deep link por telefone (`?search=`).

O lead passa para status **Em atendimento** quando aplicável.

## API pública (`/api/leads/public`)

Montada **antes** da sessão do painel (sem cookie).

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/forms/:publicKey/config` | Config do formulário |
| POST | `/forms/:publicKey/submit` | Envia lead |

Rate limit: mesmo bucket `webchatPublic` (120 POST/min/IP).

## Embed no site

```html
<script src="https://SEU-PAINEL/leads/form.js" data-form-key="lfm_..." async></script>
```

Opcional: `data-container="id-do-div"` para renderizar dentro de um elemento existente.

Chave `lfm_…` gerada ao criar o formulário no painel.

## Preview QA (dev)

- Rota: `GET /leads/preview.html?key=lfm_…` — simula site externo com embed
- Setup: `npm run qa:leads:setup` (garante formulário ativo + `localhost` em `allowedDomains`)
- Checklist: `docs/QA-FASE1-RAPIDO.md` § B.1

## Dados capturados

- Nome, telefone (obrigatórios), e-mail e mensagem (ativáveis/desativáveis no editor)
- Campos extras customizados (até 12) — rótulo, tipo texto/textarea, obrigatório
- `metadata` na captura com valores dos campos extras
- Excluir formulário no painel (capturas históricas permanecem)
- `sourceUrl`, `pageTitle`, IP (metadados)
- Status: Novo → Em análise → Em atendimento → Convertido / Perdido
- Vínculo opcional com `Destination` + segmento **Lead**
- `inboxConversationId` — conversa Inbox aberta a partir do lead (2.11.58)

## Segurança

- `allowedDomains` por formulário (mesma regra do WebChat — lista vazia = qualquer origem)
- Tenant isolado por `publicKey` → `clientId`
- Sanitização de entrada; telefone normalizado E.164

## Arquivos principais

- `src/models/LeadForm.ts`, `LeadCapture.ts`
- `src/services/leads/LeadFormService.ts`
- `src/services/web-dashboard/leads/form.js`
