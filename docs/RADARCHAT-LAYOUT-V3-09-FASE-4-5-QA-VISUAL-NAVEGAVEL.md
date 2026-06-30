# Radar Chat Layout v3 09 - Fase 4.5 QA Visual Navegavel

## 1. Objetivo

Executar uma QA visual navegavel curta depois das Fases 2, 3 e 4 do Layout v3, antes de entrar em Inbox/Chat, validando que menu, header, componentes compartilhados e marca publica continuam coerentes na branch `layout-v3`.

Esta fase tambem absorve a decisao de marca/domino informada em 2026-06-29: produto publico **Radar Chat**, site `https://radarchat.com.br`, app `https://app.radarchat.com.br` e deploy via Coolify.

Nao houve redesign de Inbox, Leads, Dashboard, WebChat, billing, IA, WhatsApp Bridge, atendimento, filas, presenca, RBAC, rotas, banco, backend, `.env`, producao ou dados reais.

## 2. Estado antes da QA

| Item | Estado observado |
|------|------------------|
| Branch de trabalho | `layout-v3` |
| Base Git | `2757b2b docs(infra): entrega Coolify 2.12.71 + prompt Codex e workflows layout-v3` |
| Branches protegidas | `main` e `develop/developed` nao foram usadas para edicao |
| Produto | `package.json` em `2.12.71` apos correcao local |
| Deploy | Coolify e branch `layout-v3` registrados em docs |
| Site publico novo | `site/radarchat/` presente como arquivo novo local |
| Script publico novo | `scripts/deploy-radarchat-ftp.mjs` presente como arquivo novo local |
| Ruido/runtime local | `data/` e `mocker/modelochat/` continuam sem alteracao de produto |

## 3. Arquivos analisados

| Grupo | Arquivos |
|-------|----------|
| Processo Layout v3 | `RADARCHAT-LAYOUT-V3-06-FASE-2-MENU-E-NAVEGACAO.md`, `RADARCHAT-LAYOUT-V3-07-FASE-3-HEADER-OPERACIONAL.md`, `RADARCHAT-LAYOUT-V3-08-FASE-4-COMPONENTES-VISUAIS-COMPARTILHADOS.md`, `RADARCHAT-LAYOUT-V3-04-CHECKLIST-QA-VISUAL-E-FUNCIONAL.md` |
| Docs globais | `DESIGN-SYSTEM.md`, `CHANGELOG.md`, `SISTEMA-REGISTRO.md`, `INDICE-DOCUMENTACAO.md`, `MENUS-SISTEMA.md`, `MENU-PAGES-REGISTRY.md`, `PREPARACAO-PRODUCAO.md`, `PREPARACAO-PRODUCAO-EXECUCAO.md`, `COOLIFY-DEPLOY.md` |
| Navegacao/Header | `navConfig.ts`, `Header.tsx`, `HeaderStatusPills.tsx`, `AgentStatusSelector.tsx`, `OrganizationSwitcher.tsx`, `EventNotificationBell.tsx`, `Sidebar.tsx` |
| Design system | `InlineNotice`, `EmptyState`, `LoadingState`, `ErrorState`, `SectionCard`, `StatusBadge`, `DataTable`, `index.ts` |
| Integracoes/API | `ApiKeysPanel.tsx`, `WebhooksPanel.tsx`, `ApiDocsPanel.tsx`, `ApiPlayground.tsx` |
| Marca publica | `frontend/index.html`, `manifest.webmanifest`, `Login.tsx`, `ChooseCompany.tsx`, `site/radarchat/index.html`, `webchat/*`, `leads/form.js` |

## 4. Rotas e perfis auditados

| Rota/perfil | Viewport | Status | Evidencia |
|-------------|----------|--------|-----------|
| `/` login | 1366x768 | Aprovado | H1 e title exibem `Radar Chat`; sem `Radar Chat`; `scrollWidth=1366` |
| `/` login | 390x844 | Aprovado | H1/title `Radar Chat`; botoes Google/Discord visiveis; `scrollWidth=390` |
| `site/radarchat/index.html` | HTML local | Aprovado com ressalva | Marca e links revisados por arquivo; browser `file://` foi bloqueado pela politica do ambiente |
| `/dashboard` | Autenticado | Nao testado | Sem sessao mock/login local para entrar no painel |
| `/platform/inbox` | Autenticado | Nao testado | Escopo proibiu redesign e nao havia sessao autenticada |
| `/platform/leads` | Autenticado | Nao testado | Sem sessao autenticada |
| `/platform/webchat` | Autenticado | Nao testado | Sem sessao autenticada |
| `/platform/inbox/ia` | Autenticado | Nao testado | Sem sessao autenticada |
| `/platform/inbox/bot` | Autenticado | Nao testado | Sem sessao autenticada |
| `/settings` / Integracoes API | Autenticado | Nao testado em browser | Inspecao estatica dos paineis alterados; build/lint focado aprovados |
| `/admin/dashboard` | Staff | Nao testado | Sem sessao staff |
| OWNER | Desktop/mobile | Nao testado | Pendente QA manual com usuario real ou mock seguro |
| ADMIN | Desktop/mobile | Nao testado | Pendente QA manual |
| MANAGER | Desktop/mobile | Nao testado | Pendente QA manual |
| ATTENDANT | Desktop/mobile | Nao testado | Pendente QA manual |
| Custom role | Desktop/mobile | Nao testado | Pendente QA manual de capabilities |
| Staff/Admin SaaS | Desktop/mobile | Nao testado | Pendente QA manual |

## 5. QA visual executada

| Item | Resultado |
|------|-----------|
| Dev server Vite local | Executado em `http://localhost:5174/` e encerrado depois |
| Login desktop | Aprovado, sem overflow horizontal e sem marca antiga visivel |
| Login mobile | Aprovado, sem overflow horizontal e sem marca antiga visivel |
| Titulo do app | Corrigido para `Radar Chat` em `frontend/index.html` |
| Manifest PWA | Corrigido para `Radar Chat` |
| Site publico | Revisado por HTML; widget aponta para `https://app.radarchat.com.br` |
| Browser site publico local | Nao concluido por bloqueio `file://`; nao foi feito workaround inseguro |

## 6. Problemas encontrados

| ID | Severidade | Problema | Status |
|----|------------|----------|--------|
| P4.5-01 | P2 | Titulo HTML do app ainda dizia `Radar Chat` | Corrigido |
| P4.5-02 | P2 | Manifest PWA ainda dizia `Radar Chat` | Corrigido |
| P4.5-03 | P2 | Site publico usava marca colada `RadarChat` em textos visiveis | Corrigido para `Radar Chat` |
| P4.5-04 | P2 | Site publico carregava widget do host `sslip.io` e versao antiga `2.11.21` | Corrigido para `app.radarchat.com.br` e `2.12.71` |
| P4.5-05 | P2 | Footer do formulario de leads apontava para `radarchat.com.br` | Corrigido para `radarchat.com.br` |
| P4.5-06 | P2 | `package.json` local estava em `2.12.70` apesar da base `2.12.71` | Corrigido para `2.12.71` |
| P4.5-07 | P3 | Lint focado apontou dividas em arquivos tocados (`location.href`, imports mortos e effect) | Corrigido sem alterar contratos |
| P4.5-08 | P3 | QA autenticada por perfil nao foi possivel no ambiente local | Pendente manual |

## 7. Correcoes aplicadas

| Area | Arquivos | Correcoes |
|------|----------|-----------|
| Marca app | `Login.tsx`, `ChooseCompany.tsx`, `Sidebar.tsx`, paginas/menu/admin/integracoes, `frontend/index.html`, `manifest.webmanifest` | Textos visiveis alterados para `Radar Chat` |
| Marca widget/WebChat | `src/services/web-dashboard/webchat/*`, `widget.js`, `widget.html` | Labels/logs/preview com `Radar Chat`; build do widget preservado |
| Marca leads | `leads/form.js`, `leadIntegrationSnippets.ts` | Footer/link/snippets com `Radar Chat` e `radarchat.com.br` |
| Site publico | `site/radarchat/index.html` | Marca `Radar Chat`; CTAs `app.radarchat.com.br`; widget oficial do app |
| Coolify/docs infra | `.env.coolify.example`, `docker-compose.coolify.yml`, `COOLIFY-DEPLOY.md`, `PREPARACAO-PRODUCAO*.md` | Dominios oficiais e nome publico atualizados |
| Lint focado | `ChooseCompany.tsx`, `AiAtendimento.tsx` | Redirect via `location.assign`, imports removidos, sync de form agendado fora do corpo imediato do effect |

## 8. Itens nao alterados

- Backend, banco, migrations, modelos, controllers, services e contratos REST.
- Rotas, redirects, deep links, `ROUTE_PERMISSIONS`, RBAC e capabilities.
- Fluxos de Inbox, Chat, WebChat publico/widget runtime, filas, presenca, atendimento, WA Bridge, IA e billing.
- `.env` real, secrets, dados de producao, Mongo/Redis remoto e painel Coolify real.
- Identificadores tecnicos `radarchat` quando fazem parte de contrato, storage, volumes, env vars, package scopes ou historico.

## 9. RBAC e seguranca

| Item | Status |
|------|--------|
| `X-Radar Chat-Signature` | Preservado como header de contrato dos webhooks |
| `RADARCHAT_SYSTEM_ADMIN_DISCORD_IDS` | Preservado como env var tecnica |
| Volumes `radarchat-*` | Preservados para nao quebrar dados persistentes |
| CSS tokens `--rz-*` | Preservados como design-system tecnico |
| Capabilities | Nenhuma capability criada, removida ou renomeada |
| Secrets | Nenhum `.env` real ou segredo foi aberto/imprimido |

## 10. Responsividade e tema

| Cenario | Status |
|---------|--------|
| 1366x768 login | Aprovado |
| 390x844 login | Aprovado |
| 1920x1080 painel autenticado | Pendente manual |
| Sidebar aberta/fechada | Pendente manual com sessao autenticada |
| Dark/light em painel autenticado | Pendente manual |
| Nomes longos de empresa/usuario | Pendente manual |
| Tabelas/drawers autenticados | Pendente manual |

## 11. Comandos executados e validacoes

| Comando/acao | Resultado |
|--------------|-----------|
| `git status --short --branch` | Confirmou branch `layout-v3`; worktree com alteracoes locais e `data/`/`mocker/modelochat/` untracked preservados |
| `git switch layout-v3` | Executado antes das edicoes; branch alinhada a `origin/layout-v3` |
| `rg` de marca/dominos | Sem marca antiga nos arquivos de produto auditados, exceto contratos preservados |
| Vite dev server local | Login desktop/mobile validado; servidor encerrado |
| `npm run build --prefix src/services/web-dashboard/frontend` | Aprovado apos correcoes; aviso de chunks > 500 kB ja conhecido do Vite |
| `npm exec -- eslint ...` focado | Aprovado nos arquivos TS/TSX auditados |
| `git diff --check` | Aprovado; apenas avisos de CRLF do Git no Windows |

## 12. Pendencias manuais

- QA autenticada por perfil: OWNER, ADMIN, MANAGER, ATTENDANT, custom role e staff.
- Navegacao real em `/dashboard`, `/platform/inbox`, `/platform/leads`, `/platform/webchat`, `/platform/inbox/ia`, `/settings`, `/admin/dashboard`, `/plans`, `/sessions` e `/team`.
- Viewports 1920x1080, mobile autenticado, sidebar expandida/recolhida, dark/light e nomes longos.
- Smoke real em `https://app.radarchat.com.br` e site `https://radarchat.com.br` fora deste ambiente local.
- Validacao manual do painel Coolify/servidor local continua como pendencia de infra, nao resolvida por esta fase visual.

## 13. Decisao para a proxima fase

**Liberar com ressalvas para continuar o Layout v3**, porque a marca publica atual foi aplicada, o build do frontend passou, o lint focado passou e nao houve alteracao em backend/RBAC/rotas.

Ressalva obrigatoria: nao declarar "QA navegavel completa do painel" ate existir sessao autenticada por perfil e evidencia real das rotas internas. Antes de merge para `main` ou go-live comercial, executar a QA manual autenticada desta secao.

Registro: `layout-v3-fase-4-5-qa`.
