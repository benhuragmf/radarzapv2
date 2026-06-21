# RadarZap v2 — Roteiro QA Fase 1 (passo a passo)

> **Execute por último** — após Fase B/C do [`PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md`](./PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md) e `npm run qa:atendimento:gate` verde.  
> Complementa [`QA-FASE1-CHECKLIST.md`](./QA-FASE1-CHECKLIST.md) com ordem de execução e mensagens exatas.  
> **Versão alvo:** `2.11.28`

## Antes de começar

```bash
npm run qa:prep    # verifica Mongo, sessão WA e CSAT
npm test           # 326 testes
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
| `/platform/inbox/bot` | Prévia WhatsApp muda ao editar texto |
| `/platform/inbox/respostas` | Busca; prévia de atalho |
| `/platform/inbox/supervisor` | Fila visível; reatribuir (se houver itens) |
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

---

## Parte 3b — Fallback deferido + sino vermelho (2.11.28)

**Pré-condição:** fallback ativo em Triagem e Bot; timeout **60s** (ou 30s para teste rápido); 1 atendente **online** no painel.

| Quem | Ação | Esperado |
|------|------|----------|
| Visitante | Escala para fila (WebChat) | Prioridade para atendente; **sem** fallback imediato |
| Atendente | **Não** clica Assumir; aguarda timeout | Após ~60s: mensagem fallback no widget + alerta WA |
| Atendente | Volta ao painel (ou já estava) | Sino **vermelho** — evento *Chat perdido — fallback WhatsApp* |
| Dono/admin | Plano perto do vencimento ou cota IA esgotada | Sino vermelho com alertas `billing:*` / `ai:quota_*` (só quem tem `billing:view`) |

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

## Ao encontrar falha

Registre em **QA-FASE1-CHECKLIST.md** § Registro de falhas:

- Cenário #
- O que fez (passo a passo)
- O que aconteceu vs esperado
- Print ou trecho da mensagem
- Versão (`2.10.x`)

Abra issue ou informe o agente com esses dados para correção.

---

## Referências

- [`QA-FASE1-CHECKLIST.md`](./QA-FASE1-CHECKLIST.md)
- [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md)
- [`INBOX-ATENDIMENTO.md`](./INBOX-ATENDIMENTO.md) · [`TICKET-ATENDIMENTO.md`](./TICKET-ATENDIMENTO.md)
