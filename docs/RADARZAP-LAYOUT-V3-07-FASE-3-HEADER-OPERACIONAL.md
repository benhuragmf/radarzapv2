# RadarZap Layout v3 07 — Fase 3 Header Operacional

## 1. Objetivo

Melhorar a hierarquia do header/topbar do painel RadarZap v2 na branch `layout-v3`, deixando os controles operacionais em ordem mais previsível e reduzindo risco de quebra em telas menores. A fase foi limitada a organização visual, espaçamento, tooltips e acessibilidade leve, sem alterar backend, banco, APIs, IA, billing, WhatsApp Bridge, WebChat público, atendimento, presença, filas, rotas ou RBAC.

## 2. Estado antes da alteração

| Item | Estado observado |
|------|------------------|
| Branch | `layout-v3` |
| Base | `66324ee docs: registrar resultados do release gate` |
| Header antes | Título da página dividia a área esquerda com pills WA/IA/LM; lado direito trazia empresa, sino, status do agente, tema, perfil e sair |
| Risco visual | Pills operacionais podiam competir com o título em larguras menores; empresa/status tinham largura pouco estável; logout não tinha `aria-label` |
| Alterações locais já existentes | Fase 1/2 Layout v3 em docs e `navConfig.ts`, preservadas |
| Ruído local preservado | `data/` e `mocker/modelochat/` continuaram sem alteração |

## 3. Arquivos analisados

| Tipo | Arquivos |
|------|----------|
| Docs Layout v3 | `RADARZAP-LAYOUT-V3-02`, `03`, `04`, `06` |
| Docs menu/RBAC/domínios | `MENUS-SISTEMA.md`, `MENU-PAGES-REGISTRY.md`, `EQUIPE-RBAC.md`, `IA-CREDITOS-E-CARTEIRA.md`, `INBOX-ATENDIMENTO.md`, `WEBCHAT.md`, `BILLING.md` |
| Docs globais | `INDICE-DOCUMENTACAO.md`, `CHANGELOG.md`, `SISTEMA-REGISTRO.md` |
| Código header | `Header.tsx`, `HeaderStatusPills.tsx`, `EventNotificationBell.tsx`, `AgentStatusSelector.tsx`, `OrganizationSwitcher.tsx`, `Layout.tsx` |
| Código navegação/RBAC | `navConfig.ts`, `auth.ts` |

## 4. Alterações aplicadas

| Arquivo | Alteração | Motivo | Risco | Como validar |
|---------|-----------|--------|-------|--------------|
| `Header.tsx` | Reordenou a topbar: título isolado à esquerda; empresa, eventos, status do agente, WA/IA/LM, tema, perfil e sair à direita | Dar hierarquia operacional clara e reduzir competição visual com o título | Médio visual | Abrir rotas principais em desktop/mobile e confirmar truncamento |
| `HeaderStatusPills.tsx` | Aceita `className`, usa altura estável, fica compacto antes de `xl`, melhora tooltips/ARIA de WA, IA e LM | Manter indicadores sem estourar largura | Médio visual | Validar perfis com `inbox:view` e `inbox:ai:balance:view` |
| `OrganizationSwitcher.tsx` | Compacta botão em telas pequenas, mantém nome visível a partir de `sm`, adiciona `aria-label`/`aria-expanded` | Evitar que nome de empresa comprido empurre controles | Baixo | Testar usuário com múltiplas empresas |
| `AgentStatusSelector.tsx` | Compacta status em telas menores, mantém seletor clicável, adiciona ARIA | Preservar presença operacional sem ocupar largura excessiva | Médio | Testar perfil com `inbox:reply` e troca de status |
| `EventNotificationBell.tsx` | Tooltip/ARIA passa a informar eventos não lidos | Mais clareza sem alterar lógica do sino | Baixo | Abrir sino e rota `/dashboard/notificacoes` |

## 5. Header antes x depois

| Área | Antes | Depois |
|------|-------|--------|
| Esquerda | Menu mobile, título e pills WA/IA/LM no mesmo grupo | Menu mobile e título apenas, com truncamento natural |
| Direita | Empresa, sino, status, tema, perfil, sair | Empresa, eventos, status do agente, indicadores WA/IA/LM, tema, perfil, sair |
| Indicadores | Sempre tentavam ocupar espaço ao lado do título | Visíveis no desktop operacional (`lg+`), compactos até `xl` e completos em telas largas |
| Empresa | Nome podia consumir largura em mobile | Ícone compacto em telas pequenas; nome reaparece em `sm+` |
| Status agente | Label aparecia cedo e podia pressionar o header | Ícone compacto no mobile; label reaparece em `md+` |
| Acessibilidade | Alguns botões tinham apenas `title` | Botões principais ganharam `aria-label`/`aria-expanded` onde aplicável |

## 6. RBAC/capabilities preservadas

- `HeaderStatusPills` continua usando `inbox:view` para WhatsApp e `inbox:ai:balance:view` para IA/LM.
- A navegação do pill WhatsApp continua respeitando `whatsapp:session:view`: quem gerencia sessão abre `/sessions`; quem só atende abre `/platform/inbox`.
- `AgentStatusSelector` continua aparecendo apenas para `inbox:reply`.
- `EventNotificationBell` não mudou lógica de leitura, urgência, dedup ou rotas.
- `OrganizationSwitcher` não mudou `switchOrganization`, redirect para `/dashboard` nem escopo multiempresa.
- Nenhuma capability foi criada, removida ou renomeada.
- `ROUTE_PERMISSIONS`, `ProtectedRoute`, backend RBAC e modelos não foram alterados.

## 7. Responsividade

| Viewport | Comportamento esperado |
|----------|------------------------|
| Mobile | Título trunca; empresa/status aparecem compactos; sino, tema, perfil e sair mantêm alvo estável de 32px |
| Tablet | Empresa ganha nome; status ainda pode ficar compacto conforme largura |
| Desktop `lg` | Indicadores WA/IA/LM aparecem na topbar em modo compacto |
| Desktop `xl+` | Indicadores mostram labels/contadores completos |
| Inbox | Altura do header continua `h-14`, preservando o shell especial de `/platform/inbox` |

## 8. Segurança visual

- Não foram exibidos dados sensíveis novos; os indicadores continuam mostrando apenas status/saldo já autorizado por capability.
- Não houve alteração de payload, endpoint, polling, mutação, storage local, cookie ou token.
- O header não ganhou ação destrutiva nova; o botão sair apenas recebeu `type="button"` e `aria-label`.
- A compactação por breakpoint reduz risco de sobreposição sem esconder regras de permissão.

## 9. QA recomendado

- Desktop 1366x768: validar `/dashboard`, `/platform/inbox`, `/platform/inbox/ia`, `/sessions`, `/plans`, `/admin/dashboard`.
- Desktop 1920x1080: confirmar que WA/IA/LM mostram texto completo e não criam espaçamento estranho.
- Mobile 390px: abrir menu, trocar tema, abrir sino, abrir status do agente e confirmar que não há sobreposição.
- Usuário atendente: confirmar status operacional e WA visível conforme `inbox:view`; IA/LM não deve aparecer sem `inbox:ai:balance:view`.
- Usuário manager/admin/owner: confirmar IA/LM conforme permissão e link para `/platform/inbox/ia`.
- Usuário com múltiplas empresas: testar troca de empresa e redirect para `/dashboard`.
- Staff/Admin SaaS: confirmar que header não mistura dados globais e tenant além do comportamento já existente.
- Dark/light: validar contraste de botões, pills e badges do sino.

## 10. Riscos e pendências

### Resolvido nesta fase

- Header deixou de misturar título e indicadores operacionais na mesma área.
- Controles ganharam ordem operacional mais clara.
- Empresa e status do agente ficaram mais estáveis em telas menores.
- Pills WA/IA/LM ganharam modo compacto e tooltips mais explicativos.

### Encontrado mas não alterado

- O header ainda não tem busca global.
- Não foi criada barra secundária mobile para indicadores WA/IA/LM.
- Não foi alterado o conteúdo interno do menu de notificações.
- Não foi feito QA visual manual em navegador real nesta etapa.

### Precisa decisão do dono

- Confirmar se os indicadores WA/IA/LM devem aparecer também em mobile como segunda linha ou se o modo desktop é suficiente.
- Confirmar se o header deve ganhar busca global em fase própria.
- Confirmar se o perfil pode ficar ainda mais compacto em mobile caso a empresa tenha muitos controles ativos.

## 11. Pacote para enviar ao ChatGPT

Enviar no próximo chat:

1. Resumo final do Codex da Fase 3.
2. `docs/RADARZAP-LAYOUT-V3-07-FASE-3-HEADER-OPERACIONAL.md`
3. `src/services/web-dashboard/frontend/src/components/layout/Header.tsx`
4. `src/services/web-dashboard/frontend/src/components/layout/HeaderStatusPills.tsx`
5. `src/services/web-dashboard/frontend/src/components/layout/EventNotificationBell.tsx`
6. `src/services/web-dashboard/frontend/src/components/layout/AgentStatusSelector.tsx`
7. `src/services/web-dashboard/frontend/src/components/layout/OrganizationSwitcher.tsx`
8. `docs/INDICE-DOCUMENTACAO.md`
9. `docs/CHANGELOG.md`
10. `docs/SISTEMA-REGISTRO.md`

Não precisa reenviar:

- Backend, modelos Mongo, serviços IA/billing/WhatsApp/WebChat.
- Docs completos de TOPs.
- `data/` e `mocker/modelochat/`.
- Arquivos `.env`.
