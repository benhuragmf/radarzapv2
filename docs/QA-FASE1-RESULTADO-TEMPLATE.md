# RadarZap v2 — Resultado QA Fase 1

> Copie este arquivo para `QA-FASE1-RESULTADO-YYYY-MM-DD.md` ao concluir o roteiro.  
> Roteiro: [`QA-FASE1-ROTEIRO.md`](./QA-FASE1-ROTEIRO.md)

**Data:** _______________  
**Versão testada:** _______________  
**Responsável:** _______________  
**Ambiente:** dev / piloto  
**`npm run qa:prep`:** pass / fail

---

## Resumo

| Área | Pass | Fail | Skip |
|------|------|------|------|
| WhatsApp (§ A) | /10 | | |
| Painel (§ B) | /9 | | |
| WebChat (§ C) | /5 | | |
| Presença + supervisor + alertas (§ E) | /6 | | |
| Fallback deferido (Parte 3b) | /4 | | |

**Gate Fase 1 liberado?** sim / não — motivo: _______________

---

## § A — WhatsApp

| # | Resultado | Notas |
|---|-----------|-------|
| 1 Triagem → humano | pass / fail | |
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

## § E — Presença, supervisor, alertas (2.11.24–28)

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

### Falha 1
- **Cenário:**
- **Passos:**
- **Esperado:**
- **Obtido:**
- **Print/evidência:**

---

## Ações pós-QA

- [ ] Bugs críticos corrigidos e re-testados
- [ ] `QA-FASE1-CHECKLIST.md` atualizado
- [ ] `ROADMAP-COMPLETUDE.md` gate marcado se tudo passou

---

## Resultado QA Manual TOP 20

> Preencher após executar blocos A–J do [`top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md`](./concluidos/top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md).  
> Versão alvo: `2.12.6`+ · Responsável: Benhur · Data: _______________

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
| J — Segurança/LGPD | Pendente | | |

**Status final pós-manual:** `PRONTO PARA QA MANUAL` / `PRONTO PARA GO-LIVE CONTROLADO` / `BLOQUEADO` — _______________
