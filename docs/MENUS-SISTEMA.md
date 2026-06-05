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
| **Visão geral** | `/dashboard` | Métricas do dia, sessões, fila, falhas, gráfico e atalhos |
| **Relatórios** | `/platform/reports` | Logs e fila **do tenant** (sem aba admin) |
| **Auditoria** | `/platform/audit` | Resumo 7 dias: envios, erros, campanhas, contatos |

### Mensagens

| Menu | Rota | Função |
|------|------|--------|
| Enviar agora | `/send` | Envio manual com validação LGPD |
| Campanhas | `/platform/campanhas` | Lotes pendentes e histórico |
| Agendamentos | `/send/agendamentos` | Envio único em data/hora futura |
| Histórico de envios | `/send/historico` | Campanhas já processadas |
| Modelos | `/platform/templates` | Templates pw-* |

### Contatos

| Menu | Rota | Função |
|------|------|--------|
| Contatos | `/contact` | CRUD, grupos de contato, tags |
| Segmentos / Listas | `/platform/segmentos` | Grupos internos de segmentação |
| Grupos WhatsApp | `/grupos` | Destinos coletivos no WA |
| Importar / Exportar | `/platform/contacts` | CSV e VCF |

**Consentimento** (grupo separado):

| Menu | Rota |
|------|------|
| Pendentes | `/contact?consent=pending` |
| Aceitos | `/contact?consent=accepted` |
| Recusados | `/contact?consent=refused` |
| Bloqueados | `/contact?consent=blocked` |

### Automações

| Menu | Rota |
|------|------|
| Regras automáticas | `/platform/automacoes` |
| Gatilhos | `/platform/gatilhos` |

### WhatsApp

| Menu | Rota |
|------|------|
| Sessões e QR Code | `/sessions` |
| Status das conexões | `/platform/wa-status` |
| Fila de envio | `/platform/fila` |
| Logs | `/platform/wa-logs` |

### Integrações

| Menu | Rota |
|------|------|
| Chaves de API | `/settings#api-chaves` |
| Webhooks | `/settings#api-webhooks` |
| Playground | `/integrations/playground` |
| Documentação | `/settings#api-docs` |
| Limites da API | `/settings#api-rate` |

### Empresa

| Menu | Rota |
|------|------|
| Minha empresa | `/settings` |
| Equipe e cargos | `/settings/team` |
| Plano e limites | `/plans` |
| Permissões | `/settings/permissions` |
| Segurança | `/settings/security` |
| Backup | `/settings/backup` |

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
| Fila | `/discord/fila` | Fila da automação |
| Histórico | `/discord/contact/historico` | Envios originados das regras |
| Logs | `/discord/logs` | Pipeline Discord → WhatsApp |
| Configurações do servidor | `/discord/settings` | Preferências do guild |

---

## 3. Admin RadarZap

Somente staff (`isInternalStaff`). Aba **Admin**.

| Menu | Rota |
|------|------|
| Dashboard global | `/admin/dashboard` |
| Sessões WhatsApp | `/admin/sessions` |
| Fila global | `/admin/queue` |
| Logs globais | `/admin/logs` |
| Monitoramento | `/admin/monitoring` |
| Erros do sistema | `/admin/errors` |
| API global | `/admin/api` |
| Clientes | `/admin/clients` |
| Servidores | `/admin/servers` |
| Planos | `/admin/plans` |
| Pagamentos | `/admin/payments` |
| Moderação | `/admin/moderation` |
| Configurações gerais | `/admin/settings` |
| Permissões | `/admin/permissions` |
| Segurança | `/admin/security` |
| Backup | `/admin/backup` |
| Auditoria | `/admin/audit` |

---

## Referências

- Mapa técnico: `docs/MENU-PAGES-REGISTRY.md`
- Regra IA: `.cursor/rules/menu-content-automatic.mdc`

*Última atualização: alinhamento menu ↔ spec produto (Visão geral única, Consentimento, Discord Home, Admin Sistema).*
