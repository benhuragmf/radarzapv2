# RadarZap v2 — Checklist QA Fase 1 (estabilização)

> **Versão alvo:** `2.11.38` · **Gate:** `ROADMAP-COMPLETUDE.md` § Estabilização  
> **Roteiro detalhado:** [`QA-FASE1-ROTEIRO.md`](./QA-FASE1-ROTEIRO.md) · **Spec 2.11.24–28:** [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./ENTREGA-ATENDIMENTO-2.11.24-28.md)  
> **Pré-check:** `npm run qa:prep` + `npm run qa:atendimento:gate` · **Resultado:** [`QA-FASE1-RESULTADO-TEMPLATE.md`](./QA-FASE1-RESULTADO-TEMPLATE.md)

**Execução:** _______________ · **Responsável:** _______________ · **Ambiente:** dev / piloto

---

## Pré-requisitos

- [x] `npm test` verde (494 testes — validado 2026-06-22)
- [x] `npm run qa:atendimento:gate` verde (135+53 — validado 2026-06-22)
- [x] `npm run build` + build frontend verdes (validado 2026-06-22)
- [x] `npm run qa:prep` sem bloqueios (WA + CSAT — validado 2026-06-22)
- [ ] Contato de teste (idealmente o que reproduziu bugs anteriores)
- [ ] Pelo menos 1 widget WebChat ativo (para cenários site)

---

## A. WhatsApp — núcleo Inbox × Ticket × CSAT × IA

| # | Cenário | Passos | Esperado | OK? | Notas |
|---|---------|--------|----------|-----|-------|
| 1 | Triagem → humano | Cliente inicia → IA/bot → escala → atendente responde | Conversa no Inbox; sem ticket espúrio | [ ] | |
| 2 | Finalizar + CSAT | Atendente clica **Finalizar** no painel | CSAT enviado na hora ao cliente | [ ] | |
| 3 | `avaliar` | Cliente envia `avaliar` após atendimento | Pesquisa CSAT; **não** reabre ticket antigo | [ ] | |
| 4 | Nota CSAT | Cliente responde `4` (ou nota válida) | Agradecimento; nota gravada | [ ] | |
| 5 | Novo atendimento pós-CSAT | Após CSAT, cliente: `Ola` / `gostaria de atendimento` | **Novo** fluxo Inbox; sem loop CSAT | [ ] | |
| 6 | Pedido de humano | Cliente: `falar com atendente` | Escala/menu; sem lembrete CSAT indevido | [ ] | |
| 7 | TK antigo fechado | TK fechado há dias + mensagem nova do cliente | **Não** captura no TK; novo atendimento | [ ] | |
| 8 | Janela 12 h ticket | Envio **via Ticket** + resposta cliente < 12 h | Complemento no mesmo TK | [ ] | |
| 9 | IA escalação | IA promete “vou transferir” / encaminhar | Escala para fila; não trava em triagem | [ ] | |
| 10 | Menu ticket × inbox | Menu ticket `1`/`2` com inbox ativo | Sem colisão indevida entre fluxos | [ ] | |

---

## B. Painel — upgrade visual Atendimento (2.10.18)

| Rota | Verificar | OK? | Notas |
|------|-----------|-----|-------|
| `/platform/inbox` | Métricas, filtros (incl. Encerrados), estado vazio, 3 colunas, WA + site | [ ] | |
| `/platform/inbox/tickets` | Métricas, busca, paginação (15/página), abrir ticket | [ ] | |
| `/platform/inbox/setores` | Métricas, criar/editar setor público e interno | [ ] | |
| `/platform/inbox/bot` | Prévia ao vivo, salvar textos, **fallback WhatsApp** | [ ] | 2.10.72 |
| `/platform/inbox/respostas` | Busca, filtros, prévia `/bd` | [ ] | |
| `/platform/inbox/supervisor` | Fila, equipe online, reatribuir | [ ] | |
| `/platform/webchat` | Histórico 3 colunas, aba Widgets, snippet instalação | [x] | 2.10.60 — toolbar chips, seções, preview sticky |
| `/platform/inbox/ia` | Métricas, abas, salvar configurações | [ ] | |
| `/platform/inbox/relatorios` | Período, métricas, tabelas setor/atendente | [ ] | |

---

## C. WebChat — fluxos críticos

| # | Cenário | Esperado | OK? | Notas |
|---|---------|----------|-----|-------|
| 1 | Visitante abre widget → pré-chat nome/e-mail | Formulário antes do chat (se configurado) | [ ] | |
| 2 | Mensagem → triagem IA | Bot/IA responde; conversa em `bot` | [ ] | |
| 3 | Escalação → Inbox | Aparece em `/platform/inbox?channel=webchat`; **Assumir** funciona | [x] | 2.10.60 — assumir + anexo ida/volta |
| 4 | Atendente responde com imagem/PDF | Anexo visível no widget | [x] | 2.10.60 |
| 5 | Finalizar conversa site | Visitante vê encerramento; não reabre sozinho | [ ] | |

### C.2 Token, FAQ, fallback WA e bridge (2.10.70–2.10.75)

> Roteiro passo a passo: [`QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`](./QA-WEBCHAT-WA-FALLBACK-BRIDGE.md)

| # | Cenário | Esperado | OK? | Notas |
|---|---------|----------|-----|-------|
| 6 | Consulta chamado por token no widget | Ref + token → status; token errado genérico | [ ] | Fase A |
| 7 | FAQ chips + link no widget | Resposta KB + botão https | [ ] | Fase B |
| 8 | Fallback offline → alerta WA | Mensagem visitante + alerta com `TK-` | [ ] | Fase C.1 |
| 9 | Fallback deferido (online, não assume) | Sem alerta imediato; após timeout + sino vermelho | [ ] | C0 2.11.28 |
| 10 | `!assumir` / `!ticket` / `!encerrar` | Só número cadastrado em Equipe | [ ] | Fase D |
| 11 | Bridge visitante ↔ WA | Msg site → celular; resposta WA → widget; badge Bridge | [ ] | Fase E |
| 12 | IA Básica WebChat | 1ª msg ≠ menu robotizado 1–4 | [ ] | G 2.11.28 |
| 13 | Presença + RR | Ocupado não recebe prioridade; Online sim | [ ] | H 2.11.25 |

### C.1 Painel widgets (2.10.55–2.10.60)

| # | Cenário | OK? | Notas |
|---|---------|-----|-------|
| W1 | Trocar seções (Geral, Visual, Pré-chat…) e **Salvar** | [x] | 2026-06-18 |
| W2 | **Aplicar modelo** → preview ao vivo atualiza | [x] | |
| W3 | Pré-chat (modo/campos) **não muda tema** | [x] | fix 2.10.55 |
| W4 | **Balão proativo** após delay configurado | [x] | fix 2.10.54 |
| W5 | Inbox → **Assumir** → anexo ida e volta | [x] | imagem/PDF |

---

## E. Presença, supervisor e alertas (2.11.24–28)

> Roteiro: [`QA-FASE1-ROTEIRO.md`](./QA-FASE1-ROTEIRO.md) Partes 3b, 5–7

| # | Cenário | Esperado | OK? | Notas |
|---|---------|----------|-----|-------|
| 1 | Status operacional (Online/Ocupado/Ausente) | RR respeita disponibilidade | [ ] | 2.11.25 |
| 2 | Auto-ausente por inatividade | Status Ausente + prompt restaurar | [ ] | 2.11.25 |
| 3 | Supervisor dashboard | Equipe, fila WA+WC, monitor drawer | [ ] | 2.11.24 |
| 4 | Reassign supervisor (`wc:`) | Conversa reatribuída | [ ] | 2.11.24 |
| 5 | Sino vermelho fallback perdido | `webchat:fallback_missed` | [ ] | 2.11.28 |
| 6 | Alertas billing/IA/config | Só `billing:view`; badge vermelho | [ ] | 2.11.28 |

---

## D. Gate § Estabilização (resumo)

| Item | Status |
|------|--------|
| QA WhatsApp (§ A) sem falha crítica | [ ] |
| QA painel (§ B + C) sem regressão visual/funcional | [ ] |
| QA 2.11.24–28 (§ E) sem falha crítica | [ ] |
| Nenhum bug crítico aberto após 1 ciclo completo | [ ] |
| `npm test` + `npm run qa:atendimento:gate` verdes | [x] 2026-06-22 (494 + gate 135+53) |
| CI verde em `main` | [x] run `27923773714` (2.11.38) |
| Testes helpers 2.8.8–2.8.11 + presence + fallback + webhooks/audit/ordem | [x] em `qa:atendimento:gate` |
| E2E smoke rotas Atendimento | [x] CI |
| E2E Inbox/Supervisor autenticado (mock) | [x] `e2e/inbox-authenticated.spec.ts` |
| ROADMAP + changelog alinhados | [x] 2.11.35 |

---

## Registro de falhas

| Data | Versão | Cenário # | Severidade | Descrição | Issue/commit fix |
|------|--------|-----------|------------|-----------|------------------|
| | | | crítico / médio / baixo | | |

---

## Referências

- `ENTREGA-ATENDIMENTO-2.11.24-28.md` — spec técnica + cenários QA
- `ROADMAP-COMPLETUDE.md` — fases e lacunas
- `radarzap-inbox-upgrade.md` — escopo visual 2.10.18
- `INBOX-ATENDIMENTO.md` — CSAT, routing, API
- `TICKET-ATENDIMENTO.md` — janela 12 h, estados ticket
- `WEBCHAT.md` — widget, fila, Inbox unificado
