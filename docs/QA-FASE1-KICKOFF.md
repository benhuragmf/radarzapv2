# QA Fase 1 — kickoff (gate humano)

**Versão:** `2.11.36` · **Commit ref:** `e9d794c` · **Data prep:** 2026-06-22

Fase A/B automática **concluída**. Este doc é o ponto de partida para fechar o gate § Estabilização do [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md).

---

## Gate automático — já verde

| Comando | Resultado |
|---------|-----------|
| `npm test` | 494 testes |
| `npm run qa:atendimento:gate` | 135 + 53 `qa:webchat-wa` |
| `npm run qa:prep` | Mongo, WA, CSAT, WebChat, fallback OK |

| `npm run qa:gate` | ✅ test + build backend + frontend |

---

## Ordem de execução (recomendada)

| Ordem | Doc | Tempo est. | O que fecha |
|-------|-----|------------|-------------|
| 1 | [`QA-FASE1-ROTEIRO.md`](./QA-FASE1-ROTEIRO.md) **Parte 1** (cenários 1–10) | ~45 min | Checklist § A |
| 2 | **Parte 2** (rotas painel) | ~20 min | Checklist § B |
| 3 | **Parte 3** + [`QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`](./QA-WEBCHAT-WA-FALLBACK-BRIDGE.md) Fases A–E | ~60 min | Checklist § C |
| 4 | **Parte 3b** (fallback deferido + sino) | ~15 min | § E item 5 |
| 5 | **Partes 5–7** (presença, supervisor, alertas) | ~30 min | Checklist § E |
| 6 | Copiar [`QA-FASE1-RESULTADO-TEMPLATE.md`](./QA-FASE1-RESULTADO-TEMPLATE.md) → `QA-FASE1-RESULTADO-YYYY-MM-DD.md` | 5 min | Registro formal |

---

## Pré-condições operacionais

1. `npm run dev` + `npm run dashboard:frontend` (ou stack já rodando)
2. Sessão WhatsApp conectada em `/sessions`
3. CSAT habilitado em `/platform/inbox/bot`
4. Celular **cliente** ≠ número da sessão Baileys ≠ celular bridge (ver O5 em `ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md`)
5. Pelo menos 1 widget WebChat ativo
6. Membro equipe com `whatsappPhone` cadastrado (para bridge/`!assumir`)

---

## Ao terminar

1. Preencher [`QA-FASE1-CHECKLIST.md`](./QA-FASE1-CHECKLIST.md) § A, B, C, E e § D (gate resumo)
2. Se **sem falha crítica**: marcar gate § Estabilização em `ROADMAP-COMPLETUDE.md`
3. Se **falha crítica**: registrar na tabela “Registro de falhas” do checklist + abrir patch `2.11.x`

---

## Referência técnica

- Spec 2.11.24–35: [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./ENTREGA-ATENDIMENTO-2.11.24-28.md)
- Webhooks ticket/bridge: [`WEBHOOKS.md`](./WEBHOOKS.md) (2.11.33)
- Plano estabilização: [`PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md`](./PLANO-CONSULTA-ATUALIZACAO.md) §10
