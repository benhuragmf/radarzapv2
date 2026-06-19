# QA manual — WebChat: token, FAQ, fallback WhatsApp e bridge

> **Versão alvo:** `2.10.75` · **Escopo:** Fases A–F (`RADARZAP_WHATSAPP_TICKET_FAQ_IMPLEMENTATION.md`)  
> **Tempo estimado:** 30–45 min · **Ambiente:** dev local com WA conectado

**Execução:** _______________ · **Responsável:** _______________ · **Data:** _______________

**Automatizado (antes do manual):** `npm run qa:webchat-wa` — testes unitários das fases A–F + `qa:prep` (Mongo, WA, fallback, whitelist).  
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
   - [ ] Número(s) de alerta (seu celular ou grupo `@g.us`)
   - [ ] Mensagem ao visitante (texto customizado)
   - [ ] Timeout presença: `90` s (padrão)
3. **Salvar**.

| OK? | Notas |
|-----|-------|
| [ ] | |

### 0.3 IA — FAQ (opcional, Fase B)

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

---

## C. Fallback offline (Fase C)

| # | Passo | Esperado | OK? |
|---|-------|----------|-----|
| C1 | Fechar painel de **todos** os atendentes (ou aguardar ~90s sem heartbeat) | Ninguém online | [ ] |
| C2 | Visitante: pré-chat → escalar para fila (ou IA escala) | Mensagem fallback no widget | [ ] |
| C3 | WhatsApp configurado recebe alerta | Texto com `TK-…`, `!assumir`, `!ticket`, `!encerrar` | [ ] |
| C4 | Reabrir painel atendente | Presença volta (heartbeat) | [ ] |

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
| E6 | `!encerrar TK-XXXX` no WA | Chamado fechado; bridge desativado; visitante notificado | [ ] |

---

## F. Regressão rápida

| # | Passo | Esperado | OK? |
|---|-------|----------|-----|
| F1 | Conversa WA normal (sem `!`) de cliente | Fluxo Inbox/ticket normal, não consumido como bridge | [ ] |
| F2 | CSAT após finalizar conversa site | Pesquisa enviada (se CSAT ativo) | [ ] |
| F3 | `npm test` local | Verde | [ ] |

---

## Resultado

| Área | Crítico falhou? | Observações |
|------|-----------------|-------------|
| A Token | [ ] Sim / [ ] Não | |
| B FAQ | [ ] Sim / [ ] Não | |
| C Fallback | [ ] Sim / [ ] Não | |
| D Comandos | [ ] Sim / [ ] Não | |
| E Bridge | [ ] Sim / [ ] Não | |

**Aprovado para piloto?** [ ] Sim · [ ] Não — bloqueadores: _______________

---

## Referências

- `docs/RADARZAP_WHATSAPP_TICKET_FAQ_IMPLEMENTATION.md`
- `docs/WEBCHAT.md` § Consulta token, FAQ, Fallback, Bridge
- `docs/QA-FASE1-CHECKLIST.md` (gate estabilização geral)
