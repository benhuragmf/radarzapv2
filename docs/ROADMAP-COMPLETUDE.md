# Radar Chat v2 — completude do sistema e roadmap

> **Versão ref:** `2.17.61` · **Produção:** `app.radarchat.com.br` · **Última revisão:** 2026-07-01  
> **Fase atual:** **estabilização (Fase 1)** — gate humano QA manual pendente; **não** go-live declarado.

| Fase | Documento | Quando |
|------|-----------|--------|
| **1 — Agora** | Este arquivo + [`PENDENCIAS-HUMANAS-FASE1.md`](./PENDENCIAS-HUMANAS-FASE1.md) | QA manual + parar regressões |
| 2 — Produto | § Lacunas produto abaixo | Cloud API, compliance avançado |
| 3 — Servidor | `PREPARACAO-PRODUCAO.md` · [`COOLIFY-DEPLOY.md`](./COOLIFY-DEPLOY.md) | Coolify em produção @ `2.17.61` |
| 4 — Go-live | `PRODUCTION.md` | Staging validado + gate §0 |

---

## Resumo executivo (honesto)

O Radar Chat v2 tem **ampla superfície implementada** (painel, inbox, tickets, IA, campanhas, billing, API, webhooks, Admin Ops, LGPD portal, bridge dedup, infra degraded boot — até **2.12.63**).

Correções críticas Inbox × Ticket × CSAT × IA (2.8.7–2.8.11) foram seguidas por **gates automatizados verdes** (integração Jest, E2E 80/80, `qa:atendimento:gate` revalidado 2026-06-28).

**Conclusão:** código e CI **prontos para QA manual final**; **não** declarar produção estável até Benhur executar § A–J ([`PENDENCIAS-HUMANAS-FASE1.md`](./PENDENCIAS-HUMANAS-FASE1.md)).

---

## Fases do projeto

```
[FASE 1 — ATUAL] Estabilização
   QA manual WhatsApp · testes de fluxo · parar regressões inbox/ticket/CSAT
        ↓ gate § Estabilização
[FASE 2] Completude produto (se necessário antes de clientes)
   Cloud API Meta · compliance audit persistido · lint/CI endurecido
        ↓ gate § Produto
[FASE 3] PREPARACAO-PRODUCAO
   VPS · env · Docker · segurança · deploy staging
        ↓ gate §0 PRODUCTION.md
[FASE 4] Go-live produção
```

---

## Gate § Estabilização (sair da Fase 1)

Marcar **todos** antes de abrir `PREPARACAO-PRODUCAO.md` para execução:

- [ ] Roteiro **QA WhatsApp** — checklist em [`QA-FASE1-CHECKLIST.md`](./QA-FASE1-CHECKLIST.md) § A — **humano** ([`PENDENCIAS-HUMANAS-FASE1.md`](./PENDENCIAS-HUMANAS-FASE1.md))
- [ ] Nenhum bug **crítico aberto** em Inbox/Ticket/CSAT/IA por ≥ 1 ciclo completo de teste manual
- [x] `npm test` + `npm run qa:atendimento:gate` verdes — revalidado **2026-06-28** @ `2.12.63`
- [x] CI verde em `main` — E2E **80/80** + build + audit (2026-06-27)
- [x] Testes cobrindo fluxos 2.8.8–2.8.11 + alertas + bridge + LGPD + admin ops (2.11.28–2.12.63)
- [x] `ROADMAP` e changelog alinhados — **2.12.63** (2026-06-28)
- [x] E2E Playwright § B painel + presença + inbox autenticado — `npm run qa:fase1:e2e` / CI E2E

---

## Plano de estabilização (Fase 1)

### A. QA manual WhatsApp (obrigatório)

Checklist imprimível com tabelas pass/fail: **[`QA-FASE1-CHECKLIST.md`](./QA-FASE1-CHECKLIST.md)** (§ A WhatsApp, § B painel, § C WebChat).  
Passo a passo com mensagens: **[`QA-FASE1-ROTEIRO.md`](./QA-FASE1-ROTEIRO.md)** · pré-check: `npm run qa:prep`

Executar com `csatEnabled`, sessão WA conectada, contato de teste (idealmente o que reproduziu bugs).

| # | Cenário | Esperado |
|---|---------|----------|
| 1 | Cliente inicia → triagem → humano responde | Conversa no Inbox, sem ticket espúrio |
| 2 | **Finalizar** no painel | CSAT enviado na hora |
| 3 | Cliente: `avaliar` | Pesquisa CSAT — **não** abre ticket antigo |
| 4 | Cliente: `4` | Agradecimento; nota gravada |
| 5 | Após CSAT, cliente: `Ola` / `gostaria de atendimento` | **Novo** fluxo Inbox — **não** loop CSAT |
| 6 | Cliente: `falar com atendente` | Escala / menu — **não** lembrete CSAT |
| 7 | TK antigo fechado (dias) + mensagem nova | **Não** captura no TK; novo atendimento |
| 8 | Envio **via Ticket** + resposta cliente < 12 h | Complemento no mesmo TK |
| 9 | IA promete “vou transferir” | Escalona para fila (não fica travado) |
| 10 | Menu ticket `1`/`2` com inbox ativo | Sem colisão indevida |

Registrar: data, versão (`2.11.35+`), pass/fail, prints.

### B. Testes automatizados (reforço)

| Prioridade | O quê | Onde hoje |
|------------|-------|-----------|
| Alta | CSAT bypass novo atendimento | `csat.util.test.ts` ✅ |
| Alta | Ticket janela 12 h + `lastTeamMessageAt` | `ticket-reply-window.util.test.ts` ✅ |
| Alta | Routing ticket vs inbox | `inbound-routing.test.ts` ✅ |
| Alta | Paginação `GET /inbox/tickets` (`page`/`limit`) | `ticket-list-query.util.test.ts` ✅ |
| **Média** | Integração CSAT + ticket inbound | ✅ `inbox-csat-reply` + `inbox-ticket-inbound` (2.11.30–31) |
| **Média** | Integração ordem inbound ticket→consent→inbox | ✅ `inbox-inbound-order` (2.11.35) |
| Média | Alertas críticos painel (`PanelCriticalAlertsService`) | ✅ `panel-critical-alerts.service.test.ts` (2.11.29) |
| Média | E2E rotas Atendimento (smoke login) | ✅ `e2e/atendimento-smoke.spec.ts` |
| Média | E2E inbox autenticado | ✅ `e2e/inbox-authenticated.spec.ts` (7 testes, mock API) |
| Média | E2E § B painel + presença | ✅ `qa-fase1-panel` + `qa-fase1-presence` — `npm run qa:fase1:e2e` (33) |
| Baixa | `npm run lint` no CI | ~7k issues — não bloqueia hoje |

### C. Ordem de trabalho sugerida

1. Rodar QA manual § A — anotar falhas  
2. Corrigir regressões encontradas (patch 2.8.x)  
3. Adicionar testes integrados mínimos nos fluxos que falharam  
4. Repetir QA até gate § Estabilização  
5. **Só então** discutir Fase 2 (Cloud API?) e Fase 3 (servidor)

---

## Lacunas principais (status real)

| # | Item | Status | Nota |
|---|------|--------|------|
| 1 | Webhooks outbound | ✅ 2.2.0 | |
| 2 | Deploy / CI (código) | ✅ 2.5.1 | Scripts existem; **não executado em VPS** |
| 3 | Convite equipe | ✅ 2.2.2 | Validar e-mail em staging (Fase 3) |
| 4 | Billing Stripe teste | ✅ 2.4.0 | Live = Fase 3 |
| 5 | Admin operacional | ✅ **2.12.63** | Dashboard Ops 8 abas, LGPD portal, auditoria horizontal |
| 6 | Backup tenant | ✅ 2.5.0 | |
| 7 | **Inbox SLA + CSAT** | 🟡 **2.8.11+** | Fixes + testes integrados ✅ — **validar QA manual** |
| 8 | **Ticket + Inbox routing** | 🟡 **2.8.9–2.10** | Janela 12 h + integração Jest ✅ — **validar QA manual** |
| 9 | **IA triagem + escalação** | 🟡 **2.8.7+** | Fix + gate ✅ — **validar QA manual** |
| 10 | **Estabilidade geral atendimento** | 🟡 **Fase 1** | Automatizado ✅; **QA humano pendente** — gate |
| 11 | WhatsApp Cloud API | 🟡 stub | POST 503 — Fase 2 |
| 12 | Mobile PWA | ✅ 2.5.1 | |
| 13 | Testes unitários + gate | ✅ | `qa:atendimento:gate` @ 2.12.63 |
| 14 | E2E | ✅ | CI 80/80 — inbox, campanha, fase1 panel |
| 15 | Lint / qualidade CI | 🔴 | ~7k issues; não no CI |
| 16 | Compliance audit persistido | 🟡 | `ComplianceService` com TODOs |
| 17 | **WebChat (site)** | ✅ **2.10.18** | Widget + Inbox unificado + polish painel — ver `WEBCHAT.md`, [`concluidos/radarchat-inbox-upgrade.md`](./concluidos/radarchat-inbox-upgrade.md) |
| 18 | **UI módulo Atendimento** | ✅ **2.10.18** | Inbox 3 colunas, métricas, tickets paginados — ver [`concluidos/radarchat-inbox-upgrade.md`](./concluidos/radarchat-inbox-upgrade.md) |

---

## Lacunas de código (Fase 2 — após estabilizar)

| Módulo | Pendência |
|--------|-----------|
| Cloud API Meta | `CloudApiProvider`, ingestão POST, config por org |
| `ComplianceService` | Persistir audit/alertas no Mongo |
| `DestinationManager` | Export compliance, deleção agendada |
| `MetricsCollector` | Alertas externos, conexões reais |
| `APIGateway` | Token blacklist, stats admin |

---

## O que já está sólido (não confundir com “pronto para prod”)

- Menus do painel sem placeholder “Em breve”
- Design system 2.8.x + **upgrade visual Atendimento 2.10.18** ([`concluidos/radarchat-inbox-upgrade.md`](./concluidos/radarchat-inbox-upgrade.md))
- RBAC, equipe, setores internos, consentimento LGPD base
- Campanhas, Discord, integrações API, OpenAPI
- **WebChat** embedável (widget + console painel) — `WEBCHAT.md`
- **Supervisão, presença operacional, fallback deferido, alertas críticos** (2.11.24–28) — [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./concluidos/ENTREGA-ATENDIMENTO-2.11.24-28.md)
- Docker monolito + `deploy.yml` **documentados** (não validados em servidor)

---

## Como usar os documentos

1. **Trabalho diário / bugs / QA** → este arquivo + docs de módulo (`INBOX-ATENDIMENTO.md`, `TICKET-ATENDIMENTO.md`) + [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./concluidos/ENTREGA-ATENDIMENTO-2.11.24-28.md) para detalhe técnico recente
2. Feature nova → `SISTEMA-REGISTRO.md` + semver `package.json`
3. **Servidor / VPS / deploy** → `PREPARACAO-PRODUCAO.md` + [`COOLIFY-DEPLOY.md`](./COOLIFY-DEPLOY.md) — Coolify em produção; go-live comercial após gate § Estabilização
4. **Go-live** → `PRODUCTION.md` — **após** staging + gate §0

---

## Referências

- Servidor (referência, não executar agora): [`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md)
- Go-live (atalho): [`PRODUCTION.md`](./PRODUCTION.md)
- Changelog: [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md)
- QA Fase 1: [`QA-FASE1-CHECKLIST.md`](./QA-FASE1-CHECKLIST.md) · [`QA-FASE1-ROTEIRO.md`](./QA-FASE1-ROTEIRO.md)
