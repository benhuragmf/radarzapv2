# RadarChat — Conclusão Menu Produtos e Reorganização Catálogo

## 1. Resumo executivo

Novo menu **Produtos** no painel tenant, com operação de catálogo/PIX/pedidos separada da aba **IA Atendimento → Empresa e IA**. Fluxo catálogo IA 2.17.52 preservado no backend.

## 2. Versão inicial

2.17.52 (`d470985`)

## 3. Versão final

2.17.53

## 4. Branch usada

`develop` (local)

## 5. Commit final

`8c25148` — feat(products): separa catálogo em menu Produtos 2.17.53

## 6. Objetivo da entrega

Reduzir complexidade da tela IA e dar módulo operacional dedicado a produtos, pedidos e PIX.

## 7. Problema resolvido

A aba `#empresa` concentrava CRUD, PIX, frete e pedidos (~600 linhas), dificultando configuração de inteligência da IA.

## 8. Arquivos analisados

`AiAtendimento.tsx`, `navConfig.ts`, `App.tsx`, `Sidebar.tsx`, `CatalogSalesService.ts`, `catalog-sales.ts`, docs catálogo 2.17.52.

## 9. Arquivos alterados

- Frontend: `Produtos.tsx`, `components/products/*`, `components/ai/AiEmpresaCatalogSection.tsx`, `hooks/useCatalogMenuGate.ts`, `lib/catalog/*`, `navConfig.ts`, `App.tsx`, `Sidebar.tsx`, `AiAtendimento.tsx`
- Types: `catalog-menu-gate.ts`, `__tests__/catalog-menu-gate.test.ts`
- Docs: `CHANGELOG.md`, `PRODUTOS-CATALOGO.md`, este arquivo

## 10. Novo menu Produtos

Grupo lateral `grp-produtos`, ícone Package.

## 11. Submenus criados

Visão geral, Produtos e estoque, Pedidos, Comprovantes PIX, Entrega e frete, Configurações.

## 12. Feature gate / liberação por catálogo ativo

`isCatalogProductsMenuEnabled`: perfil ≠ `none` e `enabled === true`. Sidebar filtra grupo; URL direta mostra `ProductsGateScreen`.

## 13. Mudanças na tela IA Atendimento

Aba renomeada **Empresa e IA**; mantém perfil comercial, “O que a empresa faz”, toggle pedidos via IA, comportamento IA, alertas e atalhos.

## 14–18. Produtos, pedidos, PIX, entrega, config

UI movida para `/platform/produtos#*`; dados em `catalogSales` + KB **Produtos e estoque**.

## 19. RBAC e permissões

`inbox:ai:manage`, `orders:view`, `orders:*` financeiro, `company:sales-config:update` para WA interno.

## 20. APIs criadas/reutilizadas

Reutilizadas: `PATCH /platform/ai/settings`, `/platform/catalog-sales/orders/*`. Sem endpoints duplicados.

## 21. Segurança

Gate por tenant, bloqueio sem catálogo, comprovante protegido.

## 22. Compatibilidade com catálogo IA 2.17.52

Backend inalterado; testes `catalog-sales.test.ts` verdes (27+ cenários).

## 23. Testes automatizados

`catalog-menu-gate.test.ts` (4), `catalog-sales.test.ts` (26) — 30 testes passando.

## 24. QA manual executado

Build frontend + backend local; testes Jest catálogo.

## 25. QA manual pendente

Cenários A–J do prompt (WhatsApp/WebChat em produção) — Benhur.

## 26. Gates executados

`npm test` (catalog), `npm run build`, `npm run build --prefix frontend`.

## 27. Build Docker/Coolify

`pre-push:gate` — executar antes do merge main.

## 28. Push

Pendente commit/push.

## 29. Deploy

Via main → Coolify após gate verde.

## 30. Status produção

Aguardando deploy 2.17.53.

## 31. Checklist para Benhur testar

- Catálogo desligado não mostra Produtos
- Ativar catálogo na IA libera Produtos
- Tela IA ficou limpa
- Cadastrar produto ZAAd
- Testar estoque/preço
- Testar pedido WhatsApp
- Testar pedido WebChat
- Testar entrega
- Testar retirada
- Testar comprovante
- Testar permissões de atendente
- Testar acesso direto sem permissão
- Confirmar sem regressão no PIX

## 32. Riscos mitigados

Sem alteração em `CatalogSalesService` inbound; UI só reorganizada.

## 33. Pendências

QA manual produção; `pre-push:gate` completo com Docker.

## 34. Próximo passo recomendado

Merge `develop` → `main` após `npm run pre-push:gate` verde e QA smoke em staging/produção.
