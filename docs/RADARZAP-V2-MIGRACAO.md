# RadarZap v2.0 — Notas de migração

> Cópia limpa gerada a partir de `radarzap` (jun/2026)

## Onde buscar se der erro na v2

A **v2 é a versão de trabalho**. O **v1 permanece como arquivo de referência** — não apague o `radarzap` original até a v2 estar estável em produção.

```
C:\Users\benhu\OneDrive\Área de Trabalho\Projetos\
├── radarzap\      ← v1: referência completa (histórico, lixo útil para debug, deploys antigos)
└── radarzapv2\    ← v2: código limpo e funcional (use no dia a dia)
```

### Fluxo sugerido ao investigar um problema

1. Reproduzir o erro na **v2** (`radarzapv2`).
2. Se faltar arquivo, script ou comportamento: abrir o mesmo caminho no **v1** (`radarzap`) e comparar.
3. Consultar [RADARZAP-STATUS.md](RADARZAP-STATUS.md) — limitações conhecidas.
4. Só portar do v1 para v2 o que for realmente necessário (evitar recopiar lixo).

### O que só existe no v1 (não está na v2)

| Item | Caminho no v1 |
|------|----------------|
| Monólito Railway/GCP | `src/minimal-index.ts` |
| Entry legado | `src/simple-index.ts` |
| Módulo Discord antigo | `src/services/discord/` |
| Scripts de teste manual | `test-*.js`, `debug-*.js`, `fix-*.js` (raiz) |
| Deploy GCP | `cloudbuild.yaml`, `Dockerfile.gcp`, `src/gcp-config.ts` |
| Deploy Railway | `railway.json`, `Dockerfile`, `src/railway-config.ts` |
| Deploy Oracle | `docker-compose.oracle.yml`, `docker/oracle.Dockerfile` |
| Specs de agente | `.kiro/specs/` |

## Mudanças em relação ao v1

| v1 (original) | v2 (esta pasta) |
|---------------|-----------------|
| `npm start` → `minimal-index.ts` (monólito) | `npm start` → `index.ts` (microserviços) |
| Scripts de teste/fix na raiz | Removidos |
| `src/services/discord/` legado | Removido |
| `.env.example` com secrets reais | Placeholders apenas |
| `register-guild-commands.ts` com token hardcoded | Usa variáveis de ambiente |
| Deploy GCP/Railway/Oracle | Não incluído |
| Specs `.kiro/` | Não incluído |

## Arquivos essenciais copiados

- `src/` (exceto legados acima)
- `docker/` (exceto `oracle.Dockerfile`)
- `docker-compose.yml`, `scripts/`, `docs/RADARZAP-*.md`
- `start-dashboard.ts`, `seed-templates.ts`, `update-templates.ts`, `register-guild-commands.ts`
- Config: `package.json`, `tsconfig.json`, `jest.config.js`, `.eslintrc.js`, `.gitignore`, `.dockerignore`

## Desenvolvimento local (importante)

**Stack v2 apenas** — Docker usa volumes `radarzapv2_*`. Não monte volumes do projeto `radarzap` (v1).

**Não rode** `docker compose up -d` completo (sobe `auto-setup` = segundo bot). Use só infra:

```bash
npm run docker:infra   # Redis :6380 + Mongo :27017 (volumes radarzapv2)
npm run dev            # um terminal
npm run dashboard:frontend
```

Se aparecer `ECONNREFUSED 127.0.0.1:6380` ou `:27017`, o Docker infra está parado.

Para parar tudo: `npm run dev:stop` + `docker compose down` (na pasta v2).

**Não** rode ao mesmo tempo: Docker app v1 + Docker app v2 + `npm run dev`.

### Migrar dados do v1 para v2 (uma vez)

Se você tinha dados no Mongo do projeto antigo e quer copiar **sem** usar o Docker v1 no dia a dia:

```bash
npm run migrate:v1-db
```

Isso faz `mongodump` do volume `radarzap_mongodb-data` (leitura única), recria `radarzapv2_mongodb-data` com a senha do `.env` e restaura. Depois disso, só volumes v2.

O v1 continua existindo na pasta `radarzap` apenas como **referência de código**, não como infraestrutura.

## Próximos passos sugeridos

1. Inicializar git em `radarzapv2` e fazer primeiro commit
2. Rotacionar credenciais que estavam no repo antigo
3. Testar pipeline completo: `/setup` → `/rules create` → mensagem no canal
4. Integrar `web-dashboard` no `docker-compose.yml` (opcional)
