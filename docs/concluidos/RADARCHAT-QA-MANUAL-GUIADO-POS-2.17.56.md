# RadarChat — QA Manual Guiado Pós-2.17.56

## 1. Resumo executivo

Rodada de **QA guiado + ajustes locais** após handoff 2.17.56. Revisão estática do módulo Produtos, RBAC e catálogo/PIX; correções em pedidos (ações completas, status), visão geral (KPIs condicionais) e tabela de estoque. **43 testes** e **pre-push gate** verdes. **Sem push, deploy ou produção.**

## 2. Versão inicial

`2.17.56` (commit local `9bf3dec`)

## 3. Versão final

`2.17.57` (commit local desta etapa)

## 4. Branch

`develop` (ahead of `origin/develop` — não enviado)

## 5. Commit local anterior

`9bf3dec` — `fix(products): estabiliza UX e QA local sem produção 2.17.56`

## 6. Commit local desta etapa, se houve

`fix(products): aplica ajustes pós-QA local 2.17.57` — ver `git log -1`

## 7. Produção

**Produção não executada** nesta etapa por decisão do fluxo atual.

## 8. Push/deploy

- Push remoto: **não executado**
- Merge `main`: **não executado**
- Deploy / Coolify: **não executado**

## 9. Arquivos analisados

Handoff 2.17.56, componentes Products*, `CatalogFormContext`, `productDisplay.ts`, `CatalogSalesOrderPanel` (paridade ações), `catalog-sales.ts` (inalterado), testes catálogo.

## 10. Arquivos alterados

- `ProductsOrdersTab.tsx` — ações RBAC, status, coluna Quando, canal formatado
- `ProductsOverviewTab.tsx` — KPIs pedidos só com `orders:view`
- `ProductsItemsTab.tsx` — coluna Entrega
- `productDisplay.ts` — `requiresDelivery` no row
- `package.json`, `webchat/widget.js`, `CHANGELOG.md`, `SISTEMA-REGISTRO.md`, `INDICE-DOCUMENTACAO.md`

## 11. Correções aplicadas

| # | Correção |
|---|----------|
| 1 | Drawer pedidos: **Pedir novo comprovante** (`orders:update-status`) e **Reenviar notificação** (`orders:resend-pix-notification`) — paridade com Inbox |
| 2 | Aprovar/recusar só em `comprovante_recebido` / `em_conferencia` |
| 3 | KPIs de pedidos na visão geral ocultos sem `orders:view` (evita zeros enganosos) |
| 4 | Coluna **Entrega** na tabela de produtos |
| 5 | Coluna **Quando** e canal legível na lista de pedidos |

## 12. QA painel Produtos

**Método:** revisão de código + build local. **Painel autenticado:** não executado nesta sessão.

**Código validado:** 6 abas, gate catálogo, `ConfigSaveFooter` condicional, sidebar Estoque/Comprovantes.

## 13. QA Visão geral

- KPIs produto sempre visíveis para quem gerencia catálogo
- KPIs pedido condicionados a `orders:view` (2.17.57)
- Alertas WA com permissão de sessão (2.17.56)
- Aprovados hoje filtra por data (2.17.56)

## 14. QA Produtos e estoque

- Formulário colapsável; editar/duplicar abre painel (2.17.56)
- Badges estoque/preço/PIX auto
- Coluna entrega: endereço obrigatório / encomenda (2.17.57)
- Aviso estoque a confirmar no formulário

## 15. QA Pedidos

- Filtros status e canal
- Drawer: produto, valor, frete, total, endereço
- Ações com RBAC e status adequado (2.17.57)
- Comprovante via rota autenticada `/api/.../proof`

## 16. QA Comprovantes PIX

- Empty state conforme spec (código 2.17.55+)
- Aba `proofOnly` filtra status de comprovante
- **Teste real com upload:** pendente Benhur

## 17. QA Entrega e frete

- Modo atendimento via `businessCatalogProfile`
- Aviso frete no servidor
- ViaCEP via `DeliveryOriginAddressFields`

## 18. QA Configurações

- PIX + mensagens + três cards WhatsApp
- Conferência: `internalWhatsapp` + toggles + RBAC

## 19. QA WhatsApp da loja

- Sessão via `GET /sessions`; link `/sessions`
- Não é campo livre

## 20. QA WhatsApp conferência

- `internalWhatsapp`, template, toggles
- `company:sales-config:update` para alterar número

## 21. QA WhatsApp entregadores bloqueado

- Card Em breve; campos/botão disabled; zero backend de envio

## 22. QA fluxo WhatsApp entrega

**Automatizado:** `catalog-sales.test.ts` — entregue, taxa, endereço, sem PIX antes CEP.

**Manual celular:** pendente — roteiro §33.

## 23. QA fluxo WhatsApp retirada

**Automatizado:** testes retirada + estoque/preço válidos.

**Manual:** pendente.

## 24. QA estoque indefinido

**Automatizado:** `productStockAllowsPixPurchase`, UI badge.

**Manual:** produto ZAAd com estoque "consulte" — pendente.

## 25. QA produto sem preço

**Automatizado:** `getProductPriceStatus`, `canAutoPix` false.

**Manual:** pendente.

## 26. QA produto parecido

**Automatizado:** fuzzy/ambiguidade em `catalog-sales.test.ts`.

**Manual:** `zad` → ZAAd — pendente.

## 27. QA WebChat

Paridade código via `tryCatalogWebChatShortCircuit`. **Manual:** pendente.

## 28. QA permissões/RBAC

| Papel | Esperado (código) |
|-------|-------------------|
| Dono/admin | `inbox:ai:manage`, `orders:*`, `company:sales-config:update` |
| Financeiro | `orders:view`, approve/reject se cap |
| Atendente | Inbox painel pedido; sem alterar PIX interno sem cap |
| Viewer | Sem approve, sem comprovante sem `orders:view-payment-proof` |

**Teste com usuários reais:** pendente.

## 29. Segurança

- Comprovante: auth + permissão; não URL pública aberta no código
- Entregadores: sem envio
- Catálogo/PIX: backend 2.17.54 intacto

## 30. Testes executados

```
catalog-sales.test.ts + catalog-menu-gate.test.ts + product-display.util.test.ts → 43 passed
```

## 31. Gates executados

```
npm run build ✓
npm run build --prefix frontend ✓
npm run pre-push:gate ✓ (incl. Docker frontend-builder)
```

## 32. Comandos não executados

- `npm run qa:atendimento:gate` — não executado (longo; fora escopo focado)
- `npm run qa:auditoria:gate` — não executado
- `npm run qa:release-gate` — não executado (evitar fluxo produção)
- `npm test` completo — não executado
- `npm run lint` — não executado

## 33. QA pendente para Benhur

### Painel (local ou staging quando subir)

1. `/platform/produtos` — todas as abas
2. Duplicar/editar produto → formulário abre
3. Pedidos → drawer → aprovar/recusar/pedir comprovante/reenviar
4. Comprovantes — empty state e fila
5. Três WhatsApps — entregadores bloqueado
6. Usuário só `inbox:ai:manage` sem `orders:view` → visão geral sem KPIs de pedido

### WhatsApp

```text
ola boa tarde / sim / sim / quero comprar zaad / entregue /
mais tem taxa de entrega? / meu endereço você não vai pegar?
```

### Retirada

```text
quero comprar zaad / retirar
```

### Estoque consulte + sem preço + produto parecido (`zad`)

### WebChat — mesmos cenários

### Permissões — financeiro vs atendente vs viewer

## 34. Riscos encontrados

- Pacote 2.17.56–57 acumulado só local (2 commits ahead do remoto)
- QA real WhatsApp/WebChat/comprovante ainda não feito

## 35. Riscos mitigados

- Regressão catálogo: testes verdes, backend inalterado
- Ações financeiras sem status adequado: corrigido 2.17.57
- KPIs enganosos sem permissão: corrigido 2.17.57

## 36. Próximos ajustes sugeridos

- Notas internas no drawer de pedido (se API existir)
- Filtro rápido na aba Comprovantes por status
- Cancelar pedido na UI (se endpoint estável)
- Após QA Benhur: push único acumulado 2.17.56+57

## 37. Checklist para próxima etapa

- [ ] Benhur testar visual do painel
- [ ] Benhur testar WhatsApp real
- [ ] Benhur testar WebChat real
- [ ] Benhur testar comprovante real
- [ ] Benhur testar permissões
- [ ] Acumular feedback
- [ ] **Não subir produção até autorização explícita**
