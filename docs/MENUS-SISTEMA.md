# Menus do RadarZap v2 — resumo e funções

Documento de referência para produto, suporte e desenvolvimento.  
Painel: `http://localhost:5174` · API: `/api`

---

## Três ambientes no topo

| Aba | Quem vê | Função |
|-----|---------|--------|
| **Plataforma** | Todos | Uso diário da empresa: envios, contatos, WhatsApp, automações, API |
| **Discord** | Quem tem servidor vinculado | Automação Discord → WhatsApp |
| **Admin** | Staff RadarZap | Operação, clientes e sistema global |

O cliente **não** vê Operação, Gestão ou Fila global — isso fica só na aba **Admin**.

Configuração do menu: `src/services/web-dashboard/frontend/src/lib/navConfig.ts`

---

## 1. Plataforma

### Início

| Menu | Rota | Função |
|------|------|--------|
| **Início** | `/dashboard` | Métricas do dia: mensagens, sessões, fila, falhas, gráfico por hora |
| **Resumo da plataforma** | `/platform` | Cards do tenant: contatos, WA, fila, atalhos |
| **Relatórios** | `/platform/reports` | Logs e fila **do tenant** |
| **Auditoria** | `/platform/audit` | Resumo 7 dias: envios, erros, campanhas, contatos |

### Mensagens

| Menu | Rota | Função |
|------|------|--------|
| Enviar agora | `/send` | Envio manual: contatos, grupos WA, modelos pw-* |
| Campanhas | `/platform/campanhas` | Lotes pendentes e histórico de campanhas |
| Agendamentos | `/send/agendamentos` | Envio único em data/hora futura |
| Histórico | `/send/historico` | Campanhas já processadas |
| Modelos | `/platform/templates` | Templates pw-* (aniversário, campanhas, etc.) |

### Contatos

| Menu | Rota | Função |
|------|------|--------|
| Contatos | `/contact` | CRUD, grupos de contato (sidebar), consentimento |
| Segmentos | `/platform/segmentos` | Visão dos grupos de contato |
| Grupos WhatsApp | `/grupos` | Destinos coletivos no WA |
| Importar / Exportar | `/platform/contacts` | CSV e VCF |
| Pendentes / Aceitos / Recusados / Bloqueados | `/contact?consent=…` | Filtros LGPD |

> **Contato** — cadastro individual (nome, telefone, tags, birthday, grupos de contato).  
> **Grupo de contato** — segmento interno para filtros (≠ grupo WhatsApp).  
> **Grupo WhatsApp** — destino `type: group` para envio ao grupo.

### Automações

| Menu | Rota | Função |
|------|------|--------|
| Regras automáticas | `/platform/automacoes` | Gatilhos, destinos, modelos ou texto manual |
| Gatilhos | `/platform/gatilhos` | Guia dos tipos de gatilho |

### WhatsApp

| Menu | Rota | Função |
|------|------|--------|
| Sessões e QR Code | `/sessions` | Conectar WA, QR, desconectar (QR dentro desta tela) |
| Status | `/platform/wa-status` | Monitoramento das sessões |
| Fila de envio | `/platform/fila` | Fila **do tenant** |
| Logs | `/platform/wa-logs` | Logs WhatsAppService do tenant |

### Integrações

| Menu | Rota | Função |
|------|------|--------|
| Chaves de API | `/settings#api-chaves` | Gerar/revogar `X-API-Key` |
| Webhooks | `/settings#api-webhooks` | URLs HTTPS para eventos |
| Playground | `/send#playground` | Teste de envio via API |
| Documentação | `/settings#api-docs` | OpenAPI do painel |
| Limites da API | `/settings#api-rate` | Cota do plano e janela de requests |

### Empresa

| Menu | Rota | Função |
|------|------|--------|
| Minha empresa | `/settings` | Conta, plano, integrações API |
| Equipe e cargos | `/settings/team` | Convites OWNER / ADMIN / ATTENDANT |
| Plano e limites | `/plans` | Plano e cotas |
| Permissões | `/settings/permissions` | Papéis da empresa |
| Segurança | `/settings/security` | Chaves e boas práticas |
| Backup | `/settings/backup` | Export CSV de contatos |

---

## 2. Discord

Requer servidor selecionado no topo da sidebar.

### Início Discord

| Menu | Rota | Função |
|------|------|--------|
| Visão geral | `/discord/channels` | Entrada da automação (canais monitorados) |

### Automação Discord

| Menu | Rota | Função |
|------|------|--------|
| Canais monitorados | `/discord/channels` | Canais vinculados ao bot |
| Regras e filtros | `/discord/rules` | Discord → WhatsApp, destinos, bloqueio por grupo |
| Formato da mensagem | `/discord/templates` | Templates dw-* |

### Destinos WhatsApp

| Menu | Rota | Função |
|------|------|--------|
| Contatos | `/discord/contact` | Contatos no contexto Discord |
| Grupos WhatsApp | `/discord/grupos` | Grupos WA para regras |

### Monitoramento

| Menu | Rota | Função |
|------|------|--------|
| Fila | `/discord/fila` | Fila da automação Discord |
| Histórico | `/discord/contact/historico` | Envios originados das regras |
| Logs | `/discord/logs` | Pipeline Discord → WhatsApp |

### Servidor

| Menu | Rota | Função |
|------|------|--------|
| Configurações | `/discord/settings` | Preferências do guild |

---

## 3. Admin RadarZap

Somente staff (`isInternalStaff`). Aba **Admin** — separada da Plataforma.

### Início

| Menu | Rota | Função |
|------|------|--------|
| Início global | `/admin/dashboard` | Dashboard interno RadarZap |

### Operação

| Menu | Rota | Função |
|------|------|--------|
| Sessões WhatsApp | `/admin/sessions` | Todas as sessões |
| Fila global | `/admin/queue` | BullMQ sem filtro de tenant |
| Logs globais | `/admin/logs` | SystemLog de todos os clientes |
| Monitoramento | `/admin/monitoring` | Saúde MongoDB/Redis + stats |
| Erros do sistema | `/admin/errors` | Logs error 24h |
| Integrações globais | `/admin/api` | Visão admin de API |

### Clientes e planos

| Menu | Rota | Função |
|------|------|--------|
| Clientes | `/admin/clients` | Usuários e organizações |
| Servidores | `/admin/servers` | WA + Discord agregado |
| Planos | `/admin/plans` | Gestão de planos |
| Pagamentos | `/admin/payments` | Pagamentos |
| Moderação | `/admin/moderation` | Bloqueios e consentimento |

### Sistema

| Menu | Rota | Função |
|------|------|--------|
| Configurações gerais | `/admin/settings` | Health dos serviços |
| Auditoria | `/admin/audit` | AuditLog administrativo |

---

## Glossário

| Termo | Significado |
|-------|-------------|
| Contato | Pessoa (E.164) cadastrada |
| Grupo de contato | Segmento interno — filtro em envios |
| Grupo WhatsApp | Destino coletivo no WA |
| Campanha | Lote enfileirado (manual ou agendado) |
| Automação | Regra com gatilho (recorrente ou única) |
| Template pw-* | Modelo plataforma |
| Template dw-* | Modelo Discord → WhatsApp |

---

## Referências

- Mapa técnico rota → código: `docs/MENU-PAGES-REGISTRY.md`
- Regra IA para evoluir menus: `.cursor/rules/menu-content-automatic.mdc`

*Última atualização: reorganização menu SaaS (Plataforma / Discord / Admin).*
