# Radar Chat v2

> **Software proprietário** — Copyright (c) 2026 Benhur Augusto Gomes Monteiro Faria.  
> Ver [LICENSE.md](LICENSE.md) e [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

Plataforma SaaS para **atendimento omnicanal** (WhatsApp, WebChat, leads), **Inbox**, **tickets**, **IA**, **equipe/RBAC**, **billing Stripe** e **API REST**.

---

## Status atual

| Campo | Valor |
|-------|-------|
| **Versão** | `2.17.61` (produção `app.radarchat.com.br` @ `4a7c690`) |
| **Status** | QA humano pendente — gate Fase 1 aberto |
| **Produção estável** | Não declarada (congelamento catálogo: APROVADO COM RESSALVAS) |
| **Deploy** | Coolify + `main` — ver [`COOLIFY-DEPLOY.md`](docs/COOLIFY-DEPLOY.md) |
| **Próximo passo** | [`RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md`](docs/RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md) |

Changelog: [docs/SISTEMA-REGISTRO.md](docs/SISTEMA-REGISTRO.md)

---

## Leitura principal

Leia nesta ordem:

1. [docs/RADARCHAT-SISTEMA-COMPLETO.md](docs/RADARCHAT-SISTEMA-COMPLETO.md) — **documentação mestre**
2. [docs/concluidos/RADARCHAT-RESULTADO-FINAL-TOP-01-20.md](docs/concluidos/RADARCHAT-RESULTADO-FINAL-TOP-01-20.md) — resumo executivo
3. [docs/concluidos/top/RADARCHAT-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md](docs/concluidos/top/RADARCHAT-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md) — status, checklists e go-live
4. [docs/INDICE-DOCUMENTACAO.md](docs/INDICE-DOCUMENTACAO.md) — mapa de todos os `.md`
5. [docs/PENDENCIAS-HUMANAS-FASE1.md](docs/PENDENCIAS-HUMANAS-FASE1.md) — **o que falta fechar (só humano)**
6. [docs/RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md](docs/RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md) — **QA humano master**
7. [docs/RADARCHAT-EXTRAIDOS-LEGACY-2.17.61.md](docs/RADARCHAT-EXTRAIDOS-LEGACY-2.17.61.md) — gates, fallback WA, integrações (extratos)

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

Detalhes: [docs/RADARCHAT-SISTEMA-COMPLETO.md](docs/RADARCHAT-SISTEMA-COMPLETO.md) § Como rodar.

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

O código está em `2.17.61`. Antes de declarar produção estável:

1. Executar blocos **A–J** em [docs/RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md](docs/RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md).
2. Registrar resultado em `docs/concluidos/RADARCHAT-QA-HUMANO-RESULTADO-<data>.md` (modelo: [concluidos/RADARCHAT-QA-HUMANO-RESULTADO-CATALOGO-ENDERECO-PIX-2.17.61-2026-07-01.md](docs/concluidos/RADARCHAT-QA-HUMANO-RESULTADO-CATALOGO-ENDERECO-PIX-2.17.61-2026-07-01.md)).
3. Seguir [docs/concluidos/top/RADARCHAT-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md](docs/concluidos/top/RADARCHAT-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md).

Detalhe QA (legacy): [docs/legacy/QA-FASE1-ROTEIRO.md](docs/legacy/QA-FASE1-ROTEIRO.md) · extratos: [docs/RADARCHAT-EXTRAIDOS-LEGACY-2.17.61.md](docs/RADARCHAT-EXTRAIDOS-LEGACY-2.17.61.md)

**Não** marcar produção estável sem QA manual verde.

---

## Documentação

| Área | Arquivo |
|------|---------|
| Mestre | [docs/RADARCHAT-SISTEMA-COMPLETO.md](docs/RADARCHAT-SISTEMA-COMPLETO.md) |
| Índice | [docs/INDICE-DOCUMENTACAO.md](docs/INDICE-DOCUMENTACAO.md) |
| Inbox | [docs/INBOX-ATENDIMENTO.md](docs/INBOX-ATENDIMENTO.md) |
| WebChat | [docs/WEBCHAT.md](docs/WEBCHAT.md) |
| Billing | [docs/BILLING.md](docs/BILLING.md) |
| Produção | [docs/COOLIFY-DEPLOY.md](docs/COOLIFY-DEPLOY.md) · legacy: [PREPARACAO-PRODUCAO](docs/legacy/PREPARACAO-PRODUCAO.md), [PRODUCTION](docs/legacy/PRODUCTION.md) |
| TOPs 01–21 | [docs/concluidos/top/](docs/concluidos/top/) |
| Legacy (nota &lt; 8) | [docs/legacy/README.md](docs/legacy/README.md) |

---

## Regras para IA / Codex / Cursor

1. Ler **primeiro** [docs/RADARCHAT-SISTEMA-COMPLETO.md](docs/RADARCHAT-SISTEMA-COMPLETO.md) + [docs/INDICE-DOCUMENTACAO.md](docs/INDICE-DOCUMENTACAO.md).
2. Consultar v1 só para comparar: `.cursor/rules/radarchat-v2-reference.mdc`.
3. Após TOP 20: **somente** bug/blocker, ajustes de produção e documentação até o primeiro go-live.
4. Não copiar Evolution/Sendfy; não declarar produção pronta sem QA manual.
5. Ao alterar feature visível: versionar conforme [docs/VERSIONAMENTO-E-DOCUMENTACAO.md](docs/VERSIONAMENTO-E-DOCUMENTACAO.md).

---

## O que não fazer

- Não commitar `.env`, `.env.local`, `.env.production`
- Não commitar `data/`, `sessions/`, credenciais
- Não declarar produção pronta sem QA manual A–J
- Não apagar `docs/top/` nem `docs/top/RADARCHAT-TOP-*.md` (histórico auditoria TOP 01–20)
- Não misturar Radar Chat com RadarGamer / RadarLurk
- Não apagar `docs/top/` nem histórico TOP

---

## Licença

Software proprietário — [LICENSE.md](LICENSE.md)
