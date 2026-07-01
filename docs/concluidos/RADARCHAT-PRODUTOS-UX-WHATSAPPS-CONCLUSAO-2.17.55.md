# RadarChat — Conclusão Produtos UX, WhatsApps Operacionais e Entrega/Retirada

## 1. Resumo executivo

Entrega **2.17.55** evolui o módulo **Produtos** (`/platform/produtos`) de formulário básico para painel comercial profissional: dashboard na visão geral, tabelas com badges, formulário colapsável de produtos, filtros de pedidos, empty states claros e separação visual dos **três WhatsApps operacionais** (loja, conferência, entregadores bloqueado). Regras críticas de catálogo/PIX da **2.17.54** foram preservadas no backend — sem regressão em entrega antes do PIX, estoque indefinido ou `sim`≠produto.

## 2. Versão inicial

`2.17.54` (`f0f1d45`)

## 3. Versão final

`2.17.55`

## 4. Branch usada

`develop` → merge fast-forward em `main`

## 5. Commit final

`f829bdf` — `feat(products): melhora UX e separa WhatsApps operacionais 2.17.55` (commit amendado; `93422c6` foi substituído antes do push)

## 6. Objetivo

Melhorar UX do menu Produtos, organizar abas e recursos, separar WhatsApps por função, documentar entregadores como recurso futuro bloqueado e revalidar fluxo entrega/retirada/PIX antes do deploy.

## 7. Problemas corrigidos

| Problema | Solução |
|----------|---------|
| Módulo visualmente simples, muito espaço vazio | Dashboard com KPIs, fluxo operacional, alertas e atalhos |
| Botão Salvar em abas de listagem | `ConfigSaveFooter` só em `itens`, `entrega`, `configuracoes` |
| Labels truncados no sidebar | `sidebarLabel`: Estoque / Comprovantes + `title` completo |
| Configurações misturavam WA loja e conferência | `OperationalWhatsAppCards` com 3 cards distintos |
| Comprovantes vazios pouco explicativos | `EmptyState` com texto orientativo |
| Formulário de produto sempre aberto | `ProductFormPanel` colapsável “+ Novo produto” |
| Pedidos sem contexto | Filtros + drawer de detalhe + colunas enriquecidas |

## 8. Arquivos analisados

- `docs/PRODUTOS-CATALOGO.md`, `CATALOGO-PIX-PEDIDOS.md`, `CHANGELOG.md`, `SISTEMA-REGISTRO.md`
- `src/types/catalog-sales.ts`, `CatalogSalesService`
- `frontend/src/pages/menu/Produtos.tsx` e abas em `components/products/`
- `navConfig.ts`, `Sidebar.tsx`, `PlatformPage.tsx`

## 9. Arquivos alterados

**Novos:**
- `frontend/src/lib/catalog/productDisplay.ts`
- `frontend/src/components/products/ProductsPageHeader.tsx`
- `frontend/src/components/products/OperationalWhatsAppCards.tsx`
- `frontend/src/components/products/ProductFormPanel.tsx`
- `src/types/__tests__/product-display.util.test.ts`

**Alterados:**
- `Produtos.tsx`, `ProductsOverviewTab.tsx`, `ProductsItemsTab.tsx`, `ProductsOrdersTab.tsx`
- `ProductsSettingsTab.tsx`, `ProductsDeliveryTab.tsx`
- `navConfig.ts`, `Sidebar.tsx`, `PlatformPage.tsx`, `productKnowledge.ts`
- `jest.config.js`, `package.json`, docs

## 10. Melhorias visuais no menu Produtos

- Header customizado (`ProductsPageHeader`) com badges: catálogo, PIX, entrega, pendências
- Abas com hierarquia visual maior
- `PlatformPage hideHeader` para controle do título/descrição no módulo

## 11. Melhorias na Visão geral

- 8 métricas: ativos, sem preço, sem estoque, estoque indefinido, aguardando pagamento, comprovantes pendentes, aguardando endereço, aprovados hoje
- Card fluxo operacional (loja → pedido → PIX → conferência → retirada/entrega)
- Alertas inteligentes (PIX sem chave, origem incompleta, frete km, WA conferência, sessão desconectada)
- Atalhos para cadastro, pedidos, comprovantes, PIX, entrega, IA

## 12. Melhorias em Produtos e estoque

- Botão **+ Novo produto** → painel com seções Dados/Venda/Fulfillment/Segurança
- `DataTable` com badges: ativo, sem preço, sem estoque, estoque a confirmar, sob consulta
- Ações: editar, duplicar, desativar
- Aviso explícito: estoque indefinido não gera PIX automático

## 13. Melhorias em Pedidos

- Filtros por status (aguardando endereço, pagamento, conferência, aprovado, etc.)
- Colunas: produto, cliente, canal, valores, fulfillment, comprovante
- Drawer de detalhe com timeline e ações (aprovar/recusar, Inbox, notas)

## 14. Melhorias em Comprovantes PIX

- Empty state: *Nenhum comprovante aguardando conferência* + explicação do fluxo
- Fila com produto, cliente, valor, canal, horário
- Comprovante via rota protegida (`orders:view-payment-proof`)

## 15. Melhorias em Entrega e frete

- Bloco **Como esta empresa entrega?** — retirada / entrega / ambos (`fulfillmentMode` via perfil)
- Origem estruturada (CEP + ViaCEP)
- Frete: fixo, por km, manual — validação visual
- Instruções para IA com aviso de cálculo no servidor

## 16. Melhorias em Configurações

- PIX e mensagens mantidos
- Seção **WhatsApps operacionais** delegada a `OperationalWhatsAppCards`
- Diagrama do fluxo dos 3 números

## 17. WhatsApp da loja

- Lê `GET /sessions` — número conectado, status online/offline
- Link para `/sessions` conectar/gerenciar
- Aviso se sem sessão ativa
- Uso: cliente, IA, reserva, endereço, PIX, comprovante

## 18. WhatsApp do responsável pela conferência

- Campo `internalWhatsapp` (compatível)
- `responsibleName`, `internalMessageTemplate`
- Toggles: `notifyWhatsapp`, `escalateOnProof`, `allowManualResend`, `requireHumanApproval`
- RBAC: `company:sales-config:update` para alterar número

## 19. WhatsApp dos entregadores — futuro bloqueado

- Card **Em breve** com campos desabilitados
- Botão **Adicionar entregador** desabilitado + tooltip
- **Nenhum envio** implementado nesta versão
- Documentado: entregador só receberá após pagamento aprovado; nunca comprovante PIX

## 20. Fluxo entrega antes do PIX

Preservado da 2.17.54 (`catalog-sales.ts` + `CatalogSalesService`):
- `entregue` → `aguardando_endereco` → CEP/frete → só então PIX
- Perguntas taxa/endereço não repetem PIX
- `sim` não abre catálogo sem contexto

## 21. Fluxo retirada

- `retirar` / `pickup_only` pode seguir PIX se produto, preço, estoque numérico e config válidos

## 22. Estoque indefinido / consulte estoque

- Badge **Estoque a confirmar** na UI
- `productStockAllowsPixPurchase` no backend bloqueia PIX (testes 2.17.54 mantidos)

## 23. RBAC e permissões

| Capacidade | Uso |
|------------|-----|
| `inbox:ai:manage` | Catálogo, produtos, entrega |
| `orders:view` | Pedidos e comprovantes |
| `orders:approve-payment` / `reject-payment` | Ações financeiras |
| `company:sales-config:update` | WA conferência |

## 24. Segurança

- Chave PIX não exposta em logs/UI indevida
- Comprovante só com auth + permissão
- Entregadores sem envio — zero vazamento de dados de cliente
- Sem alteração em sessões/volumes

## 25. Testes automatizados

| Suite | Resultado |
|-------|-----------|
| `catalog-sales.test.ts` | 34+ pass |
| `catalog-menu-gate.test.ts` | pass |
| `product-display.util.test.ts` | 4 pass |

Total: **43 testes** passando.

## 26. QA manual executado

- Build backend + frontend local
- `npm run pre-push:gate` (incl. Docker frontend-builder)
- Validação TS `Produtos.tsx` após fix `title`/`hideHeader`

## 27. QA manual pendente

Roteiro para Benhur (celular + painel):

- Visual completo `/platform/produtos`
- Produto ZAAd R$ 145,90 — estoque numérico e indefinido
- WhatsApps: loja, conferência, card entregadores bloqueado
- Fluxo WA: `quero comprar zaad` → `entregue` → perguntas taxa/endereço (sem PIX antes CEP)
- Retirada: `retirar` com PIX se ok
- Comprovante → fila → conferência → aprovar/recusar
- WebChat paridade

## 28. Gates executados

```text
npm run build                                          ✓
npm run build --prefix src/services/web-dashboard/frontend  ✓
npx jest catalog-sales.test.ts catalog-menu-gate.test.ts product-display.util.test.ts  ✓
npm run pre-push:gate                                  ✓
```

## 29. Build Docker/Coolify

Gate Docker `frontend-builder` verde no pre-push.

## 30. Push

`git push origin develop` + merge `main` (após commit).

## 31. Deploy

Deploy automático via `main` → Coolify app-only (se merge concluído).

## 32. Status produção

Validar após deploy:
- `https://app.radarchat.com.br/api/services/health`
- `https://app.radarchat.com.br`

## 33. Checklist para Benhur testar

- [ ] Visual do menu Produtos
- [ ] Labels do menu lateral (Estoque / Comprovantes)
- [ ] Visão geral — KPIs e atalhos
- [ ] Produtos e estoque — cadastro e badges
- [ ] Pedidos — filtros e detalhe
- [ ] Comprovantes PIX — empty state e fila
- [ ] Entrega e frete — modo atendimento
- [ ] Configurações — três WhatsApps
- [ ] WhatsApp da loja (sessão)
- [ ] WhatsApp do responsável financeiro
- [ ] Card entregadores bloqueado
- [ ] Produto ZAAd
- [ ] Entrega antes PIX
- [ ] Retirada
- [ ] Estoque indefinido
- [ ] Comprovante
- [ ] WebChat

## 34. Riscos mitigados

- Regressão PIX antes endereço: backend inalterado 2.17.54
- `sim` como produto: testes mantidos
- Estoque consulte: bloqueio PIX preservado
- Envio entregador: UI apenas, sem backend
- Build Docker: gate pré-push

## 35. Pendências

- QA manual A–F no WhatsApp real (Benhur)
- Implementação futura: WhatsApp entregadores pós-`pagamento_aprovado`
- Testes E2E React do módulo Produtos (não existiam — cobertos por Jest util + catalog-sales)

## 36. Próximo passo recomendado

1. Benhur executar checklist §33 no celular
2. Se verde: considerar notificações push para conferência PIX
3. Próxima minor: backend entregadores com RBAC e auditoria
