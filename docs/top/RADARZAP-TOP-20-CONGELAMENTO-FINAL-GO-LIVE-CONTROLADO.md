# RadarZap — TOP 20/20 — Congelamento Final e Go-Live Controlado

**Versão:** `2.12.6` · **Data:** 2026-06-24 · **Branch:** `main` · **Commit base TOP 20:** `b6e39e9` (TOP 19)

---

## Resumo executivo

Etapa final do fechamento TOP 01–20: **congelamento técnico**, consolidação documental, checklists de produção e preparação do **QA manual real** para Benhur.

**Nenhuma feature nova.** **Deploy não executado.** **Stripe live não ativado.** **Push não realizado.**

Gates automatizados **verdes** (typecheck, build, 772 testes, gate atendimento, E2E 38/38, frontend build).

**Status final:** `PRONTO PARA QA MANUAL` — Benhur ainda não registrou execução dos blocos A–J com evidência.

---

## Status final

```
PRONTO PARA QA MANUAL
```

**Justificativa:** gates automatizados verdes; documentação e checklists prontos; QA manual A–J pendente; infra produção (VPS/SSL) pendente; WhatsApp QR real não validado nesta sessão.

**Não aplicável neste momento:** `PRONTO PARA GO-LIVE CONTROLADO` (exige QA manual verde + infra revisada).

---

## Herança TOP 01–19

| TOP | Tema | Status final | Observação |
|-----|------|--------------|------------|
| 01 | Diagnóstico inicial | Fechado | Riscos iniciais corrigidos TOP 02–19 |
| 02 | Baseline / gates | Fechado | CI e scripts oficiais |
| 03 | Planos / limites | Fechado | `config/plans.json` |
| 04 | RBAC / equipe | Fechado | Cross-tenant testado |
| 05 | Status / presença / fila | Fechado | RR + supervisor |
| 06 | Modos atendimento | Fechado | 5 modos + credential |
| 07 | Inbox | Fechado | Fila, transfer, assign |
| 08 | Tickets / TK | Fechado | Token, janela 12h, audit |
| 09 | Leads / Kanban | Fechado | Dedupe, estágios |
| 10 | Formulários públicos | Fechado | Embed, honeypot |
| 11 | WebChat | Fechado | Widget, FAQ, fila |
| 12 | WhatsApp | Fechado (código) | QR real = QA manual |
| 13 | Bridge | Fechado (código) | Ciclo real = QA manual |
| 14 | IA Básica | Fechado | Classificador + KB |
| 15 | IA Premium | Fechado | KB, handoff |
| 16 | IA Créditos | Fechado | Carteira, alertas |
| 17 | Billing | Fechado (test) | Live pendente decisão |
| 18 | Segurança / LGPD | Fechado | mask-secret, audit |
| 19 | QA automatizado | Fechado | 772 testes, E2E 38/38 |

---

## Estado Git inicial

| Item | Valor |
|------|-------|
| Branch | `main` |
| Último commit antes | `b6e39e9` — `chore(top): qa final e checklist pre go-live 2.12.5` |
| TOP 19 commitado | Sim |
| Working tree | Limpo (exceto untracked locais) |
| Untracked | `data/`, `mocker/modelochat/` |
| Risco mistura | Baixo |

---

## Escopo autorizado

**Executado:** congelamento doc, gates finais, checklists produção, resultado TOP 01–20, versionamento `2.12.6`, template QA TOP 20.

**Não executado:** deploy, push, Stripe live, troca env produção, QA manual Benhur, declaração produção estável.

---

## Congelamento técnico

| Item | Valor |
|------|-------|
| Versão congelada | `2.12.6` |
| Branch | `main` |
| Commit TOP 20 (após doc) | ver seção Commit final |
| Gates finais | Todos verdes (ver abaixo) |
| Módulos fechados (código) | Auth, equipe, inbox, tickets, leads, forms, webchat, WA, bridge, IA, billing, segurança |
| Módulos pendentes validação real | WhatsApp QR, bridge E2E humano, Stripe live, VPS/SSL |
| Antes do QA manual | Sem features novas; só bug/blocker |
| Pós-TOP 20 | Somente correções bug/blocker, ajustes produção, documentação e QA manual antes do primeiro go-live |

**Regra:**

```txt
Após TOP 20, somente correções de bug/blocker, ajustes de produção, documentação e QA manual devem entrar antes do primeiro go-live.
```

---

## Gates finais executados

Executados em 2026-06-24 (sequencial, ambiente dev local):

1. `npm run typecheck`
2. `npm run build`
3. `npm test`
4. `npm run qa:atendimento:gate` (inclui `qa:webchat-wa` + `qa:prep`)
5. `npm run qa:fase1:e2e`
6. `npm run build --prefix src/services/web-dashboard/frontend` (via E2E)

---

## Resultado dos gates

| Gate | Resultado | Detalhe |
|------|-----------|---------|
| `npm run typecheck` | Verde | — |
| `npm run build` | Verde | widget sync 2.12.6 |
| `npm test` | Verde | 127 suites, 772 testes |
| `npm run qa:atendimento:gate` | Verde | 237 + webchat-wa 62 + qa:prep OK |
| `npm run qa:webchat-wa` | Verde | Via gate |
| `npm run qa:fase1:e2e` | Verde | 38/38 chromium |
| Frontend build | Verde | Vite OK; chunk >500kB aviso |
| `qa:gate` / `qa:fase1:all` | Equivalente verde | Componentes rodados separadamente |

---

## Checklist QA manual Benhur

Preencher em `docs/QA-FASE1-RESULTADO-TEMPLATE.md` § Resultado QA Manual TOP 20.  
Roteiro detalhado: TOP 19 § Roteiro manual + [`QA-FASE1-ROTEIRO.md`](../QA-FASE1-ROTEIRO.md).

| Bloco | Item | Status | Evidência | Observação |
|-------|------|--------|-----------|------------|
| A | Login Owner/Admin | Pendente | | |
| A | Ver Dashboard | Pendente | | |
| A | Ver plano/limites | Pendente | | |
| A | Ver alertas | Pendente | | |
| A | Versão/doc sistema | Pendente | | Esperado 2.12.6 |
| B | Criar funcionário | Pendente | | |
| B | Testar permissões | Pendente | | |
| B | Status online/ausente/ocupado | Pendente | | |
| B | Supervisor sem receber fila | Pendente | | |
| B | Auto-ausente | Pendente | | |
| C | Abrir widget embed | Pendente | | |
| C | Pré-chat | Pendente | | |
| C | Mensagem genérica | Pendente | | |
| C | Mensagem comercial | Pendente | | |
| C | FAQ | Pendente | | |
| C | Fila | Pendente | | |
| C | Offline/fallback | Pendente | | |
| D | Conectar sessão QR | Pendente | | Blocker go-live |
| D | Receber mensagem | Pendente | | |
| D | `!ajuda` | Pendente | | |
| D | `!assumir` | Pendente | | |
| D | `!ticket` | Pendente | | |
| D | `!nota` | Pendente | | |
| D | `!encerrar` / `!encerrarchat` | Pendente | | |
| E | WebChat sem atendente | Pendente | | |
| E | Alerta WhatsApp | Pendente | | |
| E | Assume via WA | Pendente | | |
| E | Resposta no WebChat | Pendente | | |
| E | Encerrar bridge | Pendente | | |
| E | Sem loop | Pendente | | |
| F | Criar ticket | Pendente | | |
| F | Consultar TK/token | Pendente | | |
| F | Responder janela 12h | Pendente | | |
| F | Token inválido | Pendente | | |
| F | Notas internas ocultas | Pendente | | |
| G | Formulário público | Pendente | | |
| G | Contato/lead | Pendente | | |
| G | Dedupe | Pendente | | |
| G | Kanban | Pendente | | |
| G | Limite plano | Pendente | | |
| H | Modo robotizado | Pendente | | |
| H | IA Básica | Pendente | | |
| H | IA Premium | Pendente | | |
| H | Sem créditos | Pendente | | |
| H | Fallback humano | Pendente | | |
| H | Logs/uso | Pendente | | |
| I | Ver planos | Pendente | | |
| I | Checkout test | Pendente | | |
| I | Pacote IA test | Pendente | | |
| I | Webhook mockado | Pendente | | |
| I | Limites bloqueando | Pendente | | |
| J | Token inválido | Pendente | | |
| J | Cross-tenant | Pendente | | |
| J | Consentimento | Pendente | | |
| J | Export CSV | Pendente | | |
| J | Logs sem segredo | Pendente | | grep runtime |

---

## Resultado QA manual, se executado

**Não executado nesta sessão.** Benhur deve copiar template, executar blocos A–J e registrar evidências (prints, refs TK, timestamps).

Após QA verde em D+E+F → reavaliar status para `PRONTO PARA GO-LIVE CONTROLADO`.

---

## Checklist VPS, SSL e domínio

| # | Item | Status | Observação |
|---|------|--------|------------|
| 1 | VPS escolhida | Pendente | Ver PREPARACAO-PRODUCAO |
| 2 | Sistema operacional | Pendente | Linux recomendado |
| 3 | Docker instalado | Pendente | |
| 4 | Firewall | Pendente | |
| 5 | Portas necessárias | Pendente | 443, 3001 interno |
| 6 | Domínio | Pendente | |
| 7 | DNS apontado | Pendente | |
| 8 | SSL ativo | Pendente | Let's Encrypt / proxy |
| 9 | Reverse proxy | Pendente | nginx/Caddy |
| 10 | CORS | Pendente | `ALLOWED_ORIGINS` |
| 11 | Upload/body size | Pendente | anexos webchat |
| 12 | Logs | Pendente | rotação |
| 13 | Healthcheck | Pendente | `/platform/health/atendimento` |
| 14 | Restart policy | Pendente | systemd/docker |

---

## Checklist variáveis de ambiente

Valores **não impressos** — apenas status em ambiente alvo.

| Variável | Dev local | Produção |
|----------|-----------|----------|
| `NODE_ENV=production` | N/A | Pendente |
| `APP_URL` | configurado | Pendente |
| `DASHBOARD_URL` | configurado | Pendente |
| `MONGODB_URI` / `MONGODB_URL` | configurado | Pendente |
| `REDIS_URL` | configurado | Pendente |
| `SESSION_SECRET` | configurado | Pendente |
| `JWT_SECRET` | configurado | Pendente |
| `SESSION_ENCRYPTION_KEY` | configurado | Pendente prod ≥32 chars |
| `ALLOWED_ORIGINS` | configurado | Pendente |
| `STRIPE_SECRET_KEY` | test configurado | Live pendente |
| `STRIPE_WEBHOOK_SECRET` | test configurado | Live pendente |
| `STRIPE_PRICE_ID_STARTER` | configurado | Pendente live |
| `STRIPE_PRICE_ID_PRO` | configurado | Pendente live |
| OpenAI / provider IA | configurado | Pendente org |
| `GEMINI_API_KEY` | não aplicável ou pendente | Se usado |
| `WHATSAPP_SESSION_STORAGE` | configurado | Pendente volume |
| `LOG_LEVEL` | configurado | Pendente prod |
| `RATE_LIMIT_ENABLED` | configurado | Revisar prod |

**Regra:** nunca commitar `.env`, `.env.local`, `.env.production`.

---

## Checklist banco, Redis, filas e storage

| # | Item | Status |
|---|------|--------|
| 1 | MongoDB produção | Pendente |
| 2 | Índices criados | Pendente |
| 3 | Backup Mongo | Pendente |
| 4 | Restore testado | Pendente |
| 5 | Redis produção | Pendente |
| 6 | BullMQ/filas | Pendente |
| 7 | Limpeza jobs antigos | Pendente |
| 8 | Storage uploads/anexos | Pendente |
| 9 | Política retenção | Pendente |
| 10 | Logs de erro | Pendente |

---

## Checklist Stripe e billing

| # | Item | Status |
|---|------|--------|
| 1 | Stripe test funcionando | Pendente manual |
| 2 | Price IDs test | Doc TOP 17 |
| 3 | Webhook test | Pendente manual |
| 4 | Pacotes IA test | Pendente manual |
| 5 | Stripe live desativado | OK — não ativado |
| 6 | Webhook live | Pendente |
| 7 | Price IDs live | Pendente |
| 8 | Customer Portal | Pendente se não existir |
| 9 | Trial (cartão? downgrade?) | Decisão Benhur |
| 10 | Billing não apaga dados | OK — política código |

---

## Checklist WhatsApp real

| # | Item | Status |
|---|------|--------|
| 1 | QR gera | Pendente |
| 2 | QR lido | Pendente |
| 3 | Sessão conecta | Pendente |
| 4 | Reconexão | Pendente |
| 5 | Inbound | Pendente |
| 6 | Outbound | Pendente |
| 7 | Comandos `!ajuda`…`!encerrarchat` | Pendente |
| 8 | Rate limit | Automatizado verde; real pendente |
| 9 | Logs sem QR | Automatizado verde; runtime pendente |
| 10 | Sessão por empresa | Pendente |

**Sem WhatsApp real validado → não usar `PRONTO PARA GO-LIVE CONTROLADO`.**

---

## Checklist WebChat e Bridge real

| # | Item | Status |
|---|------|--------|
| 1 | Widget embed real | Pendente |
| 2 | Pré-chat | Pendente |
| 3 | FAQ | Pendente |
| 4 | Fila | Pendente |
| 5 | Fallback WhatsApp | Pendente |
| 6 | Alerta equipe | Pendente |
| 7 | `!assumir` via WA | Pendente |
| 8 | Resposta no WebChat | Pendente |
| 9 | Encerramento bridge | Pendente |
| 10 | Sem loop | Pendente |
| 11 | Sem duplicidade | Pendente |
| 12 | Cross-tenant | Automatizado verde; manual pendente |

---

## Checklist IA e créditos

| # | Item | Status |
|---|------|--------|
| 1 | Robotizado | Pendente manual |
| 2 | IA Básica | Pendente manual |
| 3 | IA Premium | Pendente manual |
| 4 | Sem créditos | Pendente manual |
| 5 | Fallback humano | Pendente manual |
| 6 | Uso debitado | Automatizado verde |
| 7 | Alertas 80/90/100 | Automatizado verde |
| 8 | Provider sem key | Pendente manual |
| 9 | Provider erro | Pendente manual |
| 10 | Logs sem API key | Automatizado verde |

---

## Checklist segurança, logs e LGPD

| # | Item | Status |
|---|------|--------|
| 1 | Logs sem segredo | Automatizado verde; runtime pendente |
| 2 | Token inválido WebChat | Automatizado verde |
| 3 | Token inválido Form | Automatizado verde |
| 4 | Token inválido Ticket | Automatizado verde |
| 5 | Stripe webhook inválido | Automatizado verde |
| 6 | Authorization não logado | TOP 18 |
| 7 | Cookie não logado | TOP 18 |
| 8 | QR não logado | TOP 18 |
| 9 | Consentimento | Pendente manual |
| 10 | Opt-out | Pendente manual |
| 11 | Export CSV | Pendente manual |
| 12 | Delete/anonymize | Pendente pós-go-live |
| 13 | Portal LGPD titular | Pendente pós-go-live |

---

## Checklist backup e recuperação

| # | Item | Status |
|---|------|--------|
| 1 | Backup Mongo definido | Pendente |
| 2 | Teste restore | Pendente |
| 3 | Backup `.env` seguro | Pendente |
| 4 | Backup sessão WA | Pendente |
| 5 | Backup uploads | Pendente |
| 6 | Plano rollback | Pendente |
| 7 | Rollback app | Pendente |
| 8 | Rollback DB | Pendente |
| 9 | Log de deploy | Pendente |
| 10 | Responsável definido | Pendente — Benhur |

---

## Checklist monitoramento e operação

| # | Item | Status |
|---|------|--------|
| 1 | Healthcheck | Código OK; prod pendente |
| 2 | Logs aplicação | Pendente |
| 3 | Logs erro | Pendente |
| 4 | Alertas queda | Pendente |
| 5 | Alertas fila | Painel parcial |
| 6 | Alertas IA Créditos | Painel OK |
| 7 | Alertas billing | Painel OK |
| 8 | Alertas WA desconectado | Pendente prod |
| 9 | CPU/RAM/disco | Pendente |
| 10 | Procedimento reinício | Pendente |

---

## Resultado consolidado TOP 01–20

Ver [`RADARZAP-RESULTADO-FINAL-TOP-01-20.md`](../RADARZAP-RESULTADO-FINAL-TOP-01-20.md).

---

## Pendências finais

| ID | Pendência | Severidade | Bloqueia go-live? | Responsável | Observação |
|----|-----------|------------|-------------------|-------------|------------|
| P01 | QA manual A–J | Blocker | Sim | Benhur | Pré-requisito go-live |
| P02 | WhatsApp QR real | Blocker | Sim | Benhur | Bloco D |
| P03 | Bridge real | Blocker | Sim | Benhur | Bloco E |
| P04 | VPS/SSL/domínio | Blocker | Sim | Benhur | Infra |
| P05 | Env produção | High | Sim | Benhur | Sem commit |
| P06 | Stripe live | High | Sim* | Benhur | *Após test OK |
| P07 | Backups/restore | High | Sim | Benhur | |
| P08 | CORS produção | High | Sim | Benhur | |
| P09 | Trial runtime | Medium | Não | Benhur | Decisão produto |
| P10 | Portal LGPD titular | Medium | Não | Benhur | Pós-MVP |
| P11 | Lint frontend 159 | Low | Não | Dev | Dívida técnica |
| P12 | Jest open handles | Low | Não | Dev | CI verde |
| P13 | Customer Portal Stripe | Medium | Não | Benhur | |
| P14 | Gateway BR | Low | Não | Benhur | Futuro |
| P15 | Purge retenção | Medium | Não | Dev | TOP 18 pendência |

---

## Riscos finais

| Risco | Severidade |
|-------|------------|
| Baileys instável / ban WA | Alta |
| Bridge loop em prod | Média |
| Segredo em log runtime | Média — mitigado código |
| Stripe misconfig live | Alta |
| Perda sessão WA sem backup | Alta |
| OneDrive + gates paralelos | Baixa — rodar sequencial |

---

## Decisões finais para Benhur

1. **Autorizar e executar** QA manual A–J (copiar template).
2. **Escolher** VPS + domínio + SSL.
3. **Stripe:** manter test até QA I verde; live só após checklist.
4. **Trial:** cartão obrigatório? downgrade Free? bloqueio?
5. **Backup:** política Mongo + sessões WA.
6. **Data go-live:** após status `PRONTO PARA GO-LIVE CONTROLADO`.
7. **Beta controlado:** opcional antes de abertura ampla.
8. **Lint frontend:** corrigir antes ou depois do go-live.
9. **Portal LGPD:** MVP manual vs portal self-service.
10. **Monitoramento:** ferramenta inicial (logs + healthcheck).

---

## Atualização da documentação mestre

Atualizados: `RADARZAP-SISTEMA-COMPLETO.md` §23–24, `README.md`, `CHANGELOG.md`, `SISTEMA-REGISTRO.md`, `INDICE-DOCUMENTACAO.md`, registry `.cursor`.

---

## Arquivos alterados

- `docs/top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md` (novo)
- `docs/RADARZAP-RESULTADO-FINAL-TOP-01-20.md` (novo)
- `docs/QA-FASE1-RESULTADO-TEMPLATE.md` (§ TOP 20)
- `docs/RADARZAP-SISTEMA-COMPLETO.md`, `README.md`, `CHANGELOG.md`, `SISTEMA-REGISTRO.md`, `INDICE-DOCUMENTACAO.md`
- `package.json`, `.cursor/rules/radarzap-v2-system-registry.mdc`

---

## Commit final

Mensagem: `chore(top): congelamento final e go-live controlado 2.12.6`  
**Push:** não autorizado nesta etapa.

---

## Próximo passo pós-TOP 20

1. Benhur executa QA manual A–J e preenche `QA-FASE1-RESULTADO-YYYY-MM-DD.md`.
2. Provisionar VPS conforme `PREPARACAO-PRODUCAO.md`.
3. Configurar env produção (sem commit).
4. Validar WhatsApp + bridge + Stripe test em ambiente espelho.
5. Se tudo verde → `PRONTO PARA GO-LIVE CONTROLADO` → deploy controlado via `PRODUCTION.md`.
6. Push git quando Benhur autorizar.
