# Radar Chat Layout v3 01 — Inventário de Rotas, Menus e RBAC

## 1. Objetivo

Este arquivo mapeia rotas, menus e permissões antes de qualquer alteração visual no Radar Chat Layout v3. A meta é registrar o estado real do painel para que as próximas fases possam reorganizar navegação e linguagem sem quebrar RBAC, redirects, deep links, atendimento, WhatsApp, WebChat, IA ou billing.

## 2. Branch e estado Git

| Item | Estado |
|------|--------|
| Branch atual | `layout-v3` |
| Base observada | `66324ee docs: registrar resultados do release gate` |
| `main` e `develop` | Não foram alteradas nesta etapa; não houve checkout, merge ou commit nessas branches |
| Arquivos já não versionados antes da etapa | `data/`, `mocker/modelochat/`, `docs/RADARCHAT-UX-VISUAL-01-DIAGNOSTICO-GERAL.md`, `docs/RADARCHAT-UX-VISUAL-02-NOVA-ORGANIZACAO-E-CONCEITO.md`, `docs/RADARCHAT-UX-VISUAL-03-PLANO-DE-EXECUCAO-E-QA.md` |
| Arquivos criados nesta etapa | Este arquivo e os demais `RADARCHAT-LAYOUT-V3-0*.md` |
| Código de produção | Não alterado nesta etapa |

## 3. Fontes analisadas

| Tipo | Arquivos |
|------|----------|
| Docs UX base | `docs/RADARCHAT-UX-VISUAL-01-DIAGNOSTICO-GERAL.md`, `docs/RADARCHAT-UX-VISUAL-02-NOVA-ORGANIZACAO-E-CONCEITO.md`, `docs/RADARCHAT-UX-VISUAL-03-PLANO-DE-EXECUCAO-E-QA.md` |
| Docs oficiais | `docs/INDICE-DOCUMENTACAO.md`, `docs/CHANGELOG.md`, `docs/VERSIONAMENTO-E-DOCUMENTACAO.md`, `docs/SISTEMA-REGISTRO.md`, `docs/MENUS-SISTEMA.md`, `docs/MENU-PAGES-REGISTRY.md`, `docs/EQUIPE-RBAC.md`, `docs/DESIGN-SYSTEM.md` |
| Rotas e navegação | `src/services/web-dashboard/frontend/src/App.tsx`, `src/services/web-dashboard/frontend/src/lib/navConfig.ts`, `src/services/web-dashboard/frontend/src/components/ProtectedRoute.tsx` |
| RBAC | `src/auth/rbac/capabilities.ts`, docs de equipe/RBAC |
| Layout global | `Layout.tsx`, `Sidebar.tsx`, `Header.tsx`, `HeaderStatusPills.tsx` |
| Scripts e gates | `package.json` |

## 4. Mapa de rotas principais

| Rota | Nome visual atual | Módulo | Público principal | Componente/página | Proteção/RBAC | Menu atual | Observação | Risco se renomear/mover |
|------|-------------------|--------|-------------------|-------------------|---------------|------------|------------|-------------------------|
| `/dashboard` | Visão geral | Empresa | Dono, admin, gestor | `Dashboard.tsx` | `dashboard:view` | Plataforma > Início | Dashboard tenant ainda é mais técnico que executivo | Médio: rota home e título global |
| `/dashboard/notificacoes` | Notificações | Empresa | Todos autorizados | `DashboardNotifications.tsx` | `dashboard:view` | Sino/header | Alertas operacionais ficam fora do dashboard | Baixo se label; médio se fluxo |
| `/platform/reports` | Relatórios | Gestão | Dono, gestor | `PlatformReports.tsx` | `platform:reports:view` | Plataforma > Início | Relatórios gerais, classificação e filas | Médio: pode confundir com métricas Inbox |
| `/platform/audit` | Auditoria | Gestão | Dono, admin | `PlatformAudit.tsx` | `platform:audit:view` | Plataforma > Início | Auditoria tenant | Médio: sensibilidade de logs |
| `/send` | Enviar agora | Envios | Marketing, dono | `SendNow.tsx` | `send:test` | Envios WhatsApp | Também redireciona hash legado | Médio: deep links e campanhas |
| `/platform/campanhas` | Campanhas | Envios | Marketing, dono | `PlatformCampaigns.tsx` | `send:test` | Envios WhatsApp | Jornada de envio em rota própria | Médio |
| `/send/agendamentos` | Agendamentos | Envios | Marketing | `SendSchedules.tsx` | `send:schedule:manage` | Envios WhatsApp | Histórico/agenda | Baixo |
| `/send/autoagendamentos` | Agendamentos automáticos | Automações | Admin, gestor | `SendAutoSchedules.tsx` | `send:schedule:manage` | Automações | Próximo de automações e envios | Médio |
| `/send/historico` | Histórico de envios | Envios | Marketing, dono | `SendHistory.tsx` | `send:test` | Envios WhatsApp | Histórico técnico/operacional | Baixo |
| `/platform/templates` | Modelos de mensagem | Envios | Marketing, admin | `PlatformTemplates.tsx` | `send:templates:manage` | Envios WhatsApp | Templates WA | Baixo |
| `/platform/inbox` | Caixa de Entrada | Atendimento | Atendente, supervisor | `Inbox.tsx` | `inbox:view` | Atendimento | Rota crítica; deep link `?conv=` | Alto: fluxo central de atendimento |
| `/platform/inbox/tickets` | Chamados | Atendimento | Atendente, supervisor | `InboxTickets.tsx` | `inbox:view` | Atendimento | Tickets/chamados assíncronos | Alto: nomenclatura e SLA |
| `/platform/inbox/tickets/:ref` | Detalhe de chamado | Atendimento | Atendente, suporte | `InboxTicketDetail.tsx` | Usa path base `/platform/inbox/tickets` | Link profundo | Rota por referência TK | Alto: deep links de suporte |
| `/platform/inbox/setores` | Setores | Atendimento | Admin, supervisor | `InboxSectors.tsx` | `inbox:department:manage` | Atendimento | Configuração operacional | Médio-alto: afeta fila |
| `/platform/inbox/bot` | Triagem e Bot | Atendimento | Dono, admin | `InboxBotSettings.tsx` | `inbox:department:manage` | Atendimento | SLA, presença, fallback e bot | Alto: altera comportamento de atendimento se mexer depois |
| `/platform/inbox/ia` | IA de Atendimento | IA | Dono, admin | `AiAtendimento.tsx` | `inbox:ai:manage` | Atendimento | Configuração IA/KB/custos | Alto: custo, risco e permissões |
| `/platform/inbox/respostas` | Respostas rápidas | Atendimento | Atendente/admin | `InboxQuickReplies.tsx` | `inbox:department:manage` | Atendimento | Apoia composer | Médio |
| `/platform/inbox/supervisor` | Supervisão | Atendimento | Supervisor | `InboxSupervisor.tsx` | `inbox:supervise` | Atendimento | Fila, equipe e redistribuição | Alto: status `supervisor_online` |
| `/platform/inbox/relatorios` | Métricas | Atendimento | Supervisor, dono | `InboxReports.tsx` | `inbox:reports:view` | Atendimento | Métricas de atendimento | Médio |
| `/platform/webchat` | Chat do Site | WebChat | Dono, admin, atendente | `WebChat.tsx` | `webchat:view` | Atendimento | Histórico, widgets, editor e preview | Alto: mistura operação e configuração |
| `/platform/leads` | Leads | Comercial | Dono, comercial | `Leads.tsx` | `leads:view` ou fallback `consent:view` no guard | Contatos | Kanban/lista/formulários/segmentos | Alto: conceito Lead x Contato |
| `/contact` | Contatos | Relacionamento | Atendente, marketing | `Destinations.tsx` | `consent:view` | Contatos/Consentimento | Usa query `?consent=` | Alto: deep links de consentimento |
| `/platform/contacts` | Importar / Exportar | Contatos | Admin/marketing | `PlatformContacts.tsx` | `consent:view` | Contatos | Parece segunda tela de contatos | Médio |
| `/platform/segmentos` | Listas e segmentos | Contatos | Marketing | `ContactSegments.tsx` | `send:destination:manage` | Contatos | Segmentos/listas | Médio |
| `/grupos` | Grupos WhatsApp | Contatos | Marketing | `WhatsAppGroups.tsx` | `send:destination:manage` | Contatos | Destinos WA | Médio |
| `/platform/lgpd` | Portal LGPD | LGPD | Dono, admin | `LgpdPortal.tsx` | `consent:view` | Consentimento | Dados, export/anonymize/eventos | Alto: segurança e privacidade |
| `/platform/automacoes` | Regras de automação | Automações | Dono, admin | `PlatformAutomations.tsx` | `send:schedule:manage` | Automações | Regras tenant | Médio |
| `/platform/gatilhos` | Gatilhos | Automações | Dono, admin | `PlatformTriggers.tsx` | `send:schedule:manage` | Automações | Linka para automações | Baixo-médio |
| `/sessions` | Conexão WhatsApp | WhatsApp | Dono, admin | `Sessions.tsx` | `whatsapp:session:view` | WhatsApp | QR/conexão; header pode linkar aqui | Alto: canal crítico |
| `/platform/wa-status` | Status da conexão | WhatsApp | Dono, admin | `WaStatus.tsx` | `whatsapp:session:view` | WhatsApp | Saúde/logs da sessão | Médio |
| `/platform/wa-limits` | Limites de envio | WhatsApp | Dono, admin | `WhatsAppSendLimitsPage.tsx` | `whatsapp:session:manage` | WhatsApp | Limites e buckets | Médio-alto |
| `/platform/fila` | Fila de envio | WhatsApp/envios | Dono, admin | `Queue.tsx` tenant | `queue:view` | WhatsApp | Não é fila de atendimento | Alto se label ficar ambígua |
| `/platform/wa-logs` | Logs WhatsApp | WhatsApp | Admin | `WaLogs.tsx` | `logs:view` | WhatsApp | Logs técnicos tenant | Médio |
| `/plans` | Plano e cobrança | Billing | Dono/financeiro | `Plans.tsx` | `billing:view` | Empresa | Plano, limites e cobrança | Alto: dados financeiros |
| `/settings` | Configurações da empresa | Empresa | Dono/admin | `Settings.tsx` | `account:settings` | Empresa | Perfil e integrações por hash | Médio |
| `/settings/team` | Equipe e permissões | Empresa/RBAC | Dono/admin | `TeamMembers.tsx` | `company:members:manage` | Empresa | Equipe e papéis | Alto: RBAC |
| `/settings/permissions` | Papéis e permissões | Empresa/RBAC | Dono/admin | `PermissionsPage.tsx` | `company:members:manage` | Empresa | Próximo de equipe | Alto: RBAC |
| `/settings/security` | Segurança | Empresa | Dono/admin | `SecuritySettings.tsx` | `account:settings` | Empresa | Segurança tenant | Médio |
| `/settings/backup` | Backup | Empresa | Dono/admin | `BackupExport.tsx` | `account:settings` | Empresa | Export/import tenant | Médio-alto |
| `/integrations/playground` | Testar API | Integrações | Dev/admin | `ApiPlaygroundPage` | `send:test` | Integrações | Substitui hash `/send#playground` | Médio |

## 5. Mapa do menu Plataforma

| Grupo | Item | Rota | Label | Capability/permissão | Público | Problema visual | Sugestão futura |
|-------|------|------|-------|----------------------|---------|-----------------|-----------------|
| Início | Visão geral | `/dashboard` | Visão geral | `dashboard:view` | Todos | Dashboard não responde tudo para dono | Evoluir para "Agora" executivo |
| Início | Relatórios | `/platform/reports` | Relatórios | `platform:reports:view` | Dono/gestor | Pode competir com Métricas Inbox | Explicar escopo geral |
| Início | Auditoria | `/platform/audit` | Auditoria | `platform:audit:view` | Dono/admin | Termo técnico | Manter em gestão/segurança |
| Envios | Enviar agora | `/send` | Enviar agora | `send:test` | Marketing/dono | Rota antiga e central | Preservar rota; revisar label só com QA |
| Envios | Status WhatsApp | `/platform/wa-stories` | Status WhatsApp | `send:test` | Marketing | Pode confundir com status da conexão | Renomear por contexto se aprovado |
| Envios | Campanhas | `/platform/campanhas` | Campanhas | `send:test` | Marketing | Jornada espalhada | Agrupar por "Envios e campanhas" |
| Envios | Agendamentos | `/send/agendamentos` | Agendamentos | `send:schedule:manage` | Marketing | OK | Baixo risco |
| Envios | Histórico de envios | `/send/historico` | Histórico de envios | `send:test` | Marketing | OK | Baixo risco |
| Envios | Modelos de mensagem | `/platform/templates` | Modelos de mensagem | `send:templates:manage` | Marketing/admin | Relacionado a envio e atendimento | Manter ou mover para Automação |
| Atendimento | Caixa de Entrada | `/platform/inbox` | Caixa de Entrada | `inbox:view` | Atendente | "Caixa" não deixa a ação principal explícita | Avaliar "Atendimentos" sem mudar rota |
| Atendimento | Chamados | `/platform/inbox/tickets` | Chamados | `inbox:view` | Atendente/suporte | Alterna com "Tickets" | Padronizar termo com dono |
| Atendimento | Setores | `/platform/inbox/setores` | Setores | `inbox:department:manage` | Supervisor/admin | Configuração misturada com operação | Subgrupo "Configuração do atendimento" |
| Atendimento | Triagem e Bot | `/platform/inbox/bot` | Triagem e Bot | `inbox:department:manage` | Dono/admin | Muito técnico | Separar bot, presença e fallback por seções |
| Atendimento | IA de Atendimento | `/platform/inbox/ia` | IA de Atendimento | `inbox:ai:manage` | Dono/admin | Custo/risco precisa aparecer | Copy orientada a risco e crédito |
| Atendimento | Respostas rápidas | `/platform/inbox/respostas` | Respostas rápidas | `inbox:department:manage` | Atendente/admin | OK | Aproximar do composer |
| Atendimento | Supervisão | `/platform/inbox/supervisor` | Supervisão | `inbox:supervise` | Supervisor | Status delicado | Explicar observar x receber atendimento |
| Atendimento | Métricas | `/platform/inbox/relatorios` | Métricas | `inbox:reports:view` | Supervisor/dono | "Métricas" genérico | "Métricas de atendimento" |
| Atendimento | Chat do Site | `/platform/webchat` | Chat do Site | `webchat:view` | Dono/admin | Opera e configura na mesma rota | Separar visualmente Chats, Widgets, Instalação |
| Contatos | Contatos | `/contact` | Contatos | `consent:view` | Atendente/marketing | Base e consentimento juntos | Reforçar diferença Lead/Contato |
| Contatos | Leads | `/platform/leads` | Leads | `consent:view` no menu; guard aceita `leads:view` | Comercial/dono | Capability diverge entre menu e rota | Alinhar docs/testes antes de mudar |
| Contatos | Listas e segmentos | `/platform/segmentos` | Listas e segmentos | `send:destination:manage` | Marketing | OK | Baixo risco |
| Contatos | Grupos WhatsApp | `/grupos` | Grupos WhatsApp | `send:destination:manage` | Marketing | OK | Baixo risco |
| Contatos | Importar / Exportar | `/platform/contacts` | Importar / Exportar | `send:destination:manage` no menu; rota `consent:view` | Admin/marketing | Parece duplicado com Contatos | "Importação de contatos" |
| Consentimento | Pendentes/Aguardando/Aceitos/Recusados/Bloqueados | `/contact?consent=*` | Vários | `consent:view` / `consent:approve-renewal` | Admin/marketing | Deep links por query | Não mover sem preservar query |
| Consentimento | Portal LGPD | `/platform/lgpd` | Portal LGPD | `consent:view` | Dono/admin | Alto risco legal | Manter claro e separado |
| Automações | Regras/Agendamentos/Gatilhos | `/platform/automacoes`, `/send/autoagendamentos`, `/platform/gatilhos` | Vários | `send:schedule:manage` | Dono/admin | Mistura envio automático e regra | Agrupar por tarefa |
| WhatsApp | Conexão/Status/Limites/Fila/Logs | `/sessions`, `/platform/wa-*`, `/platform/fila` | Vários | `whatsapp:*`, `queue:view`, `logs:view` | Dono/admin | "Fila" e "Status" ambíguos | Nomear por contexto: conexão, envios pendentes |
| Integrações | API/Webhooks/Docs/Rate/Teste | `/settings#api-*`, `/integrations/playground` | Vários | `api:*`, `send:test`, `billing:view` | Dev/admin | Itens por hash em Settings | Manter deep links |
| Empresa | Configurações/Equipe/Plano/Permissões/Segurança/Backup | `/settings*`, `/plans` | Vários | `account:*`, `company:*`, `billing:view` | Dono/admin | Equipe x Permissões próximas | Guiar por tarefa e risco |

## 6. Mapa do menu Admin

| Item | Rota | Staff/admin | Risco | Observação sobre páginas legado |
|------|------|-------------|-------|---------------------------------|
| Dashboard global | `/admin/dashboard` | Staff interno | Alto | Hub Admin Ops é caminho principal; usa deep link `?tab=tenants` |
| Sessões WhatsApp | `/admin/sessions` | Staff | Alto | Reusa `Sessions.tsx`; diferenciar global x tenant no visual |
| Fila global | `/admin/queue` | Staff | Alto | Não confundir com fila tenant ou fila de atendimento |
| Logs globais | `/admin/logs` | Staff | Alto | Dados sensíveis; depende de `logs:global` |
| Monitoramento | `/admin/monitoring` | Staff | Médio | Complementa hub Ops |
| Erros do sistema | `/admin/errors` | Staff | Alto | Falhas e eventos sensíveis |
| API global | `/admin/api` | Staff | Médio | Visão global de integrações |
| Empresas | `/admin/dashboard?tab=tenants` | Staff | Alto | Deep link dentro do hub |
| Usuários | `/admin/clients` | Staff | Médio | Página histórica/auxiliar |
| Servidores | `/admin/servers` | Staff | Médio | Pode ser legado/auxiliar |
| Planos | `/admin/plans` | Staff | Alto | Billing global |
| Pagamentos | `/admin/payments` | Staff | Alto | Dados financeiros |
| Moderação | `/admin/moderation` | Staff | Alto | Pode usar APIs legadas/depreciadas conforme docs |
| Configurações gerais | `/admin/settings` | Staff | Alto | Sistema global |
| Modelo global de IA | `/admin/ai-blueprint` | Staff | Alto | IA global; não misturar com IA tenant |
| IA da plataforma | `/admin/ai-platform` | Staff | Alto | Credenciais e uso global |
| Permissões/Segurança/Backup/Auditoria | `/admin/*` | Staff | Alto | Necessário distinguir operação SaaS de tenant |

## 7. Mapa do menu Discord

O menu Discord existe como aba separada quando o usuário tem acesso Discord ou é staff. Ele deve permanecer isolado da operação principal Radar Chat para não misturar automação Discord -> WhatsApp com atendimento WhatsApp/WebChat.

| Grupo | Item | Rota | Capability | Risco visual |
|-------|------|------|------------|--------------|
| Início Discord | Início Discord | `/discord` | `discord:channels:manage` | Baixo se mantido separado |
| Automação Discord | Canais monitorados | `/discord/channels` | `discord:channels:manage` | Médio: depende de servidor selecionado |
| Automação Discord | Regras e filtros | `/discord/rules` | `send:rules:manage` | Médio |
| Automação Discord | Formato da mensagem | `/discord/templates` | `send:templates:manage` | Médio |
| Destinos WhatsApp | Contatos/Grupos | `/discord/contact`, `/discord/grupos` | `consent:view`, `send:destination:manage` | Médio: não confundir com contatos Plataforma |
| Monitoramento | Fila/Histórico/Logs | `/discord/fila`, `/discord/contact/historico`, `/discord/logs` | `queue:view`, `logs:view` | Alto: palavra fila/logs existe em outros contextos |
| Servidor | Configurações do servidor | `/discord/settings` | `account:settings` | Médio |

## 8. Riscos de RBAC

| Risco | Onde aparece | Impacto |
|-------|--------------|---------|
| Filtragem por capability no menu | `filterNavTree`, `linkAllowed`, `can`, `canAny` | Item pode sumir/aparecer indevidamente por perfil |
| Proteção por rota separada do menu | `ROUTE_PERMISSIONS`, `ProtectedRoute` | Renomear menu não basta; rota pode redirecionar para `/dashboard` |
| Exceção de Leads | `/platform/leads` aceita `leads:view` ou `consent:view`; menu usa `consent:view` | Mudança visual pode esconder tela para quem tem `leads:view` se não alinhar |
| Deep links por query/hash | `/contact?consent=*`, `/settings#api-*`, `/admin/dashboard?tab=tenants`, `/platform/inbox?conv=` | Navegação pode quebrar contexto salvo em links |
| Header com permissões próprias | `HeaderStatusPills.tsx` usa `inbox:view`, `inbox:ai:balance:view`, `whatsapp:session:view` | Atendente pode ver status WA mas não gerenciar sessão |
| Admin SaaS x tenant | `userHasAdminMode`, `/admin/*` | Staff precisa distinguir global de tenant |
| Discord com servidor obrigatório | `requiresGuild`, `DiscordGuildPicker` | Itens bloqueados se não houver guild selecionada |
| Status operacional | `AgentStatusSelector`, presença em RBAC docs | Supervisor não deve entrar em fila por engano |
| Billing/IA | `billing:view`, `inbox:ai:manage`, `inbox:ai:balance:view` | Exposição indevida de custo, crédito ou credencial |
| Rotas legadas e redirects | `LegacySendRedirect`, redirects `/channels`, `/rules`, `/templates`, `/queue`, `/logs` | Remover sem mapa quebra usuário antigo e E2E |

## 9. Recomendações seguras para próxima fase

### Pode renomear label visual com baixo risco

- Labels puramente descritivos em docs e títulos, desde que `PAGE_TITLES`, menu e QA sejam atualizados juntos.
- Textos de contexto em páginas não críticas.
- Estado vazio com próxima ação, sem mudar chamada API.

### Exige atualizar docs/testes

- Qualquer alteração em labels do menu Plataforma.
- Termos `Caixa de Entrada`, `Chamados`, `Fila`, `WebChat`, `Billing`, `IA/LM`.
- Reordenação de grupos da sidebar.
- Mudança de título por rota em `PAGE_TITLES`.

### Exige cuidado com RBAC

- `/platform/leads`, porque menu e guard têm lógica especial.
- `/settings/team` e `/settings/permissions`, porque alteram capabilities.
- `/platform/inbox/supervisor`, `supervisor_online` e presença.
- `/plans`, `/platform/inbox/ia`, `/admin/*`, `/platform/lgpd`.
- Header status pills, por expor WhatsApp/IA por capabilities diferentes.

### Não mexer sem autorização

- Rotas e redirects legados.
- Backend, banco, billing, IA/carteira, permissões/capabilities reais.
- Fluxo de Inbox, WebChat, WhatsApp, tickets, fila e CSAT.
- Produção, banco remoto, `.env` ou dados sensíveis.
