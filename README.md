# RadarZap v2.0

Sistema de automação **Discord → WhatsApp**: captura mensagens em canais configurados, aplica regras e templates, enfileira com BullMQ e envia via Baileys.

Esta pasta é a **versão limpa** do projeto original (`radarzap`), sem scripts de teste manual, deploys legados (GCP/Railway/Oracle) nem código duplicado (`minimal-index`, `simple-index`, módulo `discord/` legado).

## Referência ao projeto original (v1)

Se algo falhar na v2 e você não encontrar o arquivo ou o comportamento esperado, **consulte o repositório original** — ele mantém histórico completo, scripts antigos e variantes de código que foram removidos aqui.

| | Caminho |
|---|--------|
| **Projeto v1 (referência)** | `C:\Users\benhu\OneDrive\Área de Trabalho\Projetos\radarzap` |
| **Projeto v2 (este)** | `C:\Users\benhu\OneDrive\Área de Trabalho\Projetos\radarzapv2` |

**Quando buscar no v1:**

- Erro em funcionalidade que existia antes da limpeza
- Comparar implementação antiga (`minimal-index.ts`, `simple-index.ts`, `src/services/discord/`)
- Scripts de debug na raiz (`test-*.js`, `fix-*.js`, `debug-*.js`)
- Configs de deploy removidas (GCP, Railway, Oracle, `cloudbuild.yaml`)
- Specs e planejamento em `.kiro/specs/`

Detalhes da migração: [docs/RADARZAP-V2-MIGRACAO.md](docs/RADARZAP-V2-MIGRACAO.md).

## Documentação

| Arquivo | Conteúdo |
|---------|----------|
| [docs/RADARZAP-01-VISAO-GERAL.md](docs/RADARZAP-01-VISAO-GERAL.md) | Visão geral e fluxo |
| [docs/RADARZAP-02-CAPTURA-DISCORD.md](docs/RADARZAP-02-CAPTURA-DISCORD.md) | Bot Discord e comandos |
| [docs/RADARZAP-03-REGRAS-TEMPLATES-FILA.md](docs/RADARZAP-03-REGRAS-TEMPLATES-FILA.md) | Regras, templates, fila |
| [docs/RADARZAP-04-PAINEL-DEPLOY-PROXIMOS-PASSOS.md](docs/RADARZAP-04-PAINEL-DEPLOY-PROXIMOS-PASSOS.md) | Painel e deploy |
| [docs/RADARZAP-STATUS.md](docs/RADARZAP-STATUS.md) | Status e backlog |

## Pré-requisitos

- Node.js 18+
- Docker Desktop (MongoDB + Redis + microserviços)
- Token do bot Discord ([Developer Portal](https://discord.com/developers/applications))

## Configuração rápida

```bash
cp .env.example .env
# Edite .env com DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, MONGO_PASSWORD, JWT_SECRET

npm install
cd src/services/web-dashboard/frontend && npm install && cd ../../../../..

npm run build
docker compose up -d
npm run register-commands   # opcional: slash commands no servidor (DISCORD_GUILD_ID)
```

## Como rodar

### Serviços principais (Docker)

```bash
docker compose up -d
```

Containers: `api-gateway`, `discord-bot`, `whatsapp-service`, `queue-processor`, `mongodb`, `redis`, `auto-setup`, `health-monitor`.

### Desenvolvimento local (orquestrador)

```bash
npm run dev
```

Usa `src/index.ts` — sobe serviços conforme `SERVICE_NAME` no `.env` (vazio = todos).

### Painel web

```bash
# Terminal 1 — API do dashboard (porta 3001)
npm run dashboard

# Terminal 2 — frontend Vite (porta 5174)
npm run dashboard:frontend
```

Acesse: http://localhost:5174

### Testes

```bash
npm test
```

### Templates iniciais no MongoDB

```bash
npm run seed:templates
```

## O que foi removido na v2

- ~30 scripts `test-*.js`, `fix-*.js`, `debug-*` na raiz
- `minimal-index.ts`, `simple-index.ts`, `src/services/discord/` (legado)
- Configs GCP, Railway, Oracle, `.kiro/`
- Credenciais reais do `.env.example` original (use placeholders)

## Estrutura

```
radarzapv2/
├── src/                    # Código TypeScript
│   ├── index.ts            # Entry point (microserviços)
│   └── services/
│       ├── discord-bot/
│       ├── whatsapp/
│       ├── queue/
│       ├── api-gateway/
│       └── web-dashboard/
├── docker/                 # Dockerfiles por serviço
├── scripts/mongo-init.js
├── docs/
├── docker-compose.yml
└── start-dashboard.ts
```

## Licença

MIT
