# RadarZap UX Visual 03 — Plano de Execução e QA

## 1. Objetivo

Criar um plano em etapas para melhorar a organização visual do RadarZap sem quebrar funcionalidades existentes, preservando rotas, RBAC, fluxos de atendimento, billing, IA, dados e integrações.

Nesta etapa documental não foi alterado código de produção.

## 2. Regras de segurança da execução

Obrigatório:

- Não alterar backend sem necessidade.
- Não alterar banco sem migração documentada.
- Não remover rotas sem mapear impacto.
- Não renomear menus sem validar permissões.
- Não mexer em componentes compartilhados sem rastrear uso.
- Não alterar fluxo de atendimento sem teste manual.
- Não alterar billing/IA créditos sem teste específico.
- Não quebrar responsividade.
- Não quebrar RBAC.
- Não misturar RadarZap com outros projetos.
- Não acessar produção, banco remoto, `.env` ou dados sensíveis em etapas visuais.
- Não usar mock/config como prova de que o fluxo real funciona.

## 3. Etapas sugeridas

### Fase 1 — Inventário e padronização visual

- Mapear componentes.
- Mapear rotas.
- Mapear menus.
- Mapear estados.
- Criar checklist visual.
- Registrar quais telas usam design system e quais usam componentes locais.
- Registrar termos atuais e termos recomendados.

### Fase 2 — Menu e navegação

- Reorganizar menu por tarefa.
- Ajustar agrupamentos.
- Ajustar nomes visuais.
- Respeitar permissões por perfil.
- Preservar rotas e redirects legados.
- Atualizar `docs/MENUS-SISTEMA.md` e `docs/MENU-PAGES-REGISTRY.md`.

### Fase 3 — Header operacional

- Melhorar topbar.
- Status do usuário.
- Alertas.
- Busca.
- Empresa atual.
- Créditos/canais.
- Definir prioridade visual entre alertas, presença e indicadores.

### Fase 4 — Inbox/Chat

- Melhorar lista de conversas.
- Melhorar painel de chat.
- Criar/organizar ações rápidas.
- Clarificar fila.
- Clarificar status.
- Integrar contato/lead/ticket sem poluir o chat.
- Validar WhatsApp e WebChat juntos.

### Fase 5 — Leads/Contatos/Kanban

- Separar conceitos.
- Reduzir duplicidade.
- Melhorar fluxo WhatsApp/WebChat → Contato → Lead/Ticket.
- Melhorar usabilidade para funcionário.
- Mostrar origem/conversão de forma simples para o dono.

### Fase 6 — Dashboard do dono

- Visão "agora".
- Visão comercial.
- Visão atendimento.
- Visão equipe.
- Visão IA/créditos.
- Alertas e gargalos.
- Atalhos por tarefa.

### Fase 7 — Estados vazios, modais, tabelas e formulários

- Padronizar componentes.
- Melhorar mensagens.
- Melhorar botões.
- Melhorar loading/erro.
- Melhorar mobile.
- Testar textos longos, tabelas grandes e nomes extensos.

### Fase 8 — QA visual e funcional

- Teste por perfil.
- Teste por rota.
- Teste responsivo.
- Teste fluxo atendimento.
- Teste WebChat.
- Teste WhatsApp Bridge.
- Teste Leads.
- Teste Tickets.
- Teste IA.
- Teste Billing.

## 4. Backlog detalhado

| ID | Tela/módulo | Problema | Melhoria proposta | Tipo | Impacto | Risco | Prioridade | Dependências | Critério de aceite |
|----|-------------|----------|-------------------|------|---------|-------|------------|--------------|--------------------|
| UX-001 | Menu Plataforma | Menu longo e orientado por módulo | Reorganizar por tarefa/persona | UX | Alto | Médio | Alta | `navConfig`, RBAC, docs, E2E | Atendente encontra Atendimentos em até 2 cliques |
| UX-002 | Menu Plataforma | "Fila" em contextos diferentes | Renomear filas por contexto | Copy | Alto | Médio | Alta | Docs, labels, E2E | Usuário diferencia fila de atendimento e envios pendentes |
| UX-003 | Menu Contatos/Leads | Contato, lead e segmento próximos sem regra visual | Adicionar labels e ajuda contextual | UX/copy | Alto | Baixo | Alta | Docs de Leads/Contatos | Usuário entende quando usar cada área |
| UX-004 | Header | Falta busca global | Projetar busca por contato/ticket/lead/telefone/rota | UX | Alto | Médio | Média | APIs existentes ou nova API futura | Busca retorna resultados úteis sem expor dados indevidos |
| UX-005 | Header | Indicadores competem por espaço | Priorizar alertas críticos e compactar status | UI | Médio | Médio | Alta | HeaderStatusPills, EventNotificationBell | Header não quebra em 1366px e mobile |
| UX-006 | Header IA | IA/LM técnico demais | Exibir estado "ok/atenção/esgotado" com tooltip | Copy/UI | Médio | Baixo | Média | `GET /platform/ai/balance` | Dono entende risco de crédito baixo |
| UX-007 | Dashboard tenant | Métricas insuficientes para dono | Criar painel "Agora no atendimento" | UX/UI | Alto | Médio | Alta | APIs Inbox/Leads/Tickets/IA | Dono entende operação em até 10 segundos |
| UX-008 | Dashboard tenant | Falta gargalo/alerta | Exibir fila alta, WA off, IA baixa, ticket vencendo | UX | Alto | Médio | Alta | Alertas existentes | Alertas aparecem com ação recomendada |
| UX-009 | Inbox | Densidade visual alta | Reduzir sinais secundários e destacar ação principal | UI/fluxo | Alto | Alto | Alta | QA manual atendimento | Atendente sabe qual ação tomar por status |
| UX-010 | Inbox | Canal/status/ticket/lead competem | Criar hierarquia de badges | UI | Alto | Médio | Alta | Componentes Inbox | Lista continua legível com nomes longos |
| UX-011 | Inbox | Painel de detalhes pesado | Usar seções recolhíveis e ordem por utilidade | UI | Médio | Médio | Média | `InboxContactDetailsPanel` | Detalhes não tiram foco do chat |
| UX-012 | Inbox | WebChat e WhatsApp juntos podem confundir | Mostrar canal e origem com microcopy | Copy | Médio | Baixo | Média | `InboxChannelBadge` | Atendente identifica canal sem ler ID |
| UX-013 | Tickets | "Chamados" e "Tickets" alternam | Padronizar nome visual | Copy | Médio | Médio | Alta | Docs/E2E | Usuário entende ticket como acompanhamento assíncrono |
| UX-014 | Supervisor | Status supervisor_online delicado | Explicar observar vs receber atendimento | UX/copy | Alto | Médio | Alta | Presença operacional | Supervisor não entra na fila por engano |
| UX-015 | WebChat | Operação e configuração na mesma rota | Separar visualmente Chats, Widgets, Instalação e IA | UX/UI | Alto | Médio | Alta | WebChat.tsx | Dono configura widget sem atrapalhar conversas |
| UX-016 | WebChat widget | Editor muito amplo | Wizard/seções com progresso | UX | Médio | Médio | Média | componentes webchat/editor | Usuário sabe o que falta configurar |
| UX-017 | Leads | Muitos filtros e conceitos | Criar "próxima ação" no detalhe | UX | Alto | Médio | Alta | LeadCaptureDetail | Comercial sabe assumir, converter ou descartar |
| UX-018 | Leads | Lead sem contato CRM pode passar despercebido | Badge/alerta "Sem contato" com ação | UX | Alto | Baixo | Média | LeadClassificationStatsRow | Leads sem CRM ficam rastreáveis |
| UX-019 | Contatos | `/contact` vs `/platform/contacts` | Renomear "Importar / Exportar" para "Importação de contatos" | Copy | Médio | Baixo | Média | navConfig/docs | Não parece segunda tela de contatos |
| UX-020 | LGPD | Consentimento e atendimento podem se confundir | Copy contextual por fluxo | Segurança/UX | Alto | Médio | Alta | `CONSENTIMENTO-LGPD.md` | Usuário diferencia opt-in de ticket/atendimento |
| UX-021 | IA Atendimento | Tela muito técnica | Separar modo, KB, custos, teste e fallback | UX | Alto | Médio | Alta | AiAtendimento | Dono entende custo e risco antes de salvar |
| UX-022 | Billing | Plano, limites e IA dispersos | Criar bloco de limites usados no dashboard/plans | UX | Alto | Médio | Média | Billing/IA APIs | Dono vê bloqueios próximos |
| UX-023 | Equipe/RBAC | Permissões complexas | Melhorar grupos por tarefa e perfis prontos | UX/segurança | Alto | Alto | Alta | TeamPermissionsEditor | Dono altera permissão sem quebrar atendimento |
| UX-024 | Admin Ops | Hub e páginas legado coexistem | Marcar páginas legado como auxiliares | UX | Médio | Baixo | Média | AdminOpsLegacyBanner | Staff sabe caminho principal |
| UX-025 | Estados vazios | Mensagens variam por tela | Padronizar EmptyState com próxima ação | UI/copy | Médio | Baixo | Média | Design system | Toda tela vazia orienta próximo passo |
| UX-026 | Tabelas | Responsividade variável | Definir padrão mobile/tablet para tabelas | Responsivo | Médio | Médio | Média | DataTable e tabelas locais | Tabela não fica ilegível no mobile |
| UX-027 | Modais | Ações críticas diferentes | Padronizar confirmação para excluir, billing, permissões | Segurança/UX | Alto | Médio | Alta | ConfirmDialog | Ação destrutiva exige confirmação clara |
| UX-028 | Design system | Tokens/componentes misturados | Inventariar componentes fora do padrão | UI | Médio | Baixo | Média | Fase 1 | Lista de exceções e plano por componente |
| UX-029 | QA visual | Sem checklist visual completo por persona | Criar matriz visual por rota/perfil | QA | Alto | Baixo | Alta | Fase 1 | Checklist aprovado antes de UI |
| UX-030 | Documentação | Docs avançadas, mas dispersas | Criar índice UX/Layout v3 | Docs | Médio | Baixo | Média | Docs existentes | Time sabe onde consultar decisões |

## 5. Critérios de aceite gerais

- Dono da empresa entende o dashboard em até 10 segundos.
- Atendente sabe qual conversa atender primeiro.
- Cliente final entende se está em fila ou atendimento.
- Menu não possui itens duplicados/confusos.
- Header mostra status operacional útil.
- Lead, contato, atendimento e ticket não se confundem.
- Todas as telas principais têm estado vazio claro.
- Layout funciona desktop e mobile.
- Nenhuma permissão RBAC é quebrada.
- Nenhum fluxo existente deixa de funcionar.
- Rotas e deep links existentes continuam válidos.
- Textos longos não quebram botões, cards, tabelas ou headers.
- QA visual e funcional fica documentado com evidência.

## 6. Checklist por persona

Cliente final:

- Entende que entrou no WebChat/WhatsApp correto.
- Vê horário ou expectativa de atendimento quando aplicável.
- Sabe se está falando com IA, bot ou humano.
- Recebe ticket/protocolo quando o problema vira acompanhamento.
- Sabe como responder ou encerrar.

Atendente:

- Vê próxima conversa prioritária.
- Sabe seu status operacional.
- Consegue assumir, responder, transferir e finalizar.
- Consegue criar ticket quando precisa acompanhamento.
- Consegue abrir contato/lead sem sair perdido.

Supervisor:

- Vê equipe online/ausente/ocupada/supervisor online.
- Vê fila e atendimentos ativos.
- Reatribui sem quebrar conversa.
- Não recebe atendimento por engano ao supervisionar.
- Enxerga gargalos e SLA.

Dono da empresa:

- Vê saúde da operação.
- Vê leads, tickets e CSAT.
- Vê canais conectados.
- Vê consumo de IA/créditos e plano.
- Consegue achar equipe, permissões e billing.

Admin SaaS:

- Vê saúde global.
- Vê empresas, planos, pagamentos, erros e filas.
- Distingue tela global de tela tenant.
- Acessa auditoria e segurança.
- Não expõe dados sensíveis em UI ou logs.

Desenvolvedor/dono do RadarZap:

- Tem mapa de rotas, menus e permissões atualizado.
- Tem checklist de componentes compartilhados.
- Tem QA por perfil antes de merge.
- Consegue evoluir sem refatoração ampla de uma vez.
- Mantém docs e changelog alinhados.

## 7. QA manual obrigatório

Roteiro mínimo:

1. Login.
2. Escolha de empresa/workspace.
3. Dashboard tenant.
4. Menu Plataforma por perfil.
5. Menu Discord quando aplicável.
6. Menu Admin quando staff.
7. Header: empresa, sino, status, IA/LM, WhatsApp, perfil.
8. Inbox: abrir lista.
9. Receber conversa WhatsApp.
10. Receber conversa WebChat.
11. Assumir conversa.
12. Transferir conversa.
13. Criar ticket.
14. Abrir ticket.
15. Enviar atualização ao cliente.
16. Criar lead.
17. Abrir atendimento a partir do lead.
18. Abrir contato.
19. Editar contato/classificação.
20. Testar WebChat widget/config.
21. Testar WhatsApp sessão/status.
22. Testar fila de atendimento.
23. Testar fila de envio.
24. Testar status online/ausente/ocupado.
25. Testar supervisor online sem receber atendimento.
26. Testar IA básica/premium se existir na conta.
27. Testar créditos IA/LM.
28. Testar plano/billing.
29. Testar permissões por OWNER, ADMIN, MANAGER, ATTENDANT e custom role.
30. Testar LGPD/consentimento sem confundir com ticket.

## 8. QA visual obrigatório

Testar:

- 1366x768.
- 1920x1080.
- Mobile estreito.
- Tablet se aplicável.
- Dark/light se existir.
- Estados vazios.
- Loading.
- Erros.
- Modais.
- Tabelas grandes.
- Conversa longa.
- Nome de cliente grande.
- Telefone/e-mail grande.
- Muitos atendimentos.
- Muitos leads.
- Muitos tickets.
- Muitos membros de equipe.
- Crédito IA esgotado.
- WhatsApp desconectado.
- WebChat com visitante sem nome.
- Sidebar com todos os grupos visíveis por admin.
- Perfil atendente com poucos menus.

Evidência esperada:

- Prints ou registro textual por viewport.
- Lista de rotas testadas.
- Perfil usado.
- Resultado: aprovado, aprovado com ressalva, falhou.
- Link/arquivo de evidência quando houver.

## 9. Ordem recomendada de implementação futura

1. Documentação e inventário.
2. Menu.
3. Header.
4. Componentes visuais compartilhados.
5. Inbox/chat.
6. Leads/contatos.
7. Dashboard.
8. Ajustes finos.
9. QA completo.
10. Registro no changelog/versionamento.

Justificativa:

- Menu e header definem orientação global.
- Componentes compartilhados reduzem retrabalho.
- Inbox e Leads têm maior risco operacional e devem vir depois de checklist.
- Dashboard depende de clareza conceitual e dados de várias áreas.

## 10. Próximo prompt recomendado

"Executar apenas a Fase 1 — Inventário e padronização visual, com alterações mínimas e seguras, atualizando documentação e sem mexer em lógica de negócio."
