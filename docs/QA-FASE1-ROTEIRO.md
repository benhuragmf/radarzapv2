# RadarZap v2 — Roteiro QA Fase 1 (passo a passo)

> **Execute por último** — após Fase B/C do [`PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md`](./PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md) e `npm run qa:atendimento:gate` verde.  
> Complementa [`QA-FASE1-CHECKLIST.md`](./QA-FASE1-CHECKLIST.md) com ordem de execução e mensagens exatas.  
> **Versão alvo:** `2.11.28` · Detalhe técnico: [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./ENTREGA-ATENDIMENTO-2.11.24-28.md)

## Antes de começar

```bash
npm run qa:prep              # verifica Mongo, sessão WA e CSAT
npm run qa:atendimento:gate  # gate automático (463+ testes)
npm test                     # suite completa
```

1. Painel aberto (`npm run dev` + `npm run dashboard:frontend`)
2. Sessão WhatsApp **conectada** (`/sessions`)
3. CSAT **habilitado** (`/platform/inbox/bot` → Pesquisa de satisfação)
4. Celular de teste como **cliente** (número diferente do atendente)
5. Anote versão: `package.json` → campo `version`

---

## Parte 1 — WhatsApp (§ A do checklist)

Execute **na ordem**. Aguarde cada resposta antes do próximo passo.

### Cenário 1 — Triagem → humano

| Quem | Ação |
|------|------|
| Cliente | Envia `Oi` ou `preciso de ajuda` |
| Sistema | Bot/IA responde (menu ou triagem) |
| Cliente | Escolhe setor ou pede atendente conforme fluxo |
| Atendente | Abre `/platform/inbox`, **Assume**, responde uma mensagem |

**Esperado:** conversa no Inbox; **sem** ticket `TK-` criado automaticamente.

---

### Cenários 2–5 — CSAT completo

| # | Quem | Ação | Esperado |
|---|------|------|----------|
| 2 | Atendente | No Inbox, clica **Finalizar** | Cliente recebe pesquisa CSAT na hora |
| 3 | Cliente | Envia `avaliar` (se ainda não recebeu nota) | Mensagem de nota 1–5; **não** abre ticket antigo |
| 4 | Cliente | Responde `4` | Agradecimento; nota gravada |
| 5 | Cliente | Envia `Ola` ou `gostaria de atendimento` | **Novo** atendimento no Inbox; **sem** loop pedindo nota |

---

### Cenário 6 — Pedido de humano pós-CSAT

| Quem | Ação |
|------|------|
| Cliente | `falar com atendente` |

**Esperado:** escala ou menu de setores; **não** lembrete de CSAT pendente.

---

### Cenário 7 — Ticket antigo fechado

**Pré-condição:** existe `TK-…` **fechado** há dias para este contato.

| Quem | Ação |
|------|------|
| Cliente | Envia mensagem nova (ex.: `tenho outra dúvida`) |

**Esperado:** novo fluxo Inbox; mensagem **não** vira complemento do TK antigo.

---

### Cenário 8 — Janela 12 h do ticket

| Quem | Ação |
|------|------|
| Atendente | Abre ticket em `/platform/inbox/tickets/:ref` |
| Atendente | Envia resumo ao cliente **via Ticket** (não só pelo Inbox) |
| Cliente | Responde em menos de 12 h |

**Esperado:** complemento no **mesmo** `TK-…`; status `client_replied`.

---

### Cenário 9 — IA promete transferência

**Pré-condição:** IA Atendimento ativa (`/platform/inbox/ia`).

| Quem | Ação |
|------|------|
| Cliente | Inicia conversa; pergunta algo que leve a transferência |
| Cliente | Ou diga algo que faça a IA responder “vou transferir” / “encaminhar” |

**Esperado:** conversa vai para fila (`waiting_queue`); **não** fica travada em triagem.

---

### Cenário 10 — Menu ticket × inbox

**Pré-condição:** inbox ativo **e** menu de ticket enviado ao cliente.

| Quem | Ação |
|------|------|
| Cliente | Responde `1` ou `2` conforme menu recebido |

**Esperado:** escolha respeita contexto (ticket vs inbox); sem colisão entre fluxos.

---

## Parte 2 — Painel Atendimento (§ B)

Percorra cada rota logado. Marque no checklist.

| Rota | O que validar rapidamente |
|------|---------------------------|
| `/platform/inbox` | Cards de métricas; filtro **Encerrados**; 3 colunas ao abrir conversa |
| `/platform/inbox/tickets` | Métricas; busca; paginação (Próxima/Anterior) |
| `/platform/inbox/setores` | Criar/editar setor |
| `/platform/inbox/supervisor` | Equipe ao vivo, conversas ativas, fila WA+WebChat, **Monitorar** (drawer), métricas 7d |
| `/platform/inbox/bot` | Fallback: **tempo aceitar antes fallback** (60s) + presença idle |
| `/platform/inbox/respostas` | Busca; prévia de atalho |
| `/platform/webchat` | Aba Widgets + snippet; histórico 3 colunas |
| `/platform/inbox/ia` | Métricas no topo; salvar configurações |
| `/platform/inbox/relatorios` | Trocar período; tabelas carregam |

---

## Parte 3 — WebChat (§ C)

1. Abra o site de teste ou `/webchat/widget.html` com chave do widget
2. Preencha nome/e-mail se o widget pedir
3. Envie mensagem → verifique triagem
4. No painel: `/platform/inbox?channel=webchat` → **Assumir** e responder
5. Teste anexo (imagem/PDF) se possível
6. **Finalizar** e confirme no widget que encerrou

Roteiro estendido token/FAQ/fallback/bridge: [`QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`](./QA-WEBCHAT-WA-FALLBACK-BRIDGE.md).

---

## Parte 3b — Fallback deferido + sino vermelho (2.11.28)

**Pré-condição:** fallback ativo em Triagem e Bot; `whatsappFallbackAcceptTimeoutSeconds` = **60** (ou **30** para teste rápido); 1 atendente **Online** no header; celular alerta ≠ sessão Baileys.

| Quem | Ação | Esperado |
|------|------|----------|
| Visitante | Escala para fila (WebChat) | Prioridade para atendente; mensagem sistema; **sem** alerta WA imediato |
| Atendente | **Não** clica Assumir; aguarda timeout (+ ~60s scan) | Visitante recebe mensagem fallback; WhatsApp recebe alerta `TK-…` |
| Atendente designado | Abre painel (ou já estava) | Sino **vermelho** — *Chat perdido — fallback WhatsApp* (`webchat:fallback_missed`) |
| Dono/admin | Simular plano perto do vencimento ou cota IA esgotada | Sino vermelho `billing:*` / `ai:quota_*` (só quem tem `billing:view`) |

---

## Parte 4 — Fila e limites WhatsApp (anti-ban)

**Automatizado:** `npm run qa:atendimento:gate` (inclui `whatsapp-session-rate-limit` + `whatsapp-human-send`).

**Painéis:** `/platform/wa-limits` (empresa) · `/admin/settings` → limites WA (admin) · `/queue` (fila BullMQ).

| Canal | Fila `whatsapp-sending` | Limite padrão |
|-------|-------------------------|---------------|
| Inbox / bot / ticket (resposta WA) | Sim (`sendKind: conversation`) | ~10/min + jitter + composing |
| Campanhas / regras Discord | Sim (`sendKind: marketing`) | ~2/min |
| Alertas internos (fallback WebChat, OTP ticket) | Sim (`sendKind: alert`) | bucket separado |
| WebChat visitante (widget) | **Não** — rate limit próprio (~12/min/conv) | HTTP 429 no widget |

### Cenário WA-1 — Inbox (conversa)

| Quem | Ação | Esperado |
|------|------|----------|
| Atendente | No Inbox WA, envie **15 mensagens seguidas** ao mesmo contato | Todas entregues, **espaçadas** (não burst instantâneo); logs `WA send aguardando rate limit` se necessário |
| Atendente | Abra `/queue` | Jobs `whatsapp-sending` processados; pending não acumula indefinidamente |

### Cenário WA-2 — Campanha (marketing)

| Quem | Ação | Esperado |
|------|------|----------|
| Operador | Dispare campanha pequena (5+ contatos) ou simule via `/send` | Envios **lentos** (~2/min); fila respeitada |
| Operador | `/platform/wa-limits` → desative limite conversa temporariamente | Só afeta bucket conversa; marketing continua limitado |

### Cenário WA-3 — WebChat bridge (alerta)

| Quem | Ação | Esperado |
|------|------|----------|
| Visitante | Spam no widget até 429 | Aviso no chatbox; mensagens **não** floodam WA retroativamente |
| Sistema | Mensagens anteriores ao bloqueio | Bridge `[Site · TK-…]` só do que passou no rate limit visitante |

### Cenário WA-4 — Saúde

| Quem | Ação | Esperado |
|------|------|----------|
| Atendente | `GET /api/platform/health/atendimento` (ou via devtools no painel) | `whatsappConnected: true`; sem fila crítica |

---

## Parte 5 — Presença operacional (2.11.25)

| # | Quem | Ação | Esperado |
|---|------|------|----------|
| P1 | Atendente | Header → status **Online** | Indicador verde; elegível para fila |
| P2 | Atendente | Trocar para **Ocupado** | Round-robin **não** indica este atendente |
| P3 | Atendente | Voltar **Online**; visitante escala | Prioridade RR se setor configurado |
| P4 | Atendente | Ficar inativo no painel ≥ `presenceIdleTimeoutSeconds` | Status auto **Ausente**; prompt ao voltar à aba |
| P5 | Supervisor | `/platform/inbox/supervisor` | Vê status operacional da equipe |

---

## Parte 6 — Supervisor avançado (2.11.24)

| # | Quem | Ação | Esperado |
|---|------|------|----------|
| S1 | Supervisor | Abrir `/platform/inbox/supervisor` | Cards resumo + lista equipe + fila WA e WebChat |
| S2 | Supervisor | Clicar **Monitorar** em conversa ativa | Drawer read-only com timeline |
| S3 | Supervisor | Reatribuir item da fila (`wc:` ou WA) | Novo assignee; conversa some da fila do anterior |
| S4 | Supervisor | Conferir métricas 7d por agente | TMA, tempo puxar, CSAT (podem estar vazios em dev) |

---

## Parte 7 — Alertas críticos painel (2.11.28)

| # | Cenário | Como simular | Esperado |
|---|---------|--------------|----------|
| A1 | Config incompleta | Fallback ON sem telefones alerta | `system:critical_config` vermelho → link Bot |
| A2 | IA sem chave | Modo empresa ativo sem API key | Alerta vermelho → link IA |
| A3 | WhatsApp caiu | Desconectar sessão em `/sessions` | `whatsapp:disconnected` vermelho |
| A4 | Fila parada | Conversa na fila > SLA configurado | `inbox:queue_sla` vermelho |

---

## Ao encontrar falha

Registre em **QA-FASE1-CHECKLIST.md** § Registro de falhas:

- Cenário #
- O que fez (passo a passo)
- O que aconteceu vs esperado
- Print ou trecho da mensagem
- Versão (`2.11.x`)

---

## Referências

- [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./ENTREGA-ATENDIMENTO-2.11.24-28.md) — spec técnica das Partes 3b, 5–7
- [`QA-FASE1-CHECKLIST.md`](./QA-FASE1-CHECKLIST.md)
- [`QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`](./QA-WEBCHAT-WA-FALLBACK-BRIDGE.md)
- [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md)
- [`INBOX-ATENDIMENTO.md`](./INBOX-ATENDIMENTO.md) · [`TICKET-ATENDIMENTO.md`](./TICKET-ATENDIMENTO.md)
