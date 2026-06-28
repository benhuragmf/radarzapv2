# RadarZap v2 — Resultado QA Fase 1

> Roteiro: [`QA-FASE1-ROTEIRO.md`](../QA-FASE1-ROTEIRO.md) · Checklist: [`QA-FASE1-CHECKLIST.md`](../QA-FASE1-CHECKLIST.md) · Pendências: [`PENDENCIAS-HUMANAS-FASE1.md`](../PENDENCIAS-HUMANAS-FASE1.md)

**Data:** 2026-06-28 (continuação)  
**Versão testada:** `2.12.65`  
**Commit ref:** `28e2d6c` · Deploy main ✅  
**Responsável:** Benhur  
**Ambiente:** **produção VPS** (local `dev:stop` — não rodar paralelo)  
**`npm run qa:prep`:** pass ✅ (2026-06-28 — WA 1, CSAT 1/3, WebChat 1, fallback ON, equipe 3 c/ WA, leads 1)

**Pré-requisito desta sessão:** só **uma** instância no mesmo WA (VPS). Tentativas anteriores com local+prod aberto geraram **mensagem duplicada** — inválidas para § A.

---

## Sessão — em andamento

| Bloco | Status | Início |
|-------|--------|--------|
| § A WhatsApp (1–10) | 🔄 em andamento | 2026-06-28 |
| § B Painel | ⏳ | |
| § B.1 Leads | ⏳ | |
| § C WebChat + bridge | ⏳ | |
| § E Presença/supervisor | ⏳ | |

---

## Resumo manual (preencher ao concluir)

| Área | Pass | Fail | Skip |
|------|------|------|------|
| WhatsApp (§ A) | /10 | | |
| Painel (§ B) | /9 | | |
| WebChat (§ C) | /5 | | |
| Presença + supervisor + alertas (§ E) | /6 | | |
| Fallback deferido (Parte 3b) | /4 | | |

**Gate Fase 1 liberado?** _pendente_ — motivo: _______________

---

## § A — WhatsApp

| # | Resultado | Notas |
|---|-----------|-------|
| 1 Triagem → humano | **pass parcial** | Triagem OK (nome/e-mail, `Sim` sem LGPD, 1 msg/turno). IA escalou p/ fila **Comercial**. **Obs:** LLM inventou planos de internet (50/100/200 Mbps) — não está na KB do repo; alucinação. Falta **Assumir** + humano responder p/ pass completo. |
| 2 Finalizar + CSAT | pass / fail | |
| 3 `avaliar` | pass / fail | |
| 4 Nota CSAT | pass / fail | |
| 5 Novo atendimento pós-CSAT | pass / fail | |
| 6 Pedido de humano | pass / fail | |
| 7 TK antigo fechado | pass / fail | |
| 8 Janela 12 h ticket | pass / fail | |
| 9 IA escalação | pass / fail | |
| 10 Menu ticket × inbox | pass / fail | |

---

## § B — Painel

| Rota | Resultado | Notas |
|------|-----------|-------|
| `/platform/inbox` | pass / fail | |
| `/platform/inbox/tickets` | pass / fail | |
| `/platform/inbox/setores` | pass / fail | |
| `/platform/inbox/bot` | pass / fail | |
| `/platform/inbox/respostas` | pass / fail | |
| `/platform/inbox/supervisor` | pass / fail | |
| `/platform/webchat` | pass / fail | |
| `/platform/inbox/ia` | pass / fail | |
| `/platform/inbox/relatorios` | pass / fail | |

---

## § C — WebChat

| # | Resultado | Notas |
|---|-----------|-------|
| 1 Pré-chat | pass / fail | |
| 2 Triagem IA | pass / fail | |
| 3 Escalação → Inbox | pass / fail | |
| 4 Anexos | pass / fail | |
| 5 Finalizar | pass / fail | |

---

## § E — Presença, supervisor, alertas

| # | Resultado | Notas |
|---|-----------|-------|
| 1 Status RR | pass / fail | |
| 2 Auto-ausente | pass / fail | |
| 3 Supervisor dashboard | pass / fail | |
| 4 Reassign wc: | pass / fail | |
| 5 Sino fallback perdido | pass / fail | |
| 6 Alertas billing/IA | pass / fail | |

---

## Falhas críticas (detalhe)

### § A.1 — LGPD opt-out × triagem IA (2026-06-28)

- **Sintoma:** Cliente em triagem (nome → e-mail); ao responder "Sim", rodapé LGPD interpretou como confirmação de cancelamento (`Inscrição cancelada`) enquanto bot continuou fluxo de triagem.
- **Causa:** `CONSENT_OPT_OUT_CONFIRM_KEYWORDS` incluía `sim`/`ok`; `optOutConfirmPendingAt` stale + consent processado antes do Inbox sem defer para triagem ativa.
- **Correção:** `2.12.65` — `hasActiveClientAtendimentoContext`, defer em `handleAcceptedInbound`, limpar pending stale em `acceptInboundInitiated`, keywords explícitas só (`sair`, `confirmo`, etc.).
- **Evidência:** screenshots sessão QA 2026-06-28 (Carolina / +556684240564).

### § A.1 — IA inventou planos de internet (2026-06-28, re-test prod)

- **Sintoma:** Cliente perguntou planos → IA listou Plano Básico 50 Mbps R$ 99,90 etc. Empresa (Radar Gamer) **não vende internet residencial**.
- **Origem:** **não** há esse texto no código nem em seeds do repo. Resposta gerada pelo **LLM (IA Premium)** ao interpretar “planos” + “internet” — **alucinação**, apesar do blueprint dizer “não invente preço” e KB vazia receber aviso explícito no prompt.
- **Ação produto (pós-gate):** cadastrar KB real (planos VIP/sala de jogos) em `/platform/inbox/ia`; fix **`2.12.66`**: sem KB → “não tenho informações confirmadas” (não chama LLM para plano/preço).
- **QA § A.1:** triagem/fila OK; marcar **pass completo** só após atendente **Assumir** e responder.

---

## Resultado QA Manual TOP 20

| Bloco | Status | Evidência | Observação |
|-------|--------|-----------|------------|
| A — Login e Dashboard | Pendente | | |
| B — Equipe e Status | Pendente | | |
| C — WebChat | Pendente | | |
| D — WhatsApp | Pendente | | |
| E — Bridge | Pendente | | |
| F — Tickets | Pendente | | |
| G — Leads e Formulários | Pendente | | |
| H — IA | Pendente | | |
| I — Billing | Pendente | | |
| J — Segurança / LGPD | Pendente | | |
