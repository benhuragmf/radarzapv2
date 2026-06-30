# Auditoria de renomeação de menus — Radar Chat v2

**Versão:** 2.10.67 · **Data:** 2026-06-19

## 1. Resumo

Auditoria completa da navegação tenant (sidebar, subnav de atendimento, títulos de página e header) com foco em nomes claros em PT-BR, alinhados à função real de cada rota. **Nenhuma rota ou permissão foi alterada** — apenas labels visuais, ícones e textos de apoio.

Principais mudanças:
- Módulo **Inbox** passa a ser exibido como **Caixa de Entrada** em menus e títulos.
- **WebChat** deixa de aparecer como “Site — histórico” e vira **Chat do Site** (widget + histórico + configuração).
- Submenus de atendimento ganham nomes descritivos (Triagem e Bot, IA de Atendimento, Supervisão, Métricas, Chamados).
- Grupos **Envios WhatsApp**, **Integrações** e **Empresa** com labels mais objetivos.

## 2. Tabela de renomeações (Plataforma — tenant)

| Rota | Nome anterior | Nome novo | Motivo |
|------|---------------|-----------|--------|
| `/platform/inbox` | Inbox | **Caixa de Entrada** | Termo técnico em inglês; página é a central de conversas WA + site |
| `/platform/inbox/tickets` | Tickets | **Chamados** | “Ticket” é jargão; usuário entende “chamado de atendimento” |
| `/platform/inbox/setores` | Setores do Inbox | **Setores** | Redundância; contexto já é atendimento |
| `/platform/inbox/bot` | Bot do Inbox | **Triagem e Bot** | Página inclui CSAT, menu setores, triagem — não só “bot” |
| `/platform/inbox/ia` | IA Atendimento | **IA de Atendimento** | Nome completo e profissional |
| `/platform/inbox/respostas` | Respostas rápidas | *(mantido)* | Já claro |
| `/platform/inbox/supervisor` | Supervisor | **Supervisão** | Nome da função/área, não do cargo |
| `/platform/inbox/relatorios` | Relatórios Inbox | **Métricas** | Foco em KPIs de atendimento |
| `/platform/webchat` | Site — histórico | **Chat do Site** | Página configura widget, aparência, instalação e histórico |
| `/send` (grupo) | Mensagens | **Envios WhatsApp** | Diferencia envios em massa do atendimento conversacional |
| `/platform/wa-stories` | Publicar status | **Status WhatsApp** | Ação + canal explícitos |
| `/platform/templates` | Modelos | **Modelos de mensagem** | Escopo claro |
| `/platform/segmentos` | Segmentos / Listas | **Listas e segmentos** | Ordem natural em PT-BR |
| `/platform/automacoes` | Regras automáticas | **Regras de automação** | Gramática e consistência |
| `/send/autoagendamentos` | Agend. automação | **Agendamentos automáticos** | Abreviação confusa removida |
| `/sessions` | Sessões e QR Code | **Conexão WhatsApp** | Objetivo da tela (conectar número) |
| `/platform/wa-status` | Status das conexões | **Status da conexão** | Singular alinhado ao uso típico |
| `/platform/wa-logs` | Logs | **Logs WhatsApp** | Diferencia de logs gerais/plataforma |
| `/integrations/playground` | Playground | **Testar API** | Ação clara para não-devs |
| `/settings#api-docs` | Documentação | **Docs da API** | Termo técnico conhecido, mais curto |
| `/settings` | Minha empresa | **Configurações da empresa** | Escopo da página |
| `/settings/team` | Equipe e cargos | **Equipe e permissões** | Reflete RBAC real |
| `/plans` | Plano e limites | **Plano e cobrança** | Inclui billing |
| `/settings/permissions` | Permissões | **Papéis e permissões** | Diferencia de permissões de API |

## 3. Admin (staff interno)

| Rota | Nome anterior | Nome novo | Motivo |
|------|---------------|-----------|--------|
| `/admin/ai-blueprint` | Blueprint IA | **Modelo global de IA** | Descreve o conteúdo (template IA sistema) |

Demais itens admin mantidos — já eram descritivos (Clientes, Fila global, Logs globais, etc.).

## 4. Discord

Nenhuma alteração — nomenclatura já alinhada ao fluxo Discord → WhatsApp e público técnico específico.

## 5. Ícones atualizados (Lucide)

| Menu | Ícone anterior | Ícone novo |
|------|----------------|------------|
| Caixa de Entrada | MessageSquare | **Inbox** |
| Respostas rápidas | Zap | **MessageSquareText** |
| Chat do Site | Globe | **PanelTop** |

## 6. Arquivos alterados

- `src/services/web-dashboard/frontend/src/lib/navConfig.ts` — sidebar, `PAGE_TITLES`, ícones
- `src/services/web-dashboard/frontend/src/components/inbox/InboxAtendimentoNav.tsx` — subnav horizontal
- `src/services/web-dashboard/frontend/src/pages/menu/Inbox.tsx`
- `src/services/web-dashboard/frontend/src/pages/menu/InboxSectors.tsx`
- `src/services/web-dashboard/frontend/src/pages/menu/InboxBotSettings.tsx`
- `src/services/web-dashboard/frontend/src/pages/menu/AiAtendimento.tsx`
- `src/services/web-dashboard/frontend/src/pages/menu/InboxQuickReplies.tsx`
- `src/services/web-dashboard/frontend/src/pages/menu/InboxSupervisor.tsx`
- `src/services/web-dashboard/frontend/src/pages/menu/InboxReports.tsx`
- `src/services/web-dashboard/frontend/src/pages/menu/InboxTickets.tsx`
- `src/services/web-dashboard/frontend/src/pages/menu/WebChat.tsx`
- `src/services/web-dashboard/frontend/src/components/webchat/WebChatVisitorPanel.tsx`
- `src/services/web-dashboard/frontend/src/components/inbox/InboxTicketDetailView.tsx`
- `src/services/web-dashboard/frontend/src/components/team/TeamPermissionsEditor.tsx`
- `src/services/web-dashboard/frontend/src/pages/TeamMembers.tsx`
- `src/services/web-dashboard/frontend/src/pages/Settings.tsx`
- `src/services/web-dashboard/frontend/src/pages/Dashboard.tsx`
- `src/services/web-dashboard/frontend/src/App.tsx`
- `src/services/web-dashboard/frontend/src/components/integrations/ApiPlayground.tsx`
- `src/services/web-dashboard/frontend/src/lib/useWebChatNavAlerts.ts`
- `src/services/web-dashboard/frontend/src/pages/admin/AdminAiBlueprint.tsx`

## 7. Itens não alterados (e por quê)

| Item | Motivo |
|------|--------|
| Paths/URLs (`/platform/inbox`, etc.) | Regra do projeto: evitar quebra de links e bookmarks |
| IDs internos (`inbox`, `webchat`, caps RBAC) | Estáveis para API e permissões |
| Nomes de componentes (`Inbox.tsx`, `InboxService`) | Código interno; risco de regressão |
| Aba **Plataforma / Discord / Admin** | Termos de modo já conhecidos pela equipe |
| **Contatos**, **Campanhas**, **Auditoria**, **Gatilhos** | Já claros no contexto |
| Canal Instagram/Messenger/E-mail | Não implementados no código |
| Reorganização em subgrupos “Chat do Site” separado | Sidebar usa seções planas; WebChat permanece em Atendimento por proximidade operacional |
| i18n EN | Projeto não possui camada i18n — tudo PT-BR |

## 8. Melhorias futuras sugeridas

1. **Grupo “Chat do Site”** na sidebar — mover WebChat para subgrupo próprio quando houver mais itens (Aparência, Instalação como rotas separadas).
2. **Atalho “Caixa de Entrada”** na Visão geral (`Dashboard.tsx`) — hoje só envios/contatos/modelos.
3. **Unificar “Chamados” vs “Tickets”** nos badges internos (`ticketRef`) — manter “Ticket #123” no chat é OK; menu usa “Chamados”.
4. **Documentação in-app** (`blueprintAdminHelp.ts`, docs de módulo) — revisar referências legadas “Inbox → IA”.

## 9. Riscos de navegação

| Risco | Mitigação |
|-------|-----------|
| Usuários buscando “Inbox” | Termo ainda usado em código/deep links; rotas iguais |
| Subnav “Caixa de Entrada” longo em mobile | Scroll horizontal já existente; abreviação “Entrada” possível se feedback negativo |
| Alertas/notificações com texto antigo | `useWebChatNavAlerts.ts` atualizado |

## 10. Checklist de validação

- [x] Labels sidebar alinhados com `PAGE_TITLES`
- [x] Subnav atendimento consistente com sidebar
- [x] Títulos `PlatformPage` / `PageHeader` atualizados nas páginas principais
- [x] Permissões RBAC inalteradas
- [x] Rotas inalteradas
- [x] `npm run lint` (backend) — executado; erros pré-existentes no repo (não nos arquivos alterados)
- [ ] `npm run build` (frontend) — falha pré-existente em `Inbox.tsx:199` (`AuthUser | undefined`); não introduzida por esta auditoria
- [x] Arquivos alterados sem erros ESLint nos paths editados
- [ ] QA manual desktop/mobile sidebar + subnav

## 11. Comandos de validação

```bash
npm run lint
npm run build
```

*(Testes E2E não referenciam textos de menu por nome.)*
