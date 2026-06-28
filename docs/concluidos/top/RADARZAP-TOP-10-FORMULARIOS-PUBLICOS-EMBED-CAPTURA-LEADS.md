# RadarZap — TOP 10/20 — Formulários Públicos, Embed e Captura de Leads

**Data:** 2026-06-24  
**Versão após TOP 10:** `2.11.96`  
**Branch:** `main`

---

## Resumo executivo

O TOP 10 fechou o módulo **Formulários públicos / embed / captura de leads** como produto: token `lfm_*`, script `form.js`, API pública `/api/leads/public`, validação central (`lead-form-submit.util.ts`), dedupe de lead aberto no submit (TOP 09), limite `leadForms` por plano na criação, resposta pública sem IDs internos, LGPD/honeypot/UTM preservados, webhook `lead.created` em capturas novas, testes dedicados e gates verdes.

---

## Herança dos TOPs anteriores

### TOP 01

`LeadForm`, `LeadCapture`, embed parcial, webhook `lead.created` — necessidade de formulário pronto para site.

### TOP 02

Baseline verde (typecheck, build, test, gate).

### TOP 03

Limites `leadForms` (1/1/2/5/20 por plano), `leadsPerMonth`, `contacts` — enforcement de formulários aplicado nesta etapa.

### TOP 04

RBAC; Marketing/Leads com `leads:manage` para criar/editar formulários.

### TOP 05

Formulário não atribui atendimento a agente indisponível (auto-inbox opcional herda fila).

### TOP 06

Formulário independente de modo de atendimento global.

### TOP 07

Formulário pode vincular contato/conversa via routing; Inbox não refeito.

### TOP 08

Formulário não cria ticket automaticamente.

### TOP 09

Contato ≠ Lead; dedupe por telefone/e-mail por org; formulário público **deve** criar/atualizar lead; WhatsApp/WebChat genérico não vira lead.

### Esta etapa fecha

Embed, token, campos, LGPD, UTM, dedupe no submit, limite plano, testes, doc oficial.

### Esta etapa não faz

Redesign WebChat (TOP 11), WhatsApp/sessão profundo (TOP 12), Bridge (TOP 13), IA (TOP 14/15), créditos IA (TOP 16), billing completo (TOP 17), produção pronta.

---

## Estado Git inicial

| Item | Valor |
|------|-------|
| Branch | `main` |
| Último commit antes | `b094969` — `chore(top): contatos leads e kanban 2.11.95` |
| Modificados | Inbox/UI (sessão paralela — **não** incluídos no commit TOP 10) |
| Untracked (não commitar) | `data/`, `mocker/modelochat/` |
| Risco | Baixo — escopo leads isolado |

---

## Escopo autorizado

Formulários, embed, token, campos, LGPD, UTM, dedupe, webhooks, limite plano, rate limit documentado, testes, documentação.

---

## Diagnóstico atual de formulários

| Item | Existe? | Arquivo | Observação |
|------|---------|---------|------------|
| Modelo formulário | Sim | `src/models/LeadForm.ts` | `publicKey`, `active`, `appearance`, `routing`, `allowedDomains` |
| Token público | Sim | `lead-form-token.util.ts` | `lfm_` + 32 hex |
| Ativo/inativo | Sim | `active` | Inativo não carrega config nem aceita submit |
| Campos padrão | Sim | `LeadFormAppearance` | nome, tel, e-mail, mensagem, interesse via custom |
| Campos customizados | Sim | `customFields[]` | text, textarea, email, tel, select, checkbox, hidden |
| Submissão pública | Sim | `POST /api/leads/public/forms/:publicKey/submit` | Sem auth |
| Resposta pública | Sim | `buildPublicLeadSubmitResponse` | Sem `captureId`/`clientId` (2.11.96) |
| Criação contato | Sim | `ensureDestinationForWebChatVisitor` | Se `routing.contactMode === 'always'` |
| Criação lead | Sim | `LeadFormService.submitPublicLead` | Sempre captura comercial |
| Deduplicação | Sim | `findOpenLeadForFormDedupe` | Atualiza lead aberto (TOP 09) |
| UTM | Sim | `utm` em `LeadCapture` | `parseLeadFormUtm` |
| Origem | Sim | `origin` enum | `site`/`wordpress`/`widget` + `formId` |
| LGPD | Sim | `requireConsent`, `consentAcceptedAt` | Bloqueia se obrigatório |
| Rate limit | Sim | `rateLimiters.webchatPublic` | 120 POST/min (prod) em `/api/leads/public` |
| Honeypot | Sim | `appearance.honeypot` | Campo oculto rejeita bot |
| Webhook | Sim | `emitLeadWebhook` → `lead.created` | Só em captura **nova** |
| API painel | Sim | `DashboardService` `/leads/forms` | `leads:manage` / `leads:view` |
| UI | Sim | `Leads.tsx` aba Integrar | Snippets `leadIntegrationSnippets.ts` |
| Testes | Sim | `lead-form-*.test.ts` | 25+ casos no padrão `lead-form` |

---

## Diagnóstico atual do embed

| Tipo de embed | Existe? | Arquivo/rota | Observação |
|---------------|---------|--------------|------------|
| Script `form.js` | Sim | `GET /leads/form.js` | `data-form-key="lfm_…"` — **modelo principal** |
| iframe | Não dedicado | — | Usar script ou HTML custom via API |
| Rota pública config | Sim | `GET /api/leads/public/forms/:key/config` | Só formulário ativo |
| Preview painel | Sim | `/leads/preview.html` | Dev + painel |
| Copiar código | Sim | `LeadIntegrationsPanel` / snippets | |
| Estilo básico | Sim | `appearance` (tema, cores, radius) | |
| Token no embed | Sim | `publicKey` na URL/script | |
| Form inativo | Sim | 404 config + submit | |
| Domínios permitidos | Sim | `allowedDomains` | Reutiliza `assertLeadFormOrigin` |
| CORS | Sim | `cors({ origin: true })` | Público cross-origin |
| CSP/script | Parcial | Script third-party | Empresa hospeda snippet; sem eval |

---

## Diagnóstico do token público

| Critério | Status |
|----------|--------|
| Geração | `crypto.randomBytes(16).hex` com prefixo `lfm_` |
| Entropia | 128 bits — não previsível |
| Não é ObjectId | OK |
| Indexado | `publicKey` unique sparse em `LeadForm` |
| Revogável | Desativar form (`active: false`) ou rotacionar chave (editar manual futuro) |
| Inativo bloqueia | `getActiveFormByPublicKey` exige `active: true` |
| Token inválido | 404 mensagem genérica |
| Não expõe org | Token não contém `clientId` |

---

## Diagnóstico de campos padrão e customizados

- Validação central: `src/types/lead-form-submit.util.ts`
- Regra: pelo menos telefone **ou** e-mail; nome obrigatório
- Custom: obrigatoriedade, max 500/2000 chars, sanitização `sanitizeLeadText`
- Campos inesperados ignorados (só IDs `cf_*` definidos no form)
- Admin: `validateFormFields` no painel para consistência require/ask

---

## Diagnóstico de LGPD e consentimento

| Item | Status |
|------|--------|
| `requireConsent` | Configurável por formulário |
| Texto | `consentText` + `consentPolicyUrl` |
| Registro aceite | `consentAccepted`, `consentAcceptedAt` |
| Bloqueio | `assertPublicLeadConsent` |
| ConsentService WA | Não aplicado a form público (estrutura própria no lead) |

---

## Diagnóstico de UTM, origem e campanha

Capturados no body público e persistidos em `LeadCapture.utm`:

- `utm_source` → `source`
- `utm_medium` → `medium`
- `utm_campaign` → `campaign`
- `utm_term` → `term`
- `utm_content` → `content`
- `sourceUrl`, `pageTitle`, `referer` (via meta)
- `formId` sempre gravado no lead
- Origem canal: `site` / `wordpress` / `widget` (`detectOrigin`)

---

## Diagnóstico de deduplicação com Contatos e Leads

| Regra | Implementação |
|-------|---------------|
| Telefone E.164 | `normalizeContactPhoneE164` |
| E-mail lower | Sanitize + lower |
| Por organização | `clientId` em todas as queries |
| Lead aberto | `OPEN_LEAD_STATUSES` — submit **atualiza** em vez de duplicar |
| Lead fechado | Novo submit cria novo lead |
| Cross-tenant | Nunca deduplica entre orgs |
| Hints | `detectDuplicates` marca `possibleDuplicate` |

---

## Regras oficiais do formulário público

1. Formulário ativo e token válido.
2. Pertence à org do token (implícito na lookup).
3. Pelo menos telefone ou e-mail.
4. Campos obrigatórios preenchidos.
5. Consentimento se `requireConsent`.
6. Texto sanitizado e limitado.
7. UTM/origem salvos.
8. Contato criado/atualizado se routing `always`.
9. Lead criado ou lead aberto atualizado.
10. Resposta sem dados internos.

---

## Regras oficiais do embed

- Copiar script `form.js` com `data-form-key`.
- Endpoint base: `/api/leads/public`.
- Respeitar `allowedDomains` quando configurado.
- Formulário inativo retorna 404.

---

## Regras oficiais de validação

Ver `validateAndParsePublicLeadPayload` e `parseLeadFormCustomFieldValues`.

---

## Regras oficiais de LGPD

Consentimento obrigatório bloqueia com HTTP 400. Aceite registrado com timestamp quando marcado.

---

## Regras oficiais de anti-spam e rate limit

- Middleware `webchatPublic`: 120 POST/min por IP (produção).
- Honeypot invisível quando habilitado.
- Limites de tamanho por campo.
- Payload vazio rejeitado na validação.
- Não revela se telefone/e-mail já existe na resposta pública.

---

## Limites por plano

| Plano | `leadForms` |
|-------|-------------|
| trial | 1 |
| free | 1 |
| starter | 2 |
| pro | 5 |
| enterprise | 20 |

Enforcement em `createForm` e `duplicateForm` via `lead-form-plan-limit.util.ts`.  
Org legada acima do limite: formulários existentes continuam; **nova** criação bloqueada até upgrade ou exclusão.

---

## Criação de Contato e Lead via formulário

1. Valida payload.
2. Opcionalmente `ensureDestinationForWebChatVisitor` (contato).
3. Busca lead aberto por phone/email.
4. Se aberto → atualiza + histórico `note`.
5. Se não → `LeadCapture.create` + webhook + painel.

---

## Webhooks e integrações

- Evento: `lead.created` (kind `captured`) via `WebhookDispatcherService`.
- Payload inclui `form_id`, `origin`, `utm` (captura nova).
- Resubmit em lead aberto **não** reemite `lead.created`.

---

## Correções ou ajustes aplicados

| Ajuste | Arquivo |
|--------|---------|
| Validação central testável | `src/types/lead-form-submit.util.ts` |
| Limite `leadForms` na criação | `lead-form-plan-limit.util.ts` + `LeadFormService` |
| Dedupe lead aberto no submit | `LeadFormService.findOpenLeadForFormDedupe` |
| Resposta sem `captureId` | `buildPublicLeadSubmitResponse` |
| UTM no webhook | `submitPublicLead` emit payload |

---

## Testes criados ou atualizados

| Arquivo | Cobertura |
|---------|-----------|
| `lead-form-submit.util.test.ts` | honeypot, consent, phone/email, UTM, custom, resposta pública |
| `lead-form-plan-limit.util.test.ts` | limites catálogo, bloqueio criação |
| `lead-form-public-submit.test.ts` | submit, dedupe, inativo, plan limit |
| `lead-form-token.util.test.ts` | pré-existente |

---

## Gates executados

| Gate | Resultado |
|------|-----------|
| `npm run typecheck` | Verde |
| `npm run build` | Verde |
| `npm test` | Verde — 674 testes |
| `npm run qa:atendimento:gate` | Verde — 144 + 61 testes + qa:prep |
| `npm test -- lead-form` | Verde — 25 testes |
| Frontend build | Não alterado nesta etapa |

---

## Arquivos alterados

- `src/services/leads/LeadFormService.ts`
- `src/services/leads/lead-form-plan-limit.util.ts`
- `src/types/lead-form-submit.util.ts`
- `src/services/leads/__tests__/lead-form-*.test.ts`
- `src/types/__tests__/lead-form-submit.util.test.ts`
- `package.json` → `2.11.96`
- `docs/top/RADARZAP-TOP-10-FORMULARIOS-PUBLICOS-EMBED-CAPTURA-LEADS.md`
- `docs/CHANGELOG.md`, `docs/SISTEMA-REGISTRO.md`, `docs/INDICE-DOCUMENTACAO.md`, `docs/LEADS-FORMULARIO.md`

---

## Riscos reduzidos

- Duplicação de leads por reenvio de formulário (dedupe aberto).
- Vazamento de IDs internos na API pública.
- Criação ilimitada de formulários fora do plano.
- Payload malformado / spam básico (validação + rate limit existente).

---

## Riscos restantes

- Sem iframe dedicado (somente script — aceitável).
- Sem rotação automática de `publicKey` na UI.
- `leadsPerMonth` não enforced no submit (TOP 17/billing).
- Captcha externo não implementado.
- Consentimento de form não sincroniza `ConsentService` de WhatsApp.

---

## Decisões pendentes para Benhur

1. Adicionar origem literal `form` ao enum ou manter `site` + `formId`?
2. Expor `captureId` em webhook apenas (já exposto) — OK para integradores?
3. iframe embed como modelo alternativo no painel?

---

## Próximo passo recomendado

**TOP 11 — WebChat profundo** (widget, fila, modos, premium AI gate) sem redesenhar formulários.
