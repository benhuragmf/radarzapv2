# Radar Chat Layout v3 08 — Fase 4 Componentes Visuais Compartilhados

## 1. Objetivo

Fortalecer a base visual compartilhada do painel Radar Chat v2 na branch `layout-v3`, criando e refinando componentes pequenos do design system para reduzir duplicacao visual em telas futuras. A fase foi limitada a componentes reutilizaveis, estados visuais, documentacao e aplicacao segura em paineis de integracoes ja existentes.

Nao houve redesign amplo de paginas, mudanca de backend, banco, APIs, rotas, redirects, atendimento, filas, presenca, IA, creditos, billing, WhatsApp Bridge, WebChat publico/widget, Leads/Tickets/LGPD ou Admin SaaS backend.

## 2. Estado antes da alteração

| Item | Estado observado |
|------|------------------|
| Branch | `layout-v3` |
| Base | `66324ee docs: registrar resultados do release gate` |
| Design system | Ja existiam `RadarPageShell`, `PageHeader`, `SectionCard`, `EmptyState`, `LoadingState`, `ErrorState`, `StatusBadge`, `DataTable`, `ActionBar`, `FilterBar`, `ConfigSaveFooter`, `SaveBar` e helpers de formulario |
| Pontos de repeticao | Avisos inline em integracoes usavam markup local; estados vazios/carregando/erro tinham pouca variacao compacta; badges e tabela tinham margem para acessibilidade leve |
| Alteracoes locais ja existentes | Fases 1, 2 e 3 do Layout v3 em docs, menu, header e componentes de layout, preservadas |
| Ruido local preservado | `data/` e `mocker/modelochat/` continuaram sem alteracao |

## 3. Arquivos analisados

| Tipo | Arquivos |
|------|----------|
| Pedido e processo | Attachment da Fase 4 Componentes Visuais Compartilhados |
| Docs Layout v3 | `RADARCHAT-LAYOUT-V3-02-INVENTARIO-COMPONENTES-VISUAIS.md`, `RADARCHAT-LAYOUT-V3-03-MATRIZ-UX-PERSONAS-E-TELAS.md`, `RADARCHAT-LAYOUT-V3-04-CHECKLIST-QA-VISUAL-E-FUNCIONAL.md`, `RADARCHAT-LAYOUT-V3-06-FASE-2-MENU-E-NAVEGACAO.md`, `RADARCHAT-LAYOUT-V3-07-FASE-3-HEADER-OPERACIONAL.md` |
| Docs globais | `DESIGN-SYSTEM.md`, `INDICE-DOCUMENTACAO.md`, `CHANGELOG.md`, `SISTEMA-REGISTRO.md`, `MENUS-SISTEMA.md`, `MENU-PAGES-REGISTRY.md`, `EQUIPE-RBAC.md` |
| Design system | `src/services/web-dashboard/frontend/src/design-system/index.ts`, `components/PageHeader.tsx`, `RadarPageShell.tsx`, `SectionCard.tsx`, `EmptyState.tsx`, `LoadingState.tsx`, `ErrorState.tsx`, `PermissionState.tsx`, `StatusBadge.tsx`, `MetricCard.tsx`, `ActionBar.tsx`, `DataTable.tsx`, `FilterBar.tsx`, `ConfigSaveFooter.tsx`, `SaveBar.tsx`, `theme.ts`, `formClasses.ts` |
| UI base | `src/services/web-dashboard/frontend/src/components/ui/Button.tsx`, `Card.tsx`, `shadcn/table.tsx` |
| Aplicacao segura | `ApiKeysPanel.tsx`, `WebhooksPanel.tsx`, `ApiDocsPanel.tsx`, `RateLimitPanel.tsx`, `Settings.tsx`, `SecuritySettings.tsx` |

## 4. Inventário dos componentes compartilhados

| Componente | Estado antes | Decisao Fase 4 | Risco |
|------------|--------------|----------------|-------|
| `RadarPageShell` | Shell tenant padrao ja alinhado ao Inbox | Inspecionado, sem alteracao | Baixo |
| `PageHeader` | Titulo, subtitulo e acoes compartilhadas | Inspecionado, sem alteracao | Baixo |
| `SectionCard` | Card de secao com loading/empty/error | Melhorado com modo compacto e classes de header/body | Baixo visual |
| `EmptyState` | Estado vazio unico para telas/listas | Melhorado com `size` e `align` para cards/tabs compactos | Baixo visual |
| `LoadingState` | Skeleton generico | Melhorado com `label` acessivel e `rowClassName` | Baixo visual |
| `ErrorState` | Exibia erro e codigo quando informado | Melhorado com `retryLabel` e redacao de segredos comuns | Medio positivo |
| `InlineNotice` | Nao existia | Criado para avisos inline sem criar card extra | Baixo visual |
| `StatusBadge` | Badge semantico basico | Melhorado com `size`, `title`, `ariaLabel` e truncamento | Baixo visual |
| `DataTable` | Wrapper TanStack simples | Melhorado com `ariaLabel` e `tableClassName` | Baixo visual |
| `ActionBar` | Barra de acoes | Inspecionada, sem alteracao | Baixo |
| `FilterBar` | Filtros em linha | Inspecionada, sem alteracao | Baixo |
| `ConfigSaveFooter` / `SaveBar` | Padrao de salvar configuracoes | Inspecionados, sem alteracao | Baixo |
| `Button` / `Card` UI | Componentes base usados fora do DS | Inspecionados, sem alteracao | Baixo |

## 5. Alterações aplicadas

| Arquivo | Alteracao | Motivo | Como validar |
|---------|-----------|--------|--------------|
| `design-system/components/InlineNotice.tsx` | Criado componente de aviso inline com tons `info`, `success`, `warning`, `danger` e `neutral` | Padronizar avisos de contexto sem multiplicar cards locais | Conferir avisos em Integracoes/API |
| `design-system/index.ts` | Exportado `InlineNotice` | Tornar o componente importavel pelo alias `@/design-system` | Build TypeScript |
| `EmptyState.tsx` | Adicionados `size` e `align`, com `role="status"` | Permitir estado vazio compacto dentro de cards/tabs | Abrir listas vazias em Integracoes |
| `LoadingState.tsx` | Adicionados `label`, `rowClassName`, `role="status"` e `aria-label` | Melhorar acessibilidade sem mudar skeleton padrao | Build e leitor de estrutura DOM |
| `ErrorState.tsx` | Adicionados `retryLabel` e sanitizacao de mensagens com tokens/secrets comuns | Evitar vazamento visual acidental em mensagens de erro | Forcar erro local sem segredo real |
| `SectionCard.tsx` | Adicionados `compact`, `headerClassName` e `bodyClassName` | Dar variacao controlada para blocos internos | Build TypeScript |
| `StatusBadge.tsx` | Adicionados `size`, `title`, `ariaLabel` e truncamento | Padronizar badges compactos em listas/tabelas | Conferir linhas de API/Webhooks |
| `DataTable.tsx` | Adicionados `ariaLabel` e `tableClassName` | Nome acessivel e customizacao leve sem recriar tabela | Conferir docs da API |
| `ApiKeysPanel.tsx` | Aplicado `InlineNotice`, `StatusBadge`, `LoadingState label` e `EmptyState size="sm"` | Usar os novos padroes em uma tela segura de configuracao | `/settings` em abas de API |
| `WebhooksPanel.tsx` | Aplicado `InlineNotice`, badges de ativo/inativo e ultimo status HTTP | Padronizar informacao sensivel e estados de webhook | `/settings` em webhooks |
| `ApiDocsPanel.tsx` | Migrada listagem para `DataTable`; erro ganhou retry; exemplos usam `InlineNotice` | Usar tabela compartilhada sem alterar contrato OpenAPI | `/settings` em docs da API |
| `RateLimitPanel.tsx` | Erro com retry, aviso inline, badge de plano e grid responsivo | Melhorar consistencia visual e mobile | `/settings` em limites |
| `DESIGN-SYSTEM.md` | Registrados `InlineNotice` e padroes da Fase 4 | Documentar uso futuro | Revisao de docs |

## 6. Padrões definidos

| Padrao | Regra |
|--------|-------|
| Avisos inline | Usar `InlineNotice` para contexto, alerta leve, segredo recem-criado e ajuda curta dentro de cards/tabs |
| Estados vazios | Usar `EmptyState size="sm"` dentro de paineis compactos; manter tamanho padrao em telas/listas maiores |
| Carregamento | Nomear contexto com `LoadingState label` quando o estado aparece sozinho |
| Erros | Exibir erro real, mas usar `ErrorState` para redigir padroes comuns de segredo e oferecer retry quando existir `refetch` |
| Badges | Usar `StatusBadge size="sm"` em listas densas, webhooks, chaves e tabelas |
| Cards internos | Usar `SectionCard compact` antes de criar um novo card visual |
| Tabelas | Usar `DataTable ariaLabel` para listagens novas ou migracoes pequenas |
| Formularios | Manter `inputCls`, `selectCls`, `textareaCls` e helpers do design system |
| Acoes destrutivas | Manter confirmacao existente; nao trocar regra de revogacao/remocao nesta fase |
| Responsividade | Preferir `flex-wrap`, `min-w-0`, truncamento e grids `sm:grid-cols-*` para evitar estouro |

## 7. Componentes criados ou melhorados

### Criado

- `InlineNotice`: aviso inline com icone padrao por tom, titulo opcional e conteudo livre. Serve para contexto de API, segredo exibido uma unica vez, alerta leve e mensagens informativas sem empilhar cards.

### Melhorados

- `EmptyState`: ganhou variacao compacta e alinhamento inicial/central.
- `LoadingState`: ganhou label acessivel e customizacao de linha de skeleton.
- `ErrorState`: ganhou texto de retry configuravel e sanitizacao de segredos comuns.
- `SectionCard`: ganhou modo compacto e pontos seguros de customizacao de header/body.
- `StatusBadge`: ganhou variacao compacta, `title`, `ariaLabel` e truncamento.
- `DataTable`: ganhou `ariaLabel` e `tableClassName`.

## 8. Telas impactadas

| Tela | Impacto |
|------|---------|
| `/settings` — API Keys | Aviso padronizado, segredo recem-criado em `InlineNotice`, estado vazio compacto e badge ativo/inativo |
| `/settings` — Webhooks | Aviso HMAC padronizado, secret em `InlineNotice`, badges de ativo/inativo e ultimo HTTP |
| `/settings` — API Docs | Listagem de endpoints passa por `DataTable`; erro tem retry; exemplo fica em aviso neutro |
| `/settings` — Rate Limit | Grid responsivo, erro com retry, aviso neutro e badge do plano |
| `/settings/security` | Impacto indireto apenas quando renderiza `ApiKeysPanel`; mesma API e mesma regra de exibicao |
| Telas futuras | Ganham padroes compartilhados para avisos, estados e tabelas sem nova dependencia |

Nao foram alteradas as telas proibidas do escopo: `/platform/inbox`, `/platform/leads`, `/platform/webchat`, `/plans`, `/admin/dashboard` e `/platform/inbox/ia`.

## 9. RBAC e segurança preservados

- Nenhuma capability foi criada, removida ou renomeada.
- `ROUTE_PERMISSIONS`, `ProtectedRoute`, menus, redirects e deep links nao foram alterados nesta fase.
- As chamadas existentes continuam nos mesmos endpoints: `/integrations/api-keys`, `/integrations/webhooks`, `/integrations/openapi`, `/integrations/rate-limit`.
- Payloads de criacao/remocao de chaves e webhooks foram preservados.
- A chave de API completa e o secret de webhook continuam aparecendo apenas no retorno de criacao, como antes.
- `ErrorState` agora redige padroes comuns de segredo em mensagens visuais de erro, reduzindo risco de exposicao em tela.
- Nenhum `.env`, dado real, producao, banco remoto ou segredo foi aberto.

## 10. Responsividade

| Area | Comportamento esperado |
|------|------------------------|
| Paineis de integracoes | Inputs e botoes usam `flex-wrap` e `min-w` para quebrar em mobile sem sobrepor |
| Rate limits | Cards passam de uma coluna no mobile para duas colunas em `sm+` |
| Badges | `StatusBadge` trunca texto longo sem empurrar a linha |
| Tabelas | `DataTable` usa o `Table` base, que ja possui overflow horizontal |
| Estados compactos | `EmptyState size="sm"` reduz altura em cards internos |
| Avisos | `InlineNotice` usa grid flexivel e texto com quebra, incluindo `code break-all` para segredos |

## 11. QA recomendado

- Abrir `/settings` com usuario autorizado e validar abas de API Keys, Webhooks, API Docs e Rate Limit.
- Criar uma chave de API em ambiente local/mock e confirmar que a chave completa aparece uma vez, com botao copiar.
- Criar webhook local de teste e confirmar que o secret aparece em aviso de alerta.
- Simular erro nas queries de OpenAPI e Rate Limit para confirmar retry e sanitizacao visual.
- Testar mobile 390px, tablet e desktop 1366px para inputs, badges, cards e tabela.
- Testar tema claro/escuro para contraste dos tons `info`, `warning`, `danger`, `success` e `neutral`.
- Confirmar que perfis sem permissao para settings continuam bloqueados pelas regras ja existentes.

## 12. Riscos e pendências

### Resolvido nesta fase

- Criado padrao unico para avisos inline.
- Estados vazios/carregando/erro ganharam variacoes seguras para paineis compactos.
- Badges e tabela ficaram mais preparados para acessibilidade e responsividade.
- Paineis de integracoes passaram a consumir componentes compartilhados sem mudar contratos.

### Encontrado mas não alterado

- `PageHeader`, `RadarPageShell`, `ActionBar`, `FilterBar`, `ConfigSaveFooter` e `SaveBar` foram mantidos como estao para evitar refatoracao ampla.
- Nao houve QA manual em navegador real nesta etapa.
- Nao foi criada biblioteca de modais, tabs ou toasts nova.
- Nao foi feita migracao ampla de todas as telas para `InlineNotice` ou `DataTable`.

### Precisa decisão do dono

- Validar visualmente se o tom `warning` deve ser usado para segredos recem-criados ou se prefere `danger`.
- Confirmar quais telas futuras devem ser migradas primeiro para `InlineNotice` e `DataTable`.
- Decidir se a proxima fase deve focar `PageHeader`/paginas internas ou um QA visual navegavel.

## 13. Pacote para enviar ao ChatGPT

Enviar no proximo chat:

1. Resumo final do Codex da Fase 4.
2. `docs/RADARCHAT-LAYOUT-V3-08-FASE-4-COMPONENTES-VISUAIS-COMPARTILHADOS.md`
3. `docs/DESIGN-SYSTEM.md`
4. `src/services/web-dashboard/frontend/src/design-system/components/InlineNotice.tsx`
5. `src/services/web-dashboard/frontend/src/design-system/components/EmptyState.tsx`
6. `src/services/web-dashboard/frontend/src/design-system/components/LoadingState.tsx`
7. `src/services/web-dashboard/frontend/src/design-system/components/ErrorState.tsx`
8. `src/services/web-dashboard/frontend/src/design-system/components/SectionCard.tsx`
9. `src/services/web-dashboard/frontend/src/design-system/components/StatusBadge.tsx`
10. `src/services/web-dashboard/frontend/src/design-system/components/DataTable.tsx`
11. `src/services/web-dashboard/frontend/src/design-system/index.ts`
12. `src/services/web-dashboard/frontend/src/components/integrations/ApiKeysPanel.tsx`
13. `src/services/web-dashboard/frontend/src/components/integrations/WebhooksPanel.tsx`
14. `src/services/web-dashboard/frontend/src/components/integrations/ApiDocsPanel.tsx`
15. `src/services/web-dashboard/frontend/src/components/integrations/RateLimitPanel.tsx`
16. `docs/INDICE-DOCUMENTACAO.md`
17. `docs/CHANGELOG.md`
18. `docs/SISTEMA-REGISTRO.md`

Nao precisa reenviar:

- Backend, modelos Mongo, servicos IA/billing/WhatsApp/WebChat.
- Docs completos de TOPs.
- `data/` e `mocker/modelochat/`.
- Arquivos `.env`.
