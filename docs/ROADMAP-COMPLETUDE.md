# RadarZap v2 — completude do sistema e roadmap

> Análise consolidada do estado atual (v2.5.0), lacunas e prioridades de evolução.  
> Produção: `PRODUCTION.md` · Registro técnico: `SISTEMA-REGISTRO.md`

**Última revisão:** 2026-06-09

---

## Resumo executivo

O RadarZap v2 **é operável** para uso diário e **billing teste validado**.  
v2.5.0 fecha backup tenant, CSAT, admin ops, deploy Docker e PWA básico.  
**Último item:** WhatsApp Cloud API (Meta) — spec em `PRODUCTION.md` §7.

---

## Lacunas principais

| # | Lacuna | Status |
|---|--------|--------|
| 1 | Webhooks outbound | ✅ 2.2.0 |
| 2 | Deploy / CI | ✅ parcial — Docker monolito `docker-compose.prod.yml`; CI build OK; deploy job automático pendente |
| 3 | Convite equipe | ✅ 2.2.2 |
| 4 | Billing Stripe | ✅ 2.4.0 (+ prices script `npm run stripe:prices`) |
| 5 | Admin operacional | ✅ 2.5.0 — moderação orgs, API global stats, alertas Slack WA |
| 6 | Backup tenant | ✅ 2.5.0 — export/import JSON `/settings/backup` |
| 7 | Inbox SLA + CSAT | ✅ 2.5.0 — CSAT 1–5 pós-encerramento |
| 8 | **WhatsApp Cloud API** | 🟡 stub webhook + doc §7 — **implementação por último** |
| 9 | Mobile | ✅ parcial 2.5.0 — PWA manifest; falta touch global |
| 10 | Testes | 🟡 CSAT + billing unit; falta E2E Playwright |

---

## Ordem de implementação (Cloud API por último)

1. ✅ Billing + teste Stripe  
2. ✅ Backup tenant JSON  
3. ✅ CSAT Inbox  
4. ✅ Admin ops (orgs, integrações, Slack alert)  
5. ✅ Deploy Docker monolito (`docker/Dockerfile.monolith`)  
6. ✅ PWA manifest  
7. 🟡 **Cloud API Meta** — próximo e último bloco grande  

---

## Páginas atualizadas (v2.5)

| Rota | Situação |
|------|----------|
| `/settings/backup` | CSV + JSON export/import |
| `/admin/moderation` | Lista orgs + override plano |
| `/admin/api` | Stats integrações globais |
| `/admin/payments` | Pedidos Stripe |
| `/platform/inbox/bot` | Toggle CSAT |

---

## Como usar

1. Feature nova → changelog `SISTEMA-REGISTRO.md` + semver `package.json`
2. Deploy/infra → `PRODUCTION.md` §2
3. Cloud API → `PRODUCTION.md` §7 (quando for implementar)
