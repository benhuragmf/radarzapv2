# Menus do Radar Chat v2 — resumo e funções

Documento de referência para produto, suporte e desenvolvimento.  
Painel: `http://localhost:5174` · API: `/api`

---

## Três ambientes no topo

| Aba | Quem vê | Função |
|-----|---------|--------|
| **Plataforma** | Todos | Uso diário da empresa: envios, contatos, WhatsApp, automações, API |
| **Discord** | Quem tem servidor vinculado | Automação Discord → WhatsApp |
| **Admin** | Staff Radar Chat | Operação, clientes e sistema global |

O cliente **não** vê Operação, Gestão ou Fila global — isso fica só na aba **Admin**.

Configuração do menu: `src/services/web-dashboard/frontend/src/lib/navConfig.ts`

---

## 1. Plataforma

### Visão geral

| Menu | Rota | Função |
|------|------|--------|
| **Dashboard** | `/dashboard` | Métricas do dia, sessões, fila, falhas, gráfico e atalhos |
| **Relatórios** | `/platform/reports` | Logs e fila **do tenant** (sem aba admin) |
| **Auditoria** | `/platform/audit` | Resumo 7 dias: envios, erros, campanhas, contatos |

### Atendimento

| Menu | Rota | Função |
|------|------|--------|
| Atendimentos | `/platform/inbox` | Conversas WhatsApp/WebChat, fila de atendimento e deep link `?conv=` |
| Tickets / Solicitações | `/platform/inbox/tickets` | Chamados assíncronos, SLA e detalhe por referência |
| Supervisão | `/platform/inbox/supervisor` | Equipe, fila, redistribuição e monitoramento |
| Métricas de atendimento | `/platform/inbox/relatorios` | Relatórios de atendimento |
| Respostas rápidas | `/platform/inbox/respostas` | Atalhos e textos do atendimento |
| Setores | `/platform/inbox/setores` | Departamentos e roteamento |
| Triagem e Bot | `/platform/inbox/bot` | Bot, presença, SLA e fallback |
| IA de Atendimento | `/platform/inbox/ia` | IA, KB, testes, uso e créditos |
| Chat do Site | `/platform/webchat` | Widgets, histórico e configuração WebChat |

### Relacionamento

**Leads e contatos**

| Menu | Rota | Função |
|------|------|--------|
| Leads e Oportunidades | `/platform/leads` | Capturas, Kanban/lista, formulários e integração com atendimento |
| Contatos | `/contact` | CRUD, grupos de contato, tags |
| Listas e segmentos | `/platform/segmentos` | Grupos internos de segmentação |
| Importação de contatos | `/platform/contacts` | CSV e VCF |
| Grupos WhatsApp | `/grupos` | Destinos coletivos no WA |

**LGPD e Consentimento**

| Menu | Rota |
|------|------|
| Portal LGPD / Consentimento | `/platform/lgpd` |
| Pendentes | `/contact?consent=pending` |
| Aguardando aprovação | `/contact?consent=waiting` |
| Aceitos | `/contact?consent=accepted` |
| Recusados | `/contact?consent=refused` |
| Bloqueados | `/contact?consent=blocked` |

### Envios e campanhas

| Menu | Rota | Função |
|------|------|--------|
| Enviar agora | `/send` | Envio manual com validação LGPD |
| Campanhas | `/platform/campanhas` | Lotes pendentes e histórico |
| Agendamentos | `/send/agendamentos` | Envio único em data/hora futura |
| Histórico de envios | `/send/historico` | Campanhas já processadas |
| Modelos de mensagem | `/platform/templates` | Templates pw-* |
| Postagens de status | `/platform/wa-stories` | Status/postagens WhatsApp |
| Envios pendentes | `/platform/fila` | Fila de envio do tenant; não é fila de atendimento |

### Automações

| Menu | Rota |
|------|------|
| Regras automáticas | `/platform/automacoes` |
| Agendamentos automáticos | `/send/autoagendamentos` |
| Gatilhos | `/platform/gatilhos` |

### Canais

**Canais WhatsApp**

| Menu | Rota |
|------|------|
| Conectar WhatsApp | `/sessions` |
| Status da conexão | `/platform/wa-status` |
| Limites de envio | `/platform/wa-limits` |
| Logs WhatsApp | `/platform/wa-logs` |

### Empresa

| Menu | Rota |
|------|------|
| Configurações | `/settings` |
| Equipe | `/settings/team` |
| Papéis e permissões | `/settings/permissions` |
| Plano e cobrança | `/plans` |
| Segurança | `/settings/security` |
| Backup | `/settings/backup` |
| Chaves de API | `/settings#api-chaves` |
| Webhooks | `/settings#api-webhooks` |
| Testar API | `/integrations/playground` |
| Documentação da API | `/settings#api-docs` |
| Limites da API | `/settings#api-rate` |

---

## 2. Discord

Requer servidor selecionado na sidebar.

| Menu | Rota | Função |
|------|------|--------|
| Início Discord | `/discord` | Resumo: canais, regras, atalhos |
| Canais monitorados | `/discord/channels` | Canais vinculados ao bot |
| Regras e filtros | `/discord/rules` | Discord → WhatsApp |
| Formato da mensagem | `/discord/templates` | Templates dw-* |
| Contatos (destinos) | `/discord/contact` | Contatos no contexto Discord |
| Grupos WhatsApp | `/discord/grupos` | Grupos WA para regras |
| Fila Discord | `/discord/fila` | Fila da automação Discord |
| Histórico | `/discord/contact/historico` | Envios originados das regras |
| Logs | `/discord/logs` | Pipeline Discord → WhatsApp |
| Configurações do servidor | `/discord/settings` | Preferências do guild |

---

## 3. Admin Radar Chat

Somente staff (`isInternalStaff`). Aba **Admin**.

| Menu | Rota |
|------|------|
| Painel Admin Radar Chat | `/admin/dashboard` |
| Sessões WhatsApp globais | `/admin/sessions` |
| Fila global do sistema | `/admin/queue` |
| Logs globais | `/admin/logs` |
| Monitoramento | `/admin/monitoring` |
| Erros do sistema | `/admin/errors` |
| API global | `/admin/api` |
| Clientes | `/admin/clients` |
| Servidores | `/admin/servers` |
| Planos globais | `/admin/plans` |
| Pagamentos globais | `/admin/payments` |
| Moderação | `/admin/moderation` |
| Configurações gerais | `/admin/settings` |
| Modelo global de IA | `/admin/ai-blueprint` |
| IA global da plataforma | `/admin/ai-platform` |
| Permissões | `/admin/permissions` |
| Segurança | `/admin/security` |
| Backup | `/admin/backup` |
| Auditoria | `/admin/audit` |

---

## Referências

- Mapa técnico: `docs/MENU-PAGES-REGISTRY.md`

*Última atualização: Layout v3 Fase 2 — menu por tarefa/persona, filas por contexto e Admin SaaS global explícito.*
