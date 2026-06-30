# Radar Chat v2 — execução PREPARACAO-PRODUCAO (tracker vivo)

> **Referência técnica:** [`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md) · **Coolify:** [`COOLIFY-DEPLOY.md`](./COOLIFY-DEPLOY.md) · **Go-live:** [`PRODUCTION.md`](./PRODUCTION.md)  
> **Branch de release:** **`layout-v3`** (UI v3 + produto `2.12.71+`) · **Atualizado:** 2026-06-29  
> **QA Fase 1:** em paralelo — [`concluidos/QA-FASE1-RESULTADO-2026-06-28.md`](./concluidos/QA-FASE1-RESULTADO-2026-06-28.md)

---

## Decisão do dono (2026-06-28)

- **`layout-v3` é a nova versão** — produto + Layout v3 (Codex Fases 2–4+); prep e deploy apontam para esta branch.
- **Coolify** entra como canal principal de deploy (compose `docker-compose.coolify.yml`).
- **PREPARACAO-PRODUCAO** avança **em paralelo** ao QA manual (anotar resultados depois).
- **Go-live comercial** (domínio final, Stripe Live, anúncio) ainda após smoke + QA sem críticos.

---

## Trilhas (como convivem)

| Trilha | Branch | Deploy | Notas |
|--------|--------|--------|-------|
| **Release alvo** | `layout-v3` | **Coolify** (stack `h143brhw…`) | UI v3 + backend; ver [`COOLIFY-DEPLOY.md`](./COOLIFY-DEPLOY.md) |
| **Legado VPS** | `main` | GHCR + SSH | **Parado no .180** — não reativar junto com Coolify |
| **QA Fase 1** | — | Testes no ambiente ativo | Não bloqueia instalar Coolify em host novo |
| **Codex layout** | `layout-v3` | — (local) | Só frontend + docs layout; commits próprios |

### Codex (layout) × Auto (infra) — **não conflitar**

Regra permanente: [`.cursor/rules/layout-v3-codex-isolation.mdc`](../.cursor/rules/layout-v3-codex-isolation.mdc)

| Agente | Escopo | **Não mexer** |
|--------|--------|----------------|
| **Codex** | Menu, header, design system, páginas, `navConfig`, docs `RADARCHAT-LAYOUT-V3-*` | Docker, Coolify, PREPARACAO infra |
| **Auto (prep)** | `docker-compose.coolify.yml`, `.env.coolify.example`, `COOLIFY-DEPLOY`, `PREPARACAO*` | `frontend/**`, docs layout, `DESIGN-SYSTEM`, `MENU-PAGES-REGISTRY` |

- **Commits separados** — infra não inclui arquivos de layout do Codex.
- Codex **continua** reorganizando layout sem esperar Coolify.
- Coolify sobe o monolito inteiro; UI em WIP no build é ok para staging.
- Antes de push: `git pull --rebase origin layout-v3` na sua área.
- Merge `layout-v3` → `main` só após Codex + `pre-push:gate` + QA visual ([`RADARCHAT-LAYOUT-V3-04`](./RADARCHAT-LAYOUT-V3-04-CHECKLIST-QA-VISUAL-E-FUNCIONAL.md)).

---

## O que **já está feito**

### Código e CI ✅

| Item | Evidência |
|------|-----------|
| Monolito Docker | `docker/Dockerfile.monolith` |
| Compose Coolify GHCR | `docker-compose.coolify-ghcr.yml` + `env_file` + override `:3001` |
| Scripts migração | `vps-configure-coolify-radarchat.sh`, workflows `layout-v3` |
| Compose GHCR legado | `docker-compose.deploy.yml`, `scripts/deploy-remote.sh` |
| CI + E2E | `.github/workflows/ci.yml` — 80/80 |
| Deploy `main` | `.github/workflows/deploy.yml` |
| Gate local | `npm run pre-push:gate` |
| Layout v3 (Codex) | Fases 2–4 em `layout-v3` (WIP local — commit pendente) |

### VPS piloto ✅ Coolify em produção (sslip.io)

| Item | Status |
|------|--------|
| Host sslip.io | ✅ https://151-247-210-180.sslip.io health 200 |
| Site publico oficial | ✅ https://radarchat.com.br |
| App oficial | ✅ https://app.radarchat.com.br |
| Stack Coolify | ✅ `h143brhw5f8tgfj9trj0f3bd-app-1` healthy |
| Legado GHCR no .180 | ✅ parado |
| **Coolify instalado** | ✅ v4.1.2 |
| Deploy API Coolify | ⏳ SSH servidor local — usa fallback direto |
| Validar servidor painel | ⏳ manual |
| Domínio próprio | ✅ `radarchat.com.br` + `app.radarchat.com.br` |

---

## Checklist — Coolify

Legenda: ✅ · 🔄 · ⏳

### H0 — Infra Coolify ✅

- [x] Scripts + workflows + `COOLIFY-DEPLOY.md` + entrega `ENTREGA-COOLIFY-MIGRACAO-2.12.71.md`
- [x] Push `layout-v3` → merge `main`

### H1 — Instalar Coolify ✅

- [x] Ubuntu VPS ZAP `.180`, Coolify 4.1.2, proxy Traefik
- [ ] Validar SSH servidor local no painel ⏳

### H2 — Resource Radar Chat ✅ (deploy direto)

- [x] Project + service `radarchat` (`h143brhw5f8tgfj9trj0f3bd`)
- [x] Compose `docker-compose.coolify-ghcr.yml`, volumes externos legado
- [x] `env_file: .env` + secrets produção
- [x] Health HTTPS sslip.io ✅
- [x] Dominio oficial do app: `https://app.radarchat.com.br`

### H3 — Migração sslip.io ✅

- [x] Volumes Mongo/sessions preservados
- [x] Legado parado; stack Coolify no ar
- [ ] Desligar `deploy.yml` no host / GitHub ⏳
- [ ] QA WA smoke pós-migração ⏳

### H4 — Staging (opcional antes de cutover)

- [ ] Segundo environment Coolify `staging`
- [ ] Mongo/Redis/volumes **separados**
- [ ] Stripe test

---

## Checklist — demais itens PREPARACAO

### A — Inventário VPS

- [ ] Anotar se host será **só Coolify** ou legado + Coolify (hosts diferentes)
- [ ] Backup Mongo antes de mudanças

### B — Segurança

- [ ] Firewall 22/443; Mongo/Redis não públicos
- [ ] Sem `ALLOW_DEV_BILLING` em prod
- [ ] `BACKUP_ENCRYPT_EXPORT=true` quando estável

### E — Smoke

```bash
set RADARCHAT_PUBLIC_URL=https://SEU_DOMINIO_COOLIFY
npm run qa:release-gate
```

### F — QA Fase 1 (paralelo)

[`PENDENCIAS-HUMANAS-FASE1.md`](./PENDENCIAS-HUMANAS-FASE1.md) — anotar no resultado 2026-06-28.

---

## Próximos passos imediatos

1. **Codex:** continuar Layout v3 (`RADARCHAT-LAYOUT-V3-05`) — usar [`PROMPT-CODEX-COOLIFY-POS-MIGRACAO.md`](./concluidos/PROMPT-CODEX-COOLIFY-POS-MIGRACAO.md).
2. **Infra:** validar servidor Coolify SSH; GitHub App auto-deploy.
3. **Ops:** condicionar `deploy.yml`; smoke WA; QA Fase 1.

---

## Histórico

| Data | Ação |
|------|------|
| 2026-06-28 | Tracker criado; prep paralelo ao QA |
| 2026-06-28 | `layout-v3` = branch release; Coolify adicionado |
| 2026-06-29 | **Migração produção .180 → Coolify** — [`ENTREGA-COOLIFY-MIGRACAO-2.12.71.md`](./concluidos/ENTREGA-COOLIFY-MIGRACAO-2.12.71.md) |

---

## Referências

- Layout v3: [`RADARCHAT-LAYOUT-V3-05-PROXIMAS-FASES-E-PROMPTS.md`](./RADARCHAT-LAYOUT-V3-05-PROXIMAS-FASES-E-PROMPTS.md)
- QA visual layout: [`RADARCHAT-LAYOUT-V3-04-CHECKLIST-QA-VISUAL-E-FUNCIONAL.md`](./RADARCHAT-LAYOUT-V3-04-CHECKLIST-QA-VISUAL-E-FUNCIONAL.md)
