# RadarZap Layout v3 05 — Próximas Fases e Prompts

## 1. Objetivo

Registrar os próximos prompts de execução visual do RadarZap sem executar nenhuma mudança nesta etapa. Cada fase deve preservar rotas, RBAC, atendimento, WhatsApp, WebChat, IA, billing, dados e documentação.

## 2. Ordem segura

1. Fase 2 — Menu e navegação.
2. Fase 3 — Header operacional.
3. Fase 4 — Componentes visuais compartilhados.
4. Fase 5 — Inbox/Chat.
5. Fase 6 — Leads/Contatos/Kanban.
6. Fase 7 — Dashboard do dono.
7. Fase 8 — WebChat/cliente final.
8. Fase 9 — IA/Billing/Créditos.
9. Fase 10 — QA visual e funcional completo.
10. Fase 11 — Revisão final 100% RadarZap.

Regras para todos os prompts:

- 50% proteção / 50% execução.
- Análise antes de alteração.
- Não assumir arquitetura.
- Preservar RBAC.
- Preservar rotas e redirects.
- Preservar atendimento, WhatsApp e WebChat.
- Preservar IA, billing e créditos.
- Atualizar docs/changelog quando houver alteração.
- Rodar testes possíveis apenas quando seguros.
- Registrar evidências e comandos não executados.

## 3. Prompt da Fase 2 — Menu e navegação

```text
Você é o Codex no RadarZap v2, branch layout-v3.

Objetivo: executar somente a Fase 2 — Menu e navegação.

Proteção:
- Confirmar branch e git status.
- Ler os cinco docs Layout v3 Fase 1.
- Ler App.tsx, navConfig.ts, ProtectedRoute.tsx, capabilities.ts e docs de menu/RBAC.
- Não alterar backend, banco, billing, IA, atendimento, WebChat ou WhatsApp.
- Não remover rotas, redirects, deep links, query strings ou hashes.
- Não alterar capabilities sem autorização.

Execução:
- Propor e aplicar apenas reorganização visual de labels/grupos do menu, se aprovada pelo inventário.
- Preservar todas as rotas existentes.
- Atualizar PAGE_TITLES somente se necessário e com baixo risco.
- Atualizar docs MENUS-SISTEMA, MENU-PAGES-REGISTRY, índice, registro e changelog.
- Rodar lint/typecheck/build apenas se houver alteração de código e se for seguro.
- Entregar resumo com riscos, arquivos alterados e comandos executados/não executados.
```

## 4. Prompt da Fase 3 — Header operacional

```text
Executar Fase 3 — Header operacional no RadarZap, branch layout-v3.

Proteção:
- Ler docs Layout v3 01 a 04.
- Inspecionar Header.tsx, HeaderStatusPills.tsx, EventNotificationBell, AgentStatusSelector, OrganizationSwitcher e navConfig.
- Mapear capabilities: inbox:view, inbox:ai:balance:view, whatsapp:session:view, account:settings.
- Não alterar APIs, RBAC, IA, billing ou presença.

Execução:
- Melhorar hierarquia visual do header sem quebrar responsividade.
- Preservar indicadores WA, IA/LM, empresa, presença, sino, tema, perfil e logout.
- Não criar busca global se exigir backend novo; registrar como proposta.
- Validar 1366x768, mobile e dark/light quando possível.
- Atualizar docs e changelog.
```

## 5. Prompt da Fase 4 — Componentes visuais compartilhados

```text
Executar Fase 4 — Componentes visuais compartilhados.

Proteção:
- Ler Layout v3 02 e DESIGN-SYSTEM.md.
- Mapear usos de RadarPageShell, PageHeader, MetricCard, EmptyState, LoadingState, ErrorState, StatusBadge, DataTable, ConfirmDialog e form helpers.
- Não alterar tokens globais sem inventário de impacto.
- Não mexer na Inbox como primeira tela de teste.

Execução:
- Padronizar primeiro estados vazios, loading, subtítulos e botões secundários de baixo risco.
- Evitar card dentro de card.
- Preservar dark/light.
- Atualizar docs do design system se mudar padrão.
- Rodar testes possíveis.
```

## 6. Prompt da Fase 5 — Inbox/Chat

```text
Executar Fase 5 — Inbox/Chat.

Proteção:
- Ler docs Layout v3, INBOX-ATENDIMENTO.md, TICKET-ATENDIMENTO.md e WEBCHAT.md.
- Inspecionar Inbox.tsx e components/inbox/*.
- Mapear fluxos: WhatsApp, WebChat, fila, triagem, IA, ticket, CSAT, transferência, presença e deep link ?conv=.
- Não alterar backend ou regras de atendimento sem autorização.

Execução:
- Melhorar hierarquia visual: lista, ação principal, chat, detalhes e badges.
- Preservar composer, assign, transfer, ticket e resposta.
- Validar por perfis ATTENDANT, MANAGER e supervisor.
- Registrar QA manual obrigatório se não puder automatizar.
```

## 7. Prompt da Fase 6 — Leads/Contatos/Kanban

```text
Executar Fase 6 — Leads/Contatos/Kanban.

Proteção:
- Ler LEADS-FORMULARIO.md, CONTATOS-CLASSIFICACAO.md, CONSENTIMENTO-LGPD.md e Layout v3 03.
- Inspecionar Leads.tsx, Destinations.tsx e components/leads/*.
- Preservar relação Lead, Contato, Atendimento e Ticket.
- Não alterar deduplicação, LGPD, consentimento, APIs ou banco.

Execução:
- Melhorar linguagem e hierarquia de Leads/Contatos.
- Destacar próxima ação, origem, contato vinculado e conversa.
- Padronizar estados vazios e filtros sem alterar comportamento.
- Atualizar docs/changelog e QA por perfil.
```

## 8. Prompt da Fase 7 — Dashboard do dono

```text
Executar Fase 7 — Dashboard do dono.

Proteção:
- Ler Dashboard.tsx, docs Layout v3 03, INBOX, WEBCHAT, LEADS, BILLING e IA créditos.
- Mapear APIs existentes antes de propor novos dados.
- Não inventar métrica sem fonte real.
- Não usar mock/config como prova de funcionamento.

Execução:
- Reorganizar dashboard para responder "minha operação está bem agora?".
- Usar apenas dados já disponíveis ou registrar lacunas.
- Mostrar atendimento, leads, tickets, canais, equipe, IA/créditos e alertas de forma clara.
- Validar performance visual e responsividade.
```

## 9. Prompt da Fase 8 — WebChat/cliente final

```text
Executar Fase 8 — WebChat/cliente final.

Proteção:
- Ler WEBCHAT.md, QA-WEBCHAT-*.md e Layout v3.
- Inspecionar WebChat.tsx, widget editor, preview, chat-box e rotas públicas.
- Não alterar API pública, widget script, origem permitida, token ou bridge sem autorização.

Execução:
- Separar visualmente chats, widgets, aparência, instalação, horários e IA.
- Melhorar copy do cliente final para fila, humano, IA, ticket e fora do horário.
- Validar preview e mobile.
- Registrar QA do visitante e do painel.
```

## 10. Prompt da Fase 9 — IA/Billing/Créditos

```text
Executar Fase 9 — IA/Billing/Créditos.

Proteção:
- Ler IA-CREDITOS-E-CARTEIRA.md, BILLING.md, EQUIPE-RBAC.md e Layout v3.
- Inspecionar AiAtendimento, Plans, HeaderStatusPills e admin IA.
- Não alterar cobrança, carteira, créditos, provider, chaves ou limites sem autorização.

Execução:
- Melhorar linguagem visual de custo, saldo, limite e risco.
- Diferenciar IA tenant, IA global, LM e créditos.
- Validar por OWNER, ADMIN, MANAGER, ATTENDANT e staff.
- Atualizar docs e QA específico.
```

## 11. Prompt da Fase 10 — QA completo

```text
Executar Fase 10 — QA visual e funcional completo.

Proteção:
- Confirmar branch layout-v3 e status.
- Ler Layout v3 04.
- Não acessar produção, banco remoto, .env sensível ou dados reais.

Execução:
- Rodar comandos seguros definidos para o estado atual.
- Validar perfis, módulos, resoluções, dark/light e estados extremos.
- Registrar evidência por rota/perfil.
- Separar falhas P0/P1/P2/P3.
- Não declarar pronto sem evidência.
```

## 12. Prompt da Fase 11 — Revisão final 100%

```text
Executar Fase 11 — Revisão final 100% RadarZap.

Proteção:
- Revisar todo diff da branch layout-v3.
- Comparar com docs Layout v3 e changelog.
- Garantir que main/develop só serão tocadas por merge aprovado.
- Não fazer deploy sem gate explícito.

Execução:
- Validar documentação, rotas, RBAC, QA, screenshots e comandos.
- Preparar resumo de merge com riscos remanescentes.
- Rodar gate pré-push/merge se autorizado e seguro.
- Entregar lista final de pendências humanas.
```
