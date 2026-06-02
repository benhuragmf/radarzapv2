# RadarZap — Etapa 01: Visão Geral e Documentação do Sistema

## O que é o RadarZap?

O RadarZap é um sistema que captura mensagens enviadas em canais específicos do Discord e replica essas mensagens automaticamente no WhatsApp. A ideia central é simples: uma mensagem postada em um canal do Discord chega automaticamente para um grupo, uma pessoa ou vários destinos configurados no WhatsApp.

O sistema foi projetado para ser profissional, seguro e escalável — com suporte a múltiplas sessões, regras de filtro, fila de envio, templates de mensagem, proteção anti-spam e painel administrativo.

---

## Fluxo Principal

```
Discord
  ↓
Captura a mensagem
  ↓
Aplica regras e filtros
  ↓
Verifica duplicidade
  ↓
Aplica template
  ↓
Entra na fila (BullMQ)
  ↓
Aguarda delay seguro
  ↓
Envia para WhatsApp (Baileys)
  ↓
Salva log
  ↓
Atualiza painel
```

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js + TypeScript |
| Discord | discord.js v14 |
| WhatsApp | @whiskeysockets/baileys |
| Banco de dados | MongoDB + Mongoose |
| Cache e filas | Redis + BullMQ |
| Containerização | Docker + Docker Compose |
| Painel web | (Etapa 06 — React + Vite + TypeScript) |

---

## Módulos do Sistema

### 1. Discord Listener
Monitora canais configurados e captura mensagens de bots, usuários e admins.
Extrai: texto, embeds, links, imagens, autor, canal, servidor, timestamp.

### 2. Rules Engine
Aplica filtros antes de qualquer envio:
- Canal de origem
- Autor (bot específico, usuário, admin)
- Palavras-chave obrigatórias ou proibidas
- Presença de link, imagem ou embed
- Deduplicação por hash de conteúdo

### 3. Template Engine
Formata a mensagem antes de enviar ao WhatsApp.
Variáveis disponíveis: `{servidor}`, `{canal}`, `{autor}`, `{mensagem}`, `{link}`, `{data}`, `{hora}`.

### 4. Queue Service (BullMQ)
Controla a ordem, prioridade, delay e retentativas de envio.
Prioridades: Alta / Média / Baixa.

### 5. WhatsApp Service (Baileys)
Gerencia sessões, envia mensagens, valida destinos, controla rate limit.
Suporte a múltiplas sessões simultâneas.

### 6. Anti-Spam e Proteção
Delay entre mensagens, limite por minuto, cooldown por grupo, bloqueio de duplicatas, pausa automática em caso de erros.

### 7. Logs e Histórico
Registra cada mensagem capturada, processada, enviada ou com falha.

### 8. Painel Administrativo
Interface web para configurar tudo: sessões, regras, templates, fila, logs.

---

## Tipos de Destino no WhatsApp

- Grupo do WhatsApp
- Pessoa específica (número)
- Várias pessoas
- Vários grupos
- Combinação de grupos e pessoas

---

## Sistema de Prioridade

| Prioridade | Exemplos |
|-----------|---------|
| Alta (8-10) | Alerta importante, live iniciada, promoção 100%, mensagem de admin |
| Média (4-7) | Promoção comum, aviso normal |
| Baixa (1-3) | Mensagens gerais |

---

## Multi-sessão

Cada sessão WhatsApp é independente e possui:
- Seus próprios grupos e contatos
- Suas próprias regras e templates
- Seus próprios limites de envio
- Seu próprio histórico de logs

Casos de uso: administrador, cliente premium, empresa por servidor Discord.

---

## Deduplicação

O sistema gera um hash do conteúdo da mensagem e verifica se já foi enviado recentemente (janela configurável, padrão 6 horas). Se sim, descarta silenciosamente e registra no log.

---

## Reenvio Inteligente

Se o WhatsApp cair ou retornar erro:
1. Mensagem permanece na fila com status `pending`
2. Sistema tenta reconectar automaticamente
3. Após reconexão, reprocessa a fila
4. Se falhar N vezes (configurável), marca como `failed` e notifica no painel ou canal Discord admin

---

## Conformidade (LGPD/GDPR)

- Consentimento registrado por destino
- Possibilidade de revogar consentimento
- Logs de auditoria completos
- Limpeza automática de destinos inválidos

---

## Arquivos Existentes Relevantes

| Arquivo | Status | Descrição |
|---------|--------|-----------|
| `src/services/whatsapp/WhatsAppService.ts` | ✅ Completo | Sessões, envio, validação, rate limit |
| `src/services/whatsapp/WhatsAppServiceIntegration.ts` | ✅ Completo | Integração com fila |
| `src/services/whatsapp/MessageFormatter.ts` | ✅ Completo | Formatação de mensagens |
| `src/services/discord-bot/DiscordBotService.ts` | ✅ Completo | Listener + reconexão |
| `src/services/discord-bot/CommandHandler.ts` | ✅ Completo | Comandos slash |
| `src/services/discord-bot/MessageExtractor.ts` | ✅ Completo | Extração generalizada: texto, embeds, links, imagens, hash |
| `src/services/templates/TemplateEngine.ts` | ✅ Completo | Motor de templates |
| `src/services/templates/TemplateController.ts` | ✅ Completo | API REST de templates |
| `src/services/web-dashboard/DashboardService.ts` | ⚠️ Parcial | Backend do painel, sem frontend |
| `src/services/queue/QueueProcessorService.ts` | ✅ Completo | Processador de filas |
| `src/cache/QueueManager.ts` | ✅ Completo | Gerenciador BullMQ |
| `src/cache/RateLimiter.ts` | ✅ Completo | Rate limiting |
| `src/cache/SessionCache.ts` | ✅ Completo | Cache de sessões |
| `src/models/` | ✅ Completo | 7 modelos: User, Session, Channel, Queue, Template, Destination, Log |
| `src/services/common/CircuitBreaker.ts` | ✅ Completo | Circuit breaker |

---

## Documentação do Projeto

| Arquivo | Conteúdo |
|---------|---------|
| `docs/RADARZAP-01-VISAO-GERAL.md` | Visão geral, módulos, stack, arquivos existentes |
| `docs/RADARZAP-02-CAPTURA-DISCORD.md` | Pipeline de captura Discord, o que falta implementar |
| `docs/RADARZAP-03-REGRAS-TEMPLATES-FILA.md` | Rules Engine, Templates, Fila, Deduplicação |
| `docs/RADARZAP-04-PAINEL-DEPLOY-PROXIMOS-PASSOS.md` | Painel, Deploy, Roadmap, Checklist |
| `src/services/whatsapp/README.md` | Documentação técnica do WhatsApp Service |

---

## Próximas Etapas

- **Etapa 02** — Captura Discord: generalizar o MessageExtractor, implementar pipeline completo
- **Etapa 03** — Rules Engine: criar motor de regras e filtros
- **Etapa 04** — Fila e Segurança: consolidar BullMQ, anti-spam, retry inteligente
- **Etapa 05** — Painel Administrativo: frontend React + Vite
