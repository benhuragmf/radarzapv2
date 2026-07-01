# RadarChat — Endereço de Entrega v1 2.17.60

## 1. Resumo executivo

Implementação local **2.17.60** da camada **Endereço de Entrega v1**: objeto estrutural `deliveryAddressV1` + `deliveryAddressSnapshot` no pedido, serviço normalizador (`CatalogDeliveryAddressService`), confirmação obrigatória do cliente antes de frete/PIX, APIs operador no painel, UI Inbox/Produtos. **Sem push/deploy** — aguardar autorização Benhur.

## 2. Versão inicial

`2.17.59` em produção (`f1f54ee`)

## 3. Versão final

`2.17.60` (local)

## 4. Branch

`develop`

## 5. Commit local

Pendente ao final desta etapa — mensagem sugerida: `feat(catalog): implementa endereco de entrega v1 2.17.60`

## 6. Produção

Produção **não** executada nesta etapa — aguardar autorização explícita do Benhur.

## 7. Push/deploy

| Ação | Status |
|------|--------|
| Push remoto | **Não executado** |
| Merge main | **Não executado** |
| Deploy Coolify | **Não executado** |

## 8. Problema resolvido

Interpretação frágil de endereço por regex/mensagens soltas no chat; frete/PIX antes de confirmação; falta de snapshot no pedido; operador sem visão estruturada.

## 9. Decisão arquitetural

Camada **Endereço v1** entre inbound (WA/WebChat) e frete/PIX. `AiConversationService`/`CatalogSalesService` delegam ao normalizador. Campos legados (`deliveryAddress`, lat/lng) mantidos sincronizados. Confirmação cliente obrigatória antes de `proceedToFreightAfterConfirmedAddress`.

## 10. Objeto de endereço no pedido

`deliveryAddressV1` em `CatalogSalesOrder` — campos: rua, número, CEP, UF, lat/lng, `source`, `status`, `confidence`, `confirmedBy`, `missingFields`, `formattedAddress`, etc.

Status: `empty`, `partial`, `received`, `needs_confirmation`, `confirmed`, `freight_pending`, `freight_confirmed`, `needs_human_review`, …

## 11. Snapshot de endereço

`deliveryAddressSnapshot` gravado após frete confirmado — endereço, distância, faixa km, frete, total, regra `distance_km_v1`, `capturedAt`.

## 12. Normalização por CEP

ViaCEP → endereço parcial → pede número → monta endereço → `needs_confirmation`.

## 13. Normalização por pin

Reverse geocode → pede rua/número → mescla pin + texto → `needs_confirmation`. Pin **não** dispara frete direto.

## 14. Normalização por texto livre

`parseLooseDeliveryAddress` → `needs_confirmation`; contexto empresa se cidade/UF faltando (confiança menor).

## 15. Confirmação do cliente

`sim`/`correto`/`confirmo` → `confirmed` → frete → PIX. `não`/`errado` → pede correção.

## 16. Correção por atendente

API `PATCH …/delivery-address`, `POST …/confirm`, `POST …/request-correction` — capability `orders:update-status`.

## 17. Frete seguro

`proceedToFreightAfterConfirmedAddress` só após `canProceedToFreight`. Falha → `pendente_humano_endereco` / `needs_human_review`, sem PIX.

## 18. PIX somente após endereço/frete

Bloqueio em `maybeAttachAddressToOrder` e fluxo incremental v1.

## 19. Inbox — endereço/localização

`CatalogSalesOrderPanel`: badge status v1, snapshot, copiar endereço, Google Maps, confirmar/solicitar correção.

## 20. Produtos/Pedidos — endereço

Drawer com `deliveryAddressV1` + snapshot; deep link DX preservado.

## 21. WebChat paridade

Mesmo `CatalogDeliveryAddressService` via `CatalogSalesService.processIncrementalAddressInput` (canal webchat).

## 22. API

- `PATCH /platform/catalog-sales/orders/:id/delivery-address`
- `POST …/delivery-address/confirm`
- `POST …/delivery-address/request-correction`
- `POST …/freight/recalculate`

## 23. RBAC

`orders:update-status` para correção/confirmação operador; `orders:view` para leitura.

## 24. Auditoria

History: `delivery_address_normalized`, `delivery_address_confirmed`, `delivery_address_needs_human`, `delivery_address_operator_corrected`, `address_confirmed_freight`, `delivery_freight_recalculated`.

## 25. Migração/backfill

`backfillDeliveryAddressV1FromLegacy` + `ensureV1` lazy em `getOrderForClient`/`orderToPayload`. Sem migração destrutiva.

## 26. Segurança

Tenant-scoped; sem alteração volumes/sessões/.env; snapshot não expõe comprovante/PIX.

## 27. Arquivos analisados

Docs 2.17.59, `CatalogSalesService`, `catalog-delivery.util`, Inbox/Produtos frontend, modelo pedido.

## 28. Arquivos alterados

- `src/types/catalog-delivery-address-v1.ts` (novo)
- `src/services/catalog/CatalogDeliveryAddressService.ts` (novo)
- `src/models/CatalogSalesOrder.ts`
- `src/types/catalog-sales.ts`
- `src/services/catalog/CatalogSalesService.ts`
- `src/services/web-dashboard/DashboardService.ts`
- `src/services/web-dashboard/frontend/.../CatalogSalesOrderPanel.tsx`
- `src/services/web-dashboard/frontend/.../ProductsOrdersTab.tsx`
- `package.json`, `webchat/widget.js`
- Docs + testes

## 29. Testes criados/alterados

- `catalog-delivery-address-v1.test.ts` (novo, 11 casos)

## 30. Testes executados

**77 passed** (7 suites catálogo incl. v1)

## 31. Gates executados

| Gate | Resultado |
|------|-----------|
| `npm run build` | OK |
| Frontend build | OK |
| `npm run pre-push:gate` | OK |

## 32. QA manual executado

Não executado (sem ambiente WA/Inbox autenticado pelo agente).

## 33. QA pendente para Benhur

Cenários A–F do prompt: CEP, pin+rua, endereço completo, confirmação sim/não, correção atendente, regressão retirada/PIX/estoque.

## 34. Riscos encontrados

- Endereço salvo no contato (reutilização) — **não implementado** nesta entrega; pendência futura.
- Pedidos legados sem v1 dependem de backfill lazy.

## 35. Riscos mitigados

- PIX antes de confirmação bloqueado
- Pin não pula confirmação
- Gates verdes
- Legado preservado

## 36. Próximo passo recomendado

1. Benhur autorizar push `develop` → merge `main` → deploy
2. QA manual cenários A–F em staging/produção
3. Opcional: endereço salvo no contato com confirmação

## 37. Checklist para Benhur testar

* [ ] CEP gera endereço e pede número
* [ ] CEP + número pede confirmação
* [ ] Pin pede rua/número
* [ ] Pin + rua/número pede confirmação
* [ ] Endereço completo pede confirmação
* [ ] Sim confirma endereço
* [ ] Não permite corrigir
* [ ] Frete só calcula depois da confirmação
* [ ] PIX só aparece depois de endereço/frete
* [ ] Inbox mostra status do endereço
* [ ] Inbox mostra botão Google Maps
* [ ] Atendente consegue corrigir endereço
* [ ] Pedido mostra snapshot do endereço
* [ ] WebChat mantém paridade
* [ ] Cancelar/sair interrompe fluxo
* [ ] Sem loop de endereço

---

*Gerado em 2026-07-01 — etapa local Endereço Entrega v1.*
