# RadarChat — Hotfix Endereço Correção Inline 2.17.61

## 1. Resumo executivo

Hotfix local **2.17.61** corrige o risco **R1** documentado no QA pós-deploy 2.17.60: respostas como `não, é número 120` na confirmação de endereço eram tratadas como negativa simples, pedindo endereço completo em vez de atualizar só o campo corrigido e reconfirmar. Implementação centralizada em `parseInlineAddressCorrectionAfterNo` + `CatalogDeliveryAddressService.applyInlineCorrection`, com testes unitários e gates verdes. **Sem push/deploy nesta etapa.**

## 2. Versão inicial

`2.17.60` (produção `95666e9`)

## 3. Versão final

`2.17.61` (local `develop`, não publicada)

## 4. Branch

`develop`

## 5. Commit local

`fix(catalog): corrige negativa com ajuste de endereco 2.17.61` (após este documento)

## 6. Produção

Produção não executada nesta etapa.

- Produção permanece em **2.17.60** (`95666e9`)
- Bundle produção: `index-D0EQsI0a.js`
- Widget produção: `2.17.60`

## 7. Push/deploy

| Ação | Status |
|------|--------|
| Push remoto | **Não executado** |
| Merge `main` | **Não executado** |
| Deploy Coolify | **Não executado** |
| Full-republish | **Não executado** |

## 8. Problema R1

Na confirmação de endereço (`needs_confirmation`), frases como `não, é número 120` caíam em `textIsAddressConfirmationNo` antes de extrair o número corrigido, gerando pedido genérico de endereço completo e perdendo o endereço parcial já montado.

## 9. Causa provável

Em `CatalogDeliveryAddressService.processConfirmationReply`, a ordem era: `sim` → **`textIsAddressConfirmationNo`** → `processFreeText`. A função `textIsAddressConfirmationNo` retornava `true` para qualquer texto com `\b(nao|errado|...)\b` até 80 caracteres, incluindo correções inline com dados úteis.

## 10. Correção aplicada

1. **`parseInlineAddressCorrectionAfterNo`** — detecta negativa + dado (número, rua+número, CEP, bairro, complemento), incluindo padrão `não é 1326 é 120`.
2. **`textIsSimpleAddressConfirmationNo`** — negativa sem dado útil; `textIsAddressConfirmationNo` delega a ela.
3. **`applyInlineCorrection`** no serviço — aplica patch em `deliveryAddressV1`, invalida frete, volta `needs_confirmation`, mensagens específicas.
4. **Ordem no fluxo:** sim → inline → não simples → texto livre → fallback.
5. **Histórico:** ação `delivery_address_inline_corrected` em `CatalogSalesService`.
6. **Bloqueio:** pedidos `pagamento_aprovado` / `pedido_confirmado` / `entregue` / `concluido` escalam para humano.

## 11. Ordem de decisão no fluxo

1. Comandos globais (cancelar/sair/atendente) — inalterados upstream
2. Confirmação positiva (`sim`, `correto`, `confirmo`)
3. **Negativa com correção inline** (`parseInlineAddressCorrectionAfterNo`)
4. Negativa simples (`não`, `errado`, `corrigir`)
5. Texto livre de endereço (`processFreeText`)
6. Fallback (`buildAddressConfirmationRequestMessage`)

## 12. Correção inline de número

Entrada: `não, é número 120` / `não é numero 120` / `errado, é número 120` / `não, é 120` / `não é 1326 é 120`

- Atualiza `deliveryAddressV1.number`
- Mantém rua, bairro, cidade, UF, CEP, lat/lng
- Resposta: `Atualizei o número do endereço. Confirme por favor: …`

## 13. Correção inline de rua/número

Entrada: `não, é Rua José Pinto, 120` / `não, é Av. José Pinto, 1020`

- Atualiza `street` + `number` (e bairro se parseado)
- Resposta: `Atualizei o endereço. Confirme por favor: …`

## 14. Correção inline de CEP

Entrada: `não, cep 78705022`

- Consulta ViaCEP via `lookupBrCep`
- Mescla rua/bairro/cidade/UF; mantém número se já existir
- Sem número: status `partial` + mensagem CEP; com número: `needs_confirmation` + confirmação completa

## 15. Correção inline de bairro/complemento

- Bairro: `não, bairro é Vila Birigui` → atualiza `neighborhood`, reconfirma
- Complemento: `não, complemento casa 2` → atualiza `complement`, reconfirma

## 16. Bloqueio de frete/PIX após correção

- `canProceedToFreight` exige `confirmed` — após inline permanece `needs_confirmation`
- `processIncrementalAddressInput` só chama frete após `action === 'confirmed'`
- `needsAddressConfirmation: true` também para `inline_corrected`
- PIX não é disparado neste caminho

## 17. Snapshot/frete invalidado

`invalidateFreightEstimate` limpa `deliveryFee`, `deliveryDistanceKm`, `deliveryTierKm`, `deliveryDistanceMethod`. `deliveryAddressSnapshot` anterior permanece no pedido até novo frete confirmado (histórico preservado).

## 18. WebChat paridade

WhatsApp e WebChat usam o mesmo `CatalogDeliveryAddressService.processClientInput` — sem duplicação por canal.

## 19. Inbox/Produtos impacto

- Pedido reflete `needs_confirmation` após inline
- Histórico `delivery_address_inline_corrected`
- Snapshot final só após frete confirmado (comportamento existente)

## 20. Segurança

- Pedido pago/aprovado: não altera endereço automaticamente; escala humano
- `confirmedAt` / `confirmedBy` limpos após correção inline
- Sem alteração em `.env`, sessões, volumes

## 21. Arquivos analisados

- `src/types/catalog-delivery-address-v1.ts`
- `src/services/catalog/CatalogDeliveryAddressService.ts`
- `src/services/catalog/CatalogSalesService.ts`
- `src/types/__tests__/catalog-delivery-address-v1.test.ts`
- `docs/concluidos/RADARCHAT-QA-REAL-POS-DEPLOY-ENDERECO-V1-2.17.60.md`
- `docs/CATALOGO-PIX-PEDIDOS.md`, `docs/PRODUTOS-CATALOGO.md`

## 22. Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/types/catalog-delivery-address-v1.ts` | Parser inline, mensagens, `refreshV1AfterInlineCorrection` |
| `src/services/catalog/CatalogDeliveryAddressService.ts` | Ordem fluxo, `applyInlineCorrection`, invalidação frete |
| `src/services/catalog/CatalogSalesService.ts` | Histórico `delivery_address_inline_corrected` |
| `src/types/__tests__/catalog-delivery-address-v1.test.ts` | +10 casos R1 |
| `package.json` | `2.17.61` |
| `src/services/web-dashboard/webchat/widget.js` | `WIDGET_BUILD 2.17.61` |
| `docs/CHANGELOG.md` | Entrada 2.17.61 |
| `docs/SISTEMA-REGISTRO.md` | Linha 2.17.61 |
| `docs/INDICE-DOCUMENTACAO.md` | Link deste doc |

## 23. Testes criados/alterados

- `parseInlineAddressCorrectionAfterNo` — número, rua, CEP, bairro, complemento, swap `1326→120`
- `refreshV1AfterInlineCorrection` — limpa confirmação
- `CatalogDeliveryAddressService` — inline número/rua/CEP/bairro, sim após inline, bloqueio pago
- `textIsAddressConfirmationNo('não, é número 120')` → `false`

## 24. Testes executados

```
npx jest src/types/__tests__/catalog-delivery-address-v1.test.ts     → 19 passed
npx jest src/types/__tests__/catalog-sales.test.ts                   → passed
npx jest src/types/__tests__/catalog-flow-commands.test.ts           → passed
npx jest src/types/__tests__/catalog-menu-gate.test.ts               → passed
npx jest src/types/__tests__/product-display.util.test.ts            → passed
npx jest src/utils/__tests__/catalog-delivery-location-confirm.test.ts → passed
npx jest src/utils/__tests__/catalog-order-code.test.ts              → passed
```

Total catalog-related: **85 testes** verdes.

## 25. Gates executados

```
npm run build                                          → exit 0
npm run build --prefix src/services/web-dashboard/frontend → exit 0
npm run pre-push:gate                                  → exit 0 (backend + frontend + docker frontend-builder)
```

## 26. QA manual pendente

Validação humana WhatsApp/Inbox/WebChat **pendente Benhur** após deploy autorizado:

- Cenário C do QA 2.17.60: `não, é número 120` na confirmação real
- Retirada inalterada (fora do escopo deste hotfix)
- Paridade WebChat no widget real

## 27. Riscos encontrados

| Risco | Severidade | Nota |
|-------|------------|------|
| R1 inline após não | Média | **Mitigado** neste hotfix |
| QA humano ainda não executado | Média | Aguarda deploy + Benhur |
| Frases ambíguas muito longas | Baixa | Fallback para confirmação genérica |

## 28. Riscos mitigados

- Negativa com número inline não pede mais endereço completo desnecessariamente
- Frete/PIX bloqueados até novo `sim`
- Pedido pago não aceita correção automática

## 29. Próximo passo recomendado

1. Benhur revisar diff local e checklist abaixo
2. Autorizar `git push origin develop` + merge `main` quando confortável
3. Deploy controlado 2.17.61
4. QA humano cenário R1 no WhatsApp real
5. Marcar QA 2.17.60 como concluído se demais itens passarem

## 30. Checklist para Benhur

* [ ] `não, é número 120` atualiza número
* [ ] `não é numero 120` atualiza número
* [ ] `errado, é número 120` atualiza número
* [ ] `não, é Rua José Pinto, 120` atualiza rua e número
* [ ] `não, é Av. José Pinto, 1020` atualiza avenida e número
* [ ] `não, cep 78705022` entra no fluxo CEP
* [ ] `não` simples pede endereço correto
* [ ] Após correção, pede confirmação novamente
* [ ] Após correção, não calcula frete antes do `sim`
* [ ] Após correção, não envia PIX antes do `sim`
* [ ] Após novo `sim`, frete/PIX seguem regra normal
* [ ] WebChat mantém paridade
* [ ] Retirada continua funcionando
