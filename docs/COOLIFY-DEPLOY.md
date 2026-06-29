# RadarZap v2 — deploy com Coolify

> **Branch de release:** `layout-v3` (UI v3 + produto `2.12.x`) — **é a branch do servidor**  
> **Compose:** [`docker-compose.coolify-ghcr.yml`](../docker-compose.coolify-ghcr.yml) (GHCR, produção hoje) · [`docker-compose.coolify.yml`](../docker-compose.coolify.yml) (build no Coolify) · **Env:** [`.env.coolify.example`](../.env.coolify.example)  
> **Tracker:** [`PREPARACAO-PRODUCAO-EXECUCAO.md`](./PREPARACAO-PRODUCAO-EXECUCAO.md)

Coolify substitui (ou complementa) o fluxo **GHCR + SSH** ([`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md) § Deploy CI). SSL, domínio e rede ficam no proxy Coolify (Traefik/Caddy).

### Sincronizar `main` → `layout-v3` (infra)

Commits de infra (`fix(infra):`, workflows VPS, scripts Coolify/SSL) entram primeiro em `main`. **Sempre** em seguida:

```bash
git checkout layout-v3 && git merge main && git push origin layout-v3
```

O VPS e o resource Coolify devem refletir `layout-v3`, não apenas `main`. Layout (Codex) e infra (Auto) convivem na mesma branch — ver isolamento em `.cursor/rules/layout-v3-codex-isolation.mdc`.

---

## Coexistência com deploy atual

| Método | Quando usar |
|--------|-------------|
| **Coolify** (novo) | VPS com Coolify instalado; deploy por branch `layout-v3`; UI de env/domínio |
| **GitHub Actions + `deploy-remote.sh`** | VPS legado sslip.io; push `main` → GHCR |

**Não** rodar os dois no **mesmo** host apontando para o **mesmo** WA — uma instância por número.

Durante migração: desligar deploy automático `main` no VPS antigo **ou** usar Coolify em servidor novo.

### Painel Coolify (porta 8000)

| URL | Uso |
|-----|-----|
| `http://151.247.210.180:8000` | Setup inicial — **HTTP sem SSL** (navegador mostra “Não seguro”) |
| `https://coolify-151-247-210-180.sslip.io` | Painel com HTTPS (após `scripts/vps-coolify-panel-https.sh` ou Settings → Instance Domain) |
| `https://151-247-210-180.sslip.io` | **RadarZap** (app), não o painel Coolify |

No Coolify: **Settings → Instance Settings → Instance's Domain** = `https://coolify-151-247-210-180.sslip.io` → Save. Workflow: **Coolify panel HTTPS**.

### Dois servidores (RadarZap + RadarGamer)

| VPS | IP | Papel | Coolify |
|-----|-----|--------|---------|
| **ZAP** `platonvps-3409` | `151.247.210.180` | RadarZap + painel Coolify | Servidor **local** (nome `RadarZap`) |
| **Gamer** `platonvps-3410` | `151.247.210.179` | radargamer.com.br | Servidor **remoto** SSH (nome `RadarGamer`) |

Cadastro automatizado:

```bash
gh workflow run "Coolify servers setup" -f confirm=SERVERS
```

Requisitos:

1. Secret `DEPLOY_SSH_KEY` — chave privada que o Coolify usa para SSH no Gamer (`.179`).
2. A **chave pública** correspondente deve estar em `~ubuntu/.ssh/authorized_keys` no VPS Gamer (painel Platon ou `ssh-copy-id`).
3. Secret opcional `RADARGAMER_SSH_KEY` — se o Gamer usar chave diferente da do RadarZap.

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

1. Coolify → **Projects** → criar projeto `RadarZap`.
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

| Passo | Ação |
|-------|------|
| 1 | Backup `mongodump` + copiar volume `radarzap-sessions` do host antigo |
| 2 | Subir stack Coolify em host novo (ou mesmo host **após** parar compose antigo) |
| 3 | Restaurar Mongo; recriar volume sessions com **mesma** `SESSION_ENCRYPTION_KEY` |
| 4 | Atualizar DNS sslip.io → domínio Coolify (ou manter sslip só para testes) |
| 5 | Smoke [`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md) § pós-deploy |
| 6 | Desabilitar workflow `deploy.yml` no GitHub **se** Coolify for o único canal |

---

## Troubleshooting

| Sintoma | Verificar |
|---------|-----------|
| 502 Bad Gateway | Domínio no serviço `app`, porta **3001**, container healthy |
| Cookie / login falha | `FRONTEND_URL` = URL HTTPS real; `COOKIE_SECURE=true` |
| WA pede QR de novo | Volume `radarzap-sessions` perdido ou `SESSION_ENCRYPTION_KEY` mudou |
| Build falha no Coolify | Rodar local `npm run pre-push:gate`; branch `layout-v3` atualizada |
| Mongo auth failed | Redeploy para regenerar `SERVICE_PASSWORD_MONGODB` **ou** restaurar backup com senha conhecida |

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
