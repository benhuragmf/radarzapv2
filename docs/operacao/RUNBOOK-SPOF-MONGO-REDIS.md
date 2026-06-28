# Runbook — SPOF MongoDB e Redis (AH-S01)

**Versão doc:** 2.12.56 · **Atualizado:** 2026-06-28  
**Escopo:** Fase 1 estabilização — referência operacional; **não** autoriza go-live VPS.

---

## Resumo

O RadarZap v2 trata **MongoDB** e **Redis** como dependências **hard** no boot (`src/index.ts`). Se qualquer uma falhar na subida, o processo encerra com `exit(1)`.

| Dependência | Uso crítico |
|-------------|-------------|
| **MongoDB** | Sessões painel, orgs, inbox, tickets, WebChat, billing, audit |
| **Redis** | Sessões express, rate limit, presença, filas BullMQ, OTP, bridge dedup |

**Modo degradado em código:** ✅ **2.12.62** — dev permite boot sem Redis (Mongo obrigatório); prod continua exigindo Redis (`validateConfig` bloqueia `INFRA_DEGRADED_BOOT`).

| Modo | Mongo down | Redis down |
|------|------------|------------|
| **production** | `exit(1)` | `exit(1)` |
| **development** | `exit(1)` | boot degradado — filas/webhooks não iniciam; `healthy: false` + `degraded: true` no health |

Env opcional: `INFRA_DEGRADED_BOOT=true` (somente não-prod ou validação falha em prod).

---

## Sintomas

| Sintoma | Provável causa |
|---------|----------------|
| Container reinicia em loop | Mongo/Redis down no `initializeInfrastructure` |
| Log `MongoDB indisponível após aguardar reconexão` | Mongo não aceita conexão em 45s |
| Log `Redis OK` ausente / erro ioredis | Redis unreachable ou auth errada |
| Painel 502 / connection refused | Processo não subiu |
| Atendimento parcial (WS ok, fila travada) | Redis caiu **após** boot — filas/rate limit degradam |

---

## Verificação rápida

```bash
# Liveness público (sem auth — Docker/load balancer)
curl -s http://127.0.0.1:3001/api/services/health | jq .
# { "healthy": true, "uptime": ..., "version": "...", "checkedAt": "..." }

# Detalhe staff (sessão + dashboard:global)
curl -s -b cookies.txt http://127.0.0.1:3001/api/admin/ops/infra-health | jq .
# inclui dependencies.mongodb/redis/queues com latência

# Docker local
docker compose ps
docker compose logs mongodb --tail 50
docker compose logs redis --tail 50
```

**HTTP 503** + `"healthy": false` → dependência core indisponível.

---

## Recuperação — dev local

```bash
docker compose up -d mongodb redis
npm run dev
```

Aguardar até `Banco de dados OK` e `Redis OK` nos logs.

---

## Recuperação — VPS (referência, executar só após gate Fase 1)

1. SSH na VPS; `docker compose -f docker-compose.deploy.yml ps`
2. Reiniciar serviço: `docker compose -f docker-compose.deploy.yml restart mongodb redis`
3. Aguardar health: `curl -sf http://127.0.0.1:3001/api/services/health`
4. Se app não subir: `docker compose -f docker-compose.deploy.yml logs app --tail 100`
5. Último recurso: `up -d` completo (ver `docs/PREPARACAO-PRODUCAO.md` — **não executar** antes do gate)

---

## Impacto por subsistema (Redis down pós-boot)

| Área | Comportamento |
|------|----------------|
| Rate limit | Fail-closed em prod (`RATE_LIMIT_FAIL_OPEN` unset) — APIs podem retornar 429/503 |
| Sessão painel | Pode cair para store memória se configurado; prod usa Redis |
| BullMQ / campanhas | Jobs não processam |
| Presença WebChat | Fallback in-memory single-node |
| OTP / bridge | Falhas intermitentes |

**Ação:** restaurar Redis antes de retomar campanhas ou testes de carga.

---

## Monitoramento recomendado (pré-prod)

- Alerta se `GET /api/services/health` → `healthy: false` por > 2 min
- Alerta restart count container `app` > 3 em 15 min
- Backup Mongo conforme `docs/PREPARACAO-PRODUCAO.md`

---

## Roadmap (pós Fase 1)

- Readiness vs liveness separados (K8s/Docker)
- ~~Degraded mode: painel read-only sem filas~~ — parcial ✅ 2.12.62 (dev, Redis opcional no boot)
- Redis Sentinel / Mongo replica set (multi-node)

---

## Referências

- `src/index.ts` — `initializeInfrastructure`, `waitForMongoReady`
- `src/services/infra/infra-health.service.ts` — AH-S04
- `docs/audits/RADARZAP-AUDITORIA-HORIZONTAL-SEGURANCA-ESTABILIDADE.md` — AH-S01
- `docs/ROADMAP-COMPLETUDE.md` — gate estabilização
