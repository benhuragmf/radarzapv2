# Leads — formulário público

**Versão:** 2.11.70

## Central de Entrada Comercial (2.11.68+)

A rota `/platform/leads` funciona como **triagem e conversão** — entradas ainda não tratadas. **Contatos** = base consolidada; **Inbox** = conversa/atendimento.

Métricas operacionais (`GET /leads/stats` → `operational`): novos abertos, WhatsApp aguardando, site/formulários, convertidos hoje, sem responsável. Clique nos cards aplica filtros (`openOnly`, `origins`, etc.).

### WhatsApp → Lead (2.11.69)

Quando um **número novo** envia a primeira mensagem WhatsApp:

1. `InboxService.handleInboundMessage` cria contato + conversa (fluxo existente).
2. `LeadFormService.maybeCaptureWhatsAppInbound` cria `LeadCapture` com `origin: whatsapp`, vincula `destinationId` e `inboxConversationId`.
3. Usa formulário sistema inativo **Entrada WhatsApp (sistema)** (lazy por organização).

**Não** duplica lead se o telefone já existia em Contatos ou já há lead aberto para o mesmo número. Webhook `lead.created` emitido.

### Captura manual (2.11.69)

- Botão **Capturar lead** na aba Capturas (`POST /leads/captures`).
- Formulário sistema **Captura manual (sistema)**; origem padrão `manual`.

### WebChat → Lead (2.11.70)

Nova sessão no widget com **telefone que não está em Contatos** gera `LeadCapture` com `origin: webchat`. Vínculo em `metadata.webchatConversationId`. **Assumir atendimento** abre `wc:{id}` no Inbox unificado.

### Notificação no painel (2.11.70)

Toda captura (formulário, WhatsApp, WebChat, manual) emite evento `lead:new_entry` no sino. A página Leads atualiza a lista em tempo real via socket.

## Objetivo

Área de **captura, qualificação e conversão** — distinta de Contatos (base consolidada). Reaproveita listas/segmentos, consentimento e Inbox sem duplicar esses módulos.

## Painel

- Menu: **Contatos → Leads** (`/platform/leads`)
- Abas: **Capturas** · **Integrar no site** · **Listas e segmentos** · **Formulários**
- Cards no topo: total, novos hoje, em atendimento, convertidos, perdidos, origem principal
- Permissões: visualizar `consent:view`; gerenciar formulários/leads `send:destination:manage`; Inbox `inbox:reply`

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
| GET | `/leads/forms` | Lista formulários (com stats capturas) |
| POST | `/leads/forms` | Cria formulário |
| POST | `/leads/forms/:id/duplicate` | Duplica formulário |
| PATCH | `/leads/forms/:id` | Configura aparência, routing, domínios |
| DELETE | `/leads/forms/:id` | Remove formulário |
| GET | `/leads/stats` | Métricas e funil |
| GET | `/leads/segments-summary` | Listas com contagem de leads |
| GET | `/leads/captures` | Lista leads (filtros: status, `openOnly`, `origins`, origem, formId, responsável…) |
| POST | `/leads/captures` | Captura manual (2.11.69) |
| GET | `/leads/captures/:id` | Detalhe |
| PATCH | `/leads/captures/:id` | Status / observações |
| POST | `/leads/captures/:id/convert` | Converter ou vincular a contato |
| POST | `/leads/captures/:id/add-to-groups` | Adicionar a listas |
| DELETE | `/leads/captures/:id` | Excluir captura |
| POST | `/leads/captures/:id/open-inbox` | Abre conversa Inbox (`inbox:reply`) |

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
