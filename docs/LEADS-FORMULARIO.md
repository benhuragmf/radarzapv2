# Leads — formulário público

**Versão:** 2.11.57

## Objetivo

Permitir que a empresa incorpore um **formulário de captura** no site (embed), semelhante ao widget WebChat, e gerencie os contatos recebidos no painel.

## Painel

- Menu: **Contatos → Leads** (`/platform/leads`)
- Permissões: visualizar capturas `consent:view`; gerenciar formulários `send:destination:manage`

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

## Dados capturados

- Nome, telefone (obrigatórios), e-mail e mensagem (configuráveis)
- `sourceUrl`, `pageTitle`, IP (metadados)
- Status: Novo → Em análise → Em atendimento → Convertido / Perdido
- Vínculo opcional com `Destination` + segmento **Lead**

## Segurança

- `allowedDomains` por formulário (mesma regra do WebChat — lista vazia = qualquer origem)
- Tenant isolado por `publicKey` → `clientId`
- Sanitização de entrada; telefone normalizado E.164

## Arquivos principais

- `src/models/LeadForm.ts`, `LeadCapture.ts`
- `src/services/leads/LeadFormService.ts`
- `src/services/web-dashboard/leads/form.js`
