# RadarZap v2

> **Software proprietário** — Copyright (c) 2026 Benhur Augusto Gomes Monteiro Faria.  
> Ver [LICENSE.md](LICENSE.md) e [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

Plataforma SaaS para **atendimento omnicanal** (WhatsApp, WebChat, leads), **Inbox**, **tickets**, **IA**, **equipe/RBAC**, **billing Stripe** e **API REST**.

---

## Status atual

| Campo | Valor |
|-------|-------|
| **Versão** | `2.12.64` |
| **Status** | `PRONTO PARA QA MANUAL` (gate automático ✅) |
| **Produção estável** | Não declarada |
| **Deploy CI/VPS** | Pipeline ativo; QA humano Fase 1 pendente |
| **Próximo passo** | [`PENDENCIAS-HUMANAS-FASE1.md`](docs/PENDENCIAS-HUMANAS-FASE1.md) — QA manual A–J + Admin Bloco E VPS |

Changelog: [docs/SISTEMA-REGISTRO.md](docs/SISTEMA-REGISTRO.md)

---

## Leitura principal

Leia nesta ordem:

1. [docs/RADARZAP-SISTEMA-COMPLETO.md](docs/RADARZAP-SISTEMA-COMPLETO.md) — **documentação mestre**
2. [docs/concluidos/RADARZAP-RESULTADO-FINAL-TOP-01-20.md](docs/concluidos/RADARZAP-RESULTADO-FINAL-TOP-01-20.md) — resumo executivo
3. [docs/concluidos/top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md](docs/concluidos/top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md) — status, checklists e go-live
4. [docs/INDICE-DOCUMENTACAO.md](docs/INDICE-DOCUMENTACAO.md) — mapa de todos os `.md`
5. [docs/PENDENCIAS-HUMANAS-FASE1.md](docs/PENDENCIAS-HUMANAS-FASE1.md) — **o que falta fechar (só humano)**
6. [docs/QA-FASE1-RESULTADO-TEMPLATE.md](docs/QA-FASE1-RESULTADO-TEMPLATE.md) — registrar QA manual TOP 20

---

## Como rodar localmente

```bash
npm install
npm install --prefix src/services/web-dashboard/frontend
cp .env.example .env   # Mongo, Redis, SESSION_ENCRYPTION_KEY, etc.
npm run docker:infra   # Mongo + Redis

# Terminal 1
npm run dev

# Terminal 2
npm run dashboard:frontend
```

Painel: [http://localhost:5174](http://localhost:5174) · API: [http://localhost:3001/api](http://localhost:3001/api)

Detalhes: [docs/RADARZAP-SISTEMA-COMPLETO.md](docs/RADARZAP-SISTEMA-COMPLETO.md) § Como rodar.

---

## Gates obrigatórios

```bash
npm run typecheck
npm run build
npm test
npm run qa:atendimento:gate
npm run build --prefix src/services/web-dashboard/frontend
npm run qa:fase1:e2e    # Playwright — opcional pré-go-live
```

Sequência completa e critérios: doc mestre §22.

---

## QA manual antes do go-live

O código está congelado em `2.12.6`. Antes de produção:

1. Executar blocos **A–J** (login, equipe, WebChat, WhatsApp, bridge, tickets, leads, IA, billing, segurança).
2. Preencher [docs/QA-FASE1-RESULTADO-TEMPLATE.md](docs/QA-FASE1-RESULTADO-TEMPLATE.md) § Resultado QA Manual TOP 20.
3. Seguir [docs/top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md](docs/top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md).

Roteiro passo a passo: [docs/QA-FASE1-ROTEIRO.md](docs/QA-FASE1-ROTEIRO.md)

**Não** marcar produção estável sem QA manual verde.

---

## Documentação

| Área | Arquivo |
|------|---------|
| Mestre | [docs/RADARZAP-SISTEMA-COMPLETO.md](docs/RADARZAP-SISTEMA-COMPLETO.md) |
| Índice | [docs/INDICE-DOCUMENTACAO.md](docs/INDICE-DOCUMENTACAO.md) |
| Inbox | [docs/INBOX-ATENDIMENTO.md](docs/INBOX-ATENDIMENTO.md) |
| WebChat | [docs/WEBCHAT.md](docs/WEBCHAT.md) |
| Billing | [docs/BILLING.md](docs/BILLING.md) |
| Produção | [docs/PREPARACAO-PRODUCAO.md](docs/PREPARACAO-PRODUCAO.md), [docs/PRODUCTION.md](docs/PRODUCTION.md) |
| TOPs 01–21 | [docs/top/](docs/top/) |
| Migração v1 | [docs/RADARZAP-V2-MIGRACAO.md](docs/RADARZAP-V2-MIGRACAO.md) |

---

## Regras para IA / Codex / Cursor

1. Ler **primeiro** [docs/RADARZAP-SISTEMA-COMPLETO.md](docs/RADARZAP-SISTEMA-COMPLETO.md) + [docs/INDICE-DOCUMENTACAO.md](docs/INDICE-DOCUMENTACAO.md).
2. Consultar v1 só para comparar: `.cursor/rules/radarzap-v2-reference.mdc`.
3. Após TOP 20: **somente** bug/blocker, ajustes de produção e documentação até o primeiro go-live.
4. Não copiar Evolution/Sendfy; não declarar produção pronta sem QA manual.
5. Ao alterar feature visível: versionar conforme [docs/VERSIONAMENTO-E-DOCUMENTACAO.md](docs/VERSIONAMENTO-E-DOCUMENTACAO.md).

---

## O que não fazer

- Não commitar `.env`, `.env.local`, `.env.production`
- Não commitar `data/`, `sessions/`, credenciais
- Não declarar produção pronta sem QA manual A–J
- Não apagar `docs/top/` nem `docs/top/RADARZAP-TOP-*.md` (histórico auditoria TOP 01–20)
- Não misturar RadarZap com RadarGamer / RadarLurk
- Não apagar `docs/top/` nem histórico TOP

---

## Licença

Software proprietário — [LICENSE.md](LICENSE.md)
