# Radar Chat v2 — deploy com Coolify

> **Branch de release:** `layout-v3` (UI v3 + produto `2.12.x`) — **é a branch do servidor**  
> **Compose produção (VPS ZAP):** [`docker-compose.coolify-ghcr.yml`](../docker-compose.coolify-ghcr.yml) + override [`docker-compose.coolify-direct-override.yml`](../docker-compose.coolify-direct-override.yml)  
> **Compose build:** [`docker-compose.coolify.yml`](../docker-compose.coolify.yml) · **Env:** [`.env.coolify.example`](../.env.coolify.example)  
> **Entrega migração:** [`concluidos/ENTREGA-COOLIFY-MIGRACAO-2.12.71.md`](./concluidos/ENTREGA-COOLIFY-MIGRACAO-2.12.71.md) · **Tracker:** [`PREPARACAO-PRODUCAO-EXECUCAO.md`](./PREPARACAO-PRODUCAO-EXECUCAO.md)

Coolify substitui o fluxo **GHCR + SSH** legado ([`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md) § Deploy CI). Dominios oficiais: site publico `https://radarchat.com.br` e sistema `https://app.radarchat.com.br`. O host `sslip.io` fica como validacao/legado do cutover Coolify com rota dinamica para `:3001` ([`scripts/vps-coolify-traefik-route-legacy.sh`](../scripts/vps-coolify-traefik-route-legacy.sh)).

---

## Estado produção (VPS ZAP — 2026-06-29) ✅

| Item | Valor |
|------|--------|
| Site publico oficial | https://radarchat.com.br |
| App oficial | https://app.radarchat.com.br |
| Host legado/validacao sslip.io | https://151-247-210-180.sslip.io |
| Painel Coolify | http://151.247.210.180:8000 · https://coolify-151-247-210-180.sslip.io |
| Container app | `h143brhw5f8tgfj9trj0f3bd-app-1` (healthy) |
| Service UUID | `h143brhw5f8tgfj9trj0f3bd` |
| Stack no host | `/data/coolify/services/h143brhw5f8tgfj9trj0f3bd/` |
| Legado `radarzap-app-1` | **Parado** |
| Modo deploy atual | **Direto** (`deploy_service_direct`) — API Coolify ainda não valida SSH local |

**Importante:** o serviço `app` usa `env_file: .env` (secrets de produção copiados de `/opt/radarzap/.env`). Sem isso o container entra em crash loop (`validateConfig` falha).

### Workflows GitHub (branch `layout-v3` no VPS)

| Workflow | Uso |
|----------|-----|
| **Coolify status check** | Diagnóstico containers + health |
| **Fix Coolify SSL (Radar Chat)** | Republicar stack + Traefik sslip.io |
| **Configure Coolify (Radar Chat)** | `migrate_legacy=1` migração; `0` só sync |
| **Coolify servers setup** | Cadastro servidores ZAP + Gamer |
| **RadarGamer SSH bootstrap** | 1ª vez no VPS `.179` |

```bash
gh workflow run "Coolify status check" -R benhuragmf/radarzapv2 --ref layout-v3
```

---

## Prompt Codex (layout-v3 — pós-Coolify)

Arquivo pronto para colar: [`concluidos/PROMPT-CODEX-COOLIFY-POS-MIGRACAO.md`](./concluidos/PROMPT-CODEX-COOLIFY-POS-MIGRACAO.md)

Resumo: Codex cuida de `frontend/**` e docs layout; **não** alterar scripts `vps-*`, compose Coolify nem workflows de infra sem coordenar. Produção já está no stack Coolify — não reativar compose legado no mesmo host.

---

### Sincronizar `main` ↔ `layout-v3`

Infra e layout em `layout-v3`; merge para `main`. VPS usa `DEPLOY_BRANCH=layout-v3`.

```bash
git checkout main && git merge layout-v3 && git push origin main
```

Isolamento Codex: `.cursor/rules/layout-v3-codex-isolation.mdc`.

---

## Coexistência com deploy atual

| Método | Quando usar |
|--------|-------------|
| **Coolify (produção ZAP)** | Stack `h143brhw…` em `/data/coolify/services/` |
| **GHCR + `deploy-remote.sh`** | Legado — **parado no .180** |

Não rodar os dois no mesmo host com o mesmo número WhatsApp. Condicionar `deploy.yml` no host ZAP.

### Painel Coolify (porta 8000)

| URL | Uso |
|-----|-----|
| `http://151.247.210.180:8000` | Setup inicial — **HTTP sem SSL** (navegador mostra “Não seguro”) |
| `https://coolify-151-247-210-180.sslip.io` | Painel com HTTPS (após `scripts/vps-coolify-panel-https.sh` ou Settings → Instance Domain) |
| `https://app.radarchat.com.br` | **Radar Chat** (app oficial), não o painel Coolify |
| `https://radarchat.com.br` | Site publico/comercial |
| `https://151-247-210-180.sslip.io` | Host legado/validacao do app no cutover Coolify |

No Coolify: **Settings → Instance Settings → Instance's Domain** = `https://coolify-151-247-210-180.sslip.io` → Save. Workflow: **Coolify panel HTTPS**.

### Dois servidores (Radar Chat + RadarGamer)

| VPS Platon | IP | Papel | Coolify |
|------------|-----|--------|---------|
| **ZAP** `platonvps-3409-1782517003` | `151.247.210.180` | Radar Chat + painel Coolify | Servidor **local** (`Radar Chat`) |
| **Gamer** `platonvps-3410-1782516873` | `151.247.210.179` | radargamer.com.br | Servidor **remoto** (`RadarGamer`) |

**Secrets GitHub (Actions):** `DEPLOY_SSH_KEY` (chave privada deploy), `DEPLOY_HOST` = `.180`, `RADARZAP_PASSWORD` / `RADARGAMER_PASSWORD` (senha `ubuntu` Platon — só bootstrap ou recuperação; **não** commitar).

O **ZAP (.180)** já recebe deploy por chave (`DEPLOY_SSH_KEY`); o bootstrap por senha só é necessário no **Gamer (.179)** se a chave for perdida.

Cadastro automatizado:

```bash
gh workflow run "Coolify servers setup" -f confirm=SERVERS
```

Requisitos:

1. Secret `DEPLOY_SSH_KEY` — chave privada que o Coolify usa para SSH no Gamer (`.179`).
2. A **chave pública** correspondente deve estar em `~ubuntu/.ssh/authorized_keys` no VPS Gamer (painel Platon ou `ssh-copy-id`).
3. Secret opcional `RADARGAMER_SSH_KEY` — se o Gamer usar chave diferente da do Radar Chat.

Bootstrap (primeira vez, senha do painel Platon no Gamer):

1. GitHub → **Settings → Secrets** → `RADARGAMER_PASSWORD` (senha `ubuntu` do VPS Gamer; só bootstrap).
2. Workflow **RadarGamer SSH bootstrap** → input `RADARGAMER` — instala a mesma chave de `DEPLOY_SSH_KEY` no `.179` e cadastra no Coolify.

```bash
gh workflow run "RadarGamer SSH bootstrap" -f confirm=RADARGAMER
```

Depois troque a senha do VPS Gamer no painel Platon.

No painel: **Servers** → dois hosts com métricas após validação. Script: `scripts/vps-coolify-servers-setup.sh`.

---

## Pré-requisitos

1. Servidor Linux (Ubuntu 22.04+) com Coolify v4+ instalado ([coolify.io/docs/get-started](https://coolify.io/docs/get-started/introduction)).
2. Repositório `radarzapv2` acessível (GitHub App ou deploy key).
3. Branch **`layout-v3`** com Fase 4 layout commitada (ou `main` após merge).
4. RAM **4 GB+** (Baileys + Mongo + Redis + build).

---

## Passo a passo — novo resource Docker Compose

### 1. Projeto e servidor

1. Coolify → **Projects** → criar projeto `Radar Chat`.
2. Environment **production** (ou `staging` primeiro).
3. Servidor conectado (localhost ou VPS remoto via SSH).

### 2. Adicionar resource

1. **+ Add Resource** → **Docker Compose** → **Git Repository**.
2. Repositório: `benhuragmf/radarzapv2` (ou fork).
3. **Branch:** `layout-v3`.
4. **Docker Compose location:** `docker-compose.coolify.yml`.
5. **Build Pack:** Docker Compose (build do `docker/Dockerfile.monolith` no serviço `app`).

### 3. Domínio e porta

1. Aba **Domains** → serviço **`app`**.
2. Porta interna: **3001** (monolito Express + painel).
3. Domínio: wildcard Coolify ou domínio próprio (ex. `app.seudominio.com`).
4. SSL: Let's Encrypt via Coolify (portas **80/443** abertas no firewall).

Coolify preenche `SERVICE_URL_APP` e `SERVICE_FQDN_APP` — usados em `FRONTEND_URL` / `CORS_ORIGIN` no compose.

### 4. Variáveis de ambiente

1. Aba **Environment Variables** → colar itens de [`.env.coolify.example`](../.env.coolify.example).
2. **Não** definir `MONGODB_URL` / `MONGO_PASSWORD` manualmente — o compose usa `SERVICE_PASSWORD_MONGODB`.
3. **Não** definir `ALLOW_DEV_BILLING` nem `ALLOW_DEV_API_KEY_BYPASS`.
4. OAuth: cadastrar redirects com a URL final (`SERVICE_URL_APP`):
   - `{URL}/auth/discord/callback`
   - `{URL}/auth/google/callback`

### 5. Volumes persistentes

O compose declara volumes nomeados:

| Volume | Conteúdo |
|--------|----------|
| `radarzap-sessions` | Sessões Baileys (**crítico**) |
| `radarzap-media` | Mídia inbox/webchat |
| `radarzap-logs` | Logs app |
| `mongodb-data` | Banco |
| `redis-data` | Filas BullMQ |

**Não** marcar “delete volumes” em redeploy destrutivo.

### 6. Deploy

1. **Deploy** (primeira vez: build ~5–15 min).
2. Health: `GET {SERVICE_URL_APP}/api/services/health` ou painel Coolify.
3. Conectar WhatsApp no painel (QR) — **parar** `npm run dev` local no mesmo número.

### 7. Webhook auto-deploy (opcional)

Coolify → **Webhooks** / GitHub App → redeploy em push na branch `layout-v3`.

Equivalente ao `.github/workflows/deploy.yml` em `main`, mas controlado pelo Coolify.

---

## Staging no Coolify

1. Duplicar resource no environment **staging**.
2. Branch `layout-v3` ou `develop`.
3. Mongo/Redis **isolados** (outro stack compose = outros volumes).
4. Stripe **test** keys; WA de teste separado.

---

## Migração do VPS legado (sslip.io)

**Status ZAP (.180):** ✅ migrado em 2026-06-29 — ver [`ENTREGA-COOLIFY-MIGRACAO-2.12.71.md`](./concluidos/ENTREGA-COOLIFY-MIGRACAO-2.12.71.md).

| Passo | Ação |
|-------|------|
| 1 | Backup `mongodump` + volume `radarzap-sessions` ✅ (volumes externos reutilizados) |
| 2 | Parar compose legado; subir stack Coolify (`configure-coolify` ou `deploy_service_direct`) ✅ |
| 3 | `env_file: .env` no app + secrets produção ✅ |
| 4 | Traefik → `:3001` (`fix-coolify-ssl` ou `vps-coolify-traefik-route-legacy.sh`) ✅ |
| 5 | Smoke health HTTPS ✅ |
| 6 | Desabilitar `deploy.yml` no host / validar SSH Coolify ⏳ |

Automação:

```bash
gh workflow run "Configure Coolify (Radar Chat)" --ref layout-v3 \
  -f confirm=CONFIGURE -f migrate_legacy=1
```

---

## Troubleshooting

| Sintoma | Verificar |
|---------|-----------|
| 502 Bad Gateway | App em `:3001`? `gh workflow run "Fix Coolify SSL" --ref layout-v3` |
| Container `Restarting` | Falta `env_file: .env` ou secrets (`SESSION_SECRET`, `DISCORD_TOKEN`, …) |
| Cookie / login falha | `FRONTEND_URL` = URL HTTPS real; `COOKIE_SECURE=true` |
| WA pede QR de novo | Volume `radarzap-sessions` perdido ou `SESSION_ENCRYPTION_KEY` mudou |
| Compose inválido no deploy | `.env` deve existir **no mesmo dir** que `docker-compose.yaml` antes de `docker compose config` |
| Painel Coolify `exited` | Containers podem estar Up — conferir `Coolify status check` |
| Deploy botão Coolify não sobe | Servidor “not reachable” — usar workflow ou `deploy_service_direct` |
| Mongo auth failed | `SERVICE_PASSWORD_MONGODB` = `MONGO_PASSWORD` do `.env` legado (volume já inicializado) |

---

## Relação com Layout v3 (Codex)

- **Codex** é dono de todo `frontend/` e docs `RADARZAP-LAYOUT-V3-*` — prep **não edita** esses arquivos.
- Coolify aponta para `layout-v3`; o build inclui a UI atual (mesmo em reorganização).
- Commits de infra e de layout são **independentes** na mesma branch.
- Merge `layout-v3` → `main` só quando Codex + gate + QA visual estiverem ok.

Ver [`.cursor/rules/layout-v3-codex-isolation.mdc`](../.cursor/rules/layout-v3-codex-isolation.mdc).

---

## Referências

- [Coolify — Docker Compose](https://coolify.io/docs/knowledge-base/docker/compose)
- [`docker-compose.deploy.yml`](../docker-compose.deploy.yml) — legado GHCR + imagem pré-buildada
- [`docker-compose.prod.yml`](../docker-compose.prod.yml) — build local sem Coolify
