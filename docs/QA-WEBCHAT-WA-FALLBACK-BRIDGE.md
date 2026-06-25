# QA manual — WebChat: token, FAQ, fallback WhatsApp e bridge

> **Versão alvo:** `2.11.99` (TOP 13) · **Escopo:** Fases A–H (A–F: 2.10.70–75; G–H + C0: 2.11.24–28; bridge consolidada: 2.11.99)
> **Spec técnica:** [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./concluidos/ENTREGA-ATENDIMENTO-2.11.24-28.md)  
> **Tempo estimado:** 30–45 min · **Ambiente:** dev local com WA conectado

**Execução:** _______________ · **Responsável:** _______________ · **Data:** _______________

**Automatizado (antes do manual):** `npm run qa:webchat-wa` — testes unitários + `qa:prep`.  
**Setup rápido dev:** `QA_WA_PHONE=5511999999999 npm run qa:webchat-wa:setup` (habilita fallback + whitelist Equipe).  
**Resultado:** copie [`QA-WEBCHAT-WA-RESULTADO-TEMPLATE.md`](./QA-WEBCHAT-WA-RESULTADO-TEMPLATE.md) ao concluir.

---

## Pré-requisitos

| Item | OK? |
|------|-----|
| `npm run dev` + `npm run dashboard:frontend` rodando | [ ] |
| Sessão WhatsApp conectada em **Sessões** | [ ] |
| Widget WebChat ativo com chave pública conhecida | [ ] |
| Página de teste: `/webchat/widget.html` ou site com snippet | [ ] |
| Número WhatsApp **pessoal** do atendente de teste (cadastrado em Equipe) | [ ] |
| Segundo navegador/aba anônima para simular visitante | [ ] |

---

## 0. Configuração inicial (5 min)

### 0.1 Equipe — whitelist WhatsApp

1. **Configurações → Equipe** → editar membro de teste.
2. Preencher **WhatsApp pessoal** (mesmo número que receberá alertas/comandos).
3. Papel com `inbox:reply` (Atendente, Admin, etc.).

| OK? | Notas |
|-----|-------|
| [ ] | |

### 0.2 Triagem e Bot — fallback

1. **Atendimento → Triagem e Bot** (`/platform/inbox/bot`).
2. Seção **Chat do site — fallback WhatsApp**:
   - [ ] Ativar fallback
   - [ ] **Tempo para aceitar antes do fallback** — ex.: `60` s (padrão 2.11.28; use `30` s para teste rápido)
   - [ ] Número(s) de alerta (celular pessoal ou grupo `@g.us` — **não** o número da sessão Baileys)
   - [ ] Mensagem ao visitante (texto customizado)
   - [ ] Timeout presença offline: `90` s (padrão)
   - [ ] Timeout inatividade painel: `300` s (padrão 2.11.25)
3. **Salvar**.

| OK? | Notas |
|-----|-------|
| [ ] | |

### 0.3 Presença operacional (2.11.25)

1. Atendente logado: header → status **Online**.
2. Confirmar heartbeat (indicador ativo após ~30s).

| OK? | Notas |
|-----|-------|
| [ ] | |

### 0.4 IA — FAQ (opcional, Fase B)

1. **Atendimento → IA** → aba Base de conhecimento.
2. Criar artigo com palavra-chave + link `https://…` + **Sugestão rápida** ativa.

| OK? | Notas |
|-----|-------|
| [ ] | |

---

## A. Consulta de chamado por token (Fase A)

| # | Passo | Esperado | OK? |
|---|-------|----------|-----|
| A1 | No Inbox, abrir conversa **Site** → **Converter em chamado** | Mensagem sistema com `TK-…` + token `XXXX-XXXX` | [ ] |
| A2 | Copiar ref + token; abrir widget (aba anônima) → **Consultar chamado** | Formulário ref + token | [ ] |
| A3 | Informar ref + token corretos | Status do chamado + histórico (sem dados internos) | [ ] |
| A4 | Token errado | Mesma mensagem genérica (não revela se existe) | [ ] |
| A5 | **Continuar atendimento** (conversa ainda aberta) | Sessão retomada no widget | [ ] |

---

## B. FAQ no widget (Fase B)

| # | Passo | Esperado | OK? |
|---|-------|----------|-----|
| B1 | Abrir widget novo; ver chips de sugestão (se configurados) | Chips clicáveis | [ ] |
| B2 | Clicar chip ou digitar palavra-chave do artigo | Resposta da base + botão de link | [ ] |
| B3 | Link abre `https` em nova aba | URL sanitizada (sem `javascript:`) | [ ] |
| B4 | Pergunta genérica que bate em **2+ artigos** (ex.: "como funciona") | Bot lista opções **1, 2, 3…** no chat | [ ] |
| B5 | Clicar opção numerada | Conteúdo do artigo aparece **no chat** (sem nova aba) | [ ] |
| B6 | Clicar botão **FAQ** no header do widget | Lista por categorias da base de conhecimento | [ ] |
| B7 | Clicar artigo na lista FAQ | Conteúdo entra no chat (ou aviso para concluir pré-chat) | [ ] |

---

## C. Fallback (Fase C — offline + deferido 2.11.28)

### C.0 — Fallback deferido (atendente online, não assume)

| # | Passo | Esperado | OK? |
|---|-------|----------|-----|
| C0 | Atendente **Online**; visitante escala para fila | Prioridade no painel; mensagem sistema; **sem** alerta WA na hora | [ ] |
| C0b | Atendente **não** assume; aguardar `whatsappFallbackAcceptTimeoutSeconds` + scan (~60s) | Mensagem fallback no widget + alerta WA com `TK-…` | [ ] |
| C0c | Atendente designado abre painel | Sino **vermelho** — *Chat perdido — fallback WhatsApp* | [ ] |

### C.1 — Fallback offline (ninguém online)

| # | Passo | Esperado | OK? |
|---|-------|----------|-----|
| C1 | Fechar painel de **todos** os atendentes (ou status Offline / aguardar timeout heartbeat) | Ninguém `availableForQueue` | [ ] |
| C2 | Visitante: pré-chat → escalar para fila | Após timeout: mensagem fallback no widget | [ ] |
| C3 | WhatsApp configurado recebe alerta | Texto com `TK-…`, `!assumir`, `!ticket`, `!encerrar` | [ ] |
| C4 | Reabrir painel atendente → **Online** | Presença volta (heartbeat + status) | [ ] |

---

## D. Comandos WhatsApp (Fase D)

| # | Passo | Esperado | OK? |
|---|-------|----------|-----|
| D1 | Do número **cadastrado** em Equipe: `!assumir TK-XXXX` | Confirmação + bridge ativo | [ ] |
| D2 | Do número **não cadastrado**: `!assumir TK-XXXX` | "Comando não autorizado" | [ ] |
| D3 | `!ticket TK-XXXX` | Resumo status, cliente, canal | [ ] |
| D4 | `!ajuda` | Lista de comandos | [ ] |

---

## E. Bridge site ↔ WhatsApp (Fase E)

| # | Passo | Esperado | OK? |
|---|-------|----------|-----|
| E1 | Após D1, visitante envia mensagem no widget | Atendente recebe WA: `[Site · TK-…] Nome` + texto | [ ] |
| E2 | Atendente responde no WhatsApp (texto simples) | Visitante vê resposta no widget | [ ] |
| E3 | Comando `!foo` no WA | **Não** aparece no widget | [ ] |
| E4 | Inbox: conversa mostra badge **Bridge WA** | Lista + cabeçalho | [ ] |
| E5 | Painel: atendente também responde pelo Inbox | Visitante vê (paridade painel) | [ ] |
| E6 | `!encerrarchat TK-XXXX` no WA | Bridge desativado; chamado **permanece aberto**; visitante avisado | [ ] |
| E7 | `!encerrar TK-XXXX` no WA | Chamado fechado; conversa encerrada; visitante notificado | [ ] |

---

## F. Regressão rápida

| # | Passo | Esperado | OK? |
|---|-------|----------|-----|
| F1 | Conversa WA normal (sem `!`) de cliente | Fluxo Inbox/ticket normal, não consumido como bridge | [ ] |
| F2 | CSAT após finalizar conversa site | Pesquisa enviada (se CSAT ativo) | [ ] |
| F3 | `npm test` + `npm run qa:atendimento:gate` | Verde | [ ] |

---

## G. IA Básica WebChat (2.11.28)

**Pré-condição:** `/platform/inbox/ia` → modo **IA Básica — Triagem Inteligente** (`basic_triage`).

| # | Passo | Esperado | OK? |
|---|-------|----------|-----|
| G1 | Widget novo → 1ª mensagem do visitante | Resposta IA Básica (classificador/KB); **não** menu robotizado 1–4 | [ ] |
| G2 | Pedir atendente ou palavra que escala | Entra na fila Inbox (`wc:`) | [ ] |

---

## H. Presença + round-robin (2.11.25)

| # | Passo | Esperado | OK? |
|---|-------|----------|-----|
| H1 | Atendente **Ocupado**; visitante escala | **Sem** prioridade para este atendente | [ ] |
| H2 | Atendente **Online**; visitante escala | Prioridade RR (se setor + RR ativo) | [ ] |
| H3 | Supervisor vê equipe em `/platform/inbox/supervisor` | Status operacional correto | [ ] |

---

## Resultado

| Área | Crítico falhou? | Observações |
|------|-----------------|-------------|
| A Token | [ ] Sim / [ ] Não | |
| B FAQ | [ ] Sim / [ ] Não | |
| C Fallback (C0 + offline) | [ ] Sim / [ ] Não | |
| D Comandos | [ ] Sim / [ ] Não | |
| E Bridge | [ ] Sim / [ ] Não | |
| G IA Básica WC | [ ] Sim / [ ] Não | |
| H Presença | [ ] Sim / [ ] Não | |

**Aprovado para piloto?** [ ] Sim · [ ] Não — bloqueadores: _______________

---

## Referências

- [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./concluidos/ENTREGA-ATENDIMENTO-2.11.24-28.md)
- `docs/concluidos/RADARZAP_WHATSAPP_TICKET_FAQ_IMPLEMENTATION.md`
- `docs/WEBCHAT.md` § Consulta token, FAQ, Fallback, Bridge
- `docs/QA-FASE1-CHECKLIST.md` (gate estabilização geral)
