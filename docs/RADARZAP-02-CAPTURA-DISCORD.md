# RadarZap — Etapa 02: Captura Discord

## Objetivo

Capturar mensagens de canais configurados no Discord e extrair todas as informações relevantes para o pipeline de envio ao WhatsApp.

---

## O que já existe

### DiscordBotService (`src/services/discord-bot/DiscordBotService.ts`) ✅
- Client Discord.js configurado com intents corretos (`GuildMessages`, `MessageContent`, `GuildMembers`)
- Listener `Events.MessageCreate` ativo
- Reconexão automática com backoff exponencial (até 5 tentativas)
- Circuit breaker para proteção contra falhas da API Discord
- Registro de sessão no Redis
- Health check periódico a cada 30 segundos

### CommandHandler (`src/services/discord-bot/CommandHandler.ts`) ✅
Comandos slash implementados:
- `/setup` — configura canal para monitoramento
- `/status` — status do bot e sessão WhatsApp
- `/connect-whatsapp` — inicia conexão via QR code
- `/disconnect-whatsapp` — encerra sessão
- `/add-destination` — adiciona grupo ou contato WhatsApp
- `/list-destinations` — lista destinos configurados
- `/remove-destination` — remove destino
- `/test-message` — envia mensagem de teste
- `/filters add-keyword` / `remove-keyword` / `list` — gerencia filtros de palavras-chave
- `/help` — ajuda

### MessageExtractor (`src/services/discord-bot/MessageExtractor.ts`) ✅
Extrai todos os dados relevantes de qualquer mensagem Discord: texto, embeds, links, imagens, hash de deduplicação SHA-256.

---

## O que precisa ser feito

Todos os itens da Etapa 02 foram implementados. Pendente apenas testes manuais de integração.

---

## Pipeline de Captura

```
Discord Event: MessageCreate
        ↓
DiscordBotService.handleMessage()
        ↓
Verificar se canal está monitorado (DiscordChannel.findByChannelId)
        ↓
MessageExtractor.extract(message) → ExtractedMessage
        ↓
Gerar hash de deduplicação
        ↓
Adicionar job na fila 'message-processing' (BullMQ)
        ↓
QueueProcessorService processa o job
        ↓
Rules Engine avalia as regras
        ↓
(se aprovado) Template Engine formata
        ↓
Fila 'whatsapp-sending'
        ↓
WhatsAppService envia
```

---

## Modelo DiscordChannel (já existe em `src/models/DiscordChannel.ts`)

O modelo já suporta:
- `guildId`, `channelId`, `clientId`
- `filters.keywords` — palavras-chave obrigatórias
- `filters.excludeKeywords` — palavras proibidas
- `filters.minPrice`, `filters.maxPrice` — filtros de preço (específico de jogos, pode ser removido)
- `isActive` — ativar/desativar monitoramento
- `matchesFilters()` — método de validação

Precisa adicionar:
- `filters.allowBots: boolean` — se deve capturar mensagens de bots
- `filters.allowedBotIds: string[]` — IDs de bots específicos permitidos
- `filters.allowedUserIds: string[]` — IDs de usuários específicos
- `filters.requireLink: boolean` — só captura se tiver link
- `filters.requireImage: boolean` — só captura se tiver imagem
- `filters.requireEmbed: boolean` — só captura se tiver embed
- `destinationIds: ObjectId[]` — destinos WhatsApp vinculados ao canal
- `templateName: string` — template padrão para este canal
- `rulePriority: 'high' | 'medium' | 'low'` — prioridade padrão das mensagens

---

## Tipos de Conteúdo Capturado

| Tipo | Suporte |
|------|---------|
| Texto simples | ✅ |
| Embeds | ✅ |
| Links | ✅ |
| Imagens (attachments) | ✅ |
| Mensagens de bots | ✅ |
| Mensagens de admins | ✅ |
| Mensagens de usuários | ✅ |

---

## Comandos Discord

| Comando | Status | Observação |
|---------|--------|-----------|
| `/setup` | ✅ | Funcional |
| `/status` | ✅ | Funcional |
| `/connect-whatsapp` | ✅ | Funcional |
| `/disconnect-whatsapp` | ✅ | Funcional |
| `/add-destination` | ✅ | Funcional |
| `/list-destinations` | ✅ | Funcional |
| `/remove-destination` | ✅ | Funcional |
| `/test-message` | ✅ | Funcional |
| `/filters` | ✅ | keywords + exclude |
| `/rules` | ✅ | create, list, toggle, delete |
| `/help` | ✅ | Atualizado com /rules |
| `/templates` | ❌ | Etapa 03 |
| `/queue` | ❌ | Etapa 03 |

---

## Variáveis de Template Disponíveis na Captura

Após a extração, estas variáveis ficam disponíveis para o Template Engine:

```
{servidor}    → nome do servidor Discord
{canal}       → nome do canal
{autor}       → nome do autor da mensagem
{mensagem}    → texto da mensagem
{link}        → primeiro link encontrado
{links}       → todos os links separados por vírgula
{imagem}      → URL da primeira imagem
{embed_titulo} → título do primeiro embed
{embed_desc}  → descrição do primeiro embed
{data}        → data no formato DD/MM/YYYY
{hora}        → hora no formato HH:MM
{timestamp}   → ISO 8601 completo
```

---

## Exemplo de Configuração de Canal

```json
{
  "guildId": "123456789",
  "channelId": "987654321",
  "channelName": "promoções",
  "isActive": true,
  "filters": {
    "allowBots": true,
    "allowedBotIds": ["111222333"],
    "keywords": ["promoção", "desconto", "grátis"],
    "excludeKeywords": ["patrocinado"],
    "requireLink": true,
    "requireEmbed": false,
    "requireImage": false
  },
  "destinationIds": ["<ObjectId do grupo WhatsApp>"],
  "templateName": "promocao-padrao",
  "rulePriority": "high"
}
```

---

## Checklist da Etapa 02

- [x] Generalizar `MessageExtractor` para qualquer tipo de mensagem
- [x] Remover bloqueio hardcoded de bots no `handleMessage`
- [x] Adicionar campos de filtro no modelo `DiscordChannel`
- [x] Implementar comando `/rules` no `CommandHandler`
- [x] Vincular canal a destinos WhatsApp diretamente (`destinationIds` no model)
- [x] Gerar hash de deduplicação na extração
- [ ] Testar captura de: texto, embed, link, imagem, bot, usuário
