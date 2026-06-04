# RadarZap v2.0

Sistema de automação **Discord → WhatsApp**: captura mensagens em canais configurados, aplica regras e templates, enfileira com BullMQ e envia via Baileys (texto, imagem com legenda, botões de loja).

Esta pasta é a **versão limpa** do projeto original (`radarzap`), sem scripts de teste manual, deploys legados (GCP/Railway/Oracle) nem código duplicado (`minimal-index`, `simple-index`, módulo `discord/` legado).

## O que a v2 faz

| Etapa | Descrição |
|-------|-----------|
| **Captura** | Bot Discord lê mensagens, embeds e anexos (`#live-on`, promoções, lojas) |
| **Classificação** | Links Twitch, TikTok, YouTube, Kick — live, vídeo, short ou clipe |
| **Regras** | Filtro por canal, palavra-chave, tipo de conteúdo |
| **Templates `dw-*`** | Catálogo editável no painel (`dw-live`, `dw-video`, `dw-short`, …) |
| **Envio** | WhatsApp com layout padrão (link, rodapé, imagem) |
| **Logs** | Pipeline rastreável em `/discord/logs` (capture → render → send) |

O **nome do streamer** vem do handle na URL (ex.: `@mcjean7` no TikTok), não do autor da mensagem no Discord.

## Referência ao projeto original (v1)

Se algo falhar na v2, **consulte o repositório original** — histórico completo, scripts antigos e variantes removidas aqui.

| | Caminho |
|---|--------|
| **Projeto v1 (referência)** | `C:\Users\benhu\OneDrive\Área de Trabalho\Projetos\radarzap` |
| **Projeto v2 (este)** | `C:\Users\benhu\OneDrive\Área de Trabalho\Projetos\radarzapv2` |

Detalhes da migração: [docs/RADARZAP-V2-MIGRACAO.md](docs/RADARZAP-V2-MIGRACAO.md).

## Documentação

| Arquivo | Conteúdo |
|---------|----------|
| [docs/RADARZAP-01-VISAO-GERAL.md](docs/RADARZAP-01-VISAO-GERAL.md) | Visão geral e fluxo |
| [docs/RADARZAP-02-CAPTURA-DISCORD.md](docs/RADARZAP-02-CAPTURA-DISCORD.md) | Bot Discord e comandos |
| [docs/RADARZAP-03-REGRAS-TEMPLATES-FILA.md](docs/RADARZAP-03-REGRAS-TEMPLATES-FILA.md) | Regras, templates, fila |
| [docs/RADARZAP-04-PAINEL-DEPLOY-PROXIMOS-PASSOS.md](docs/RADARZAP-04-PAINEL-DEPLOY-PROXIMOS-PASSOS.md) | Painel e deploy |
| [docs/RADARZAP-STATUS.md](docs/RADARZAP-STATUS.md) | Status e backlog |
| [docs/RADARZAP-V2-MIGRACAO.md](docs/RADARZAP-V2-MIGRACAO.md) | Diferenças v1/v2 e dev local |

## Pré-requisitos

- Node.js 18+
- Docker Desktop (MongoDB + Redis)
- Token do bot Discord ([Developer Portal](https://discord.com/developers/applications))
- Conta Google (opcional) para login no painel via OAuth

## Configuração rápida

```bash
cp .env.example .env
# Edite .env: DISCORD_TOKEN, MONGO_PASSWORD, JWT_SECRET, FRONTEND_URL, OAuth Google/Discord

npm install
cd src/services/web-dashboard/frontend && npm install && cd ../../../../..

npm run seed:templates    # templates dw-* no MongoDB
npm run register-commands   # opcional: slash commands (DISCORD_GUILD_ID)
```

## Desenvolvimento local (recomendado)

Use **só a infra Docker** da v2 — não suba o stack completo nem o Docker do v1 em paralelo (evita bot duplicado e mensagens repetidas).

```bash
npm run docker:infra        # Redis :6380 + Mongo :27017 (volumes radarzapv2_*)

# Terminal 1 — backend + bot + fila + WhatsApp + API :3001
npm run dev

# Terminal 2 — frontend Vite :5174
npm run dashboard:frontend
```

Acesse o painel: **http://localhost:5174**

Rotas úteis:

- `/discord/rules` — regras Discord → WhatsApp
- `/discord/templates` — editor de templates `dw-*`
- `/discord/logs` — logs do pipeline
- `/discord/whatsapp` — conexão e consentimento LGPD

Para parar processos locais: `npm run dev:stop`

Se aparecer `ECONNREFUSED` em `:6380` ou `:27017`, rode `npm run docker:infra` de novo.

### Migrar banco do v1 (uma vez)

```bash
npm run migrate:v1-db
```

Copia dados do volume Mongo do projeto antigo para `radarzapv2_mongodb-data`. O v1 continua só como referência de código.

## Produção / Docker completo

```bash
npm run build
docker compose up -d
```

Containers: `api-gateway`, `discord-bot`, `whatsapp-service`, `queue-processor`, `mongodb`, `redis`, `auto-setup`, `health-monitor`.

> Em dev, **não** use `docker compose up -d` completo — o serviço `auto-setup` sobe um segundo bot.

## Scripts npm

| Script | Uso |
|--------|-----|
| `npm run dev` | Orquestrador local (`src/index.ts`, todos os serviços) |
| `npm run dev:stop` | Encerra processos dev (PowerShell) |
| `npm run docker:infra` | Só Redis + MongoDB |
| `npm run dashboard:frontend` | Vite do painel (:5174) |
| `npm run seed:templates` | Insere templates iniciais no Mongo |
| `npm run update:templates` | Atualiza catálogo `dw-*` no Mongo |
| `npm run migrate:v1-db` | Migra dados Mongo v1 → v2 |
| `npm run clear:test` | Limpa estado de teste (filas/cache) |
| `npm test` | Testes Jest |

## Testes

```bash
npm test
```

Cobertura relevante: classificação de links, templates de stream, captura Discord, extração de streamer por URL.

## O que foi removido na v2

- ~30 scripts `test-*.js`, `fix-*.js`, `debug-*` na raiz
- `minimal-index.ts`, `simple-index.ts`, `src/services/discord/` (legado)
- Configs GCP, Railway, Oracle, `.kiro/`
- Credenciais reais do `.env.example` original (use placeholders)

## Estrutura

```
radarzapv2/
├── src/
│   ├── index.ts                 # Entry point (microserviços / dev all-in-one)
│   ├── constants/
│   │   └── discord-whatsapp-templates.ts   # Catálogo dw-*
│   ├── utils/
│   │   ├── discord-capture.ts              # Captura e dedupe
│   │   ├── discord-wa-format.ts            # Layout WA, streamer da URL
│   │   ├── discord-wa-variables.ts         # Variáveis dos templates
│   │   ├── link-content-classifier.ts      # Twitch/TikTok/YouTube/Kick
│   │   └── stream-template.ts              # Template final no envio
│   └── services/
│       ├── discord-bot/
│       ├── whatsapp/
│       ├── queue/
│       ├── api-gateway/
│       └── web-dashboard/
├── docker/
├── scripts/
│   ├── migrate-v1-db-to-v2.ps1
│   └── clear-test-state.ts
├── docs/
├── docker-compose.yml
└── start-dashboard.ts
```

## Licença

MIT
