# Radar Chat — Upgrade visual do módulo Atendimento

**Versão:** 2.10.18 · **Data:** 2026-06-18

Escopo desta entrega: aprimoramento visual e UX das telas de atendimento com base nos mockups em `mocker/`. IA Atendimento e Relatórios Inbox receberam polish alinhado ao design system (sem mockup dedicado).

## Referências visuais (`mocker/`)

| Menu | Arquivo |
|------|---------|
| Inbox | `inbox.png` |
| Tickets | `ticket.png` |
| Setores | `setores.png` |
| Bot | `botinbox.png` |
| Respostas rápidas | `respostarapida.png` |
| Supervisor | `supervisor.png` |
| Site — histórico | `site historio.png` |
| Site — widgets | `site historio2.png` |

## Componentes criados

| Componente | Caminho |
|------------|---------|
| `InboxStatsRow` | `frontend/src/components/inbox/InboxStatsRow.tsx` |
| `InboxChannelBadge` | `frontend/src/components/inbox/InboxChannelBadge.tsx` |
| `InboxEmptyChat` | `frontend/src/components/inbox/InboxEmptyChat.tsx` |
| `InboxBotFlowPreview` | `frontend/src/components/inbox/InboxBotFlowPreview.tsx` |
| `InboxContactDetailsPanel` | `frontend/src/components/inbox/InboxContactDetailsPanel.tsx` — 3ª coluna do Inbox |
| `WebChatVisitorPanel` | `frontend/src/components/webchat/WebChatVisitorPanel.tsx` — 3ª coluna do histórico site |

## Componentes modificados

| Componente | Alteração |
|------------|-----------|
| `InboxAtendimentoNav` | Scroll horizontal, destaque de aba ativa corrigido |
| `Inbox.tsx` | Métricas, estado vazio, filtro Encerrados, **3ª coluna** (contato + notas + histórico), abas Responder/**Chat interno** |
| `InboxComposer.tsx` | Abas Responder / **Chat interno** (timeline só equipe; supervisor + atendente) |
| `InboxTickets.tsx` | Métricas, erro/vazio, coluna Ações, **paginação server-side** (15/página) |
| `InboxSectors.tsx` | Nav secundária, cards de métricas |
| `InboxBotSettings.tsx` | Nav, prévia WhatsApp ao vivo, contador de caracteres, salvar destacado |
| `InboxQuickReplies.tsx` | Busca, filtros por categoria, painel de prévia |
| `InboxSupervisor.tsx` | Dashboard com métricas, equipe online, ações rápidas |
| `WebChat.tsx` | Layout 3 colunas, busca, painel visitante, métricas, **aba Widgets** com stats, cards e instalação |
| `AiAtendimento.tsx` | Nav do módulo, métricas de uso/skills, abas estilizadas, salvar fixo |
| `InboxReports.tsx` | Nav, métricas, tabelas por setor/atendente, estados vazio/erro |

## Backend

| Alteração | Arquivo |
|-----------|---------|
| Filtro `status=closed` inclui `resolved` e `closed` | `InboxService.listConversations` |
| `WebChatConversationDto` expõe `userAgent` e `createdAt` | `WebChatService.toConversationDto` |

## APIs utilizadas (sem novas rotas)

- `GET /inbox/conversations`
- `GET /inbox/tickets` — query `page`, `limit` (máx. 100); resposta `{ items, total, page, limit }`
- `GET /inbox/tickets/stats`
- `GET /inbox/departments`, `/inbox/settings`, `/inbox/quick-replies`
- `GET /inbox/supervisor/queue`, `/inbox/members`
- `GET /webchat/stats`, `/webchat/widgets`, `/webchat/conversations`
- `GET /sessions` (status WhatsApp no Inbox)

## Pendências

Nenhuma pendência conhecida desta entrega.

## QA manual sugerido

1. `/platform/inbox` — métricas, filtros, estado vazio, conversa WA e site
2. `/platform/inbox/tickets` — métricas, busca, paginação server-side (15/página), erro simulado (API off)
3. `/platform/inbox/setores` — métricas, criar/editar setor
4. `/platform/inbox/bot` — prévia atualiza ao editar textos, salvar
5. `/platform/inbox/respostas` — busca, prévia `/bd`
6. `/platform/inbox/supervisor` — fila, reatribuir
7. `/platform/webchat` — abas Histórico/Widgets, nav secundária, métricas widgets, snippet instalação
8. `/platform/inbox/ia` — métricas, abas, salvar fixo
9. `/platform/inbox/relatorios` — período, métricas, tabelas
