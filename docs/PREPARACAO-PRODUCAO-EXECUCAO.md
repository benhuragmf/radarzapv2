# RadarZap v2 — execução PREPARACAO-PRODUCAO (tracker vivo)

> **Referência técnica:** [`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md) · **Coolify:** [`COOLIFY-DEPLOY.md`](./COOLIFY-DEPLOY.md) · **Go-live:** [`PRODUCTION.md`](./PRODUCTION.md)  
> **Branch de release:** **`layout-v3`** (UI v3 + produto `2.12.69+`) · **Atualizado:** 2026-06-28  
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
| **Release alvo** | `layout-v3` | **Coolify** (novo) | UI v3 + backend; ver [`COOLIFY-DEPLOY.md`](./COOLIFY-DEPLOY.md) |
| **Legado VPS** | `main` | GHCR + SSH | sslip.io até migrar ou desligar workflow |
| **QA Fase 1** | — | Testes no ambiente ativo | Não bloqueia instalar Coolify em host novo |
| **Codex layout** | `layout-v3` | — (local) | Só frontend + docs layout; commits próprios |

### Codex (layout) × Auto (infra) — **não conflitar**

Regra permanente: [`.cursor/rules/layout-v3-codex-isolation.mdc`](../.cursor/rules/layout-v3-codex-isolation.mdc)

| Agente | Escopo | **Não mexer** |
|--------|--------|----------------|
| **Codex** | Menu, header, design system, páginas, `navConfig`, docs `RADARZAP-LAYOUT-V3-*` | Docker, Coolify, PREPARACAO infra |
| **Auto (prep)** | `docker-compose.coolify.yml`, `.env.coolify.example`, `COOLIFY-DEPLOY`, `PREPARACAO*` | `frontend/**`, docs layout, `DESIGN-SYSTEM`, `MENU-PAGES-REGISTRY` |

- **Commits separados** — infra não inclui arquivos de layout do Codex.
- Codex **continua** reorganizando layout sem esperar Coolify.
- Coolify sobe o monolito inteiro; UI em WIP no build é ok para staging.
- Antes de push: `git pull --rebase origin layout-v3` na sua área.
- Merge `layout-v3` → `main` só após Codex + `pre-push:gate` + QA visual ([`RADARZAP-LAYOUT-V3-04`](./RADARZAP-LAYOUT-V3-04-CHECKLIST-QA-VISUAL-E-FUNCIONAL.md)).

---

## O que **já está feito**

### Código e CI ✅

| Item | Evidência |
|------|-----------|
| Monolito Docker | `docker/Dockerfile.monolith` |
| Compose Coolify | `docker-compose.coolify.yml` + `.env.coolify.example` |
| Compose GHCR legado | `docker-compose.deploy.yml`, `scripts/deploy-remote.sh` |
| CI + E2E | `.github/workflows/ci.yml` — 80/80 |
| Deploy `main` | `.github/workflows/deploy.yml` |
| Gate local | `npm run pre-push:gate` |
| Layout v3 (Codex) | Fases 2–4 em `layout-v3` (WIP local — commit pendente) |

### VPS piloto ✅ parcial

| Item | Status |
|------|--------|
| Host sslip.io | ✅ QA Benhur |
| Deploy `main` automático | ✅ até `2.12.69` |
| WA único em prod | ✅ não rodar `dev` local no mesmo número |
| **Coolify instalado** | ⏳ próximo passo |
| Domínio próprio | ⏳ |

---

## Checklist — Coolify (prioridade agora)

Legenda: ✅ · 🔄 · ⏳

### H0 — Infra Coolify (só Auto — sem arquivos de layout)

- [ ] Commit **apenas** infra: `docker-compose.coolify.yml`, `.env.coolify.example`, `docs/COOLIFY-DEPLOY.md`, `docs/PREPARACAO*`, índice/roadmap (linhas infra)
- [ ] **Não** incluir `frontend/` nem docs `RADARZAP-LAYOUT-V3-*` nesse commit
- [ ] Push `layout-v3` → `origin` (Codex faz push dos commits de layout **separadamente**)

### H1 — Instalar Coolify no VPS

- [ ] Ubuntu 22.04+, 4 GB+ RAM, portas 22/80/443
- [ ] Instalar Coolify ([get-started](https://coolify.io/docs/get-started/introduction))
- [ ] Conectar servidor (SSH key no Coolify)
- [ ] Wildcard ou domínio para apps

### H2 — Resource RadarZap

- [ ] Project → Docker Compose → Git `radarzapv2`
- [ ] Branch: **`layout-v3`**
- [ ] Compose file: **`docker-compose.coolify.yml`**
- [ ] Domínio no serviço **`app`**, porta **3001**
- [ ] Colar env de `.env.coolify.example`
- [ ] OAuth redirects com `SERVICE_URL_APP`
- [ ] **Deploy** + health verde

### H3 — Migração (se sair do sslip.io legado)

- [ ] Backup Mongo + volume `radarzap-sessions`
- [ ] Mesma `SESSION_ENCRYPTION_KEY` no Coolify
- [ ] Smoke PREPARACAO § pós-deploy
- [ ] Desligar deploy GHCR no host antigo (ou host separado)
- [ ] QA WA no ambiente Coolify

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
set RADARZAP_PUBLIC_URL=https://SEU_DOMINIO_COOLIFY
npm run qa:release-gate
```

### F — QA Fase 1 (paralelo)

[`PENDENCIAS-HUMANAS-FASE1.md`](./PENDENCIAS-HUMANAS-FASE1.md) — anotar no resultado 2026-06-28.

---

## Próximos passos imediatos

1. **Commit infra** (Coolify + docs prep) — sem tocar layout Codex.
2. **Instalar Coolify** no VPS (Codex segue layout em paralelo).
3. **Criar resource** seguindo [`COOLIFY-DEPLOY.md`](./COOLIFY-DEPLOY.md).
4. **Migrar** WA/sessions ou conectar QR no ambiente novo.
5. QA manual quando puder; prep não espera gate Fase 1.

---

## Histórico

| Data | Ação |
|------|------|
| 2026-06-28 | Tracker criado; prep paralelo ao QA |
| 2026-06-28 | `layout-v3` = branch release; Coolify adicionado |
| | Coolify 1º deploy | _preencher_ |

---

## Referências

- Layout v3: [`RADARZAP-LAYOUT-V3-05-PROXIMAS-FASES-E-PROMPTS.md`](./RADARZAP-LAYOUT-V3-05-PROXIMAS-FASES-E-PROMPTS.md)
- QA visual layout: [`RADARZAP-LAYOUT-V3-04-CHECKLIST-QA-VISUAL-E-FUNCIONAL.md`](./RADARZAP-LAYOUT-V3-04-CHECKLIST-QA-VISUAL-E-FUNCIONAL.md)
