# ENTREGA — Migração produção legado GHCR → Coolify (VPS ZAP)

> **Versão:** `2.12.71` · **Data:** 2026-06-29 · **Branch:** `layout-v3` (merge → `main`)  
> **Doc operacional:** [`COOLIFY-DEPLOY.md`](../COOLIFY-DEPLOY.md)

---

## Resumo executivo

O app **RadarZap em produção** (`https://151-247-210-180.sslip.io`) migrou do compose legado **`docker-compose.deploy.yml` + GHCR** para o **resource Coolify** `radarzap`, com volumes Mongo/Redis/sessões **preservados**.

| Antes | Depois |
|-------|--------|
| `radarzap-app-1` (compose legado em `/opt/radarzap`) | `h143brhw5f8tgfj9trj0f3bd-app-1` |
| Deploy: push `main` → GHCR → `deploy-remote.sh` | Stack em `/data/coolify/services/h143brhw5f8tgfj9trj0f3bd/` |
| Traefik rota manual `vps-coolify-traefik-route-legacy.sh` | Mesma rota (deploy **direto**; proxy Coolify ainda não roteia o domínio via labels) |

**Health (2026-06-29):** `GET /api/services/health` → **200** (HTTP e HTTPS).

---

## IDs Coolify (VPS 151.247.210.180)

| Recurso | UUID |
|---------|------|
| Service `radarzap` | `h143brhw5f8tgfj9trj0f3bd` |
| Servidor local RadarZap | `hklsapd6w3wwu9g00k514vjt` |
| Servidor remoto RadarGamer | `cg0rf7b0alfe7jobwdoy8xcb` |
| Project RadarZap | `prmxqsp1rf57x977zs4z7iqp` |

---

## O que foi implementado (commits infra)

| Área | Arquivos / workflows |
|------|----------------------|
| Configuração Coolify API | `scripts/vps-configure-coolify-radarzap.sh` |
| Migração legado → Coolify | `MIGRATE_LEGACY=1`, `stop_legacy_stack`, `deploy_service_direct` |
| SSH localhost | `ensure_deploy_key_on_localhost`, `pick_coolify_ssh_target` |
| Compose produção GHCR | `docker-compose.coolify-ghcr.yml` + **`env_file: .env`** no `app` |
| Bind host :3001 (Traefik) | `docker-compose.coolify-direct-override.yml`, patch Python pós-`expose` |
| SSL / fallback | `scripts/vps-fix-coolify-ssl.sh`, `vps-coolify-traefik-route-legacy.sh` |
| Diagnóstico | `scripts/vps-coolify-status.sh` (logs em crash loop) |
| Workflows GH Actions | `configure-coolify.yml`, `fix-coolify-ssl.yml`, `coolify-status.yml`, `coolify-servers-setup.yml`, … |
| Branch no VPS | Workflows usam **`layout-v3`** (`DEPLOY_BRANCH`) |

---

## Limitações conhecidas (não bloqueiam app no ar)

1. **Deploy via API Coolify** — fila não sobe containers (servidor local “not reachable” no painel). **Mitigação:** `deploy_service_direct` escreve compose + `.env` em `/data/coolify/services/{uuid}/` e roda `docker compose up`.
2. **Status no painel** — resource pode aparecer `exited` no DB; containers reais estão **Up (healthy)**.
3. **Validar servidor** — painel Coolify → Servers → RadarZap → user `ubuntu`, chave `radarzap-deploy`, Validate (pendência manual).
4. **RAM 2 GB** — apertado (Coolify + app); monitorar OOM.
5. **`deploy.yml` em `main`** — ainda publica GHCR; **não** reativar deploy legado no mesmo host sem parar stack Coolify.

---

## Workflows úteis

```bash
# Diagnóstico
gh workflow run "Coolify status check" --ref layout-v3

# Republicar stack + HTTPS (sem derrubar legado se Coolify já ativo)
gh workflow run "Fix Coolify SSL (RadarZap)" --ref layout-v3

# Migração completa (parar legado + Coolify)
gh workflow run "Configure Coolify (RadarZap)" --ref layout-v3 -f confirm=CONFIGURE -f migrate_legacy=1

# Cadastro servidores
gh workflow run "Coolify servers setup" --ref layout-v3 -f confirm=SERVERS
```

---

## Prompt para Codex (colar no início da sessão)

Ver seção **“Prompt Codex”** em [`COOLIFY-DEPLOY.md`](../COOLIFY-DEPLOY.md#prompt-codex-layout-v3--pós-coolify).

---

## Próximos passos (infra — não Codex)

- [ ] Validar servidor RadarZap no painel Coolify (SSH reachable)
- [ ] Conectar GitHub App no Coolify para auto-deploy `layout-v3`
- [ ] Desabilitar ou condicionar `.github/workflows/deploy.yml` no host ZAP
- [ ] RadarGamer: concluir validação SSH + métricas
- [ ] Domínio próprio (fora sslip.io) quando go-live comercial

---

## Referências

- [`COOLIFY-DEPLOY.md`](../COOLIFY-DEPLOY.md)
- [`PREPARACAO-PRODUCAO-EXECUCAO.md`](../PREPARACAO-PRODUCAO-EXECUCAO.md)
- [`.cursor/rules/layout-v3-codex-isolation.mdc`](../../.cursor/rules/layout-v3-codex-isolation.mdc)
