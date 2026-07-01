# RadarChat — Fechamento Endereço v1 e Localização Humana Segura 2.17.61

## 1. Resumo executivo

Fechamento local do **Endereço de Entrega v1** em **2.17.61**: correção do risco **R1** (negativa com correção inline), invalidação segura de frete/PIX após alteração de endereço, e painel operador **localização humana segura** no Inbox e Produtos/Pedidos — endereço confirmado separado do pin, Google Maps, alerta de divergência (~400 m) e cópia manual para entrega **sem motoboy automático**. Gates verdes; **sem push/deploy** nesta etapa.

## 2. Versão inicial

`2.17.60` (produção `95666e9`, bundle `index-D0EQsI0a.js`)

## 3. Versão final

`2.17.61` (local `develop`, não publicada)

## 4. Branch

`develop` (2 commits à frente de `origin/develop` após este commit)

## 5. Commit local

- `9b3b637` — `fix(catalog): corrige negativa com ajuste de endereco 2.17.61` (R1)
- **Este commit** — `fix(catalog): fecha endereco v1 e correcao manual segura 2.17.61` (UI humana + testes divergência)

## 6. Produção

Produção não executada nesta etapa. Permanece **2.17.60**.

## 7. Push/deploy

| Ação | Status |
|------|--------|
| Push remoto | **Não executado** |
| Merge `main` | **Não executado** |
| Deploy Coolify | **Não executado** |

## 8. Problema R1

Na confirmação (`needs_confirmation`), `não, é número 120` caía em negativa simples e pedia endereço completo, sem atualizar só o número.

## 9. Correção aplicada

- `parseInlineAddressCorrectionAfterNo` + ordem: sim → inline → não → texto livre
- `applyInlineCorrection` invalida frete, limpa confirmação, volta `needs_confirmation`
- Histórico `delivery_address_inline_corrected`
- Pedido pago: escala humano, não altera endereço automaticamente

## 10. Ordem de decisão no fluxo

1. Comandos globais (cancelar/sair/atendente)
2. Confirmação positiva (`sim`, `correto`, `confirmo`)
3. Negativa com correção inline
4. Negativa simples (`não`, `errado`, `corrigir`)
5. Texto livre de endereço
6. Fallback seguro

## 11. Correção inline de número

`não, é número 120` / `não é numero 120` / `errado, é número 120` / `não é 1326 é 120` → atualiza `number`, reconfirma, mensagem *Atualizei o número do endereço*.

## 12. Correção inline de rua/número

`não, é Rua José Pinto, 120` / `não, é Av. José Pinto, 1020` → atualiza rua + número, mensagem *Atualizei o endereço*.

## 13. Correção inline de CEP

`não, cep 78705022` → ViaCEP, mescla logradouro; sem número pede número; com número reconfirma.

## 14. Correção inline de bairro/complemento

- Bairro: `não, bairro é Vila Birigui`
- Complemento: `não, complemento casa 2`

## 15. Frete invalidado após correção

`invalidateFreightEstimate` limpa `deliveryFee`, `deliveryDistanceKm`, `deliveryTierKm`, `deliveryDistanceMethod`. Snapshot anterior permanece no pedido até novo frete confirmado.

## 16. PIX bloqueado após correção

Frete/PIX só após `action === 'confirmed'` em `processIncrementalAddressInput`. `inline_corrected` mantém `needsAddressConfirmation: true`.

## 17. Endereço confirmado

Bloco **Endereço confirmado para entrega** (`CatalogDeliveryHumanPanel`): rua, número, bairro, cidade/UF, CEP, complemento, referência, status, origem, data confirmação.

## 18. Localização enviada pelo cliente

Bloco separado **Localização enviada pelo cliente**: lat/lng, origem (`whatsapp_pin`/`webchat`), aviso se pin não confirmado como endereço final, Google Maps, copiar coordenadas.

## 19. Alerta de divergência pin/endereço

`evaluatePinAddressDivergence` (`catalog-delivery-human.util.ts`): limiar **400 m**; alerta amarelo se distante; aviso manual se sem coordenadas ou endereço não confirmado.

## 20. Copiar dados para entrega manual

Botão **Copiar dados para entrega manual** — texto com pedido, cliente, endereço, complemento, Maps, coordenadas, frete, total e observação. **Apenas clipboard** — sem WhatsApp para motoboy.

## 21. Inbox

`CatalogSalesOrderPanel.tsx` usa `CatalogDeliveryHumanPanel`; ações operador (confirmar endereço, solicitar correção) preservadas com RBAC.

## 22. Produtos/Pedidos

`ProductsOrdersTab.tsx` drawer com mesmo painel + botões confirmar/solicitar correção; deep link `DX-####` preservado.

## 23. WebChat paridade

Correção inline e confirmação via `CatalogDeliveryAddressService` compartilhado — sem duplicação por canal.

## 24. Motoboy automático fora do escopo

**Não implementado:** cadastro motoboy, fila entregadores, envio automático, status entregador.

## 25. Segurança

Sem alteração `.env`/sessões/volumes; comprovante via rota autenticada; cópia manual não expõe chave PIX; pedido pago bloqueia correção automática.

## 26. Arquivos analisados

- `CatalogDeliveryAddressService.ts`, `CatalogSalesService.ts`, `catalog-delivery-address-v1.ts`
- `CatalogSalesOrderPanel.tsx`, `ProductsOrdersTab.tsx`
- Docs QA/deploy 2.17.60, `CATALOGO-PIX-PEDIDOS.md`, `PRODUTOS-CATALOGO.md`

## 27. Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/types/catalog-delivery-address-v1.ts` | R1 parser inline (commit anterior) |
| `src/services/catalog/CatalogDeliveryAddressService.ts` | R1 apply + invalidação frete |
| `src/services/catalog/CatalogSalesService.ts` | Histórico inline |
| `src/types/catalog-delivery-human.util.ts` | **Novo** — divergência, cópia manual |
| `src/types/__tests__/catalog-delivery-human.util.test.ts` | **Novo** — 6 casos |
| `src/types/__tests__/catalog-delivery-address-v1.test.ts` | +complemento, inline |
| `frontend/.../CatalogDeliveryHumanPanel.tsx` | **Novo** — UI compartilhada |
| `frontend/.../CatalogSalesOrderPanel.tsx` | Integração painel |
| `frontend/.../ProductsOrdersTab.tsx` | Drawer + campos localização |
| `docs/*` | CHANGELOG, SISTEMA-REGISTRO, INDICE, CATALOGO, PRODUTOS |

## 28. Testes criados/alterados

- R1: 20 casos em `catalog-delivery-address-v1.test.ts`
- Divergência/cópia: 6 casos em `catalog-delivery-human.util.test.ts`

## 29. Testes executados

```
8 suites, 92 testes — todos verdes
```

Inclui: `catalog-delivery-address-v1`, `catalog-delivery-human.util`, `catalog-sales`, `catalog-flow-commands`, `catalog-delivery-location-confirm`, `catalog-menu-gate`, `catalog-order-code`, `product-display.util`

## 30. Gates executados

```
npm run build                                          → exit 0
npm run build --prefix src/services/web-dashboard/frontend → exit 0
npm run pre-push:gate                                  → exit 0 (Docker frontend-builder OK)
```

## 31. QA manual pendente

Checklist Benhur (WhatsApp real, Inbox, WebChat, retirada) — ver seção 35.

## 32. Riscos encontrados

| Risco | Severidade |
|-------|------------|
| R1 inline | Média — **mitigado** |
| Pin = coords do v1 após text_after_pin (distância 0) | Baixa — humano ainda vê blocos separados |
| QA humano não executado | Média |

## 33. Riscos mitigados

- Correção inline sem pedir endereço completo desnecessário
- Frete/PIX após confirmação
- Operador não mistura pin com endereço confirmado na UI
- Sem automação motoboy

## 34. Próximo passo recomendado

1. Benhur revisar checklist
2. Autorizar push `develop` + merge `main`
3. Deploy controlado 2.17.61
4. QA humano cenários R1 + pin divergente no WhatsApp

## 35. Checklist para Benhur

* [ ] `não, é número 120` atualiza número
* [ ] `não é numero 120` atualiza número
* [ ] `errado, é número 120` atualiza número
* [ ] `não, é Rua José Pinto, 120` atualiza rua e número
* [ ] `não, é Av. José Pinto, 1020` atualiza avenida e número
* [ ] `não, cep 78705022` entra no fluxo CEP
* [ ] `não, bairro é Vila Birigui` atualiza bairro
* [ ] `não, complemento casa 2` atualiza complemento
* [ ] `não` simples pede endereço correto
* [ ] Após correção, pede confirmação novamente
* [ ] Após correção, não calcula frete antes do `sim`
* [ ] Após correção, não envia PIX antes do `sim`
* [ ] Após novo `sim`, frete/PIX seguem regra normal
* [ ] Se endereço muda, frete antigo é invalidado
* [ ] Inbox mostra endereço confirmado separado do pin
* [ ] Inbox mostra Google Maps
* [ ] Inbox mostra copiar dados para entrega manual
* [ ] Produtos/Pedidos mostra endereço confirmado separado do pin
* [ ] Alerta aparece se pin/endereço divergirem
* [ ] WebChat mantém paridade
* [ ] Retirada continua funcionando
* [ ] Nenhum envio automático para motoboy foi criado
