# RadarChat — Conclusão Menu Produtos e Reorganização Catálogo

## 1. Resumo executivo

Novo menu **Produtos** no painel tenant, com operação de catálogo/PIX/pedidos separada da aba **IA Atendimento → Empresa e IA**. Fluxo catálogo IA 2.17.52 preservado no backend. **Produção validada em 2026-07-01.**

## 2. Versão inicial

2.17.52 (`d470985`)

## 3. Versão final

2.17.53

## 4. Branch usada

`develop` → fast-forward `main`

## 5. Commit final

| Commit | Descrição |
|--------|-----------|
| `8c25148` | feat(products): separa catálogo em menu Produtos 2.17.53 |
| `ed3851d` | docs: hash commit na conclusão Produtos 2.17.53 |
| _(pós-validação)_ | fix(products): invalida gate menu, UX pedidos e docs 2.17.53 |

## 6. Objetivo da entrega

Reduzir complexidade da tela IA e dar módulo operacional dedicado a produtos, pedidos e PIX.

## 7. Problema resolvido

A aba `#empresa` concentrava CRUD, PIX, frete e pedidos (~600 linhas), dificultando configuração de inteligência da IA.

## 8. Arquivos analisados

`AiAtendimento.tsx`, `Produtos.tsx`, `navConfig.ts`, `App.tsx`, `Sidebar.tsx`, `useCatalogMenuGate.ts`, `catalog-menu-gate.ts`, `CatalogSalesService.ts`, docs catálogo.

## 9. Arquivos alterados

- Frontend: `Produtos.tsx`, `components/products/*`, `AiEmpresaCatalogSection.tsx`, `hooks/useCatalogMenuGate.ts`, `lib/catalog/*`, `navConfig.ts`, `App.tsx`, `Sidebar.tsx`, `AiAtendimento.tsx`
- Types: `catalog-menu-gate.ts`, `__tests__/catalog-menu-gate.test.ts`
- Docs: `CHANGELOG.md`, `PRODUTOS-CATALOGO.md`, `CATALOGO-PIX-PEDIDOS.md`, `SISTEMA-REGISTRO.md`, `INDICE-DOCUMENTACAO.md`, `MENU-PAGES-REGISTRY.md`

## 10. Novo menu Produtos

Grupo lateral `grp-produtos`, ícone Package, label **Produtos**.

## 11. Submenus criados

Visão geral, Produtos e estoque, Pedidos, Comprovantes PIX, Entrega e frete, Configurações — hashes em `/platform/produtos#*`.

## 12. Feature gate / liberação por catálogo ativo

`isCatalogProductsMenuEnabled`: `businessCatalogProfile !== 'none'` **e** `catalogSales.enabled === true`.

- Sidebar: oculta grupo se gate falso; admin com perfil e `enabled=false` vê grupo + CTA.
- URL `/platform/produtos` sem gate → `ProductsGateScreen`.
- Após salvar na IA, `invalidateQueries(['ai-settings-catalog-gate'])` atualiza menu sem reload (fix pós-validação).

## 13. Mudanças na tela IA Atendimento

Aba **Empresa e IA**; perfil comercial, toggle pedidos via IA, comportamento IA, alertas, atalhos. CRUD/PIX/frete movidos para Produtos.

## 14–18. Produtos, pedidos, PIX, entrega, config

UI em `/platform/produtos#*`; dados em `catalogSales` + KB **Produtos e estoque**. Atendentes com só `orders:view` veem abas Pedidos/Comprovantes (fix pós-validação).

## 19. RBAC e permissões

`inbox:ai:manage`, `orders:view`, `orders:*` financeiro, `company:sales-config:update` para WA interno.

## 20. APIs criadas/reutilizadas

`PATCH /platform/ai/settings`, `/platform/catalog-sales/orders/*` — sem duplicação.

## 21. Segurança

Gate tenant, bloqueio sem catálogo, comprovante via rota autenticada + `orders:view-payment-proof`.

## 22. Compatibilidade com catálogo IA 2.17.52

Backend inalterado; `catalog-sales.test.ts` verde.

## 23. Testes automatizados

- `catalog-menu-gate.test.ts` — 5 cenários
- `catalog-sales.test.ts` — 26 cenários
- **31 testes** passando (validação 2026-07-01)

## 24. QA manual executado

Build backend + frontend; `pre-push:gate` com Docker; smoke HTTP produção (health, bundle, widget).

## 25. QA manual pendente

Cenários A–J com login/celular (ZAAd, PIX WA/WebChat, permissões) — Benhur.

## 26. Gates executados

```text
npx jest catalog-menu-gate + catalog-sales  → OK
npm run build                               → OK
npm run build --prefix .../frontend         → OK
npm run pre-push:gate                       → OK (Docker frontend-builder)
```

Comandos não executados (opcionais): `qa:atendimento:gate`, `qa:auditoria:gate`, `qa:release-gate`.

## 27. Build Docker/Coolify

- GHCR build: job `build-and-push` run **28532450303** — success (~2m43s)
- Docker image push OK; `frontend-builder` validado localmente no gate

## 28. Push

- `git push origin develop` — commits `8c25148`, `ed3851d`
- `git push origin main` — fast-forward `58e8b84..ed3851d`

## 29. Deploy

- Workflow: **Deploy** run `28532450403` (push `ed3851d` na `main`)
- Job `deploy` — **success** (~5m18s), step *Deploy Coolify via SSH*
- Fluxo: `main` → GitHub Actions → Coolify app-only → `app.radarchat.com.br`

## 30. Status produção

| Check | Resultado |
|-------|-----------|
| `GET /api/services/health` | **200** `healthy: true` |
| Bundle painel | `index-BzUcDRiy.js` (build 2.17.53) |
| Widget | `WIDGET_BUILD = '2.17.53'` |
| Strings no JS | `platform/produtos`, `Empresa e IA` presentes |

## 31. Checklist para Benhur testar

- [ ] Catálogo desligado não mostra Produtos
- [ ] Ativar catálogo na IA libera Produtos (sem hard refresh)
- [ ] Tela IA ficou limpa
- [ ] Cadastrar produto ZAAd
- [ ] Testar estoque/preço
- [ ] Testar pedido WhatsApp
- [ ] Testar pedido WebChat
- [ ] Testar entrega
- [ ] Testar retirada
- [ ] Testar comprovante
- [ ] Testar permissões de atendente (só pedidos)
- [ ] Acesso direto sem permissão
- [ ] Confirmar sem regressão no PIX

## 32. Riscos mitigados

Sem alteração em `CatalogSalesService` inbound; UI reorganizada; gate invalidado após save IA.

## 33. Pendências

- QA manual A–J (Benhur + celular)
- Código morto legado em `AiAtendimento.tsx` (helpers produto não usados na UI) — limpeza futura opcional

## 34. Próximo passo recomendado

Executar checklist §31 em produção; depois considerar remover dead code de produto em `AiAtendimento.tsx`.
