# Radar Chat Layout v3 06 — Fase 2 Menu e Navegação

> **Arquivo — entrega Layout v3 Fase 2.** Referência viva: [`MENUS-SISTEMA.md`](../MENUS-SISTEMA.md), [`MENU-PAGES-REGISTRY.md`](../MENU-PAGES-REGISTRY.md). QA visual: [`RADARCHAT-LAYOUT-V3-09`](../RADARCHAT-LAYOUT-V3-09-FASE-4-5-QA-VISUAL-NAVEGAVEL.md).

## 1. Objetivo

Esta fase reorganiza visualmente o menu lateral e os títulos de navegação do Radar Chat para reduzir carga cognitiva por perfil. A alteração foi feita em labels, ordem dos grupos e agrupamento visual, preservando rotas, redirects, deep links, `ROUTE_PERMISSIONS`, capabilities, backend, banco, IA, billing, WhatsApp, WebChat, LGPD e regras de atendimento.

## 2. Estado antes da alteração

| Item | Estado observado |
|------|------------------|
| Branch | `layout-v3` |
| Base | `66324ee docs: registrar resultados do release gate` |
| Arquivos já alterados antes desta fase | `docs/CHANGELOG.md`, `docs/INDICE-DOCUMENTACAO.md`, `docs/SISTEMA-REGISTRO.md` com registro da Fase 1 |
| Arquivos não rastreados antes desta fase | `docs/RADARCHAT-LAYOUT-V3-01` a `05`, `docs/RADARCHAT-UX-VISUAL-01` a `03`, `data/`, `mocker/modelochat/` |
| Menu atual resumido | Plataforma em Início, Envios, Atendimento, Contatos, Automações, WhatsApp, Integrações e Empresa; Admin em Início, Operação, Clientes e planos, Sistema; Discord isolado |
| Riscos principais | Deep links de Inbox/Tickets/Contato/API/Admin; labels de fila em múltiplos contextos; divergência visual em Leads; Admin SaaS global x tenant |

## 3. Arquivos analisados

| Tipo | Arquivos |
|------|----------|
| Docs Fase 1 | `docs/RADARCHAT-LAYOUT-V3-01-INVENTARIO-ROTAS-MENUS-RBAC.md`, `03`, `04`, `05` |
| Docs menu/RBAC | `docs/MENUS-SISTEMA.md`, `docs/MENU-PAGES-REGISTRY.md`, `docs/EQUIPE-RBAC.md` |
| Docs globais | `docs/INDICE-DOCUMENTACAO.md`, `docs/CHANGELOG.md`, `docs/SISTEMA-REGISTRO.md` |
| Código navegação | `src/services/web-dashboard/frontend/src/lib/navConfig.ts` |
| Código rotas/RBAC | `src/services/web-dashboard/frontend/src/App.tsx`, `src/services/web-dashboard/frontend/src/components/ProtectedRoute.tsx`, `src/auth/rbac/capabilities.ts` |

## 4. Alterações aplicadas

| Arquivo | Tipo de alteração | Motivo | Risco | Como validar |
|---------|-------------------|--------|-------|--------------|
| `src/services/web-dashboard/frontend/src/lib/navConfig.ts` | Labels, ordem de grupos, agrupamento visual e `PAGE_TITLES` | Organizar menu por tarefa/persona e reduzir confusão de fila | Médio | Abrir menu por perfil; confirmar rotas/caps; rodar typecheck/build quando possível |
| `docs/RADARCHAT-LAYOUT-V3-06-FASE-2-MENU-E-NAVEGACAO.md` | Novo documento de fase | Registrar mudanças, riscos, QA e pacote para próximo chat | Baixo | Conferir se cobre antes/depois, rotas e RBAC |
| `docs/MENUS-SISTEMA.md` | Atualização do resumo do menu | Refletir nova organização visual | Baixo | Comparar com `navConfig.ts` |
| `docs/MENU-PAGES-REGISTRY.md` | Nota de labels Layout v3 Fase 2 | Registrar que rotas/API não mudaram | Baixo | Conferir topo do doc |
| `docs/INDICE-DOCUMENTACAO.md` | Adicionar Fase 2 ao índice | Descoberta documental | Baixo | Link abre o arquivo novo |
| `docs/CHANGELOG.md` | Entrada append-only `layout-v3-fase-2` | Registrar etapa visual sem bump de versão | Baixo | Conferir topo do changelog |
| `docs/SISTEMA-REGISTRO.md` | Entrada `layout-v3-fase-2` | Registro vivo do sistema | Baixo | Conferir tabela inicial |

## 5. Menu antes x depois

| Grupo antigo | Item antigo | Grupo novo | Item novo | Rota preservada | Capability preservada | Observação |
|--------------|-------------|------------|-----------|-----------------|-----------------------|------------|
| Início | Visão geral | Visão geral | Dashboard | `/dashboard` | `dashboard:view` | Label mais direto para dono |
| Início | Relatórios | Visão geral | Relatórios | `/platform/reports` | `platform:reports:view` | Sem mudança funcional |
| Início | Auditoria | Visão geral | Auditoria | `/platform/audit` | `platform:audit:view` | Sem mudança funcional |
| Atendimento | Caixa de Entrada | Atendimento | Atendimentos | `/platform/inbox` | `inbox:view` | Rota e `?conv=` preservados |
| Atendimento | Chamados | Atendimento | Tickets / Solicitações | `/platform/inbox/tickets` | `inbox:view` | Links `:ref` preservados |
| Atendimento | Supervisão | Atendimento | Supervisão | `/platform/inbox/supervisor` | `inbox:supervise` | Movido para perto de Tickets |
| Atendimento | Métricas | Atendimento | Métricas de atendimento | `/platform/inbox/relatorios` | `inbox:reports:view` | Label mais específico |
| Atendimento | Respostas rápidas | Atendimento | Respostas rápidas | `/platform/inbox/respostas` | `inbox:department:manage` | Ordem ajustada |
| Atendimento | Setores | Atendimento | Setores | `/platform/inbox/setores` | `inbox:department:manage` | Ordem ajustada |
| Atendimento | Triagem e Bot | Atendimento | Triagem e Bot | `/platform/inbox/bot` | `inbox:department:manage` | Sem mudança funcional |
| Atendimento | IA de Atendimento | Atendimento | IA de Atendimento | `/platform/inbox/ia` | `inbox:ai:manage` | Sem mudança funcional |
| Atendimento | Chat do Site | Atendimento | Chat do Site | `/platform/webchat` | `webchat:view` | Sem mudança funcional |
| Contatos | Leads | Relacionamento | Leads e Oportunidades | `/platform/leads` | Item preserva lógica `leads:view` ou `consent:view` via `linkAllowed` | Saiu do grupo `consent:view` para seguir a exceção já existente da rota |
| Contatos | Contatos | Relacionamento > Contatos e listas | Contatos | `/contact` | `consent:view` | Query `?consent=` preservada fora deste item |
| Contatos | Listas e segmentos | Relacionamento > Contatos e listas | Listas e segmentos | `/platform/segmentos` | `send:destination:manage`; grupo segue `consent:view` como antes | Sem mudança funcional de grupo |
| Contatos | Importar / Exportar | Relacionamento > Contatos e listas | Importação de contatos | `/platform/contacts` | `send:destination:manage` no item; rota segue `consent:view`; grupo segue `consent:view` como antes | Divergência já existente registrada |
| Contatos | Grupos WhatsApp | Relacionamento > Contatos e listas | Grupos WhatsApp | `/grupos` | `send:destination:manage`; grupo segue `consent:view` como antes | Sem mudança funcional de grupo |
| Consentimento | Portal LGPD | Relacionamento > LGPD e Consentimento | Portal LGPD / Consentimento | `/platform/lgpd` | `consent:view` | Label mais explícito |
| Consentimento | Pendentes/Aguardando/Aceitos/Recusados/Bloqueados | Relacionamento > LGPD e Consentimento | Mesmos filtros | `/contact?consent=*` | `consent:view` ou `consent:approve-renewal` | Queries preservadas |
| Envios | Enviar agora | Envios e campanhas | Enviar agora | `/send` | `send:test` | Sem mudança funcional |
| Envios | Campanhas | Envios e campanhas | Campanhas | `/platform/campanhas` | `send:test` | Sem mudança funcional |
| Envios | Agendamentos | Envios e campanhas | Agendamentos | `/send/agendamentos` | `send:schedule:manage` | Sem mudança funcional |
| Envios | Histórico de envios | Envios e campanhas | Histórico de envios | `/send/historico` | `send:test` | Sem mudança funcional |
| Envios | Modelos de mensagem | Envios e campanhas | Modelos de mensagem | `/platform/templates` | `send:templates:manage` | Sem mudança funcional |
| Envios | Status WhatsApp | Envios e campanhas | Postagens de status | `/platform/wa-stories` | `send:test` | Evita confusão com status da conexão |
| WhatsApp | Fila de envio | Envios e campanhas | Envios pendentes | `/platform/fila` | `queue:view` | Saiu de Canais para contexto de envio |
| WhatsApp | Conexão WhatsApp | Canais > Canais WhatsApp | Conectar WhatsApp | `/sessions` | `whatsapp:session:view` | Rota preservada |
| WhatsApp | Status da conexão | Canais > Canais WhatsApp | Status da conexão | `/platform/wa-status` | `whatsapp:session:view` | Sem mudança funcional |
| WhatsApp | Limites de envio | Canais > Canais WhatsApp | Limites de envio | `/platform/wa-limits` | `whatsapp:session:manage` | Sem mudança funcional |
| WhatsApp | Logs WhatsApp | Canais > Canais WhatsApp | Logs WhatsApp | `/platform/wa-logs` | `logs:view` | Continua dentro de Canais WhatsApp |
| Integrações | Integrações | Empresa > Integrações/API | Integrações/API | `/settings#api-*`, `/integrations/playground` | `api:*`, `send:test`, `billing:view` | Hashes preservados |
| Empresa | Configurações da empresa | Empresa > Conta e segurança | Configurações | `/settings` | `account:settings` | Label mais curto |
| Empresa | Equipe e permissões | Empresa > Conta e segurança | Equipe | `/settings/team` | `company:members:manage` | Permissões em item separado |
| Empresa | Plano e cobrança | Empresa > Conta e segurança | Plano e cobrança | `/plans` | `billing:view` | Sem mudança funcional |
| Admin | Dashboard global | Admin Radar Chat | Painel Admin Radar Chat | `/admin/dashboard` | `dashboard:global` | Global fica explícito no modo |
| Admin | Fila global | Operação global | Fila global do sistema | `/admin/queue` | `queue:global` | Evita confundir com fila tenant |
| Discord | Fila | Monitoramento Discord | Fila Discord | `/discord/fila` | `queue:view` | Evita confundir com fila tenant/admin |

## 6. Labels alteradas

| Label anterior | Label nova | Rota | Motivo | Público beneficiado | Risco | Precisa QA? |
|----------------|------------|------|--------|---------------------|-------|-------------|
| Visão geral | Dashboard | `/dashboard` | Nome mais direto | Dono/admin | Baixo | Sim, visual |
| Caixa de Entrada | Atendimentos | `/platform/inbox` | Foco na tarefa do atendente | Atendente/supervisor | Médio | Sim |
| Chamados | Tickets / Solicitações | `/platform/inbox/tickets` | Explica acompanhamento assíncrono | Atendente/suporte | Médio | Sim |
| Métricas | Métricas de atendimento | `/platform/inbox/relatorios` | Diferenciar de relatórios gerais | Supervisor/dono | Baixo | Sim |
| Leads | Leads e Oportunidades | `/platform/leads` | Linguagem comercial | Dono/comercial | Médio | Sim |
| Importar / Exportar | Importação de contatos | `/platform/contacts` | Evitar duplicidade com Contatos | Admin/marketing | Baixo | Sim |
| Portal LGPD | Portal LGPD / Consentimento | `/platform/lgpd` | Deixar escopo legal claro | Dono/admin | Baixo | Sim |
| Status WhatsApp | Postagens de status | `/platform/wa-stories` | Separar de status de conexão | Marketing/dono | Baixo | Sim |
| Fila de envio | Envios pendentes | `/platform/fila` | Separar de fila de atendimento/global | Dono/admin/usuários com `queue:view` | Médio | Sim |
| Conexão WhatsApp | Conectar WhatsApp | `/sessions` | Ação mais clara | Dono/admin | Baixo | Sim |
| Integrações | Integrações/API | Hashes `/settings#api-*` | Deixar área técnica explícita | Dev/admin | Baixo | Sim |
| Configurações da empresa | Configurações | `/settings` | Reduzir redundância no grupo Empresa | Dono/admin | Baixo | Sim |
| Equipe e permissões | Equipe | `/settings/team` | Separar de Papéis e permissões | Dono/admin | Médio | Sim |
| Dashboard global | Painel Admin Radar Chat | `/admin/dashboard` | Diferenciar Admin SaaS global | Staff | Baixo | Sim |
| Fila global | Fila global do sistema | `/admin/queue` | Evitar confundir com tenant/Discord | Staff | Baixo | Sim |
| Sessões WhatsApp | Sessões WhatsApp globais | `/admin/sessions` | Contexto Admin global | Staff | Baixo | Sim |
| Planos/Pagamentos | Planos globais/Pagamentos globais | `/admin/plans`, `/admin/payments` | Separar billing global de tenant | Staff | Baixo | Sim |
| IA da plataforma | IA global da plataforma | `/admin/ai-platform` | Diferenciar de IA tenant | Staff | Baixo | Sim |
| Fila | Fila Discord | `/discord/fila` | Separar fila Discord da fila tenant/admin | Usuário Discord/staff | Baixo | Sim |

## 7. Rotas preservadas

- `/platform/inbox`
- `/platform/inbox?conv=`
- `/platform/inbox/tickets`
- `/platform/inbox/tickets/:ref`
- `/platform/leads`
- `/contact`
- `/contact?consent=`
- `/platform/webchat`
- `/sessions`
- `/platform/fila`
- `/plans`
- `/settings`
- `/settings#api-*`
- `/admin/dashboard?tab=tenants`
- `/discord/fila`
- Redirects legados de Discord e `/send#agendados` / `/send#playground`

## 8. RBAC preservado

- Nenhuma capability foi removida.
- Nenhuma capability nova foi criada.
- `ROUTE_PERMISSIONS` foi preservado.
- `ProtectedRoute.tsx` não foi alterado.
- `src/auth/rbac/capabilities.ts` não foi alterado.
- Menu e rota continuam protegidos pelos mesmos itens de capability.
- Divergência encontrada: `Leads` já tinha exceção no guard (`leads:view` ou `consent:view`) e `linkAllowed` já tratava `wa-leads` com `canAny`. A Fase 2 moveu o item para fora do grupo visual `grp-contatos`, fazendo o item seguir a própria regra já existente sem alterar capabilities.
- Divergência encontrada: `Envios pendentes` usa rota `/platform/fila` protegida por `queue:view`. A Fase 2 moveu o item para Envios e campanhas, preservando a capability do item e deixando a label mais clara.

## 9. Perfis impactados

| Perfil | Impacto esperado |
|--------|------------------|
| OWNER | Menu mais orientado por tarefa: atendimento, relacionamento, envios, canais, empresa |
| ADMIN | Menos ambiguidade entre equipe, permissões, plano e integrações |
| MANAGER | Atendimento, supervisão, métricas e leads ficam mais próximos |
| ATTENDANT | "Atendimentos" substitui "Caixa de Entrada"; precisa QA para confirmar que não vê itens indevidos |
| Custom role | Precisa QA porque grupos com filhos filtrados podem variar conforme capabilities |
| Staff/Admin SaaS | Labels globais mais explícitos em fila, sessões, billing e IA |
| Discord | Fila Discord e Monitoramento Discord ficam isolados do Radar Chat principal |

## 10. QA recomendado

- Desktop 1366x768: sidebar completa, scroll e labels longas.
- Desktop 1920x1080: menu sem espaçamento estranho.
- Mobile: abrir/fechar sidebar e validar labels truncadas.
- Usuário atendente: ver Atendimentos, Contatos/Leads permitidos, sem Admin SaaS/billing indevido.
- Usuário supervisor: ver Supervisão, Métricas de atendimento e status de equipe.
- Usuário dono: ver Canais, Empresa, Plano e cobrança, Integrações/API se permitido.
- Usuário staff: ver Admin Radar Chat separado e labels globais.
- Menu Plataforma: rotas abrem sem redirect indevido.
- Menu Admin: `/admin/dashboard?tab=tenants` preservado.
- Menu Discord: Fila Discord abre apenas com guild/permissão.

## 11. Riscos e pendências

### Resolvido nesta fase

- "Caixa de Entrada" ficou "Atendimentos".
- "Chamados" ficou "Tickets / Solicitações".
- "Fila de envio" ficou "Envios pendentes".
- "Fila global" ficou "Fila global do sistema".
- "Fila" no Discord ficou "Fila Discord".
- Admin SaaS ganhou labels globais mais explícitos.
- Integrações/API passou a ficar sob Empresa.

### Encontrado mas não alterado

- `/dashboard/notificacoes` continua acessível pelo sino/header, sem item novo no menu para não aumentar ruído.
- `/settings#api-*` continua baseado em hash.
- `/platform/contacts` ainda tem divergência entre item de menu (`send:destination:manage`) e rota (`consent:view`) herdada do estado anterior.
- Logs WhatsApp seguem dentro do grupo Canais WhatsApp com grupo `whatsapp:session:view`.

### Precisa decisão do dono

- Confirmar se "Atendimentos" é o nome definitivo para `/platform/inbox`.
- Confirmar se "Tickets / Solicitações" deve ser simplificado para "Tickets" depois.
- Confirmar se "Postagens de status" é melhor que "Status WhatsApp".
- Confirmar se `Envios pendentes` deve ser visível para todo perfil com `queue:view`.

### Precisa próxima fase

- Fase 3 deve tratar header operacional, busca, indicadores WA/IA/LM e responsividade.
- Fase 4 deve padronizar componentes visuais compartilhados.
- QA manual por perfil precisa ser executado antes de merge para branch principal.

## 12. Pacote para enviar ao ChatGPT

### Enviar no próximo chat

Enviar:

1. Resumo final do Codex.
2. `docs/RADARCHAT-LAYOUT-V3-06-FASE-2-MENU-E-NAVEGACAO.md`
3. `src/services/web-dashboard/frontend/src/lib/navConfig.ts`
4. `docs/MENUS-SISTEMA.md`
5. `docs/MENU-PAGES-REGISTRY.md`
6. `docs/INDICE-DOCUMENTACAO.md`
7. `docs/CHANGELOG.md`
8. `docs/SISTEMA-REGISTRO.md`

Não precisa reenviar:

- Inventário de componentes.
- Matriz UX.
- Checklist QA.
- Docs Fase 1 completos.
- Índice completo se o próximo pedido já trouxer o resumo.
- Todos os documentos Layout v3.
