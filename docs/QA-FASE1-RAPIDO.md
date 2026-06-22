# QA Fase 1 — checklist rápido (1 página)

**Versão:** `2.11.50` · **Gate auto:** revalidar após mudanças de perfil/equipe

Detalhe: [`QA-FASE1-ROTEIRO.md`](./QA-FASE1-ROTEIRO.md) · imprimir: [`QA-FASE1-CHECKLIST.md`](./QA-FASE1-CHECKLIST.md) · **O que o Playwright cobre:** [`QA-FASE1-AUTOMATIZACAO.md`](./QA-FASE1-AUTOMATIZACAO.md)

---

## Antes de começar (2 min)

```bash
npm run qa:fase1:all      # Playwright (34) + gate Jest — recomendado antes do manual
npm run qa:manual:start   # só gate Jest + prep
```

- [ ] `dev` + `dashboard:frontend` rodando
- [ ] WA conectado em `/sessions`
- [ ] CSAT ON em `/platform/inbox/bot`
- [ ] Celular **cliente** ≠ número Baileys ≠ bridge
- [ ] Widget WebChat ativo + membro com `whatsappPhone` **verificado** na Equipe (`whatsappPhoneVerifiedAt`)
- [ ] Atendente com e-mail confirmado em `/settings#perfil` (ou login Google)


**Ambiente hoje:** Mongo ✅ · WA 1 sessão · CSAT 1/3 org · WebChat 1 widget · Fallback ON · Equipe 1 membro c/ WA

---

## A — WhatsApp (45 min) — marque P/F

| # | Faça | Esperado |
|---|------|----------|
| 1 | Cliente inicia → triagem → humano responde | Inbox OK, sem ticket espúrio |
| 2 | **Finalizar** no painel | CSAT na hora |
| 3 | Cliente: `avaliar` | CSAT, não reabre TK antigo |
| 4 | Cliente: `4` | Agradecimento + nota |
| 5 | Depois do CSAT: `Ola` / `gostaria de atendimento` | Novo fluxo, sem loop CSAT |
| 6 | `falar com atendente` | Escala, sem lembrete CSAT |
| 7 | TK fechado (dias) + msg nova | Novo atendimento, não captura TK |
| 8 | Envio via **Ticket** + reply < 12 h | Mesmo TK |
| 9 | IA promete transferir | Escala, não trava |
| 10 | Menu ticket `1`/`2` com inbox ativo | Sem colisão |

---

## B — Painel (20 min) — abrir rota, smoke OK?

Rotas cobertas por `npm run qa:fase1:e2e` (mock): tickets, setores, bot, respostas, relatórios, webchat, supervisor, presença.

Manual ao vivo: `/platform/inbox` · demais rotas acima · conferir salvar/editar real.

---

## C — WebChat + bridge (60 min)

| # | Faça | Esperado |
|---|------|----------|
| 1 | Widget → pré-chat → msg | Triagem/bot |
| 2 | Escalar → Inbox **Assumir** | Lista `channel=webchat` |
| 3 | Token TK no widget | Status OK; token errado genérico |
| 4 | FAQ no widget | KB + link |
| 5 | Fallback **offline** | Alerta WA com `TK-` |
| 6 | Fallback **deferido** (online, não assume) | Sino vermelho após timeout |
| 7 | `!assumir` / `!ticket` / `!encerrar` | Só número da Equipe |
| 8 | Bridge site ↔ WA | Msg ida/volta + badge Bridge |
| 9 | IA Básica WC | 1ª msg ≠ menu 1–4 robotizado |

Roteiro completo: [`QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`](./QA-WEBCHAT-WA-FALLBACK-BRIDGE.md)

---

## D — Perfil equipe (15 min) — desde 2.11.50

Doc: [`EQUIPE-RBAC.md`](./EQUIPE-RBAC.md) § Perfil

| # | Faça | Esperado |
|---|------|----------|
| 1 | Dono cadastra atendente (nome, e-mail, WA) em Equipe | Dados salvos; status pendente na lista |
| 2 | Atendente em `/settings#perfil` confirma e-mail (OTP) | `profileComplete` avança; Google dispensa OTP e-mail |
| 3 | Atendente confirma WhatsApp (OTP no celular) | `whatsappPhoneVerifiedAt`; `!assumir` autorizado |
| 4 | Toggle **edição bloqueada** (padrão) | Atendente não altera campos; só confirma |
| 5 | Toggle **edição liberada** | Atendente edita com novo OTP |

---

## E — Presença + supervisor + sino (30 min)

| # | Faça | Esperado |
|---|------|----------|
| 1 | Online / Ocupado / Ausente | RR respeita status |
| 2 | Idle → auto-ausente | Prompt restaurar |
| 3 | `/inbox/supervisor` | Equipe, fila, monitor |
| 4 | Reassign conversa `wc:` | Reatribuída |
| 5 | Fallback perdido | Sino `webchat:fallback_missed` |
| 6 | Alerta billing/IA (se simular) | Badge vermelho, perm correta |

---

## Fechar

1. Anotar P/F em [`QA-FASE1-RESULTADO-2026-06-22.md`](./QA-FASE1-RESULTADO-2026-06-22.md)
2. **Sem falha crítica?** → marcar gate em `ROADMAP-COMPLETUDE.md`
3. **Falhou?** → descrever cenário # + print → patch `2.11.x`

**Gate liberado?** [ ] sim · [ ] não — motivo: _______________
