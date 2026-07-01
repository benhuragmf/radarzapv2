# RadarChat — Handoff Local Pós-2.17.55

> **Reconciliação (2026-07-01):** commits 2.17.56 (`9bf3dec`) e 2.17.57 (`d0d3cfb`) estão na `main` e em produção. Ver [`RADARCHAT-VALIDACAO-POS-PRODUCAO-2.17.57.md`](./RADARCHAT-VALIDACAO-POS-PRODUCAO-2.17.57.md).

## 1. Resumo executivo

Etapa de **estabilização local** após entrega 2.17.55. *Na redação original: sem produção, push ou deploy — superseded.* Auditoria de código + ajustes finos de UX no módulo Produtos; regras críticas de catálogo/PIX preservadas (testes 43/43); gates locais verdes. Versão incrementada para **2.17.56** com commit **apenas local**.

## 2. Versão inicial

`2.17.55` (commit remoto `79ce762`)

## 3. Versão final

`2.17.56` (local, não enviado ao remoto)

## 4. Branch usada

`develop`

## 5. Commit local, se houve

`f7129eb` — `fix(products): estabiliza UX e QA local sem produção 2.17.56` (somente local, branch `develop`)

## 6. Produção

**Produção: NÃO executada** nesta etapa por decisão do fluxo atual.

**Status:** aguardando etapa específica de produção solicitada por Benhur.

- Push: **não executado**
- Deploy: **não executado**
- Coolify: **não disparado**

## 7. Arquivos analisados

- `Produtos.tsx`, `ProductsPageHeader.tsx`, `OperationalWhatsAppCards.tsx`, `ProductFormPanel.tsx`
- `ProductsOverviewTab.tsx`, `ProductsItemsTab.tsx`, `ProductsOrdersTab.tsx`
- `ProductsSettingsTab.tsx`, `ProductsDeliveryTab.tsx`
- `CatalogFormContext.tsx`, `productDisplay.ts`, `productKnowledge.ts`
- `navConfig.ts`, `Sidebar.tsx`
- `catalog-sales.ts`, `CatalogSalesService.ts` (sem alteração)
- Docs: `PRODUTOS-CATALOGO.md`, `CHANGELOG.md`, `SISTEMA-REGISTRO.md`, conclusões 2.17.52–2.17.55

## 8. Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `CatalogFormContext.tsx` | `productFormOpen`, `startDuplicateProduct` |
| `ProductFormPanel.tsx` | Formulário controlado pelo contexto |
| `ProductsItemsTab.tsx` | Duplicar abre formulário |
| `ProductsOverviewTab.tsx` | Alerta WA só com permissão de sessão |
| `ProductsOrdersTab.tsx` | Drawer: rótulos produto/valor; invalida KPIs |
| `package.json` | `2.17.56` |
| `webchat/widget.js` | sync `WIDGET_BUILD` |
| `CHANGELOG.md`, `SISTEMA-REGISTRO.md`, `INDICE-DOCUMENTACAO.md` | registro 2.17.56 |

## 9. Correções aplicadas

1. **Duplicar/editar produto** não abria o formulário — estado `productFormOpen` no contexto
2. **Drawer de pedido** exibia valor monetário no campo “Produto” — separado em Produto / Valor produto
3. **Alerta “WA loja offline”** aparecia para usuários sem `whatsapp:session:view` — corrigido
4. **KPIs da visão geral** não atualizavam após aprovar/recusar pedido — invalidação de query

## 10. Menu Produtos — validação

- Rota `/platform/produtos` com 6 abas via hash
- Gate: `catalogSales.enabled` + perfil ≠ `none`
- `ConfigSaveFooter` só em `itens`, `entrega`, `configuracoes`
- RBAC: `canManage` vê tudo; `orders:view` vê pedidos/comprovantes

## 11. Visão geral — validação

- 8 KPIs (produtos, preço, estoque, pagamento, comprovantes, endereço, aprovados hoje)
- Fluxo operacional visual
- Alertas condicionais (PIX, entrega, km, WA, conferência, preço, estoque indefinido)
- Atalhos com hash corretos

## 12. Produtos e estoque — validação

- `+ Novo produto` colapsável; seções Dados/Venda/Fulfillment/Segurança
- Badges: Em estoque, Sem estoque, Estoque a confirmar, Sem preço, PIX bloqueado
- Duplicar/editar abre painel (2.17.56)

## 13. Pedidos — validação

- Filtros status e canal (WhatsApp/WebChat)
- Colunas: produto, cliente, canal, total, status
- Drawer com cliente, endereço, frete, total, comprovante
- Ações financeiras com `orders:approve-payment` / `reject-payment`

## 14. Comprovantes PIX — validação

Empty state:
> Nenhum comprovante aguardando conferência.  
> Quando um cliente enviar comprovante pelo WhatsApp ou WebChat, ele aparecerá aqui para análise.

Comprovante: `/api/platform/catalog-sales/orders/:id/proof` — exige `orders:view-payment-proof`

## 15. Entrega e frete — validação

- Modo atendimento mapeado de `businessCatalogProfile` (sem campo Mongo duplicado)
- Aviso “cálculo no servidor”
- Tabela km 1–8 com validação visual via `DeliveryOriginAddressFields`

## 16. Configurações — validação

PIX + mensagens + `OperationalWhatsAppCards`

## 17. WhatsApp da loja — validação

- `GET /sessions`; link `/sessions`; não é campo livre
- Descrição: número onde cliente conversa, compra e reserva

## 18. WhatsApp conferência — validação

- `internalWhatsapp`, `responsibleName`, `internalMessageTemplate`
- Toggles conferência; `requireHumanApproval` default true
- Alterar número: `company:sales-config:update`

## 19. WhatsApp entregadores bloqueado — validação

- Card **Em breve**; campos disabled; botão **Adicionar entregador** disabled + tooltip
- **Nenhum** envio backend para entregador (`grep` só UI + teste)

## 20. Catálogo IA/PIX — validação

Backend inalterado desde 2.17.54. Testes cobrem: entrega, taxa, endereço, `sim`/`ok`, estoque, perfis, WebChat paridade.

## 21. Entrega antes PIX — validação

**Automatizado:** `catalog-sales.test.ts` — `entregue`/`entrega` pedem endereço; PIX só após frete no serviço.

**Manual (Benhur):** roteiro §30.

## 22. Retirada — validação

**Automatizado:** `retirar` + estoque/preço válidos permitem fluxo PIX.

## 23. Estoque indefinido — validação

`productStockAllowsPixPurchase` bloqueia; UI badge **Estoque a confirmar**; `canAutoPix` false.

## 24. WebChat — validação

Paridade via `tryCatalogWebChatShortCircuit` — testes gate pass. QA manual pendente.

## 25. RBAC e segurança

- Comprovante autenticado; sem URL pública aberta no código novo
- Entregadores sem envio
- Chave PIX não exposta em componentes novos

## 26. Testes executados

```
npx jest catalog-sales.test.ts catalog-menu-gate.test.ts product-display.util.test.ts
→ 43 passed
```

## 27. Gates executados

```
npm run build                                    ✓
npm run build --prefix .../frontend              ✓
npm run pre-push:gate (backend + frontend + Docker) ✓
```

## 28. Comandos inexistentes ou não executados

| Comando | Status |
|---------|--------|
| `npm run test:frontend` | Não existe |
| `npm run lint` | Existe (escopo limitado) — não executado |
| `npm run typecheck` | Coberto por `tsc` no build |
| `npm test` (suite completa) | Não executado |
| `npm run qa:atendimento:gate` | Não executado |
| `npm run qa:auditoria:gate` | Não executado |
| `npm run qa:release-gate` | Não executado |

## 29. QA manual executado

- Build e testes locais
- Revisão estática de componentes e RBAC
- **Painel autenticado:** não disponível nesta sessão

## 30. QA manual pendente para Benhur

### WhatsApp

```text
ola boa tarde
sim
sim
quero comprar zaad
entregue
mais tem taxa de entrega?
meu endereço você não vai pegar?
```

Esperado: saudação ok; `sim`≠produto; `entregue`→CEP; sem PIX antes endereço/frete; taxa/endereço no contexto; sem repetir PIX.

### Retirada

```text
quero comprar zaad
retirar
```

PIX só se produto/preço/estoque/config válidos.

### Estoque indefinido

Produto com estoque “consulte” → sem PIX automático.

### WebChat

Repetir cenários: produto, entrega, retirada, estoque indefinido, comprovante, taxa, endereço.

### Painel

1. `/platform/produtos` — todas as abas
2. Labels Estoque / Comprovantes
3. Card entregadores bloqueado
4. Duplicar produto abre formulário
5. Drawer pedido mostra nome do produto
6. IA Atendimento não inchou de novo

## 31. Riscos encontrados

- QA WhatsApp/WebChat real ainda não executado
- Commit 2.17.56 só local — remoto ainda em 2.17.55/79ce762 até Benhur autorizar push

## 32. Riscos mitigados

- Catálogo/PIX: 43 testes verdes, backend intacto
- Entregadores: UI bloqueada, zero envio
- Gates Docker verdes antes de eventual push futuro

## 33. Próximo passo recomendado

1. Benhur: QA manual §30 (painel + celular)
2. Acumular feedback visual/funcional
3. Quando autorizar: push `develop` → merge `main` → deploy único com pacote acumulado

## 34. Checklist para próxima etapa

- [ ] Revisar visual pelo Benhur
- [ ] Testar WhatsApp real
- [ ] Testar WebChat real
- [ ] Testar comprovante real
- [ ] Testar permissões (financeiro, comprovante, sessão WA)
- [ ] Acumular próximos ajustes
- [ ] **Não subir produção até Benhur autorizar**
