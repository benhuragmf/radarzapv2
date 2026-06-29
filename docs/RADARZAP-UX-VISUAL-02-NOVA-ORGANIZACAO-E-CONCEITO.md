# RadarZap UX Visual 02 — Nova Organização e Conceito

## 1. Princípio central

O RadarZap deve parecer um painel de controle de atendimento e relacionamento, onde o dono entende a empresa em poucos segundos, o funcionário atende sem se perder e o cliente final sabe exatamente onde está no atendimento.

Esse conceito deve preservar o que já existe no produto: WhatsApp, WebChat, Inbox, fila, tickets, leads, contatos, IA, créditos, equipe, RBAC, billing, auditoria e Admin SaaS. A mudança recomendada é de organização visual, linguagem e hierarquia, não de recriação de módulos.

## 2. Personas principais

| Persona | O que precisa ver | O que não deveria ver | O que causa confusão | Tela ideal |
|---------|-------------------|-----------------------|----------------------|------------|
| Cliente final | Se está na fila, com IA, com humano, protocolo/ticket, horário e retorno | Termos internos como triagem, SLA, departmentId, IA provider | Não saber se alguém vai responder ou se precisa mandar outra mensagem | Widget/WhatsApp com mensagens simples, status claro e expectativa de tempo |
| Atendente | Próxima conversa, prioridade, cliente, histórico, ações responder/assumir/transferir/criar ticket | Configuração avançada, billing, API, IA provider, logs técnicos | Mistura de fila, lead, contato e ticket sem ação principal | Tela "Atendimentos" com lista priorizada, chat central e detalhes sob demanda |
| Supervisor | Equipe online/ausente/ocupada, fila, gargalos, atendimentos ativos, transferências | Chaves de API, billing técnico, admin global | Diferença entre observar, assumir e redistribuir | Painel de operação com visão de equipe + fila + ações de supervisão |
| Dono da empresa | Situação agora, clientes esperando, leads, tickets, CSAT, canais, IA/créditos, custos e alertas | Logs técnicos, rota global admin, detalhes de implementação | Dashboard que mostra mensagens mas não responde "minha operação está bem?" | Dashboard executivo com blocos de atendimento, comercial, equipe, canais e custos |
| Admin do sistema | Saúde global, empresas, billing, segurança, erros, filas globais, auditoria | Fluxos tenant comuns misturados como se fossem operação global | Páginas legado e hub Admin Ops coexistindo | Admin SaaS separado, com hub principal e páginas auxiliares claramente marcadas |
| Dono/desenvolvedor RadarZap | Mapa estável de rotas, componentes, permissões, QA, riscos e evolução | Refatoração visual sem inventário | Melhorar UI e quebrar RBAC/fluxo | Plano por fases com checklist, docs e QA antes de cada mudança |

## 3. Nova arquitetura de navegação

Proposta de navegação para a aba Plataforma, adaptada ao estado real encontrado:

### Atendimento

- Atendimentos (`/platform/inbox`)
- Fila de atendimento (pode ser filtro/aba do Inbox, não necessariamente rota nova)
- Chat do Site (`/platform/webchat`)
- WhatsApp (`/sessions`, `/platform/wa-status`)
- Tickets / Solicitações (`/platform/inbox/tickets`)
- Supervisão (`/platform/inbox/supervisor`)
- Respostas rápidas (`/platform/inbox/respostas`)
- Triagem e Bot (`/platform/inbox/bot`)

### Relacionamento

- Leads e Oportunidades (`/platform/leads`)
- Contatos (`/contact`)
- Listas e Segmentos (`/platform/segmentos`)
- Formulários do Site (aba dentro de Leads)
- LGPD e Consentimento (`/platform/lgpd` e filtros de `/contact`)

### Automação e IA

- IA de Atendimento (`/platform/inbox/ia`)
- Regras de automação (`/platform/automacoes`)
- Gatilhos (`/platform/gatilhos`)
- Agendamentos automáticos (`/send/autoagendamentos`)
- Modelos de mensagem (`/platform/templates`)
- Créditos de IA (pode ser bloco dentro de IA + indicador no header)

### Gestão

- Dashboard (`/dashboard`)
- Relatórios (`/platform/reports`)
- Métricas de atendimento (`/platform/inbox/relatorios`)
- Equipe (`/settings/team`)
- CSAT (se existe dentro de relatórios/configuração, promover visualmente quando necessário)
- Alertas e notificações (`/dashboard/notificacoes`)

### Empresa

- Configurações (`/settings`)
- Canais (`/sessions`, `/platform/wa-status`, `/platform/webchat`)
- Horários (hoje em Inbox Bot/WebChat; pode virar subseção clara)
- Plano e Pagamento (`/plans`)
- Permissões (`/settings/permissions`)
- Segurança (`/settings/security`)
- Backup (`/settings/backup`)
- Integrações/API (`/settings#api-*`, `/integrations/playground`)

### Sistema/Admin

Fica na aba Admin para staff RadarZap:

- Dashboard global (`/admin/dashboard`)
- Empresas/clientes
- Billing/pagamentos
- Filas/logs/erros
- Segurança/auditoria
- IA plataforma
- Configurações globais

Visibilidade por perfil:

| Perfil | Deve ver | Deve evitar por padrão |
|--------|----------|------------------------|
| Atendente | Atendimentos, Tickets próprios, Contatos necessários, Respostas rápidas, Meu perfil | Billing, API, backup, configurações avançadas, Admin SaaS |
| Supervisor | Atendimentos, Supervisão, Métricas, Equipe operacional, Tickets, Leads conforme permissão | Admin SaaS, chaves secretas, billing global |
| Dono da empresa | Dashboard, Atendimento, Leads, Contatos, Equipe, Canais, Plano, IA/créditos, Segurança | Logs técnicos profundos por padrão |
| Admin SaaS | Admin global completo + acesso tenant quando necessário | Misturar operação global com navegação tenant sem indicação visual |

## 4. Novo conceito para o Header

O header deve funcionar como barra operacional, não apenas como título da página.

Elementos recomendados:

- Empresa/workspace atual sempre visível.
- Busca global por contato, ticket, lead, telefone e rota.
- Alertas críticos com prioridade visual maior que notificações comuns.
- Status do usuário: online, ausente, ocupado, supervisor online.
- Canais conectados: WhatsApp ok, QR pendente, WebChat ativo.
- Consumo IA/créditos com texto de risco: ok, atenção, esgotado.
- Atalhos rápidos contextuais: novo atendimento, novo lead, conectar WhatsApp.
- Perfil e logout em menu compacto.

Regra visual:

- Header não deve virar painel de métricas. Deve mostrar somente o que ajuda a decidir agora.
- Detalhes devem abrir em popover/drawer.

## 5. Novo conceito para Inbox/Chat

Experiência desejada:

- Coluna esquerda: conversas priorizadas.
- Filtros simples no topo: Todos, Fila, Minhas, Em atendimento, Triagem, Tickets, Encerrados.
- Filtro por canal: WhatsApp, Site, Todos.
- Indicador claro de quem espera há mais tempo.
- Estado de cada conversa em linguagem humana: "Na fila", "Com você", "Aguardando cliente", "Com outro atendente", "Ticket aberto".
- Ação principal única por status: Assumir, Responder, Transferir, Criar ticket, Reabrir.
- Painel central: conversa com composer limpo e atalhos rápidos.
- Painel direito: contato, histórico, lead/ticket vinculado e dados WebChat em seções recolhíveis.
- IA sugerindo resposta sem tomar o espaço do humano.
- Tags, prioridade e SLA visíveis, mas secundários.
- Avisos simples: "Cliente espera há 12 min", "Você está ocupado", "WhatsApp desconectado".

Preservar:

- Integração WhatsApp/WebChat.
- Ticket vinculado.
- Presença e fila.
- RBAC de atendente/supervisor.
- Deep links `?conv=`.

## 6. Novo conceito para Leads e Contatos

Regra clara:

- Contato = pessoa/empresa conhecida no sistema.
- Lead = oportunidade comercial ou interesse ainda não convertido.
- Atendimento = conversa em tempo real.
- Ticket = problema/solicitação que precisa acompanhamento.

Fluxo ideal:

1. Cliente chama no WhatsApp/WebChat.
2. Sistema cria/atualiza Contato.
3. Se houver interesse comercial, vira Lead.
4. Se houver problema, vira Ticket.
5. Se houver venda/oportunidade, entra no Kanban.
6. Dono visualiza origem, status e conversão.

Como aparecer no produto:

- Em Leads: sempre mostrar origem, contato vinculado, conversa vinculada e próxima ação.
- Em Contatos: mostrar se existe lead aberto, ticket aberto ou atendimento recente.
- No Inbox: mostrar se a conversa é lead/comercial, mas sem transformar a tela em CRM.
- Em Tickets: mostrar contato e conversa original, mas com foco no acompanhamento.

## 7. Novo conceito para Dashboard do dono

Blocos recomendados:

| Bloco | Pergunta respondida |
|-------|---------------------|
| Agora no atendimento | Quantas pessoas estão esperando ou sendo atendidas? |
| Clientes esperando | Quem está há mais tempo na fila? |
| Equipe | Quem está online, ausente, ocupado ou supervisor online? |
| Leads novos | Quantas oportunidades entraram e de onde vieram? |
| Tickets pendentes | Quais solicitações estão abertas ou vencendo SLA? |
| CSAT | Clientes estão satisfeitos? |
| Tempo médio de resposta | Atendimento está rápido? |
| Canais conectados | WhatsApp/WebChat estão funcionando? |
| IA/créditos | Quanto foi usado e há risco de bloqueio? |
| Alertas importantes | O que precisa ação agora? |
| Gargalos | Onde a operação está travando? |

Primeiro viewport ideal:

- 4 a 6 KPIs de operação agora.
- 1 bloco de alerta.
- 1 lista curta de prioridade.
- Atalhos para Atendimentos, Leads, Tickets e Canais.

## 8. Novo conceito visual

Diretrizes:

- Menos poluição visual por tela.
- Cards objetivos, sem empilhar cards dentro de cards.
- Mais labels humanas e menos jargão técnico.
- Estados vazios com próxima ação clara.
- Botões com ação direta: "Assumir", "Responder", "Criar ticket", "Abrir contato".
- Cores por status consistentes:
  - Verde: conectado/concluído/ok.
  - Amarelo: atenção/espera.
  - Vermelho: erro/bloqueio/risco.
  - Azul: informação/andamento.
  - Roxo/violeta: IA/premium, com uso moderado.
- Layout responsivo desenhado por tarefa, não apenas escondendo colunas.
- Hierarquia visual consistente: título, resumo, ação principal, dados secundários.
- Tabelas com colunas essenciais no mobile e detalhes em drawer.

## 9. Padrões de nomenclatura

Sugestões para avaliar antes de implementar:

| Hoje | Sugestão | Observação |
|------|----------|------------|
| Caixa de Entrada | Atendimentos | Mais claro para cliente brasileiro |
| Chamados | Tickets / Solicitações | Mantém termo técnico e explica função |
| Leads | Leads e Oportunidades | Ajuda dono/comercial |
| WebChat | Chat do Site | Já aparece assim em partes do menu |
| Billing | Plano e Pagamento | Evitar inglês para dono |
| IA de Atendimento | IA e Automação do Atendimento | Se a tela continuar reunindo IA, KB e fallback |
| Créditos IA | Créditos de IA | Mais natural |
| Fila de envio | Envios pendentes | Evita confusão com fila de atendimento |
| Conexão WhatsApp | Canais WhatsApp | Agrupa QR, status e limites |
| Logs WhatsApp | Histórico técnico WhatsApp | Se ficar visível para dono/admin |
| Admin Dashboard | Painel Admin RadarZap | Separar de dashboard tenant |

Regras:

- Não renomear rotas nesta fase.
- Validar labels com `PAGE_TITLES`, `ROUTE_PERMISSIONS`, E2E e docs.
- Evitar dois nomes visuais para a mesma coisa.

## 10. Regras para não confundir o usuário

- Uma ação principal por tela.
- Menus agrupados por tarefa, não por tecnologia.
- Atendente não deve ver configurações avançadas sem necessidade.
- Dono deve ver indicadores e alertas, não detalhes técnicos primeiro.
- Admin SaaS pode ver saúde, logs e auditoria em área própria.
- Cliente final deve ver mensagens simples de fila, humano, IA e ticket.
- Tudo que for IA deve explicar custo/crédito quando aplicável.
- "Fila" deve sempre dizer de quê: fila de atendimento, fila de envio ou fila global.
- Lead, contato, atendimento e ticket devem ter definição igual em todas as telas.
- Alteração visual não pode quebrar RBAC nem deep links.

## 11. Protótipo textual das telas principais

### Dashboard

Topo:

- Status geral: Operação ok / Atenção / Crítico.
- KPIs: clientes esperando, atendimentos ativos, tempo médio, leads novos, tickets pendentes, IA usada.
- Alertas: WhatsApp desconectado, fila alta, crédito IA baixo, plano perto do limite.

Corpo:

- "Agora no atendimento" com fila e equipe.
- "Comercial" com leads e conversões.
- "Pendências" com tickets e CSAT.
- "Canais e custos" com WhatsApp, WebChat, plano e IA.

### Inbox

Esquerda:

- Filtros rápidos, canal e busca.
- Conversas ordenadas por urgência.

Centro:

- Header do cliente: nome, canal, status, espera, ação principal.
- Mensagens.
- Composer com anexos, respostas rápidas e sugestão IA discreta.

Direita:

- Contato.
- Lead vinculado.
- Ticket vinculado.
- Histórico e dados WebChat.

### Leads/Kanban

Topo:

- Novos, em atendimento, convertidos, sem responsável.
- Filtros por origem, status, responsável e período.

Corpo:

- Kanban para visão comercial.
- Lista para operação rápida.
- Detalhe lateral com contato, origem, conversa e próxima ação.

### Contato

Topo:

- Dados da pessoa/empresa, consentimento, origem e classificação.

Corpo:

- Histórico de atendimentos.
- Leads vinculados.
- Tickets vinculados.
- Segmentos/listas.
- Ações: editar, abrir atendimento, criar lead, criar ticket.

### Ticket

Topo:

- Referência, status, SLA, contato e responsável.

Corpo:

- Atualizações ao cliente.
- Notas internas.
- Histórico da conversa.
- Ações: enviar atualização, comentar, fechar, reabrir.

### Configuração do WebChat

Separar mentalmente:

- Conversas do site: operação.
- Widgets do site: configuração.
- Aparência e preview: visual.
- IA, horários e transferência: comportamento.
- Instalação: técnico.

### Equipe/status

Visão:

- Membros, papel, status operacional, perfil completo, WhatsApp verificado.
- Papéis e permissões em área de dono/admin.
- Supervisor altera status de equipe com auditoria/clareza.

### Planos/IA créditos

Visão:

- Plano atual, limites usados, próximos bloqueios.
- Créditos IA usados, saldo, previsão e histórico.
- Explicar diferença entre LM e créditos IA em linguagem simples.
