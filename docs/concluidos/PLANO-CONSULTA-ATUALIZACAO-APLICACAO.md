# Plano — consulta, atualização e aplicação (origem GG)

**Versão ref:** `2.11.28` · **Data:** 2026-06-21  
**Status:** Fase 1 — estabilização (sem go-live)

Este documento consolida os rascunhos `gg.md`, `gg1.md` e `gg2.md` em entregas oficiais do **Radar Chat v2** e define **como consultar, atualizar e aplicar** cada bloco no sistema.

> **Ordem de execução:** implementação Fase B/C → gate automático → **QA manual por último** (§10).

---

## 1. Origem dos arquivos GG

| Arquivo | Conteúdo | Destino no repo | Escopo |
|---------|----------|-----------------|--------|
| `gg.md` | Auditoria técnica + estabilização atendimento | [`ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md`](./concluidos/ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md) | **Radar Chat v2** |
| `gg1.md` | Visão produto / diferenciação vs concorrentes | [`RADARCHAT-VISAO-PRODUTO-DIFERENCIACAO.md`](./RADARCHAT-VISAO-PRODUTO-DIFERENCIACAO.md) | **Radar Chat v2** (Fase D+) |
| `gg2.md` | Termos/privacidade Discord — RadarGamer v4 | **Fora do escopo** deste repositório | Projeto **RadarGamer** |

> **Nota:** `gg2.md` não se aplica ao `radarchatv2`. Se necessário, reutilizar o texto no repositório RadarGamer como `docs/discord-app-settings.md` + rotas `/termos` e `/privacidade`.

---

## 2. Fluxo de trabalho recomendado

```txt
CONSULTAR → IMPLEMENTAR (patch seguro) → VALIDAR (gate automático) → QA MANUAL (último) → REGISTRAR (changelog/registry)
```

### 2.1 Consultar (antes de codar)

1. Ler [`INDICE-DOCUMENTACAO.md`](./INDICE-DOCUMENTACAO.md)
2. Ler doc de módulo afetado (`INBOX-ATENDIMENTO.md`, `TICKET-ATENDIMENTO.md`, `WEBCHAT.md`, etc.)
3. Ler [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md) — gate § Estabilização
4. Inspecionar código real (não assumir rotas/campos)
5. Comparar com v1 só se comportamento divergir (`.cursor/rules/radarchat-v2-reference.mdc`)

### 2.2 Atualizar (documentação)

Protocolo: [`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md)

| Alteração | Atualizar |
|-----------|-----------|
| Comportamento de domínio | Doc de módulo + `CHANGELOG.md` |
| Menu/rota/API | `MENU-PAGES-REGISTRY.md` |
| Entrega significativa | `SISTEMA-REGISTRO.md` + `.cursor/rules/radarchat-v2-system-registry.mdc` |
| Novo doc | `INDICE-DOCUMENTACAO.md` |
| Versão | `package.json` (patch/minor) |

### 2.3 Aplicar (código)

Regras do `gg.md` adaptadas:

- **Permitido sem autorização extra:** testes, gates QA, docs, bugs isolados, logs seguros
- **Exige plano + QA:** refatoração `InboxService`, filas, modelos destrutivos, Cloud API Meta
- **Proibido na Fase 1:** go-live VPS, billing live, envio WA em teste automatizado, commit de credenciais

---

## 3. Mapa GG → sistema (aplicação por prioridade)

### Prioridade 1 — Estabilização (agora)

| Item (gg.md) | Onde aplicar | Doc / código | Status jun/2026 |
|--------------|--------------|--------------|-----------------|
| Entrega 2.11.24–28 (presença, supervisor, fallback, sino) | Código + docs | [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./concluidos/ENTREGA-ATENDIMENTO-2.11.24-28.md) | ✅ doc completa |
| WA Inbox × Ticket × CSAT × IA | QA manual **§10** | `QA-FASE1-CHECKLIST.md`, `QA-FASE1-ROTEIRO.md` | 🔴 QA manual por último |
| Ordem inbound | Testes | `inbound-routing.test.ts`, `csat.util.test.ts` | 🟡 unitários OK; integração falta |
| Gate automático atendimento | `package.json` scripts | `npm run qa:atendimento:gate` | ✅ 2.11.28 (463 testes + gate) |
| WebChat bridge + comandos WA | Código + QA | `webchat-whatsapp-bridge.service.ts` | 🟡 2.11.8–2.11.13; QA §10 |
| Celular próprio / loop alerta | Análise | §7 em `ANALISE-CRITICA-…` | ✅ anti-loop 2.11.16 |
| Rate limit 2/min marketing, 10/min conversa | WhatsApp send layer | `whatsapp-session-rate-limit.ts` | ✅ 2.11.17 |
| Chamado WebChat × cliente × `!nota` | Ticket + bridge | `InboxService`, `TICKET-ATENDIMENTO.md` | ✅ 2.11.10–2.11.13 |
| Presença operacional + round-robin | Inbox + socket | `inbox-agent-presence.ts`, `INBOX-ATENDIMENTO.md` | ✅ 2.11.25 |
| Supervisão avançada (dashboard/monitor) | Inbox supervisor | `inbox-supervisor-dashboard.service.ts` | ✅ 2.11.24 |
| Fallback WA deferido + sino crítico | WebChat + painel | `webchat-whatsapp-fallback.service.ts`, `panel-critical-alerts.service.ts` | ✅ 2.11.28 |
| Fix IA Básica WebChat (≠ menu robotizado) | WebChat triagem | `webchat-basic-triage.service.ts` | ✅ 2.11.28 |

### Prioridade 2 — Segurança operacional

| Item | Aplicação | Status |
|------|-----------|--------|
| Observabilidade “Saúde do Atendimento” | `GET /api/platform/health/atendimento` | ✅ 2.11.17 |
| Auditoria append-only Ticket/Bridge | `AttendanceEvent` + `attendance-audit.service.ts` | ✅ 2.11.17 bridge; ✅ 2.11.34 ticket |
| Modo piloto `PILOT_MODE` | Env + limite campanha | ✅ 2.11.17 |
| Webhooks ticket/bridge | `WEBHOOKS.md` + dispatcher | ✅ 2.11.33 |

### Prioridade 3 — Produto (Fase D+)

| Item (gg1.md) | Aplicação |
|---------------|-----------|
| CRM leve / funil lead | Backlog — ver `RADARCHAT-VISAO-PRODUTO-DIFERENCIACAO.md` |
| Gatilhos inteligentes WebChat | `WEBCHAT.md` + widget |
| Templates por segmento | Seeds + onboarding |
| IA Básica local-first | [`concluidos/RADARCHAT-ATTENDANCE-MODES-PHASE-5.md`](./concluidos/RADARCHAT-ATTENDANCE-MODES-PHASE-5.md) |

---

## 4. Fases de execução

### Fase A — Gate automático + correções

1. ✅ `npm run qa:atendimento:gate` (2.11.28 — 463 testes unitários + gate)
2. ✅ Anti-loop alerta fallback (2.11.16)
3. ✅ Auditoria rev.2 (`ANALISE-CRITICA-…`)
4. ✅ Fallback deferido + alertas críticos painel (2.11.28)
5. ✅ Testes integrados mínimos InboxService — 2.11.30–35 (CSAT, ticket, ordem inbound)

### Fase B — Segurança operacional

1. ✅ Rate limit por sessão WA tipado + jitter (2.11.17)
2. ✅ Proteção loop número próprio em alertas bridge (2.11.16)
3. ✅ Audit log append-only bridge (`AttendanceEvent`) (2.11.17)
4. ✅ `GET /api/platform/health/atendimento` (2.11.17)
5. ✅ Presença operacional atendentes + round-robin por disponibilidade (2.11.25)
6. ✅ Webhooks ticket/bridge (2.11.33)
7. ✅ Audit log eventos ticket (create/close/reply) — 2.11.34

### Fase C — Piloto seguro

1. ✅ `PILOT_MODE=true` + limite destinatários campanha (2.11.17)
2. 1–3 tenants reais com roteiro QA assinado — **após §10**
3. Só após gate § Estabilização verde

### Fase D — Produto vendável

1. Visão `gg1.md` → épicos priorizados (CRM leve, gatilhos, relatórios conversão)
2. Onboarding wizard
3. Templates por segmento

### Fase E — IA Básica

1. Fase 5 modos — refinamentos pós-estabilização
2. Não misturar com estabilização WA

---

## 5. Comandos de validação (gate automático)

```bash
npm run qa:prep
npm run qa:webchat-wa
npm run qa:atendimento:gate
npm test
npm run qa:gate
```

---

## 6. Arquivos que podem ser alterados (Fase A/B)

- `src/services/inbox/*`, `src/services/webchat/*`, `src/services/whatsapp/*`
- `src/services/attendance/*`, `src/utils/whatsapp-session-rate-limit.ts`
- `src/utils/*` (helpers ticket, CSAT, routing, bridge)
- `docs/*`, `package.json` scripts, testes `__tests__`
- `frontend/src/components/inbox/*`, `frontend/src/pages/menu/*` (atendimento)

## 7. Arquivos que NÃO alterar sem necessidade

- `sessions/`, `.env`, credenciais
- Cloud API Meta (stub Fase 2)
- Billing Stripe live
- `PREPARACAO-PRODUCAO.md` execução / deploy VPS
- Refatoração massiva `InboxService.ts` sem testes de regressão

---

## 8. Próximo passo imediato (implementação)

1. ✅ Webhooks `ticket.*` / `webchat.bridge.*` (2.11.33)
2. ✅ Audit log eventos ticket (create/close/client_replied) — 2.11.34
3. ✅ Testes integrados ordem inbound em `InboxService` — 2.11.35
4. **Depois:** QA manual §10

---

## 9. Referências cruzadas

| Documento | Papel |
|-----------|-------|
| [`ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md`](./concluidos/ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md) | Auditoria técnica detalhada (gg.md) |
| [`RADARCHAT-VISAO-PRODUTO-DIFERENCIACAO.md`](./RADARCHAT-VISAO-PRODUTO-DIFERENCIACAO.md) | Visão comercial (gg1.md) |
| [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md) | Gate oficial Fase 1 |

---

## 10. QA manual — última etapa (não pular antes da Fase B)

Execute **somente após** Fases A/B verdes no gate automático.

| Ordem | Doc | Escopo |
|-------|-----|--------|
| **start** | [`QA-FASE1-KICKOFF.md`](./QA-FASE1-KICKOFF.md) | Gate automático ✅ + ordem de execução |
| 0 | [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./concluidos/ENTREGA-ATENDIMENTO-2.11.24-28.md) | Spec técnica (consulta durante QA) |
| 1 | [`QA-FASE1-ROTEIRO.md`](./QA-FASE1-ROTEIRO.md) | § A WhatsApp + Partes 3–7 (WebChat, fallback deferido, presença, supervisor, alertas) |
| 2 | [`QA-FASE1-CHECKLIST.md`](./QA-FASE1-CHECKLIST.md) | Checklist imprimível (§ A–E) |
| 3 | [`QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`](./QA-WEBCHAT-WA-FALLBACK-BRIDGE.md) | Token, FAQ, C0/C1 fallback, bridge, IA Básica, presença |
| 4 | [`QA-FASE1-RESULTADO-TEMPLATE.md`](../QA-FASE1-RESULTADO-TEMPLATE.md) | Registro Fase 1 |
| 4b | [`QA-FASE1-RESULTADO-2026-06-22.md`](./QA-FASE1-RESULTADO-2026-06-22.md) | **Sessão atual** — gate auto ✅, manual em branco |
| 5 | [`QA-WEBCHAT-WA-RESULTADO-TEMPLATE.md`](./QA-WEBCHAT-WA-RESULTADO-TEMPLATE.md) | Registro WebChat/WA |

**Gate ROADMAP § Estabilização** só fica 🟢 quando §10 estiver assinado.

**Pré-requisitos QA:**

```bash
npm run qa:manual:start   # gate atendimento + prep (mesmo que qa:atendimento:gate)
npm run dev
npm run dashboard:frontend
```

Registro sugerido: [`QA-FASE1-RESULTADO-2026-06-22.md`](./QA-FASE1-RESULTADO-2026-06-22.md) (gate automático já preenchido).

Sessão WA conectada, CSAT habilitado, celular de teste ≠ número do atendente.
