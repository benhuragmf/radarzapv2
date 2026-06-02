# RadarZap — Etapa 03: Rules Engine, Templates e Fila

## Objetivo

Implementar o motor de regras que decide se uma mensagem capturada deve ser enviada, aplicar o template correto e gerenciar a fila de envio com segurança.

---

## Parte 1 — Rules Engine

### O que precisa ser criado

O arquivo `src/services/rules/` não existe ainda. Precisa ser criado do zero.

### Estrutura de uma Regra

```typescript
interface Rule {
  id: string;
  clientId: ObjectId;       // dono da regra
  name: string;             // ex: "Promoções do Radar Gamer"
  isActive: boolean;

  // Condições (todas devem ser verdadeiras — AND)
  conditions: {
    channelIds?: string[];        // canais permitidos
    guildIds?: string[];          // servidores permitidos
    authorIds?: string[];         // autores específicos (usuários ou bots)
    onlyBots?: boolean;           // apenas mensagens de bots
    onlyUsers?: boolean;          // apenas mensagens de usuários
    requireKeywords?: string[];   // deve conter estas palavras
    excludeKeywords?: string[];   // não deve conter estas palavras
    requireLink?: boolean;        // deve ter link
    requireImage?: boolean;       // deve ter imagem
    requireEmbed?: boolean;       // deve ter embed
  };

  // Ação (o que fazer quando a regra bate)
  action: {
    destinationIds: ObjectId[];   // destinos WhatsApp
    templateName: string;         // template a usar
    priority: 'high' | 'medium' | 'low';
    addDelay?: number;            // delay extra em ms antes de enviar
  };
}
```

### Exemplo de Regra

```json
{
  "name": "Promoções do canal #promoções via bot Radar Gamer",
  "isActive": true,
  "conditions": {
    "channelIds": ["987654321"],
    "authorIds": ["111222333"],
    "onlyBots": true,
    "requireLink": true
  },
  "action": {
    "destinationIds": ["<ObjectId grupo Promoções WhatsApp>"],
    "templateName": "promocao-padrao",
    "priority": "high"
  }
}
```

### Lógica de Avaliação

```
Para cada mensagem capturada:
  Para cada regra ativa do clientId:
    Se TODAS as condições forem verdadeiras:
      Aplicar a ação da regra
      (uma mensagem pode bater em múltiplas regras → múltiplos envios)
```

### Arquivo a criar: `src/services/rules/RulesEngine.ts`

Métodos principais:
- `evaluate(message: ExtractedMessage, clientId: string): RuleMatch[]`
- `createRule(clientId, ruleData): Rule`
- `updateRule(ruleId, data): Rule`
- `deleteRule(ruleId): void`
- `toggleRule(ruleId): Rule`
- `getRules(clientId): Rule[]`

### Modelo a criar: `src/models/Rule.ts`

Campos: `clientId`, `name`, `isActive`, `conditions`, `action`, `createdAt`, `updatedAt`, `matchCount` (quantas vezes bateu).

---

## Parte 2 — Template Engine

### O que já existe ✅

`src/services/templates/TemplateEngine.ts` — completo e funcional.

Templates padrão já criados:
- `game-promotion-basic`
- `game-promotion-discount`
- `game-free`
- `game-dlc`
- `custom-message`

### O que precisa ser adicionado

#### Templates padrão para o RadarZap

Adicionar ao `initializeDefaultTemplates()`:

```typescript
{
  name: 'radarzap-padrao',
  content: '📢 *{canal}* — {servidor}\n\n{mensagem}\n\n🔗 {link}\n\n_Enviado em {data} às {hora}_'
},
{
  name: 'radarzap-com-embed',
  content: '📢 *{embed_titulo}*\n\n{embed_desc}\n\n🔗 {link}\n\n_Via {canal} • {data}_'
},
{
  name: 'radarzap-simples',
  content: '{mensagem}'
},
{
  name: 'radarzap-alerta',
  content: '🚨 *ALERTA — {canal}*\n\n{mensagem}\n\n_Por {autor} em {data} às {hora}_'
}
```

#### Variáveis a suportar

Atualizar o `render()` do modelo Template para incluir todas as variáveis do RadarZap:

```
{servidor}, {canal}, {autor}, {mensagem}, {link}, {links},
{imagem}, {embed_titulo}, {embed_desc}, {data}, {hora}, {timestamp}
```

---

## Parte 3 — Fila de Envio (BullMQ)

### O que já existe ✅

- `src/cache/QueueManager.ts` — gerenciador BullMQ completo
- `src/services/queue/QueueProcessorService.ts` — processador de jobs
- `src/services/whatsapp/WhatsAppServiceIntegration.ts` — integração com fila

### Filas existentes

| Fila | Uso |
|------|-----|
| `message-processing` | Processar mensagem capturada do Discord |
| `whatsapp-sending` | Enviar mensagem para WhatsApp |
| `whatsapp-connection` | Conectar/desconectar sessão |

### Fluxo completo da fila

```
Job: 'process-discord-message' (fila: message-processing)
  ↓
QueueProcessorService recebe o job
  ↓
RulesEngine.evaluate(message, clientId) → RuleMatch[]
  ↓
Para cada RuleMatch:
  ↓
  TemplateEngine.renderTemplate(templateName, variables)
  ↓
  Verificar deduplicação (Redis: hash da mensagem)
  ↓
  Se não duplicada:
    Adicionar job na fila 'whatsapp-sending'
    com priority, delay e attempts da regra
  ↓
  Salvar log no SystemLog
```

### Configurações de segurança da fila

```typescript
// Delay mínimo entre mensagens para o mesmo destino
const MIN_DELAY_MS = 3000; // 3 segundos

// Limite por minuto por sessão WhatsApp
const MAX_PER_MINUTE = 20;

// Cooldown por grupo após N mensagens
const GROUP_COOLDOWN_AFTER = 5;
const GROUP_COOLDOWN_MS = 60000; // 1 minuto

// Máximo de tentativas antes de marcar como falha
const MAX_ATTEMPTS = 3;

// Backoff exponencial entre tentativas
const BACKOFF = { type: 'exponential', delay: 2000 };

// Janela de deduplicação
const DEDUP_WINDOW_HOURS = 6;
```

### Prioridades na fila

| Prioridade | Valor BullMQ | Exemplos |
|-----------|-------------|---------|
| Alta | 8-10 | Alertas, lives, promoções 100%, admin |
| Média | 4-7 | Promoções comuns, avisos |
| Baixa | 1-3 | Mensagens gerais |

### Deduplicação

```typescript
// Gerar hash da mensagem
const hash = crypto
  .createHash('sha256')
  .update(`${clientId}:${destinationId}:${messageContent}`)
  .digest('hex');

// Verificar no Redis
const key = `dedup:${hash}`;
const exists = await redis.get(key);

if (exists) {
  // Descartar e logar
  return;
}

// Marcar como enviada (TTL = janela de deduplicação)
await redis.setex(key, DEDUP_WINDOW_HOURS * 3600, '1');
```

---

## Parte 4 — Logs e Histórico

### O que já existe ✅

`src/models/SystemLog.ts` — modelo de log completo.

### Campos do log

```typescript
{
  clientId: ObjectId,
  type: 'capture' | 'rule_match' | 'rule_skip' | 'send_success' | 'send_failure' | 'dedup_skip',
  
  // Origem
  discordMessageId: string,
  discordChannelId: string,
  discordGuildId: string,
  discordAuthor: string,
  
  // Destino
  whatsappDestination: string,
  whatsappSessionId: string,
  
  // Processamento
  ruleName: string,
  templateName: string,
  renderedMessage: string,
  
  // Resultado
  status: 'success' | 'failure' | 'skipped',
  errorMessage?: string,
  attempts: number,
  
  // Tempo
  capturedAt: Date,
  sentAt?: Date,
  processingTimeMs: number
}
```

---

## Checklist da Etapa 03

### Rules Engine
- [ ] Criar `src/models/Rule.ts`
- [ ] Criar `src/services/rules/RulesEngine.ts`
- [ ] Integrar RulesEngine no QueueProcessorService
- [ ] Adicionar comando `/rules` no CommandHandler

### Templates
- [ ] Adicionar templates padrão do RadarZap no TemplateEngine
- [ ] Suportar todas as variáveis de captura
- [ ] Adicionar comando `/templates` no CommandHandler

### Fila
- [ ] Integrar RulesEngine no processamento da fila
- [ ] Implementar deduplicação com Redis
- [ ] Configurar delays e limites de segurança
- [ ] Implementar pausa automática em caso de muitos erros

### Logs
- [ ] Logar cada etapa do pipeline (captura, regra, template, envio)
- [ ] Logar deduplicações descartadas
- [ ] Logar falhas com detalhes do erro
