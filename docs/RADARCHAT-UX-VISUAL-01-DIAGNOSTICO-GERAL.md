# Radar Chat UX Visual 01 — Diagnóstico Geral

## 1. Objetivo da análise

O objetivo desta análise é avaliar visualmente e horizontalmente o Radar Chat v2 para melhorar organização, clareza, facilidade de uso e profissionalização do produto sem alterar código de produção nesta etapa.

Esta etapa foi feita por inspeção estática do repositório local, especialmente `src/services/web-dashboard/frontend/src/App.tsx`, `src/services/web-dashboard/frontend/src/lib/navConfig.ts`, componentes de layout, páginas principais, design system e documentação existente. Não houve acesso a produção, banco remoto, serviços externos, `.env` ou dados sensíveis.

## 2. Escopo analisado

Áreas encontradas no código e documentação:

| Área | Evidência local |
|------|-----------------|
| Frontend dashboard | React/Vite em `src/services/web-dashboard/frontend` |
| Rotas principais | `App.tsx`, `ProtectedRoute.tsx`, `navConfig.ts` |
| Layout global | `Layout.tsx`, `Sidebar.tsx`, `Header.tsx`, `HeaderStatusPills.tsx` |
| Design system | `design-system/`, `index.css`, `docs/DESIGN-SYSTEM.md` |
| Dashboard tenant | `/dashboard`, `Dashboard.tsx` |
| Inbox/Atendimento | `/platform/inbox`, `/platform/inbox/*`, componentes `components/inbox/*` |
| WebChat | `/platform/webchat`, widget editor, previews, visitante e fila |
| Leads | `/platform/leads`, Kanban/lista/formulários/segmentos |
| Contatos/LGPD | `/contact`, `/platform/contacts`, `/platform/lgpd`, classificação e consentimento |
| WhatsApp | `/sessions`, `/platform/wa-status`, `/platform/wa-limits`, `/platform/fila`, `/platform/wa-logs`, `/platform/wa-stories` |
| Envios e automações | `/send`, `/send/agendamentos`, `/platform/campanhas`, `/platform/automacoes`, `/platform/gatilhos` |
| IA/Chatbot | `/platform/inbox/ia`, `/platform/inbox/bot`, créditos IA/LM no header |
| Billing/planos | `/plans`, `/admin/plans`, `/admin/payments`, `docs/BILLING.md` |
| Equipe/RBAC | `/settings/team`, `/settings/permissions`, `docs/EQUIPE-RBAC.md` |
| Admin SaaS | `/admin/dashboard`, `/admin/*`, Admin Ops e páginas legadas |
| Discord legado/produto | `/discord/*`, automação Discord para WhatsApp |
| QA existente | Jest/Playwright, `e2e/*`, scripts `qa:*`, docs `QA-*` |

## 3. Mapa visual atual do sistema

| Área/tela | Rota provável | Público principal | Objetivo da tela | Problemas visuais encontrados | Problemas de organização | Risco para o usuário | Prioridade |
|-----------|---------------|-------------------|------------------|-------------------------------|--------------------------|----------------------|------------|
| Login | `/` sem sessão | Todos | Autenticar no painel | Parece funcional, mas texto "Painel Administrativo" pode soar interno demais para cliente SaaS | Branding e contexto comercial poderiam ser mais claros | Cliente novo não entende se está no painel certo | média |
| Escolha de empresa | fluxo pós-login | Usuário multiempresa | Escolher organização | Existe componente próprio | Fluxo depende de contexto de organização | Entrar na empresa errada ou não entender workspace | média |
| Sidebar Plataforma | global | Atendente, dono, supervisor | Navegação diária | Muitos grupos, muitos nomes técnicos e scroll longo | Mistura atendimento, envios, contatos, automação, WhatsApp, API e empresa | Usuário se perde antes de achar tarefa principal | alta |
| Modo Discord | `/discord/*` | Usuário com Discord | Automação Discord para WhatsApp | Separado por aba, bom isolamento | Pode competir com Radar Chat atendimento se usuário não usa Discord | Confusão de produto se aparecer para cliente sem contexto | média |
| Modo Admin | `/admin/*` | Staff Radar Chat | Operação SaaS global | Separado por aba e RBAC | Páginas legado e hub Ops coexistem | Staff pode usar tela antiga sem perceber caminho preferencial | média |
| Header/topbar | global | Todos logados | Título, empresa, notificações, status, perfil | Útil, mas denso em telas menores | Sem busca global; status e IA competem por espaço | Operação importante pode ficar escondida no overflow | alta |
| Dashboard tenant | `/dashboard` | Dono da empresa | Resumo da conta | Métricas básicas e gráfico existem | Pouca visão "agora": fila, atendentes, leads, tickets, IA/custos e gargalos ainda não estão unificados | Dono não entende a saúde operacional em segundos | alta |
| Notificações | `/dashboard/notificacoes` | Dono, gestor, atendente | Ler alertas do painel | Existe sino global | Pode ficar separado do dashboard operacional | Alertas críticos podem ser tratados tarde | média |
| Inbox | `/platform/inbox` | Atendente | Atender conversas WA/WebChat | Layout rico, mas muito denso: filtros, badges, timer, painel de contato e ações | Conceitos de conversa, ticket, lead, contato e WebChat aparecem juntos | Atendente pode não saber qual conversa priorizar ou qual ação usar | alta |
| Supervisor | `/platform/inbox/supervisor` | Supervisor | Ver equipe, fila e atendimentos | Existe painel por abas | Requer entendimento prévio de presença e fila | Supervisor pode ficar online de forma errada ou interferir no atendimento | alta |
| Tickets/Chamados | `/platform/inbox/tickets` e `/:ref` | Atendente, suporte | Acompanhar problemas assíncronos | Tabela e detalhe existem | Nome "Chamados" no menu e "Tickets" em outros lugares podem alternar | Funcionário confunde conversa ao vivo com chamado assíncrono | alta |
| Triagem e Bot | `/platform/inbox/bot` | Dono, admin, supervisor | Configurar fila, bot, SLA e presença | Funcional, com muitas opções | Configurações críticas ficam em uma área técnica | Config mal feita muda fluxo de atendimento inteiro | alta |
| IA de Atendimento | `/platform/inbox/ia` | Dono, admin | Configurar IA básica/premium, KB e créditos | Muito completa, provável densidade alta | IA, KB, provedor, crédito e fallback são conceitos difíceis | Dono ativa IA sem entender custo/risco | alta |
| Respostas rápidas | `/platform/inbox/respostas` | Atendente/admin | Gerenciar atalhos | Existe módulo dedicado | Fica dentro de Atendimento, bom; precisa conexão clara com composer | Atendente não sabe que atalhos existem | média |
| Métricas Inbox | `/platform/inbox/relatorios` | Supervisor/dono | Métricas de atendimento | Existe rota | Separada do dashboard geral | Dono olha dashboard geral e perde métricas de atendimento | média |
| WebChat | `/platform/webchat` | Dono/admin/atendente | Gerenciar widget e chats do site | Página muito rica: chats, widgets, preview, IA, horários | Mistura operação de chats e configuração visual do widget na mesma rota | Dono pode mexer no widget quando queria só ver conversas | alta |
| Leads | `/platform/leads` | Comercial/dono | Capturar, qualificar e converter leads | Lista/Kanban/formulários/segmentos existem | Relação Lead x Contato x Inbox precisa ficar explícita sempre | Comercial duplica cadastro ou perde origem/conversão | alta |
| Contatos | `/contact` | Atendente, marketing | Base consolidada, consentimento e grupos | Área consolidada existe | Mesma base aparece como contatos, destinos, segmentos, consentimento | Usuário não sabe onde editar pessoa ou permissão | alta |
| Importar/Exportar | `/platform/contacts` | Admin/marketing | CSV/VCF | Existe separado | Nome parecido com Contatos causa duplicidade mental | Usuário abre tela errada para editar contato | média |
| LGPD | `/platform/lgpd` | Dono/admin | Portal de dados e eventos | Existe dedicado | Consentimento também aparece como grupo no menu | Usuário confunde opt-in de campanha com atendimento ativo | alta |
| Envios WhatsApp | `/send`, `/send/*`, `/platform/campanhas` | Marketing/dono | Enviar e agendar mensagens | Fluxo robusto | "Envios", "Campanhas", "Status WhatsApp" e "Limites" espalham jornada de envio | Envio sem entender consentimento, limite ou fila | alta |
| WhatsApp Bridge/sessões | `/sessions`, `/platform/wa-status` | Dono/admin | Conexão e saúde do canal | Rotas separadas existem | "Conexão WhatsApp" e "Status da conexão" podem parecer duplicados | Dono não sabe onde resolver QR/conexão | média |
| Fila de envio | `/platform/fila` | Dono/admin | Ver envios pendentes | Existe | Fila de envio e fila de atendimento usam mesmo termo "fila" | Usuário confunde campanha pendente com cliente esperando | alta |
| API/Integrações | `/settings#api-*`, `/integrations/playground` | Desenvolvedor/admin | Chaves, webhooks, docs e teste | Existe e centraliza integrações | Fica dentro de Configurações, mas também no menu Integrações | Dono comum pode ver itens técnicos demais | média |
| Empresa/configurações | `/settings`, `/settings/team`, `/settings/permissions`, `/settings/security`, `/settings/backup` | Dono/admin | Perfil, equipe, permissões, segurança e backup | Estrutura existe | Equipe e permissões aparecem em duas rotas próximas | Dono mexe em papel errado ou quebra RBAC | alta |
| Plano/Billing | `/plans` | Dono/financeiro | Plano, limites, cobrança | Existe | Plano, IA créditos e limites aparecem em locais diferentes | Dono não conecta custo, plano e consumo | alta |
| Admin Ops | `/admin/dashboard` | Staff Radar Chat | Saúde global do SaaS | Forte, com abas e métricas | Páginas legado ainda coexistem com hub | Staff compara dados de telas diferentes | média |
| Estados vazios/loading/erro | design system | Todos | Orientar quando não há dados | Componentes existem | Uso pode variar por tela | Telas vazias não ensinam próxima ação | média |

## 4. Diagnóstico do menu lateral

Existe hoje:

- Sidebar única com alternância entre `Plataforma`, `Discord` e `Admin`.
- Navegação configurada em `navConfig.ts`, com permissões por capability e filtragem por perfil.
- Grupos principais da Plataforma: Início, Envios, Atendimento, Contatos, Automações, WhatsApp, Integrações e Empresa.
- Admin Radar Chat separado para staff interno.
- Discord separado por aba quando o usuário tem acesso.

Problemas encontrados:

- A Plataforma está funcionalmente completa, mas longa demais para uso diário. O usuário precisa percorrer muitos grupos para responder perguntas simples: "quem está esperando?", "onde está meu lead?", "meu WhatsApp está conectado?", "quanto estou gastando de IA?".
- Alguns nomes são orientados por tecnologia ou módulo interno: `Inbox`, `WebChat`, `Billing`, `IA`, `Fila`, `Destino`, `Logs`.
- A palavra "fila" aparece em contextos distintos: fila de atendimento, fila de envio, fila global/admin e fila Discord.
- "Contatos", "Importar / Exportar", "Listas e segmentos", "Leads" e "Consentimento" ficam próximos, mas a relação conceitual entre eles não é óbvia.
- "WhatsApp" aparece em Envios, Atendimento, Contatos, WhatsApp, Header e Discord, o que é verdadeiro tecnicamente, mas exige uma arquitetura mental do usuário.
- O menu Admin tem boa separação por staff, mas ainda convive com páginas legado e rotas profundas por query string.

Riscos:

- Atendente ver opções demais e perder o foco no atendimento.
- Dono confundir ferramenta operacional com configuração técnica.
- Supervisor não saber a diferença entre ficar `supervisor_online` e assumir atendimento.
- Desenvolvedor quebrar RBAC ao renomear ou mover itens sem mapear `ROUTE_PERMISSIONS`.

## 5. Diagnóstico do header/topbar

Existe hoje:

- Título da página via `pageTitleFor`.
- Troca de empresa/workspace por `OrganizationSwitcher`.
- Sino de notificações.
- Seletor de status do atendente.
- Toggle dark/light.
- Perfil do usuário.
- Logout.
- Pills de status WhatsApp e consumo IA/LM via `HeaderStatusPills`.

Problemas:

- Não foi encontrada busca global no header.
- Em telas menores, título, status WhatsApp, IA/LM, empresa, sino, presença, tema e perfil competem por uma altura fixa de 56px.
- O header tem informações operacionais importantes, mas não cria hierarquia clara entre alerta crítico, status pessoal e status da empresa.
- Consumo IA/LM aparece como indicador técnico; para dono pode faltar texto de impacto ("perto do limite", "bloqueado", "ok").

Oportunidades:

- Criar header operacional por prioridade: empresa atual, busca global, alertas críticos, status do atendente/canais, créditos IA.
- Reservar detalhes técnicos para menu ou drawer, mantendo o header escaneável.

## 6. Diagnóstico do chat/inbox

Existe hoje:

- Lista de conversas com busca, filtros rápidos, filtro por canal e filtro por setor.
- Canais WhatsApp e WebChat unificados por conversa.
- Status de conversa: triagem, fila, atendimento, transferido, resolvido/encerrado.
- Timers de fila/triagem, urgência e SLA.
- Ações de assumir, transferir, criar ticket, responder, notas internas e detalhes do contato.
- Painel de detalhes com contato, histórico, ticket e dados WebChat.
- Integração com presença de atendente e socket.

Problemas:

- A tela concentra muitos sinais ao mesmo tempo: canal, setor, ticket, lead, classificação CRM, tempo de fila, prioridade, atendente, preview, WebChat, status e ações.
- O usuário precisa entender conceitos diferentes para agir: conversa, fila, triagem, ticket, contato, lead, setor, presença, IA.
- A ação principal pode variar por status, mas nem sempre fica óbvia para um atendente novo.
- WebChat e WhatsApp juntos são fortes para operação, mas aumentam complexidade visual quando o usuário só quer atender a próxima pessoa.
- O painel lateral de detalhes é útil, porém pode competir com o foco da conversa em telas médias.

Risco para funcionário:

- Responder conversa errada, deixar cliente esperando, abrir ticket desnecessário ou transformar atendimento em lead sem critério.

## 7. Diagnóstico de Leads/Contatos

Existe hoje:

- Contatos são base consolidada.
- Leads são entradas comerciais/capturas, com status, origem, Kanban/lista, formulários e integração com Inbox.
- WebChat e WhatsApp podem gerar lead conforme regras documentadas.
- Contatos possuem classificação, origem, opt-in, temperatura e status comercial.
- Leads podem ser vinculados a contato e abrir atendimento no Inbox.

Problemas:

- A diferença entre Lead, Contato, Atendimento e Ticket existe na documentação, mas precisa ser reforçada no produto em todas as telas.
- O menu coloca Leads dentro de Contatos, o que é defensável, mas pode fazer o usuário achar que lead é apenas um contato.
- A rota `/platform/contacts` é "Importar / Exportar", enquanto `/contact` é "Contatos"; isso pode parecer duplicado.
- Consentimento aparece como fluxo próprio e também como parte de contatos/campanhas, exigindo clareza de contexto.

Fluxo ideal a preservar:

1. Cliente chama no WhatsApp/WebChat.
2. Sistema cria/atualiza Contato.
3. Se houver intenção comercial, vira Lead.
4. Se houver problema ou acompanhamento, vira Ticket.
5. Dono visualiza origem, status e conversão.

## 8. Diagnóstico do Dashboard

Existe hoje:

- Métricas de mensagens, sessões ativas, fila pendente e falhas recentes.
- Gráfico de mensagens por hora.
- Atalhos rápidos para Enviar agora, Contatos, Modelos e Relatórios.
- Admin Dashboard global muito mais completo para staff.

Problemas:

- O dashboard tenant ainda parece mais técnico/operacional de mensagens do que painel de controle do dono da empresa.
- Não concentra, no primeiro olhar, clientes esperando, atendentes online/ausentes/ocupados, leads novos, tickets pendentes, CSAT, tempo médio de resposta, canais conectados, IA/créditos e alertas.
- Faltam blocos de "agora no atendimento", "gargalos" e "risco de operação".

Risco:

- Dono da empresa abre o painel e não entende a situação real da operação em até 10 segundos.

## 9. Diagnóstico visual geral

Pontos fortes:

- Há design system próprio com tokens `--rz-*`.
- Existem componentes compartilhados: `RadarPageShell`, `PageHeader`, `MetricCard`, `FilterBar`, `DataTable`, `EmptyState`, `LoadingState`, `ErrorState`, `SectionCard`, `StatusBadge`.
- Dark/light existem.
- Sidebar sempre escura e consistente.
- Ícones Lucide são usados amplamente.
- Há esforço de responsividade no Inbox, tabelas e layout global.

Problemas:

- Muitas telas ainda combinam componentes próprios antigos (`Card`, `Button`, badges locais) com design system novo.
- O produto usa muitos cards, badges e tabs; a densidade pode parecer "painel técnico" em vez de ferramenta operacional.
- Há mistura de nomes em português e termos técnicos/ingleses: Inbox, WebChat, Billing, LM, IA, API, Admin, Tickets.
- Estados vazios existem, mas precisam sempre responder "o que faço agora?" por persona.
- Responsividade do Inbox é tratada com ocultação em mobile, mas fluxos complexos como detalhes/contato/ticket exigem QA visual dedicado.
- Cores de status precisam ser padronizadas por significado: espera, risco, sucesso, bloqueio, IA, billing e canal.

## 10. Problemas críticos encontrados

Cliente final:

- Pode não entender com clareza quando está em fila, com bot/IA, com humano ou aguardando retorno por ticket se os textos públicos não forem revisados em conjunto.

Funcionário/atendente:

- Inbox tem muitos estados e ações concorrentes; a prioridade da próxima conversa precisa ser mais óbvia.
- Lead/Contato/Ticket/Atendimento ainda exigem treinamento conceitual.

Dono da empresa:

- Dashboard tenant não mostra uma visão executiva completa de atendimento, vendas, equipe, IA e gargalos.
- Billing, consumo IA e limites aparecem distribuídos entre header, planos, IA e alertas.

Admin/supervisor:

- Supervisor tem painel próprio, mas status operacional e interferência em fila precisam de copy muito clara.
- Admin SaaS tem hub forte, mas páginas legado e links profundos ainda podem confundir.

Desenvolvedor/dono do produto:

- Qualquer reorganização visual toca `navConfig`, `ROUTE_PERMISSIONS`, rotas, E2E, docs e expectativas de usuários.
- Há risco de "melhorar layout" e quebrar fluxo de atendimento, permissões ou roteamento legado.

## 11. Quick wins

| ID | Melhoria | Impacto | Risco |
|----|----------|---------|-------|
| QW-01 | Criar glossário visual curto: Atendimento, Contato, Lead, Ticket, Fila, IA | Alto | Baixo |
| QW-02 | Renomear labels visuais sem mudar rotas: "Caixa de Entrada" para "Atendimentos", "Chamados" para "Tickets / Solicitações" se aprovado | Alto | Médio, por RBAC/docs/E2E |
| QW-03 | Reordenar sidebar por tarefa: Atendimento, Relacionamento, Gestão, Empresa, Sistema | Alto | Médio |
| QW-04 | Adicionar subtítulos humanos nos headers de telas críticas | Médio | Baixo |
| QW-05 | Padronizar estados vazios com próxima ação | Médio | Baixo |
| QW-06 | Criar visão "Agora" no dashboard tenant usando dados já existentes | Alto | Médio |
| QW-07 | Separar visualmente no Inbox: ação principal, sinais de prioridade e dados secundários | Alto | Médio |
| QW-08 | Tornar consumo IA/LM mais compreensível para dono | Médio | Baixo |
| QW-09 | Consolidar docs de menu e rotas antes de alterar UI | Alto | Baixo |
| QW-10 | Criar checklist visual por perfil antes da implementação | Alto | Baixo |

## 12. Riscos antes de alterar

- Quebrar rotas usadas por redirects legados e deep links.
- Quebrar permissões ao mover itens sem atualizar `ROUTE_PERMISSIONS`, `navConfig`, docs e testes.
- Confundir fluxo de atendimento ao alterar Inbox sem QA manual.
- Confundir Lead/Contato/Ticket ao mexer em nomes sem regra conceitual clara.
- Alterar layout compartilhado e afetar Admin, Discord e Plataforma ao mesmo tempo.
- Mexer em billing/IA créditos sem validar limites, alertas e visibilidade por capability.
- Quebrar responsividade do Inbox, WebChat editor e tabelas grandes.
- Prometer melhoria visual sem validar em desktop, mobile e com dados longos.
- Usar dados mock/config como prova de funcionamento real.
- Acessar produção ou dados sensíveis durante uma etapa que deve ser apenas documental.
