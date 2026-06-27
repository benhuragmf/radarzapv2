# Classificação de contatos — RadarZap v2

**Versão doc:** 2.12.19 · **Desde:** 2.12.10 (pacotes A–J)

Sistema unificado de **tipo, origem, permissão LGPD, funil, temperatura, qualidade do telefone** e **elegibilidade para campanha**. A classificação é **inferida** a partir de consentimento, leads, duplicados e campos persistidos no `Destination`, com opção de edição manual e backfill em lote.

---

## Dimensões

| Dimensão | Campo / enum | Uso |
|----------|----------------|-----|
| Tipo | `contactKind` — lead, client, prospect, partner, internal, blocked | Segmentação comercial, automações |
| Origem | `contactOrigin` — whatsapp, webchat, form, manual, csv, … | Rastreio de canal |
| Permissão | `permission` (derivada de `consentStatus`) | LGPD / opt-in |
| Funil | `commercialStatus` | CRM / pós-venda |
| Temperatura | `temperature` | Priorização comercial |
| Qualidade tel. | `phoneQuality` | Validação envio |
| Campanha | `campaignSelectable` + `sendBlockReason` | Bloqueio em massa |

Tipos: `src/types/contact-classification.ts` · inferência: `src/utils/contact-classification.util.ts` · serviço: `src/services/destinations/destination-classification.service.ts`.

---

## Onde aparece no produto

| Área | Comportamento |
|------|----------------|
| **Contatos** (`/contact`) | Badges, editor, filtros `?class=`, export CSV filtrado |
| **Envio** (`/send`) | Tabela com classificação, segmentos dinâmicos |
| **Segmentos** (`/platform/segmentos`) | Listas fixas + 5 presets dinâmicos + backfill |
| **Leads** | Stats CRM, filtros, coluna classificação |
| **Inbox** | Card no detalhe; badges na lista e no Supervisor; filtro `?class=` na lista (server-side) |
| **Automações** | Filtros por classificação + `assertCampaignSendAllowed` |
| **Relatórios** (`/platform/reports`) | KPIs, breakdowns, export CSV |
| **Plataforma** (`/platform`) | Atalhos para segmentos e contatos opt-in |

---

## API principal (`/api`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/destinations` | Lista com `classification`; query `?class=` filtra no servidor |
| PATCH | `/destinations/:id` | Atualiza `contactKind`, `contactOrigin`, `commercialStatus`, `temperature` |
| GET | `/destinations/smart-segments` | Presets dinâmicos + contagem |
| GET | `/destinations/smart-segments/:id/members` | Membros de um preset |
| GET | `/destinations/classification-stats` | Totais agregados |
| GET | `/destinations/classification-stats/export-csv` | Resumo CSV |
| GET | `/destinations/classification-export-csv` | Contatos + colunas classificação (`?class=` opcional) |
| GET | `/destinations/classification-backfill-status` | Pendentes de persistência |
| POST | `/destinations/backfill-classification` | Grava inferência em lote (500) |
| GET | `/leads/classification-stats` | Stats CRM nos leads |
| GET | `/leads/captures` | Filtros `classification*` e `unlinkedOnly` |
| PATCH | `/inbox/conversations/:id/visitor-profile` | WebChat: perfil + classificação no CRM |
| GET | `/inbox/conversations` | Lista unificada; `?class=` filtra por classificação CRM (2.12.18) |

OpenAPI: `src/constants/openapi-dashboard.ts`.

---

## Filtro rápido `?class=`

Valores: `opt_in`, `pending`, `hot`, `blocked`, `lead`, `client`, `prospect` (+ tipos `partner`, `internal`).

- **Contatos:** URL `/contact?class=opt_in`
- **Inbox:** URL `/platform/inbox?class=hot` (conversas com contato CRM vinculado)
- **Supervisor:** URL `/platform/inbox/supervisor?class=lead`
- **API:** `GET /destinations?class=hot` · `GET /inbox/conversations?class=hot` · `GET /inbox/supervisor/dashboard?class=hot`

---

## Bloqueio de campanha

`CampaignDispatchService` e `BirthdayAutomationService` chamam `assertCampaignSendAllowed()` antes do envio. Motivos típicos: opt-out, sem consentimento, telefone inválido/duplicado, tipo interno/bloqueado.

---

## Backfill

Contatos antigos podem não ter `contactKind` / `contactOrigin` persistidos. Segmentos dinâmicos funcionam por inferência; o backfill grava campos para edição manual e relatórios.

UI: **Segmentos dinâmicos** ou **Relatórios → Classificar lote**.

---

## Pacotes de entrega (changelog)

| Versão | Pacote | Escopo |
|--------|--------|--------|
| 2.12.9–10 | A | Segmentos + backfill |
| 2.12.11 | B | Automações + OpenAPI |
| 2.12.12 | C | Leads × CRM |
| 2.12.13 | D | Contatos + WebChat Inbox |
| 2.12.14 | E | Relatórios agregados |
| 2.12.15 | F | Filtro server-side + export CSV |
| 2.12.16 | G | Badges na lista Inbox + doc + testes |
| 2.12.17 | H | Supervisor badges + atalhos Plataforma + doc consolidada |
| 2.12.18 | I | Filtro `?class=` na lista Inbox (server-side) |
| 2.12.19 | J | Supervisor `?class=` + atalhos Inbox nos relatórios |

Ver `docs/CHANGELOG.md` para detalhes por versão.
