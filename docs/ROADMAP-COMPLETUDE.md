# RadarZap v2 — completude do sistema e roadmap

> **Versão ref:** `2.9.1` · **Última revisão:** 2026-06-17  
> **Fase atual:** **estabilização do produto** — **não** preparação de produção nem go-live.

| Fase | Documento | Quando |
|------|-----------|--------|
| **1 — Agora** | Este arquivo + `INBOX-ATENDIMENTO.md` / `TICKET-ATENDIMENTO.md` | Bugs, QA manual, testes de fluxo |
| 2 — Produto | § Lacunas produto abaixo | Cloud API, compliance avançado (se bloquear release) |
| 3 — Servidor | `PREPARACAO-PRODUCAO.md` | **Só após gate § Estabilização** |
| 4 — Go-live | `PRODUCTION.md` | Staging validado + gate §0 |

---

## Resumo executivo (honesto)

O RadarZap v2 tem **ampla superfície implementada** (painel, inbox, tickets, IA, campanhas, billing teste, API, webhooks).  
Porém o **núcleo de atendimento WhatsApp** (Inbox × Ticket × CSAT × IA) passou por **cinco correções críticas em sequência** (2.8.7–2.8.11) após bugs em uso real.

**Conclusão:** sistema **utilizável em dev/piloto interno**, **não estável o suficiente** para VPS, staging ou checklist de `PREPARACAO-PRODUCAO.md`.

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

- [ ] Roteiro **QA WhatsApp** (abaixo) executado sem falha crítica
- [ ] Nenhum bug **crítico aberto** em Inbox/Ticket/CSAT/IA por ≥ 1 ciclo completo de teste
- [ ] `npm test` + `npm run build` verdes
- [ ] CI verde em `main`
- [ ] Testes cobrindo fluxos que quebraram em 2.8.8–2.8.11 (helpers + routing — ver § Testes)
- [ ] `ROADMAP` e changelog alinhados ao estado validado

---

## Plano de estabilização (Fase 1)

### A. QA manual WhatsApp (obrigatório)

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

Registrar: data, versão (`2.8.11+`), pass/fail, prints.

### B. Testes automatizados (reforço)

| Prioridade | O quê | Onde hoje |
|------------|-------|-----------|
| Alta | CSAT bypass novo atendimento | `csat.util.test.ts` ✅ |
| Alta | Ticket janela 12 h + `lastTeamMessageAt` | `ticket-reply-window.util.test.ts` ✅ |
| Alta | Routing ticket vs inbox | `inbound-routing.test.ts` ✅ |
| **Média** | Integração `tryHandleCsatReply` + ordem inbound | **Falta** — `InboxService` ~4k linhas sem teste integrado |
| Média | E2E inbox autenticado | **Falta** |
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
| 5 | Admin operacional | ✅ 2.5.0 | |
| 6 | Backup tenant | ✅ 2.5.0 | |
| 7 | **Inbox SLA + CSAT** | 🟡 **2.8.11** | MVP em 2.5.0; **bugs críticos até 2.8.11** — validar QA |
| 8 | **Ticket + Inbox routing** | 🟡 **2.8.9–2.8.10** | Janela 12 h corrigida — validar QA |
| 9 | **IA triagem + escalação** | 🟡 **2.8.7** | Fix recente — validar QA |
| 10 | **Estabilidade geral atendimento** | 🔴 **Fase 1** | Bloqueia preparação prod |
| 11 | WhatsApp Cloud API | 🟡 stub | POST 503 — Fase 2 (se bloquear release) |
| 12 | Mobile PWA | ✅ 2.5.1 | |
| 13 | Testes unitários | ✅ 298 | Não cobrem WA ponta a ponta |
| 14 | E2E | 🟡 smoke | 6 testes — login/PWA apenas |
| 15 | Lint / qualidade CI | 🔴 | ~7k issues; não no CI |
| 16 | Compliance audit persistido | 🟡 | `ComplianceService` com TODOs |
| 17 | **WebChat (site)** | ✅ **2.10.0** | Lista unificada no Inbox (`channel=all`) — ver `WEBCHAT.md` |

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
- Design system 2.8.x
- RBAC, equipe, setores internos, consentimento LGPD base
- Campanhas, Discord, integrações API, OpenAPI
- **WebChat** embedável (widget + console painel) — `WEBCHAT.md`
- Docker monolito + `deploy.yml` **documentados** (não validados em servidor)

---

## Como usar os documentos

1. **Trabalho diário / bugs / QA** → este arquivo + docs de módulo (`INBOX-ATENDIMENTO.md`, `TICKET-ATENDIMENTO.md`)
2. Feature nova → `SISTEMA-REGISTRO.md` + semver `package.json`
3. **Servidor / VPS / deploy** → `PREPARACAO-PRODUCAO.md` — **consulta antecipada ok; execução só após gate § Estabilização**
4. **Go-live** → `PRODUCTION.md` — **após** staging + gate §0

---

## Referências

- Servidor (referência, não executar agora): [`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md)
- Go-live (atalho): [`PRODUCTION.md`](./PRODUCTION.md)
- Changelog: [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md)
