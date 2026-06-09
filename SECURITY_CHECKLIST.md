# Checklist de segurança — RadarZap

Use antes de **deploy staging/prod** e em revisões trimestrais.

---

## Secrets e repositório

- [ ] `.env` **não** commitado (`git check-ignore .env`)
- [ ] `sessions/` e `**/creds.json` ignorados
- [ ] `JWT_SECRET`, `SESSION_SECRET`, `SESSION_ENCRYPTION_KEY` únicos por ambiente (≥32 chars)
- [ ] `STRIPE_*` live só em prod; test só em staging
- [ ] `ALLOW_DEV_BILLING=false` em prod (validado no boot)
- [ ] `ALLOW_DEV_API_KEY_BYPASS` **não** definido em staging/prod
- [ ] `RADARZAP_SYSTEM_ADMIN_DISCORD_IDS` preenchido só com IDs da equipe

## HTTPS e cookies

- [ ] `FRONTEND_URL` HTTPS em prod
- [ ] `COOKIE_SECURE=true` em prod
- [ ] Redirects OAuth cadastrados (Google + Discord)
- [ ] nginx/Caddy termina TLS; upstream só `127.0.0.1:3001`

## Banco e Redis

- [ ] MongoDB com auth; porta **não** pública
- [ ] Redis com senha em prod; porta **não** pública
- [ ] Backups Mongo criptografados em repouso
- [ ] Clusters staging ≠ prod

## Aplicação

- [ ] `npm test` verde
- [ ] `npm run build` verde
- [ ] `npm audit --audit-level=high` revisado
- [ ] Rate limit ativo (`/auth`, `/api`)
- [ ] Helmet / security headers no painel
- [ ] Webhook Stripe apontando para URL prod com `whsec` live
- [ ] Webhooks clientes só HTTPS

## Docker (se aplicável)

- [ ] Imagem roda como usuário não-root
- [ ] Volumes `sessions/`, `media/` persistentes e com permissão restrita
- [ ] **Não** montar `docker.sock` em prod
- [ ] `docker-compose.prod` sem expor 27017/6379

## CI/CD

- [ ] Secrets no GitHub Environment (não no código)
- [ ] Branch `main` protegida
- [ ] Deploy manual ou tag `v*` com aprovação em `production`

## LGPD

- [ ] Fluxo de consentimento testado
- [ ] Export/backup tratado como dado sensível
- [ ] Processo de exclusão de tenant documentado

## Pós-deploy (smoke)

- [ ] `GET /api/services/health` → healthy
- [ ] Login Google + Discord
- [ ] Usuário tenant A **não** acessa dados de tenant B (teste manual IDOR)
- [ ] Checkout Stripe teste (staging)
- [ ] QR WhatsApp visível só para o tenant correto

---

**Última revisão:** 2026-06-09 · Ver também `docs/PRODUCTION.md` §2
