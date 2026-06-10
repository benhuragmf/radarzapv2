# RadarZap v2 — runbook de go-live (servidor dedicado)

> **Só execute este documento quando o sistema estiver 100% pronto, sem erros conhecidos.**  
> Toda preparação (servidor, env, segurança, validação local) está em [`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md).

**Versão ref:** `2.7.1` · **Última revisão:** 2026-06-10

---

## §0 — Gate obrigatório (antes de qualquer comando abaixo)

| Fase | Documento |
|------|-----------|
| Desenvolvimento / preparação | [`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md) |
| **Go-live (este runbook)** | Só após todos ✅ abaixo |

- [ ] Checklist de [`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md) (infra, env, segurança) concluído
- [ ] **CI verde** em `main` (`test` + `backend-build` + `frontend-build` + E2E)
- [ ] **`npm run build`** + **`npm test`** locais sem erro
- [ ] **Smoke manual local** ok (login, Inbox, WA, ticket, billing teste)
- [ ] **Roadmap** do release sem bloqueadores críticos
- [ ] **Tag semver** (`v2.x.x`) + changelog `SISTEMA-REGISTRO.md` alinhados ao commit

**Ordem:** dev estável → **staging** (§2) → smoke staging → **produção** (§3).

---

## §1 — Executar: primeira vez no dedicado (Docker)

```bash
ssh root@SEU_IP

apt update && apt install -y docker.io docker-compose-plugin git
systemctl enable --now docker

mkdir -p /opt/radarzap && cd /opt/radarzap
git clone https://github.com/benhuragmf/radarzapv2.git .

cp .env.example .env
nano .env                    # secrets — ver PREPARACAO-PRODUCAO.md
export MONGO_PASSWORD='…'

echo $GITHUB_PAT | docker login ghcr.io -u SEU_USER --password-stdin

export RADARZAP_IMAGE=ghcr.io/benhuragmf/radarzap:latest
bash scripts/deploy-remote.sh "$RADARZAP_IMAGE"

# nginx + SSL → localhost:3001 (ver PREPARACAO-PRODUCAO.md § nginx)
```

**Não** rodar `npm run docker:infra` nem `auto-setup` em prod.

---

## §2 — Executar: staging (validar release)

1. Mesmo procedimento §1 em VPS/host **staging** (Mongo/Redis **separados** de prod)
2. `.env` com keys **de teste** (Stripe test, OAuth staging)
3. `FRONTEND_URL` / `CORS_ORIGIN` = URL staging HTTPS
4. Deploy: GitHub Actions → workflow **Deploy** → `workflow_dispatch` → **staging**
5. Conectar 1 sessão WA teste
6. **Smoke §4** completo em staging
7. Só avançar para §3 se staging ok

**Deploy CI:** `.github/workflows/deploy.yml` — build `docker/Dockerfile.monolith` → GHCR → SSH → `scripts/deploy-remote.sh`.

---

## §3 — Executar: produção (go-live)

| Passo | Ação |
|-------|------|
| 1 | Deploy **mesmo commit/tag** validado em staging |
| 2 | Secrets prod **únicos** (`JWT_SECRET`, `SESSION_SECRET`); manter `SESSION_ENCRYPTION_KEY` se copiar volume `sessions/` |
| 3 | Mongo prod **limpo** ou migração seletiva — não copiar lixo de staging |
| 4 | Redis prod **vazio** (filas BullMQ não migram) |
| 5 | `.env`: `NODE_ENV=production`, Stripe **Live**, e-mail prod |
| 6 | DNS + SSL prod ativos |
| 7 | Webhooks externos URLs **prod** (Stripe, clientes) |
| 8 | Sessões WA: copiar volume staging→prod **só** com mesma encryption key; senão **novo QR** |
| 9 | Workflow Deploy → **production** ou tag `v*` |
| 10 | **Smoke §4** em prod |
| 11 | Monitorar 24h: logs, WA, filas BullMQ |

---

## §4 — Smoke (no momento do deploy)

- [ ] `GET /api/services/health` → healthy
- [ ] Login Google + Discord admin
- [ ] Painel + WebSocket Inbox
- [ ] Sessão WA conectada ou QR ok
- [ ] Enviar mensagem teste
- [ ] Convite equipe (e-mail)
- [ ] Checkout plano (Stripe test staging / live prod)
- [ ] Webhook outbound HTTPS
- [ ] Ticket menu WhatsApp + SLA painel
- [ ] IA (se ativa): status ticket não grava complemento

---

## §5 — Rollback

1. Redeploy imagem/tag **anterior** (`RADARZAP_IMAGE=ghcr.io/.../radarzap:<sha-anterior>`)
2. **Não** rollback Mongo se migration irreversível — restore snapshot pré-deploy
3. Manter volume `sessions/` — rollback de código compatível se schema igual
4. Stripe: reconciliar pedidos pendentes no dashboard Stripe

---

## Referências (preparação — não executar aqui)

| Assunto | Documento |
|---------|-----------|
| Servidor, env, nginx, PM2, Docker | [`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md) |
| Segurança | [`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md) § Checkup |
| Roadmap / lacunas | [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md) |
| Versão | [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md) |
