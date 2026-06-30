# Radar Chat Layout v3 03 — Matriz UX por Personas e Telas

## 1. Objetivo

Garantir que o novo visual do Radar Chat seja pensado para cliente final, atendente, supervisor, dono da empresa, admin SaaS e dono/desenvolvedor do Radar Chat. Esta matriz não altera telas; ela define perguntas, ações e riscos para orientar as próximas fases.

## 2. Personas

| Persona | Precisa entender | Ação principal esperada | O que não deve atrapalhar |
|---------|------------------|-------------------------|---------------------------|
| Cliente final | Se está em fila, com bot/IA, com humano ou em ticket | Responder, aguardar, consultar protocolo, encerrar | Termos internos, IDs, SLA técnico, provider IA |
| Atendente | Quem atender agora e qual ação tomar | Assumir, responder, transferir, criar ticket, abrir contato/lead | Billing, Admin SaaS, logs técnicos, configuração avançada |
| Supervisor | Estado da fila, equipe e gargalos | Redistribuir, monitorar, orientar equipe | Entrar na fila por engano, misturar operação com config |
| Dono da empresa | Saúde do atendimento, vendas, equipe, canais e custos | Ver gargalo, corrigir canal, chamar equipe, revisar plano/IA | Logs técnicos e excesso de detalhes |
| Admin SaaS | Saúde global, empresas, filas, erros, billing e segurança | Suportar tenant, investigar falha, auditar, ajustar global | Confundir tenant com global |
| Dono/desenvolvedor Radar Chat | Rotas, permissões, QA e evolução segura | Executar fases, preservar contratos, documentar evidência | Refatoração ampla sem inventário |

## 3. Matriz por tela

| Tela | Rota | Persona principal | Pergunta que a tela precisa responder | Ação principal | Informações secundárias | O que esconder | Risco de confusão | Melhoria futura |
|------|------|-------------------|--------------------------------------|----------------|-------------------------|---------------|-------------------|----------------|
| Login | `/` sem sessão | Todos | Estou entrando no Radar Chat certo? | Entrar | Marca, erro de login | Jargão interno | "Painel Administrativo" para cliente | Copy SaaS mais clara |
| Escolha de empresa | pós-login | Multiempresa | Qual empresa vou operar? | Selecionar workspace | Plano/role | IDs internos | Entrar no tenant errado | Mostrar contexto e última usada |
| Dashboard | `/dashboard` | Dono | Minha operação está bem agora? | Abrir gargalo/atendimento | Mensagens, sessões, fila, falhas | Logs técnicos | Ver mensagens mas não saúde | Dashboard "Agora" |
| Header | global | Todos | Onde estou e há algo crítico? | Ver alerta/status | Empresa, WA, IA/LM, presença | Detalhe técnico | Informação demais em 56px | Hierarquia operacional |
| Sidebar | global | Todos | Onde encontro minha tarefa? | Navegar por tarefa | Modo Plataforma/Discord/Admin | Itens sem permissão | Menu longo e técnico | Fase 2 menu por tarefa |
| Inbox | `/platform/inbox` | Atendente | Quem precisa de resposta agora? | Assumir/responder | Canal, espera, contato, ticket, lead | Configuração avançada | Sinais demais competindo | Ação principal por status |
| Supervisor | `/platform/inbox/supervisor` | Supervisor | Onde está o gargalo da equipe? | Redistribuir/monitorar | Presença, filas, SLA | Billing/API | Receber atendimento por engano | Copy de modo supervisor |
| Tickets | `/platform/inbox/tickets` | Suporte | O que precisa acompanhamento? | Abrir/atualizar ticket | SLA, contato, status | Conversa irrelevante | Ticket x chat ao vivo | Padronizar termo |
| WebChat | `/platform/webchat` | Dono/admin | Meu chat do site está ativo e configurado? | Ajustar widget/ver chats | Preview, visitante, IA, horários | Provider/IDs | Operação e configuração juntas | Separar abas por tarefa |
| Leads | `/platform/leads` | Comercial/dono | Quais oportunidades devo tratar? | Converter/assumir lead | Origem, contato, conversa | Dados técnicos | Lead x contato | Próxima ação no detalhe |
| Contatos | `/contact` | Atendente/marketing | Quem é esta pessoa e posso falar com ela? | Editar/segmentar/abrir histórico | Consentimento, origem, grupos | Logs internos | Contato x lead x consentimento | Regra visual única |
| LGPD | `/platform/lgpd` | Dono/admin | Quais dados/consentimentos preciso atender? | Exportar/anonimizar com confirmação | Eventos | Operação de chat | Confundir opt-in com atendimento | Copy de segurança |
| WhatsApp conexão | `/sessions` | Dono/admin | Meu canal WhatsApp está conectado? | Conectar/reconectar | QR, número, perfil | Logs profundos | Status x conexão | Centralizar canal |
| Envios | `/send`, `/platform/campanhas` | Marketing | Posso enviar campanha com segurança? | Enviar/agendar | Consentimento, limites, histórico | Fila de atendimento | Envio sem entender limite | Jornada por etapas |
| IA Atendimento | `/platform/inbox/ia` | Dono/admin | A IA está ajudando sem custo/risco indevido? | Configurar/testar | KB, consumo, fallback | Chave/provider bruto | Ativar sem entender custo | Separar modo, KB, custo |
| Plano | `/plans` | Dono/financeiro | Meu plano limita algo agora? | Revisar/alterar plano | Limites, cobrança, IA | Logs de billing global | Plano x créditos IA | Blocos de limite claro |
| Equipe | `/settings/team` | Dono/admin | Quem pode fazer o quê? | Convidar/editar papel | Status, perfil, OTP | RBAC bruto sem explicação | Quebrar atendimento por permissão | Perfis prontos e explicações |
| Admin SaaS | `/admin/dashboard` | Staff Radar Chat | O SaaS está saudável? | Investigar empresa/falha | Filas, erros, billing, auditoria | Dados tenant sem contexto | Global x tenant | Marcadores visuais fortes |

## 4. Cliente final

Avaliação por canal:

- WebChat: precisa saber se o chat está online, se há fila, se a conversa foi encaminhada para humano, se virou ticket e como consultar protocolo.
- WhatsApp: precisa receber mensagens simples, sem termos como triagem, SLA ou department.
- Fila: deve comunicar espera e próxima ação, não apenas "aguarde".
- Bot/IA: deve deixar claro quando é automação e quando haverá humano.
- Humano: deve parecer transição de atendimento, não troca de sistema.
- Ticket/protocolo: deve explicar acompanhamento assíncrono e retorno esperado.
- Fora do horário: deve dizer se haverá retorno, fallback WhatsApp, ou abertura de ticket.

## 5. Atendente

Avaliação por tarefa:

- Inbox: deve priorizar próxima conversa, não todos os sinais ao mesmo tempo.
- Fila: precisa separar fila de atendimento de fila de envio.
- Assumir: ação deve ficar visível quando a conversa está disponível.
- Responder: composer deve ficar focado e bloquear quando a conversa não permite resposta.
- Transferir: precisa indicar setor/agente e efeito para cliente.
- Criar ticket: deve aparecer como acompanhamento, não como resposta comum.
- Abrir contato/lead: útil, mas secundário ao atendimento.
- Status online/ausente/ocupado: deve ser entendido como disponibilidade real para fila.

## 6. Supervisor

Avaliação por operação:

- Supervisão: precisa ver fila, equipe, gargalos e conversas críticas.
- Equipe: status online, ausente, ocupado, offline e `supervisor_online` devem ter copy clara.
- Fila: deve mostrar espera, prioridade e capacidade.
- Redistribuição: ação de reatribuir precisa deixar claro impacto no atendente e no cliente.
- Supervisor online sem receber atendimento: deve ser tratado como modo de observação, não como atendimento.
- Gargalos: listas curtas de risco devem vir antes de detalhes.

## 7. Dono da empresa

Avaliação por decisão:

- Dashboard: precisa responder em segundos se a operação está saudável.
- Leads: precisa mostrar origem, conversão e próximas oportunidades.
- Tickets: precisa mostrar pendências, SLA e risco de cliente insatisfeito.
- CSAT: deve aparecer como saúde de atendimento, não relatório escondido.
- Equipe: precisa ver disponibilidade e carga sem detalhe técnico.
- Canais: WhatsApp/WebChat conectados e fallback devem ser óbvios.
- IA/créditos: consumo, risco de bloqueio e valor devem ser claros.
- Plano/billing: limites e cobrança devem estar ligados ao uso.
- Segurança: permissões, LGPD e backup devem ter linguagem de risco.

## 8. Admin SaaS

Avaliação por suporte:

- Empresas: distinguir tenant, plano, status e risco.
- Billing global: mostrar cobrança/erro sem misturar com billing tenant.
- Filas globais: separar fila global de fila tenant/atendimento/envio.
- Logs: evitar exposição excessiva por padrão; filtros claros.
- Erros: destacar severidade e empresa afetada.
- Auditoria: preservar rastreabilidade.
- Segurança: evidenciar ações sensíveis.
- Suporte: deep links para empresa devem deixar claro contexto global/tenant.

## 9. Dono/desenvolvedor Radar Chat

Avaliação de manutenção:

- Manutenção: mudanças visuais devem ser pequenas por fase.
- Rotas: não remover nem mover sem mapa de redirects/deep links.
- Permissões: `ROUTE_PERMISSIONS`, menu e capabilities precisam ficar alinhados.
- QA: cada fase precisa registrar comandos executados e não executados.
- Documentação: índice, changelog e registro devem acompanhar decisões.
- Testes por fase: lint/typecheck/build/E2E só quando seguros para o escopo.

## 10. Regras de UX obrigatórias para próximas fases

- Uma ação principal por tela ou por estado ativo.
- Menu por tarefa, não por tecnologia interna.
- Fila sempre com contexto: atendimento, envio, global ou Discord.
- Lead, Contato, Ticket e Atendimento com definição única.
- IA sempre com custo, limite ou risco claro quando aplicável.
- Billing em linguagem de dono/financeiro, sem jargão técnico excessivo.
- RBAC preservado em menu, rota, header e ação.
- Estados vazios com próxima ação explícita.
- Deep links e redirects legados preservados.
- Admin SaaS separado visualmente de tenant.
- Cliente final nunca deve ver linguagem interna.
