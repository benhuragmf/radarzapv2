# Plano — consulta, atualização e aplicação (origem GG)

**Versão ref:** `2.11.13` · **Data:** 2026-06-21  
**Status:** Fase 1 — estabilização (sem go-live)

Este documento consolida os rascunhos `gg.md`, `gg1.md` e `gg2.md` em entregas oficiais do **RadarZap v2** e define **como consultar, atualizar e aplicar** cada bloco no sistema.

---

## 1. Origem dos arquivos GG

| Arquivo | Conteúdo | Destino no repo | Escopo |
|---------|----------|-----------------|--------|
| `gg.md` | Auditoria técnica + estabilização atendimento | [`ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md`](./ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md) | **RadarZap v2** |
| `gg1.md` | Visão produto / diferenciação vs concorrentes | [`RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md`](./RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md) | **RadarZap v2** (Fase D+) |
| `gg2.md` | Termos/privacidade Discord — RadarGamer v4 | **Fora do escopo** deste repositório | Projeto **RadarGamer** |

> **Nota:** `gg2.md` não se aplica ao `radarzapv2`. Se necessário, reutilizar o texto no repositório RadarGamer como `docs/discord-app-settings.md` + rotas `/termos` e `/privacidade`.

---

## 2. Fluxo de trabalho recomendado

```txt
CONSULTAR → DOCUMENTAR → VALIDAR (QA/testes) → APLICAR (patch seguro) → REGISTRAR (changelog/registry)
```

### 2.1 Consultar (antes de codar)

1. Ler [`INDICE-DOCUMENTACAO.md`](./INDICE-DOCUMENTACAO.md)
2. Ler doc de módulo afetado (`INBOX-ATENDIMENTO.md`, `TICKET-ATENDIMENTO.md`, `WEBCHAT.md`, etc.)
3. Ler [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md) — gate § Estabilização
4. Inspecionar código real (não assumir rotas/campos)
5. Comparar com v1 só se comportamento divergir (`.cursor/rules/radarzap-v2-reference.mdc`)

### 2.2 Atualizar (documentação)

Protocolo: [`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md)

| Alteração | Atualizar |
|-----------|-----------|
| Comportamento de domínio | Doc de módulo + `CHANGELOG.md` |
| Menu/rota/API | `MENU-PAGES-REGISTRY.md` |
| Entrega significativa | `SISTEMA-REGISTRO.md` + `.cursor/rules/radarzap-v2-system-registry.mdc` |
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
| WA Inbox × Ticket × CSAT × IA | QA manual | `QA-FASE1-CHECKLIST.md`, `QA-FASE1-ROTEIRO.md` | 🔴 QA manual incompleto |
| Ordem inbound | Testes | `inbound-routing.test.ts`, `csat.util.test.ts` | 🟡 unitários OK; integração falta |
| Gate automático atendimento | `package.json` scripts | Propor `qa:atendimento:gate` | ⏳ não criado |
| WebChat bridge + comandos WA | Código + QA | `webchat-whatsapp-bridge.service.ts`, `whatsapp-agent-command.service.ts` | 🟡 2.11.8–2.11.13; validar QA |
| Celular próprio / loop alerta | Análise | §7 em `ANALISE-CRITICA-…` | 🟡 parcial — ver análise |
| Rate limit 2/min marketing, 10/min conversa | WhatsApp send layer | Documentar + implementar fase B | ⏳ planejado |
| Chamado WebChat × cliente × `!nota` | Ticket + bridge | `InboxService`, `TICKET-ATENDIMENTO.md` | ✅ 2.11.10–2.11.13 |

### Prioridade 2 — Segurança operacional

| Item | Aplicação |
|------|-----------|
| Observabilidade “Saúde do Atendimento” | Doc + métricas mínimas (sem painel grande) |
| Auditoria append-only Ticket/Bridge | Modelo `TicketEvent` / `BridgeEvent` — proposta |
| Modo piloto `PILOT_MODE` | Env + flags — proposta |
| Webhooks ticket/bridge | `WEBHOOKS.md` + dispatcher |

### Prioridade 3 — Produto (Fase D+)

| Item (gg1.md) | Aplicação |
|---------------|-----------|
| CRM leve / funil lead | Backlog — ver `RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md` |
| Gatilhos inteligentes WebChat | `WEBCHAT.md` + widget |
| Templates por segmento | Seeds + onboarding |
| IA Básica local-first | [`concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-5.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-5.md) |

---

## 4. Fases de execução

### Fase A — Estabilização crítica (2–4 semanas)

1. Rodar [`QA-FASE1-CHECKLIST.md`](./QA-FASE1-CHECKLIST.md) § A + § C WebChat
2. Rodar [`QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`](./QA-WEBCHAT-WA-FALLBACK-BRIDGE.md) com ticket novo
3. Criar `npm run qa:atendimento:gate` (agrupa `qa:gate` + `qa:webchat-wa`)
4. Corrigir regressões encontradas (patch 2.11.x)
5. Atualizar gate em `ROADMAP-COMPLETUDE.md`

### Fase B — Segurança operacional

1. Rate limit por sessão WA + jitter
2. Proteção loop número próprio em alertas bridge
3. Estrutura audit log Ticket/Bridge (append-only)
4. Logs/métricas mínimas de saúde

### Fase C — Piloto seguro

1. `PILOT_MODE=true` (limites, badge, auditoria extra)
2. 1–3 tenants reais com roteiro QA assinado
3. Só após gate § Estabilização verde

### Fase D — Produto vendável

1. Visão `gg1.md` → épicos priorizados (CRM leve, gatilhos, relatórios conversão)
2. Onboarding wizard
3. Templates por segmento

### Fase E — IA Básica

1. Fase 5 modos — classificador local-first
2. Não misturar com estabilização WA

---

## 5. Comandos de validação

```bash
npm run qa:prep
npm run qa:webchat-wa
npm test
npm run qa:gate
```

**Futuro:** `npm run qa:atendimento:gate` = `qa:gate` + subset atendimento + smoke E2E quando estável.

---

## 6. Arquivos que podem ser alterados (Fase A)

- `src/services/inbox/*`, `src/services/webchat/*`, `src/services/whatsapp/*`
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

## 8. Próximo passo imediato

1. **QA manual** chamado WebChat (mensagem ao cliente × `!nota` × consulta TK+token) — roteiro em `QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`
2. **Atualizar** [`TICKET-ATENDIMENTO.md`](./TICKET-ATENDIMENTO.md) § mensagens visíveis vs notas internas (2.11.13)
3. **Criar** script `qa:atendimento:gate` (agrupador)
4. **Executar** checklist § A WhatsApp em `QA-FASE1-CHECKLIST.md`

---

## 9. Referências cruzadas

| Documento | Papel |
|-----------|-------|
| [`ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md`](./ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md) | Auditoria técnica detalhada (gg.md) |
| [`RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md`](./RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md) | Visão comercial (gg1.md) |
| [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md) | Gate oficial Fase 1 |
