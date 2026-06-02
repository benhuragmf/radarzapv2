# RadarZap — Status do Projeto

> Última atualização: 30/05/2026

---

## ✅ O que está funcionando

### Infraestrutura
- [x] Docker Compose com 7 containers (discord-bot, whatsapp-service, queue-processor, api-gateway, health-monitor, mongodb, redis)
- [x] MongoDB com autenticação
- [x] Redis com BullMQ
- [x] Reconexão automática do MongoDB (DatabaseManager com backoff exponencial)
- [x] Reconexão automática do Redis

### Bot Discord
- [x] Login e registro de slash commands
- [x] `/setup` — configura canal para monitoramento
- [x] `/connect-whatsapp` — gera QR code e conecta sessão
- [x] `/disconnect-whatsapp` — desconecta sessão
- [x] `/status` — mostra status do bot e sessão
- [x] `/add-destination` — cadastra destino (contato ou grupo) com dropdown de tipo
- [x] `/list-destinations` — lista destinos cadastrados
- [x] `/remove-destination` — remove destino
- [x] `/test-message` — envia mensagem de teste para destino específico ou todos
- [x] `/rules create` — cria regra para o canal atual
- [x] `/rules list` — lista regras com status e contador de matches
- [x] `/rules toggle` — ativa/desativa regra
- [x] `/rules delete` — deleta regra
- [x] `/list-groups` — lista grupos WhatsApp com IDs
- [x] `/help` — ajuda com todos os comandos
- [x] Resposta imediata antes de enfileirar (evita "Unknown interaction")
- [x] `safeErrorReply` em catch blocks (não relança erro em interações expiradas)

### WhatsApp Service
- [x] Conexão via Baileys (WhatsApp Web)
- [x] QR code enviado diretamente no canal Discord
- [x] QR code deletado automaticamente após conexão
- [x] Sessão persistida no MongoDB + arquivos locais
- [x] Restauração automática de sessões ao reiniciar
- [x] Reconexão automática em desconexões transientes (428, 408)
- [x] Logout permanente limpa sessão (401)
- [x] Envio de mensagens com formatação JID correta (strip `+`, resolve via `onWhatsApp()`)
- [x] `findByIdentifier` normaliza `+` (busca com e sem prefixo)
- [x] Rate limiting por sessão (20 msg/min)
- [x] Circuit breaker (abre após 3 falhas)
- [x] `monitorSessionHealth()` — verifica saúde da sessão
- [x] `getServiceStats()` — estatísticas do serviço

### Pipeline de Mensagens
- [x] Captura de mensagens do Discord (MessageExtractor)
- [x] RulesEngine — avalia mensagem contra regras ativas do cliente
- [x] Filtros: canal, servidor, autor, bot/usuário, keywords, link, imagem, embed
- [x] TemplateEngine com 9 templates padrão (game-promotion + 4 RadarZap)
- [x] Variáveis: `{servidor}`, `{canal}`, `{autor}`, `{mensagem}`, `{link}`, `{embed_titulo}`, `{embed_desc}`, `{data}`, `{hora}`
- [x] Deduplicação com Redis (SHA-256, TTL 6h)
- [x] Delay escalonado entre envios (3s entre jobs)
- [x] Backoff exponencial nas retentativas (3 tentativas)
- [x] Fallback: regra sem `destinationIds` usa todos os destinos ativos do usuário
- [x] SystemLog com traceId em cada etapa do pipeline

### Painel Web (Dashboard)
- [x] Backend: Express + Socket.IO na porta 3001
- [x] Frontend: React 18 + Vite + TypeScript + Tailwind v4
- [x] Página Dashboard — stats em tempo real (sessões, mensagens, jobs, falhas)
- [x] Página Sessões — status, conectar/desconectar, QR code inline
- [x] Página Regras — lista, toggle ativo/inativo, deletar
- [x] Página Templates — lista com preview do conteúdo
- [x] Página Fila — stats por fila, jobs com falha e reenvio
- [x] Página Logs — filtros por nível/serviço, expandir detalhes
- [x] Página Teste de Envio — selecionar destino, enviar mensagem
- [x] WebSocket para atualizações em tempo real (stats a cada 10s)
- [x] Script `start-dashboard.ts` para rodar localmente

### Testes
- [x] 50 testes passando (RulesEngine: 18, MessageExtractor: 15, WhatsAppService: 17)
- [x] Stub do Baileys para testes sem dependências nativas
- [x] Mock manual do `@/models` com `getDestinationStats`
- [x] CircuitBreaker prototype mocks

---

## ⚠️ Funciona mas tem limitações

### Pipeline completo Discord → WhatsApp
- **Status:** implementado mas não testado de ponta a ponta
- **O que falta para testar:**
  1. Docker Desktop precisa estar rodando
  2. `/setup` no canal monitorado
  3. `/rules create name:teste` (cria regra sem destinos — usa todos por fallback)
  4. Postar mensagem no canal → deve chegar no WhatsApp

### Regras sem destinos específicos
- **Status:** corrigido — usa todos os destinos ativos do usuário como fallback
- **Limitação:** não há como vincular destinos específicos a uma regra pelo Discord
- **Workaround:** usar o painel web (quando implementado o formulário de edição)

### Painel Web — `totalMessages`
- **Status:** mostra 0 quando rodando localmente
- **Causa:** processo local conecta em `localhost:27017` mas o MongoDB do Docker pode não expor essa porta
- **Fix:** adicionado `ports: 27017:27017` no `docker-compose.yml` — precisa recriar o container MongoDB

### Templates
- **Status:** 9 templates criados no banco na primeira execução
- **Limitação:** se o MongoDB não estiver conectado no startup, templates não são criados (lazy init corrige isso)

---

## ❌ O que ainda precisa ser feito

### Pipeline
- [ ] **Testar pipeline completo** — mensagem Discord → regra → template → WhatsApp
- [ ] **Vincular destinos a regras** — adicionar parâmetro `destinations` ao `/rules create`
- [ ] **Editar regra** — comando `/rules edit` ou formulário no painel
- [ ] **Filtros avançados** — preço mínimo/máximo, regex no texto

### Painel Web
- [ ] **Formulário de criação de regra** — atualmente só via Discord
- [ ] **Formulário de edição de regra** — alterar condições, ação, destinos
- [ ] **Criação/edição de templates** — formulário com preview em tempo real
- [ ] **Gráfico de mensagens por hora** — `messagesPerHour` retorna `[]` ainda
- [ ] **Exportar logs CSV**
- [ ] **Autenticação no painel** — qualquer um com acesso à porta 3001 pode ver tudo
- [ ] **Build integrado ao Docker** — Dockerfile do web-dashboard precisa ser reescrito

### Infraestrutura
- [ ] **Dockerfile do web-dashboard** — atual é para nginx estático, precisa ser Node.js
- [ ] **`docker compose up --build`** — containers criados manualmente precisam ser migrados para Compose
- [ ] **Redis `noeviction`** — configurado no `docker-compose.yml` mas container Redis antigo ainda usa `allkeys-lru`
- [ ] **Alias `mongodb` no container** — precisa ser recriado via Compose para ter o alias correto

### Qualidade
- [ ] **Testes do pipeline** — testar `QueueProcessorService.processDiscordMessage` com mocks
- [ ] **Testes do DashboardService** — endpoints da API
- [ ] **Índices duplicados no Mongoose** — warnings de `Duplicate schema index` em todos os modelos
- [ ] **`ephemeral` deprecated** — warning do discord.js sobre usar `flags` em vez de `ephemeral`

### SaaS / Multi-tenant (Etapa 5)
- [ ] Sistema de planos (free, premium, enterprise) com limites
- [ ] Billing e pagamentos
- [ ] Onboarding automatizado
- [ ] API pública com Swagger

---

## 🗓️ Migração Julho 2026

Quando o projeto crescer, migrar para a stack padrão:

| Atual | Alvo |
|-------|------|
| Express | NestJS |
| MongoDB + Mongoose | PostgreSQL + Prisma |
| Sem auth | Better Auth |
| Docker manual | Docker + Coolify |

O frontend React já está na stack correta — só atualizar os contratos de API.

---

## 🚀 Como rodar localmente

### Todos os serviços via Docker
```bash
docker compose up -d
```

### Dashboard web (dev)
```bash
# Terminal 1 — backend
npx ts-node -r tsconfig-paths/register start-dashboard.ts

# Terminal 2 — frontend
cd src/services/web-dashboard/frontend
npm run dev
# Acessa: http://localhost:5174
```

### Testes
```bash
npx jest --no-coverage --forceExit
```

### Build do frontend
```bash
cd src/services/web-dashboard/frontend
npm run build
# Gera em: src/services/web-dashboard/public/
```
