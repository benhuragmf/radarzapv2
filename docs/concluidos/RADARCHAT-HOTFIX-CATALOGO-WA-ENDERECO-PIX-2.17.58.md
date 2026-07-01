# RadarChat — Hotfix Catálogo WhatsApp Endereço, Retirada e PIX 2.17.58

## 1. Resumo executivo

Hotfix local **2.17.58** após QA real WhatsApp em produção (2.17.57). Corrige PIX duplicado na retirada, retirada sem endereço configurado, parser de endereço completo sem CEP, pin + rua/número, fallback contextual (sem “instabilidade” genérica) e supressão de resposta LLM quando catálogo já respondeu. **54 testes** + **pre-push gate** verdes. **Sem deploy/push** nesta etapa.

## 2. Versão inicial

`2.17.57` (produção `d0d3cfb`)

## 3. Versão final

`2.17.58` (local)

## 4. Branch

`develop`

## 5. Commit local

`fix(catalog): corrige retirada endereço e respostas duplicadas 2.17.58` (após esta documentação)

## 6. Produção

**Produção não executada** nesta etapa — aguardando autorização explícita do Benhur.

## 7. Push/deploy

- Push remoto: **não executado**
- Merge `main`: **não executado**
- Deploy / Coolify: **não executado**

## 8. Bugs reais reproduzidos

| # | Bug | Causa raiz |
|---|-----|------------|
| 1 | PIX retirada duplicado | `processAiCatalogTurn` enviava pickup via WA automático **e** short-circuit enviava `customerReply` |
| 2 | Retirada com “Consulte nossa equipe” + PIX | Fallback genérico em `buildPickupFulfillmentReply` |
| 3 | Endereço completo → instabilidade | Short-circuit só CEP/número curto; LLM falhava → recovery genérico |
| 4 | Pin + `Rua: Salmen Hanze, 1326` rejeitado | `mergeLocationConfirmReply` exigia CEP/bairro completos; prefixo `Rua:` |
| 5 | Instabilidade no fluxo catálogo | `recoverFromAiFailure` sem contextualização |
| 6 | Resposta LLM após catálogo | `sendAiReply` sempre após `processAiCatalogTurn` com cotação |

## 9. Prints/QA Benhur considerados

Fluxos reportados: retirada ZAAd duplicando PIX; entrega com endereço completo; pin + confirmação rua/número; mensagem de instabilidade no meio da compra.

## 10. Arquivos analisados

`catalog-sales.ts`, `catalog-delivery-address.ts`, `catalog-delivery.util.ts`, `CatalogSalesService.ts`, `AiConversationService.ts`, `WebChatAiService.ts`, testes catálogo.

## 11. Arquivos alterados

- `src/types/catalog-sales.ts` — pickup, PIX resend, fallback contextual
- `src/types/catalog-delivery-address.ts` — endereço livre, geocodable
- `src/utils/catalog-delivery.util.ts` — parser rua/número, merge pin, geocode cliente
- `src/services/catalog/CatalogSalesService.ts` — retirada, endereço, anti-duplicação
- `src/services/ai/AiConversationService.ts` — short-circuit endereço, recovery, skip LLM
- `src/services/webchat/WebChatAiService.ts` — paridade endereço
- `package.json`, `webchat/widget.js` → 2.17.58
- Testes + docs

## 12. Retirada — PIX duplicado

Removido `sendPickupFulfillmentToCustomer` de `processAiCatalogTurn` no pickup. Uma única resposta via `processFulfillmentChoice` → `preparePickupFulfillmentReply`. Anti-reenvio se `catalogOrderPixAlreadySent` (salvo `detectPixResendRequest`).

## 13. Retirada — endereço ausente

`resolveConfiguredPickupAddress` valida `deliveryOriginAddress` / `Organization.address`. Sem endereço: status `pendente_configuracao_whatsapp`, escala humano, mensagem honesta **sem PIX**.

## 14. Entrega — endereço completo sem CEP

`parseLooseDeliveryAddress` + `textLooksLikeDeliveryAddressInput` + `geocodeCustomerAddressFree` para destino. `tryProcessCatalogAddressInput` no short-circuit.

## 15. Pin localização — rua/número

`parseStreetNumberReply` aceita `Rua:`, `R.`, `nº`. `mergeLocationConfirmReply` relaxado (cidade/UF do reverse sem CEP obrigatório).

## 16. Fallback contextual sem instabilidade

`buildCatalogContextualRecoveryReply` + uso em `buildPurchaseRecoveryReply` e `recoverFromAiFailure`. Mensagem genérica de instabilidade substituída por orientação de pedido quando há fluxo ativo.

## 17. Concorrência/idempotência WhatsApp

- Skip `sendAiReply` quando `catalogTurn.serverQuoteSent` / `handled` / `quoteFailed` com pedido ativo
- Uma resposta principal de catálogo por inbound no short-circuit de endereço/fulfillment

## 18. WebChat paridade

`tryCatalogWebChatShortCircuit` usa `tryProcessCatalogAddressInput` e mesmos detectores de endereço.

## 19. Segurança

Sem exposição de chave PIX em logs; sem alteração em sessões/volumes; entregadores permanecem bloqueados.

## 20. Testes criados/alterados

- `catalog-sales.test.ts` — pickup, endereço livre, rua/número, fallback
- `catalog-delivery-location-confirm.test.ts` — `Rua: Salmen Hanze, 1326`

## 21. Testes executados

```
54 passed (catalog-sales + menu-gate + product-display + location-confirm)
```

## 22. Gates executados

- `npm run build` — OK
- `npm run build --prefix src/services/web-dashboard/frontend` — OK
- `npm run pre-push:gate` — OK

## 23. QA manual executado

Não executado com WhatsApp real nesta sessão (correção + testes automatizados).

## 24. QA pendente para Benhur

Repetir em produção **após deploy autorizado**:

1. Retirada ZAAd — PIX uma vez; sem endereço → sem PIX + humano
2. Entrega — endereço completo sem CEP
3. Pin + `Rua: Salmen Hanze, 1326`
4. Perguntas taxa/endereço — sem repetir PIX
5. `manda o pix` — reenvio explícito
6. WebChat paridade

## 25. Riscos encontrados

- Geocoding OSM pode falhar offline/lento — mensagem de falha de frete (não instabilidade)
- Endereço de retirada depende de `deliveryOriginAddress` ou `Organization.address` configurados

## 26. Riscos mitigados

- Duplicação PIX retirada
- PIX com placeholder “consulte equipe”
- Instabilidade genérica em fluxo ativo
- LLM respondendo após catálogo

## 27. Próximo passo recomendado

1. Benhur autorizar push + deploy 2.17.58
2. QA WhatsApp cenários A–D do prompt
3. Se OK, fechar pendências da validação 2.17.57

## 28. Checklist para Benhur testar

- [ ] Retirada não duplica PIX
- [ ] Retirada sem endereço não libera PIX
- [ ] Retirada com endereço libera PIX uma vez
- [ ] Entrega pede endereço antes do PIX
- [ ] Endereço completo sem CEP não gera instabilidade
- [ ] Rua: Salmen Hanze, 1326 é aceito
- [ ] Pin + rua/número funciona
- [ ] Pergunta taxa não repete PIX
- [ ] Pergunta endereço não repete PIX
- [ ] Produto estoque consulte não gera PIX
- [ ] Produto sem preço não gera PIX
- [ ] WebChat mantém paridade
