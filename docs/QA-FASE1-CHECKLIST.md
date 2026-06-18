# RadarZap v2 — Checklist QA Fase 1 (estabilização)

> **Versão alvo:** `2.10.18` · **Gate:** `ROADMAP-COMPLETUDE.md` § Estabilização  
> Preencher data, responsável e pass/fail ao executar. Anexar prints em falhas.

**Execução:** _______________ · **Responsável:** _______________ · **Ambiente:** dev / piloto

---

## Pré-requisitos

- [ ] `npm test` verde (326 testes em 2.10.18)
- [ ] `npm run build` + build frontend verdes
- [ ] Sessão WhatsApp conectada (`/sessions`)
- [ ] CSAT habilitado na org (`csatEnabled`)
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
| `/platform/inbox/bot` | Prévia ao vivo, salvar textos | [ ] | |
| `/platform/inbox/respostas` | Busca, filtros, prévia `/bd` | [ ] | |
| `/platform/inbox/supervisor` | Fila, equipe online, reatribuir | [ ] | |
| `/platform/webchat` | Histórico 3 colunas, aba Widgets, snippet instalação | [ ] | |
| `/platform/inbox/ia` | Métricas, abas, salvar configurações | [ ] | |
| `/platform/inbox/relatorios` | Período, métricas, tabelas setor/atendente | [ ] | |

---

## C. WebChat — fluxos críticos

| # | Cenário | Esperado | OK? | Notas |
|---|---------|----------|-----|-------|
| 1 | Visitante abre widget → pré-chat nome/e-mail | Formulário antes do chat (se configurado) | [ ] | |
| 2 | Mensagem → triagem IA | Bot/IA responde; conversa em `bot` | [ ] | |
| 3 | Escalação → Inbox | Aparece em `/platform/inbox?channel=webchat`; **Assumir** funciona | [ ] | |
| 4 | Atendente responde com imagem/PDF | Anexo visível no widget | [ ] | |
| 5 | Finalizar conversa site | Visitante vê encerramento; não reabre sozinho | [ ] | |

---

## D. Gate § Estabilização (resumo)

| Item | Status |
|------|--------|
| QA WhatsApp (§ A) sem falha crítica | [ ] |
| QA painel (§ B + C) sem regressão visual/funcional | [ ] |
| Nenhum bug crítico aberto após 1 ciclo completo | [ ] |
| `npm test` + `npm run build` verdes | [x] validado local 2026-06-18 |
| CI verde em `main` | [ ] — corrigido audit runtime em 2.10.19 (aguardando pipeline) |
| Testes helpers 2.8.8–2.8.11 (`csat`, `ticket-reply-window`, `inbound-routing`) | [x] em `npm test` |
| ROADMAP + changelog alinhados | [x] 2.10.18 |

---

## Registro de falhas

| Data | Versão | Cenário # | Severidade | Descrição | Issue/commit fix |
|------|--------|-----------|------------|-----------|------------------|
| | | | crítico / médio / baixo | | |

---

## Referências

- `ROADMAP-COMPLETUDE.md` — fases e lacunas
- `radarzap-inbox-upgrade.md` — escopo visual 2.10.18
- `INBOX-ATENDIMENTO.md` — CSAT, routing, API
- `TICKET-ATENDIMENTO.md` — janela 12 h, estados ticket
- `WEBCHAT.md` — widget, fila, Inbox unificado
