# Prompt Codex — layout-v3 pós-migração Coolify (copiar/colar)

Use como **primeira mensagem** em sessão Codex no branch `layout-v3`.

---

```
Contexto RadarZap v2 — layout-v3 + produção Coolify (2026-06-29)

PRODUÇÃO (não mexer sem coordenar):
- URL: https://151-247-210-180.sslip.io
- App roda no stack Coolify (NÃO no compose legado GHCR)
- Container: h143brhw5f8tgfj9trj0f3bd-app-1
- Compose no host: /data/coolify/services/h143brhw5f8tgfj9trj0f3bd/
- Volumes externos: radarzap_radarzap-sessions, radarzap_mongodb-data, etc.
- Health OK: GET /api/services/health → 200

BRANCH:
- layout-v3 = branch do servidor E do layout Codex
- Infra Coolify já mergeada em layout-v3 (commits fix(infra): jun/2026)
- main recebe merge de layout-v3; VPS puxa layout-v3 nos workflows Coolify

SEU ESCOPO (Codex):
- frontend/**, design-system, navConfig, docs RADARZAP-LAYOUT-V3-*
- NÃO editar: scripts/vps-*, docker-compose.coolify*, .github/workflows/* Coolify,
  docs/COOLIFY-DEPLOY.md, PREPARACAO-PRODUCAO* (infra Auto)

REGRAS:
- Commits de layout separados de infra
- Antes de push: git pull --rebase origin layout-v3
- pre-push:gate antes de merge em main
- Não rodar npm run dev local no mesmo número WA que produção

DOCS:
- Entrega migração: docs/concluidos/ENTREGA-COOLIFY-MIGRACAO-2.12.71.md
- Coolify operação: docs/COOLIFY-DEPLOY.md
- Isolamento: .cursor/rules/layout-v3-codex-isolation.mdc
- Tracker prep: docs/PREPARACAO-PRODUCAO-EXECUCAO.md

PENDÊNCIAS INFRA (outro agente / humano):
- Validar servidor Coolify SSH no painel
- deploy.yml GHCR: não reativar legado no .180
- QA Fase 1 manual continua em paralelo

Continue o Layout v3 conforme RADARZAP-LAYOUT-V3-05-PROXIMAS-FASES-E-PROMPTS.md
```
