# Leads — formulário público

**Versão:** 2.11.96

## Central de Entrada Comercial (2.11.68+)

### Política de cadastro por canal (2.14.0+)

O **dono da empresa** define em **Atendimento → Triagem e Bot → aba Cadastro CRM** (`/platform/inbox/bot#cadastro`) como cada entrada vira registro:

| Canal | Opções |
|-------|--------|
| WhatsApp | Contato · Lead · Ambos · Pendente · Apenas conversa |
| Chat do site | Contato · Lead · Ambos · Pendente · Apenas conversa |
| Formulário | Lead · Contato · Ambos · Pendente |
| Retorno de cliente | Lead de retorno · Contato existente · Apenas conversa |
| Captura manual (painel) | Contato aprovado direto (fixo) |

- **Pendente:** `crmRegistrationStatus: pending` — não lista em Contatos até `PATCH` com `crmRegistrationStatus: approved`.
- **Apenas conversa / Lead sem CRM:** registro técnico `inbox_only` (Inbox funciona; oculto em `/contact`).
- **Padrão (retrocompat):** WA `both`, WebChat `lead`, Formulário `both`, Retorno `return_lead`.

API: `inboundRegistrationPolicy` em `GET|PATCH /api/inbox/settings`. Filtro contatos pendentes: `GET /destinations?registration=pending`.

Persistência: `InboxSettings.inboundRegistrationPolicy`, `Destination.crmRegistrationStatus`.

A rota `/platform/leads` funciona como **triagem e conversão** — entradas ainda não tratadas. **Contatos** = base consolidada; **Inbox** = conversa/atendimento.

Métricas operacionais (`GET /leads/stats` → `operational`): novos abertos, WhatsApp aguardando, site/formulários, convertidos hoje, sem responsável. Clique nos cards aplica filtros (`openOnly`, `origins`, etc.).

### WhatsApp → Lead (2.11.69, ajuste TOP 09 / 2.11.95)

Quando um **número novo** envia a primeira mensagem WhatsApp **com intenção comercial** (orçamento, plano, cotação, etc. — classificador local):

1. `InboxService.handleInboundMessage` cria contato + conversa (fluxo existente).
2. `LeadFormService.maybeCaptureWhatsAppInbound` cria `LeadCapture` com `origin: whatsapp`, vincula `destinationId` e `inboxConversationId`.
3. Usa formulário sistema inativo **Entrada WhatsApp (sistema)** (lazy por organização).

**Saudação genérica (`oi`, `bom dia`) não cria lead** — apenas contato + Inbox. Retorno (nova conversa após encerramento) ainda gera lead. Webhook `lead.created` quando aplicável.

**Não** duplica lead se o telefone já existia em Contatos ou já há lead aberto para o mesmo número.

### Captura manual (2.11.69)

- Botão **Capturar lead** na aba Capturas (`POST /leads/captures`).
- Formulário sistema **Captura manual (sistema)**; origem padrão `manual`.

### WebChat → Lead (2.11.70)

Nova sessão no widget com **telefone que não está em Contatos** gera `LeadCapture` com `origin: webchat`. Vínculo em `metadata.webchatConversationId`. **Assumir atendimento** abre `wc:{id}` no Inbox unificado.

### Notificação no painel (2.11.70)

Toda captura (formulário, WhatsApp, WebChat, manual) emite evento `lead:new_entry` no sino. A página Leads atualiza a lista em tempo real via socket.

### Retorno e triagem (2.11.71)

- **WhatsApp:** contato existente que inicia **nova conversa** (após encerramento anterior) gera lead de retorno; conversa já aberta **não** duplica.
- **WebChat:** nova sessão com telefone conhecido também gera lead de retorno.
- **Assumir atendimento** atribui o lead ao usuário logado (`assignedUserId`).
- Kanban: botão **Assumir** no hover do card.

### Intenção comercial (2.11.72)

- Contato **existente** em conversa **já aberta** que envia mensagem com intenção comercial (orçamento, plano, comprar, etc.) → gera lead se não houver lead aberto para o telefone.
- Mesma regra no **WebChat** para visitante já vinculado a contato.
- Kanban: ações rápidas **WhatsApp** (painel inline) e **Salvar como contato** no hover.

### Lista e sync (2.11.73)

- Modo **Lista**: mesmas ações rápidas do Kanban (Assumir, WhatsApp, Salvar como contato).
- Ao **encerrar atendimento** no Inbox (`/enc`, inatividade) ou WebChat, lead `in_progress` vinculado → status **Qualificado** automaticamente.

### Classificador e tempo real (2.11.74)

- Intenção comercial: **classificador local** (`classifyLocal`) + frases explícitas — sem LLM; reduz falso positivo financeiro/suporte.
- Socket `lead:updated` (silencioso) refresca Kanban/lista quando status muda no backend.
- Lista: link Inbox para conversas WebChat (`wc:{id}`).

### Detalhe e assumir (2.11.75)

- Painel lateral / aba Conversa: **Abrir atendimento** funciona para WebChat (`wc:`).
- Retomar conversa WA qualificada via **Assumir** → status `in_progress` + refresh em tempo real.
- Kanban: ícone Inbox no hover quando já há conversa vinculada.

### Abrir atendimento no Inbox (2.11.77)

- Operador clica **Abrir atendimento** → cria conversa **Em atendimento** no Inbox (não fica preso na triagem bot).
- Contato entra no segmento **Lead** + tag `Lead`; conversa no setor **Comercial** (se existir e o atendente tiver acesso).
- Mensagem de sistema na timeline: origem da captura, categoria Lead/Comercial.

## Objetivo

Área de **captura, qualificação e conversão** — distinta de Contatos (base consolidada). Reaproveita listas/segmentos, consentimento e Inbox sem duplicar esses módulos.

## Painel

- Menu: **Contatos → Leads** (`/platform/leads`)
- Abas: **Capturas** · **Formulários** · **Listas e segmentos**
- A aba **Formulários** segue o mesmo padrão dos widgets WebChat: lista de formulários no topo + editor com **Visão geral** (domínios primeiro), campos, aparência, destino, segurança e **Integrar no site** (script, API, HTML, WordPress, etc.)
- Cards no topo: total, novos hoje, em atendimento, convertidos, perdidos, origem principal
- Permissões: visualizar `leads:view` (fallback `consent:view`); gerenciar `leads:manage` (fallback `send:destination:manage`); Kanban `leads:kanban:manage`; Inbox `inbox:reply`

## Integrar no site (dentro de Formulários)

Na seção **Integrar no site** de cada formulário há códigos prontos para copiar:

| Método | Uso |
|--------|-----|
| **Formulário RadarZap** | Script `form.js` — padrão recomendado |
| **API / JavaScript** | `fetch` ou cURL para site customizado |
| **HTML + formulário** | Formulário seu enviando JSON |
| **WordPress** | Bloco HTML, Contact Form 7, rodapé global |
| **Elementor e outros** | Widget HTML + guia para construtores |

Cada formulário tem chave `lfm_…` e endpoint:

`POST /api/leads/public/forms/{publicKey}/submit`

Body JSON: `{ name, phone, email?, message?, sourceUrl?, pageTitle?, utm?, consent?, customFields? }`

Resposta pública (2.11.96): `{ success, successMessage, redirectUrl? }` — **sem** `captureId` nem IDs internos.

### TOP 10 (2.11.96)

- Limite de formulários por plano (`leadForms`) na criação/duplicação — ver `config/plans.json`.
- Reenvio do formulário atualiza lead **aberto** (dedupe TOP 09) em vez de duplicar.
- Validação central: `src/types/lead-form-submit.util.ts`.
- Rate limit: middleware `webchatPublic` em `/api/leads/public` (120 POST/min prod).
- Doc: [`top/RADARZAP-TOP-10-FORMULARIOS-PUBLICOS-EMBED-CAPTURA-LEADS.md`](./concluidos/top/RADARZAP-TOP-10-FORMULARIOS-PUBLICOS-EMBED-CAPTURA-LEADS.md).

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
