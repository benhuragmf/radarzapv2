# RadarZap — Etapa 04: Painel Administrativo, Deploy e Próximos Passos

---

## ⚠️ NOTA DE MIGRAÇÃO — Julho 2026

> **Decisão registrada em 30/05/2026**
>
> O backend atual usa **Express + MongoDB + Mongoose**.
> Em **julho de 2026**, migrar para a stack padrão do projeto:
>
> | Atual | Alvo |
> |-------|------|
> | Express | NestJS |
> | MongoDB + Mongoose | PostgreSQL + Prisma |
> | Sem auth estruturada | Better Auth ou Auth.js |
>
> O frontend (React + Vite + TypeScript + Tailwind + shadcn/ui) já será construído
> consumindo a API Express atual. Na migração de julho, apenas a camada de API
> muda — o frontend não precisa ser reescrito, só atualizar as URLs/contratos.
>
> **Stack padrão do projeto (referência para todos os novos projetos):**
> - Front-end: React + Vite + TypeScript
> - UI: TailwindCSS + shadcn/ui
> - Back-end: Node.js 24 LTS + NestJS
> - Banco: PostgreSQL + Prisma
> - Fila: Redis + BullMQ
> - Scraping: Playwright
> - Auth: Better Auth ou Auth.js
> - Deploy: Docker + Coolify
> - Bot: discord.js
> - Monitoramento: Sentry + logs

---

## Objetivo

Painel administrativo web para gerenciar sessões WhatsApp, regras, templates,
fila de mensagens e logs — tudo sem precisar usar comandos Discord.

---

## Parte 1 — Decisão de Arquitetura

**Escolha: Opção A — Frontend React consumindo API Express existente**

Motivo: mais rápido de entregar, não bloqueia o desenvolvimento do painel.
A migração do backend para NestJS + PostgreSQL está agendada para julho/2026.

### Stack do Frontend

```
React 18 + Vite + TypeScript
TailwindCSS + shadcn/ui
React Query (TanStack Query) para dados da API
Socket.IO client para atualizações em tempo real
React Router v6 para navegação
Recharts para gráficos
```

### Estrutura de pastas

```
src/services/web-dashboard/
├── public/                    ← frontend buildado (servido pelo Express)
└── frontend/                  ← código fonte React
    ├── src/
    │   ├── components/
    │   │   ├── ui/            ← shadcn/ui components
    │   │   ├── layout/        ← Sidebar, Header, Layout
    │   │   └── features/      ← componentes por feature
    │   ├── pages/
    │   │   ├── Dashboard.tsx
    │   │   ├── Sessions.tsx
    │   │   ├── Rules.tsx
    │   │   ├── Templates.tsx
    │   │   ├── Queue.tsx
    │   │   ├── Logs.tsx
    │   │   └── TestSend.tsx
    │   ├── hooks/             ← useStats, useSessions, useRules...
    │   ├── lib/               ← api client, socket client, utils
    │   └── main.tsx
    ├── index.html
    ├── vite.config.ts
    ├── tailwind.config.ts
    └── package.json
```

---

## Parte 2 — Telas

### 1. Dashboard Principal
- Status geral (online/offline por serviço)
- Sessões WhatsApp ativas
- Mensagens enviadas hoje / esta semana
- Erros nas últimas 24h
- Fila atual (pendentes, processando, falhas)
- Gráfico de mensagens por hora

### 2. Sessões WhatsApp
- Lista de sessões com status (connected / disconnected / connecting)
- Botão "Conectar" → exibe QR code inline via WebSocket
- Botão "Desconectar"
- Última atividade
- Contador de mensagens enviadas

### 3. Regras
- Lista com status (ativa/inativa) e contador de matches
- Toggle para ativar/desativar
- Criar nova regra (formulário)
- Editar regra existente
- Deletar regra

### 4. Templates
- Lista com preview
- Criar/editar template com variáveis destacadas
- Clonar template

### 5. Fila de Mensagens
- Pendentes / processando / falhas / concluídas
- Reenviar mensagem com falha
- Histórico recente com filtros

### 6. Logs
- Filtros: data, status, canal, destino, traceId
- Exportar CSV
- Detalhes de cada log com stack trace

### 7. Teste de Envio
- Selecionar destino
- Digitar mensagem ou escolher template
- Enviar e ver resultado em tempo real

---

## Parte 3 — API REST (endpoints necessários)

### Já existem
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/stats` | GET | Estatísticas gerais |
| `/api/system` | GET | Info do sistema |
| `/api/services/health` | GET | Saúde dos serviços |
| `/api/metrics/realtime` | GET | Métricas em tempo real |

### A adicionar no DashboardService
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/sessions` | GET | Listar sessões |
| `/api/sessions/:id/connect` | POST | Conectar sessão |
| `/api/sessions/:id/disconnect` | POST | Desconectar sessão |
| `/api/rules` | GET/POST | Listar / criar regras |
| `/api/rules/:id` | PUT/DELETE | Editar / deletar regra |
| `/api/rules/:id/toggle` | POST | Ativar/desativar regra |
| `/api/templates` | GET/POST | Listar / criar templates |
| `/api/templates/:id` | PUT/DELETE | Editar / deletar template |
| `/api/destinations` | GET | Listar destinos |
| `/api/queue` | GET | Estado da fila |
| `/api/queue/:id/retry` | POST | Reenviar mensagem |
| `/api/logs` | GET | Histórico com filtros |
| `/api/test-send` | POST | Envio de teste |

---

## Parte 4 — Deploy

### Docker Compose (atual — local)
```bash
docker compose up -d --build
docker compose logs -f
docker compose down
```

### Coolify (produção — julho 2026)
- Hospedar em VPS com Coolify
- Cada serviço como container separado
- Variáveis de ambiente via painel Coolify
- SSL automático via Let's Encrypt

### Variáveis de ambiente necessárias
```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
MONGODB_URL=
REDIS_URL=
JWT_SECRET=
SESSION_SECRET=
NODE_ENV=production
LOG_LEVEL=info
WHATSAPP_HEADLESS=true
QUEUE_CONCURRENCY=2
```

---

## Parte 5 — Checklist

### Frontend (Etapa 04 atual)
- [ ] Scaffold React + Vite + TypeScript + Tailwind + shadcn/ui
- [ ] Layout base (Sidebar + Header)
- [ ] Página Dashboard com stats em tempo real
- [ ] Página Sessões com QR code inline
- [ ] Página Regras (CRUD)
- [ ] Página Templates (CRUD)
- [ ] Página Fila
- [ ] Página Logs com filtros
- [ ] Página Teste de Envio
- [ ] Build integrado ao Docker do web-dashboard

### API (necessário para o frontend)
- [ ] Endpoints de sessões
- [ ] Endpoints de regras
- [ ] Endpoints de templates
- [ ] Endpoints de destinos
- [ ] Endpoints de fila
- [ ] Endpoints de logs
- [ ] Endpoint de teste de envio

### Migração Julho 2026
- [ ] Migrar backend para NestJS
- [ ] Migrar banco para PostgreSQL + Prisma
- [ ] Implementar Better Auth
- [ ] Deploy no Coolify
- [ ] Atualizar frontend para novos contratos de API
