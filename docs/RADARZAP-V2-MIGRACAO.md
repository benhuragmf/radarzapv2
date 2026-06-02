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

## Próximos passos sugeridos

1. Inicializar git em `radarzapv2` e fazer primeiro commit
2. Rotacionar credenciais que estavam no repo antigo
3. Testar pipeline completo: `/setup` → `/rules create` → mensagem no canal
4. Integrar `web-dashboard` no `docker-compose.yml` (opcional)
