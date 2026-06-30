# Discord → WhatsApp — monitoramento

**Versão doc:** 2.17.5 · **Atualizado:** 2026-06-30

Módulo de automação: captura eventos no Discord (mensagens, voz, membros) e envia ao WhatsApp via regras e templates `dw-*`.

## O que já funciona

| Área | Recursos |
|------|----------|
| **Monitores** | Texto, voz, eventos do servidor (`/discord/channels`) |
| **Regras** | Múltiplos gatilhos, filtros avançados, **prévia sem envio**, destinos WA |
| **Histórico** | Mensagens + voz + eventos (90 dias, `GET /channels/:id/history`) |
| **Métricas** | Dashboard 7/14/30 dias em `/discord` |

## Roadmap — melhorias sugeridas

### Prioridade alta (valor imediato)

| # | Item | Status |
|---|------|--------|
| 1 | **Histórico de mensagens de texto** | ✅ 2.16.0 |
| 2 | **Preview de regra no painel** | ✅ 2.16.0 |
| 3 | **Dashboard métricas 7–30d** | ✅ 2.16.0 |
| 4 | **Testes `evaluateEvent` + cooldown** | ✅ 2.16.1 |

### Prioridade média

| # | Item | Status |
|---|------|--------|
| 5 | **Threads / fóruns** no picker (`type` 10/11/12/15) + herança pai no bot | ✅ 2.16.1 |
| 6 | **Filtros avançados em Canais** (UI `allowedBotIds` / `allowedUserIds`) | ✅ 2.16.1 |
| 7 | **Reações e edição de mensagem** | ✅ 2.17.0 |
| 8 | **Roteamento por cargo Discord** | ✅ 2.17.0 |
| 9 | **OpenAPI** rotas `/discord/*` | ✅ 2.17.0 |
| 10 | **Auditoria** mudanças regras/monitores | ✅ 2.17.0 |

### Prioridade baixa / futuro

| # | Item |
|---|------|
| 11 | Webhook inbound Discord (sem gateway) | ✅ 2.17.5 |
| 12 | Dry-run global por tenant | ✅ 2.17.2 |
| 13 | Limpar campos legados `DiscordChannel.destinationIds` / `templateName` | ✅ 2.17.3 |
| 14 | Multi-regra por mensagem | ✅ 2.17.4 |
| 15 | Status presença do bot no widget embed |

## Threads e fóruns (2.16.1)

- Picker de canais inclui tipos **10/11/12/15** (threads e fórum).
- Mensagens em thread/post herdam o monitor do **canal pai** (`findTextMonitorForMessage`).
- Configure o canal de texto ou fórum pai em Canais — não é necessário monitorar cada thread.

## Engajamento — edição e reações (2.17.0)

- Gatilhos `message_edit` e `message_reaction` nas regras.
- Bot: intents `GuildMessageReactions` + handlers `MessageUpdate` / `MessageReactionAdd`.
- Templates `dw-message-edit` e `dw-message-reaction`.
- Webhooks: `discord.message.edited`, `discord.message.reaction`.

## Filtro por cargo (2.17.0)

- Condição `roleIds[]` nas regras — usuário precisa ter ao menos um dos cargos.
- UI: seletor de cargos via `GET /discord/guilds/:guildId/roles`.
- Mensagens: cargos do autor via `Message.member`; eventos: resolvidos no bot.

## Auditoria (2.17.0)

- Eventos `discord.rule.*` e `discord.monitor.*` em `AttendanceEvent` (90 dias).
- `GET /api/discord/audit?limit=50` — feed no painel/integrações.
- UI: card **Auditoria recente** na home `/discord` (2.17.1).

## Modo simulação — dry-run global (2.17.2)

- Flag `Organization.discordSettings.dryRun` por tenant.
- `GET/PATCH /api/discord/settings` — toggle no painel `/discord/settings`.
- Pipeline (`QueueProcessorService`): captura + avalia regras + grava histórico com status `dry_run` — **sem enfileirar WhatsApp** e sem exigir WA conectado.
- Complementa a **prévia de regra única** (`POST /rules/:id/preview`), que não persiste histórico.
- Banner na home `/discord` quando simulação ativa; auditoria `discord.settings.updated`.

## Campos legados no monitor (2.17.3)

- `DiscordChannel.destinationIds` e `templateName` eram da época em que regra ficava no canal.
- Hoje use **Regras** (`Rule.action`) para destinos e templates.
- API `GET /channels` não expõe mais esses campos; schema com `select: false`.
- `rulePriority` no canal permanece apenas para prioridade da **fila BullMQ** (não é prioridade da regra).

## Multi-regra por captura (2.17.4)

- `Organization.discordSettings.multiRulePerMessage` — opt-in por tenant.
- **Desligado (padrão):** uma captura → regra de maior prioridade.
- **Ligado:** até **5 regras** que batem, ordenadas por prioridade (mensagens + eventos voz/membros).
- Dedup WA inclui `ruleId` em multi-regra (mesmo destino pode receber templates distintos).
- Toggle em `/discord/settings`; API `GET/PATCH /discord/settings`.

## Webhook inbound — sem gateway (2.17.5)

Alternativa ao bot Discord online: sistemas externos enviam capturas via HTTP.

| Método | Rota | Auth |
|--------|------|------|
| POST | `/api/integrations/discord/inbound/messages` | `X-API-Key` + `Idempotency-Key` |
| POST | `/api/integrations/discord/inbound/events` | `X-API-Key` + `Idempotency-Key` |

- Opt-in: `Organization.discordSettings.inboundEnabled` (toggle em Configurações).
- Valida monitor ativo + filtros do canal; enfileira o mesmo pipeline (`process-discord-message` / `process-discord-event`).
- Rate limit: 60 req/min por tenant (`RADARCHAT_DISCORD_INBOUND_RATE_LIMIT_PER_MINUTE`).
- Resposta `202` com `status: queued | skipped | qa_no_real_send`.

## Filtros por autor (2.16.1)

- UI em Canais → Filtros: **IDs de bots** e **IDs de usuários** permitidos (vírgula).
- API: `PATCH /api/channels/:id/filters` com `allowedBotIds[]` / `allowedUserIds[]`.

## APIs recentes (2.15.0+)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/discord/health` | Token, bot online, guilds |
| GET | `/api/discord/stats?guildId=&days=7` | Agregado `DiscordMonitorEvent` |
| GET/PATCH | `/api/discord/settings` | Modo simulação (dry-run) global |
| GET | `/api/discord/audit?limit=50` | Auditoria regras/monitores/config |
| GET | `/api/discord/bot-invite-url` | Link OAuth convite bot |

## Pré-requisitos Discord Developer Portal

- **Bot intents:** `Guild Messages`, `Message Content`, `Guild Message Reactions`, `Server Members`, `Guild Voice States`
- **Permissões:** ver canais, histórico, enviar mensagens, audit log (kick/ban)
- **Variáveis:** `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`

## Índice Mongo

Índice único: `{ guildId, channelId, monitorType }` — permite mesmo ID para monitor texto e voz em cenários edge.

---

Ver também: `docs/WEBHOOKS.md`, `docs/CHANGELOG.md`
