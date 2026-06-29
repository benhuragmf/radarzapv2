# RadarZap Layout v3 02 — Inventário de Componentes Visuais

## 1. Objetivo

Mapear design system, componentes compartilhados e exceções antes de qualquer redesign. Este inventário separa o que já é padrão visual do RadarZap, o que ainda é local/antigo, e onde qualquer padronização pode afetar muitas telas.

## 2. Fontes analisadas

| Tipo | Arquivos |
|------|----------|
| Design system docs | `docs/DESIGN-SYSTEM.md` |
| Design system código | `src/services/web-dashboard/frontend/src/design-system/index.ts`, `design-system/components/*`, `design-system/formClasses.ts`, `design-system/tokens.ts`, `src/services/web-dashboard/frontend/src/index.css` |
| Layout global | `Layout.tsx`, `Sidebar.tsx`, `Header.tsx`, `HeaderStatusPills.tsx` |
| Telas críticas | `Dashboard.tsx`, `Inbox.tsx`, `InboxSupervisor.tsx`, `InboxTickets.tsx`, `WebChat.tsx`, `Leads.tsx`, `Destinations.tsx`, `Sessions.tsx`, `Plans.tsx`, `AdminDashboard.tsx` |
| Componentes por módulo | `components/inbox/*`, `components/webchat/*`, `components/leads/*`, `components/platform/*` |

## 3. Design system encontrado

| Componente/token | Arquivo | Uso principal | Telas que usam | Telas que não usam/uso parcial | Risco ao alterar | Recomendação |
|------------------|---------|---------------|----------------|-------------------------------|------------------|--------------|
| Tokens `--rz-*` | `index.css`, `tokens.ts` | Cores, superfície, texto, borda, status | Layout global, páginas novas, design system | Algumas classes Tailwind diretas ainda aparecem | Alto: muda todo painel | Alterar só com screenshot desktop/mobile |
| `RadarPageShell` | `design-system/components/RadarPageShell.tsx` | Container tenant padrão | Dashboard, Sessions, Destinations, Plans | Inbox usa layout especial; PlatformPage usa wrapper próprio | Médio | Manter como base de páginas comuns |
| `DashboardShell` | `DashboardShell.tsx` | Métricas e layout do dashboard | Dashboard tenant | Não usado em Admin/Inbox | Médio | Evoluir dashboard depois de inventário de dados |
| `PageHeader` | `PageHeader.tsx` | Título/subtítulo/ações | Dashboard, Sessions, Destinations, Plans, playground API | PlatformPage tem header próprio | Médio | Padronizar subtítulos por persona |
| `MetricCard` | `MetricCard.tsx` | KPIs | Dashboard, Destinations, Tickets | Vários módulos usam cards locais | Médio | Unificar KPI visual antes de dashboard novo |
| `FilterBar` | `FilterBar.tsx` | Filtros em linha | Design system disponível | Muitas telas têm filtros locais | Médio | Padronizar depois de mapear filtros críticos |
| `LoadingState` | `LoadingState.tsx` | Skeleton/carregamento | Dashboard, Sessions, Destinations, Inbox, WebChat, Leads, Tickets, Supervisor, Plans | Pode haver spinners locais | Baixo-médio | Criar padrão por densidade de tela |
| `EmptyState` | `EmptyState.tsx` | Tela vazia com orientação | Sessions, Destinations, WebChat, Leads, Tickets, Supervisor | Inbox tem estados próprios | Baixo | Padronizar texto com próxima ação |
| `ErrorState` | `ErrorState.tsx` | Erro visual | Exportado | Uso não confirmado nas telas críticas lidas | Baixo | Usar em próximas fases sem alterar API |
| `PermissionState` | `PermissionState.tsx` | Sem permissão | Exportado | Algumas telas usam EmptyState para sem permissão | Médio | Padronizar RBAC visual com cuidado |
| `StatusBadge` | `StatusBadge.tsx` | Badge semântico | Disponível | Muitos badges locais em Inbox/Tickets/Leads/WebChat | Médio | Migrar por módulo, não globalmente |
| `DataTable` | `DataTable.tsx` | Tabela simples | Disponível | Tabelas críticas locais | Alto em mobile | Padronizar só após QA de colunas |
| `SectionCard` | `SectionCard.tsx` | Bloco com título | Disponível | Páginas densas usam cards locais | Médio | Evitar cards dentro de cards |
| `ActionBar`, `SaveBar`, `ConfigSaveFooter` | `design-system/components/*` | Ações e salvar configuração | Configurações e editor futuros | WebChat tem save bar próprio | Médio | Usar em config sem tocar fluxo |
| `DetailsDrawer`, `ConfirmDialog` | `design-system/components/*` | Drawer/dialógo | Disponível | Vários módulos têm modais/drawers locais | Alto para ações destrutivas | Padronizar confirmações por risco |
| Helpers `inputCls`, `selectCls`, `textareaCls` | `formClasses.ts` | Campos nativos | Inbox, WebChat, Leads, Tickets | Formulários antigos podem usar classes locais | Baixo-médio | Migrar gradualmente |
| `searchFieldIconCls` | `formClasses.ts` | Ícone de busca | Inbox, WebChat, Tickets | Filtros locais | Baixo | Manter padrão de busca |
| `waPreviewPanelCls`, `discordPreviewPanelCls` | `formClasses.ts` | Preview WhatsApp/Discord | Previews | Específico | Médio | Não misturar com cards comuns |

## 4. Componentes globais

| Componente | Arquivo | Função | Risco visual |
|------------|---------|--------|--------------|
| `Layout` | `components/layout/Layout.tsx` | Shell principal, providers, sidebar/header, regra especial de Inbox | Alto: qualquer overflow/padding muda o painel todo |
| `Sidebar` | `components/layout/Sidebar.tsx` | Abas Plataforma/Discord/Admin, grupos, itens, alerts, mobile | Alto: menu + RBAC + responsividade |
| `Header` | `components/layout/Header.tsx` | Título, empresa, sino, status, tema, perfil, logout | Alto em 1366px/mobile |
| `HeaderStatusPills` | `components/layout/HeaderStatusPills.tsx` | Status WhatsApp e IA/LM por capability | Alto: custo, canal e permissões |
| `OrganizationSwitcher` | `components/layout/OrganizationSwitcher.tsx` | Troca de workspace | Alto: contexto tenant |
| `EventNotificationBell` | `components/layout/EventNotificationBell.tsx` | Alertas/notificações | Médio-alto |
| `AgentStatusSelector` | `components/layout/AgentStatusSelector.tsx` | Status operacional do atendente/supervisor | Alto: fila e disponibilidade |
| `PlatformPage` | `components/platform/PlatformPage.tsx` | Wrapper de páginas Plataforma | Médio: usado em módulos críticos |
| `DiscordPage` | Referenciado em docs | Wrapper Discord | Médio se existir/for usado |

## 5. Componentes críticos por módulo

| Módulo | Componentes encontrados | Estado visual | Risco |
|--------|------------------------|---------------|-------|
| Dashboard | `RadarPageShell`, `PageHeader`, `DashboardShell`, `MetricCard`, `LoadingState` | Usa design system bem | Médio: precisa dados novos para virar dashboard do dono |
| Inbox | `Inbox.tsx`, `InboxComposer`, `InboxMessageBubble`, `InboxContactDetailsPanel`, `InboxStatsRow`, `InboxAtendimentoNav`, `InboxChannelBadge`, `InboxDepartmentBadge`, `InboxLiveVisitors*`, `InboxEmptyChat`, `ContactAvatar` local | Mistura design system e componentes locais ricos | Alto: tela operacional central |
| Supervisor | `InboxSupervisor.tsx`, `SupervisorMonitorDrawer`, `ConversationRow`, `EmptyState`, `LoadingState` | Usa wrapper e estados, mas lógica visual própria | Alto: redistribuição e presença |
| Tickets | `InboxTickets`, `InboxTicketDetailView`, `InboxTicketActionsBar`, `TicketStatusBadge`, `ConversationStatusBadge`, `MetricCard`, `LoadingState`, `EmptyState` | Boa base, badges locais | Alto: status/SLA/deep link |
| WebChat | `WebChat`, `WebChatWidgetList`, `WebChatVisitorPanel`, `WebChatLivePreview`, `WebChatPreviewTemplates`, `WebChatWidgetEditorSection`, `WidgetSectionCard`, `ChatBox*`, `WebChatInstallSection`, `WebChatBusinessHoursEditor`, `WebChatWidgetSaveBar` | Muito completo e local | Alto: visitante, widget e configuração |
| Leads | `Leads`, `LeadStatsCards`, `LeadCapturesToolbar`, `LeadCaptureListTable`, `LeadKanbanBoard`, `LeadCaptureDetail`, `LeadIntegrationsPanel`, `LeadFormFieldsEditor`, `LeadWhatsAppPanel`, modais locais | Rich UI local com DS parcial | Alto: comercial + atendimento |
| Contatos | `Destinations.tsx`, `MetricCard`, `LoadingState`, `EmptyState`, consent UI | Usa DS, mas tem muitos estados CRM/consentimento | Alto: base de dados e LGPD |
| IA | `AiAtendimento.tsx`, header IA pills, docs IA créditos | Provável densidade técnica | Alto: custo e comportamento |
| Billing | `Plans.tsx`, Admin payments/plans | Usa `RadarPageShell`, `PageHeader`, `LoadingState` | Alto: financeiro |
| Admin | `AdminDashboard.tsx`, páginas `/admin/*` | Admin Ops e páginas auxiliares | Alto: global x tenant |

## 6. Componentes fora do padrão

| Achado | Onde | Por que importa | Ação futura |
|--------|------|-----------------|-------------|
| Badges locais de status | Inbox, Tickets, Leads, WebChat | Cada módulo pode dar cor diferente ao mesmo significado | Criar matriz de status antes de mexer |
| Cards locais e `WidgetSectionCard` | WebChat, Leads, Inbox | Podem duplicar `SectionCard`/`MetricCard` | Migrar por módulo, preservando layout |
| Modais/drawers locais | Leads, Supervisor, Tickets, WebChat | Confirmações e largura variam | Padronizar destrutivas primeiro |
| Tabelas locais | Leads, Tickets, Contatos, Admin | DataTable global não cobre todos os casos | Definir padrão responsivo antes |
| Classes Tailwind sem helper | Páginas antigas e módulos densos | Pode fugir dos tokens `--rz-*` | Inventariar por `rg` antes de Fase 4 |
| Texto técnico no header/labels | IA/LM, API, Logs, Billing, Inbox | Dono/atendente pode não entender | Criar glossário visual aprovado |

## 7. Padrão visual recomendado

| Elemento | Padrão recomendado |
|----------|--------------------|
| Títulos | Título curto por tarefa; subtítulo explica impacto para a persona |
| Subtítulos | Linguagem humana, sem termos internos quando a tela é de dono/atendente |
| Cards | Usar card só para item/bloco real; evitar card dentro de card |
| Ações principais | Uma ação principal por tela ou por item ativo |
| Botões secundários | Ações de apoio agrupadas; ícone quando familiar |
| Badges de status | Semântica única: ok, atenção, risco, bloqueio, andamento, IA, canal |
| Estados vazios | Sempre responder "o que faço agora?" |
| Tabelas | Colunas essenciais primeiro; detalhes em drawer no mobile |
| Formulários | `inputCls`, `selectCls`, `textareaCls`, footer de salvar consistente |
| Drawers/modais | Usar para detalhes e confirmações, com título e risco claros |
| Responsividade | Projetar por tarefa; Inbox não deve virar scroll de página comum |
| Dark/light | Validar contraste dos tokens e status em ambos |

## 8. Riscos ao padronizar

| Risco | Exemplo | Mitigação |
|-------|---------|-----------|
| Componente compartilhado usado por muitas telas | `RadarPageShell`, `PageHeader`, `MetricCard`, tokens `--rz-*` | Alterar em branch, com screenshots por rota |
| Mudança afetar Admin/Discord/Plataforma juntos | Sidebar, Header, tokens globais | Separar por modo quando necessário |
| CSS global arriscado | `index.css`, tokens, `.rz-sidebar`, classes de preview | Testar dark/light e 1366px/mobile |
| Quebra mobile | Sidebar, header pills, tabelas, Inbox 3 colunas | QA por viewport antes de avançar |
| Quebra de overflow da Inbox | `Layout.tsx` trata `/platform/inbox` com `overflow-hidden` | Não trocar por page shell comum |
| Exposição de informação | Header IA/WA, Admin, Billing, LGPD | Validar por perfil/RBAC |

## 9. Próxima execução recomendada

1. Fase 2: reorganizar menu e labels sem mudar rotas.
2. Fase 3: melhorar header operacional com foco em hierarquia e responsividade.
3. Fase 4: padronizar componentes compartilhados de menor risco: estados vazios, loading, subtítulos, botões secundários e filtros simples.
4. Deixar Inbox, WebChat, Leads, IA e Billing para fases próprias com QA dedicado.
