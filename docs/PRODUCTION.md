# RadarZap v2 — go-live (atalho)

> **Fase 4** — só após estabilização (Fase 1), produto aceito e staging validado.  
> Conteúdo completo: [`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md) · Fase atual: [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md)

**Versão ref:** `2.12.63` · **Última revisão:** 2026-06-28

---

## ⚠️ Não use este arquivo ainda

Gate Fase 1 **não fechado** — QA manual humano pendente ([`PENDENCIAS-HUMANAS-FASE1.md`](./PENDENCIAS-HUMANAS-FASE1.md)). Automatizado ✅; go-live **não** declarado.

---

## Quando chegar a hora

| Passo | Onde |
|-------|------|
| 1 | `ROADMAP-COMPLETUDE.md` § Gate Estabilização ✅ |
| 2 | `PREPARACAO-PRODUCAO.md` § Gate + Deploy staging |
| 3 | `PREPARACAO-PRODUCAO.md` § Smoke pós-deploy |
| 4 | `PREPARACAO-PRODUCAO.md` § Deploy produção |
| 5 | `PREPARACAO-PRODUCAO.md` § Rollback (se necessário) |

---

## Gate §0 (resumo)

- [ ] Fase 1 estabilização concluída (`ROADMAP-COMPLETUDE.md`)
- [ ] Staging validado com smoke completo
- [ ] CI verde · `npm test` + build locais
- [ ] Tag `v2.x.x` alinhada ao release

**Não execute deploy em produção com bugs conhecidos em atendimento WhatsApp.**
