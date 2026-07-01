# RadarChat — Deploy Endereço de Entrega v1 2.17.60

## 1. Resumo executivo

Endereço de Entrega v1 **2.17.60** implantado em produção via push `develop` → fast-forward `main` → workflow Deploy **success**. Commit **`95666e9`**. Produção: widget `2.17.60`, bundle `index-D0EQsI0a.js`, health `healthy`. **77 testes** verdes; `pre-push:gate` verde. **QA humano WhatsApp/Inbox/WebChat:** pendente Benhur.

## 2. Versão inicial em produção

`2.17.59` (`f1f54ee`) — deploy [28542629760](https://github.com/benhuragmf/radarzapv2/actions/runs/28542629760)

## 3. Versão final implantada

`2.17.60` (`95666e9`)

## 4. Branch inicial

`develop` @ `95666e9` (1 commit à frente de `origin/develop`)

## 5. Branch final

`develop` e `main` alinhadas em `95666e9`

## 6. Commit local

`95666e9` — `feat(catalog): implementa endereco de entrega v1 2.17.60` (já existia antes desta etapa)

## 7. Commit develop

`95666e9` — push `3388983..95666e9` → `origin/develop`

## 8. Commit main

`95666e9` — fast-forward `f1f54ee..95666e9`

## 9. Push develop

Executado 2026-07-01 — **success**

## 10. Merge main

`git merge --ff-only develop` — **success**

Push: `f1f54ee..95666e9` → `origin/main`

## 11. Deploy workflow

| Campo | Valor |
|-------|--------|
| Workflow | Deploy |
| Run ID | [28547931838](https://github.com/benhuragmf/radarzapv2/actions/runs/28547931838) |
| Branch | `main` |
| Commit | `95666e99dddf2cca0506ad0a408465b81ad28c37` |
| Status | **success** |
| Duração | ~6m15s |
| Jobs | `build-and-push` success · `deploy` (Coolify SSH) success |

Sem full-republish, prune, volumes ou sessões WhatsApp.

## 12. Health check

```json
GET https://app.radarchat.com.br/api/services/health
{"healthy":true,"uptime":69,"version":"0.0.0","checkedAt":"2026-07-01T21:15:24Z"}
```

HTTP **200** em `https://app.radarchat.com.br`

## 13. Bundle em produção

```html
<script type="module" crossorigin src="/assets/index-D0EQsI0a.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-B9jEu0ig.css">
```

Bundle anterior (2.17.59): `index-CFrXD9Ca.js` / `index-C1EuxmRD.css` — **substituído**.

Strings confirmadas: `deliveryAddressV1`, `Endereço aguardando confirmação`, `Endereço confirmado`, `Confirmar endereço`, `Solicitar correção`, `Copiar endereço`, `Google Maps`.

## 14. Widget build

`WIDGET_BUILD = '2.17.60'` em `/webchat/widget.js`

## 15. Arquivos analisados

Handoff `RADARCHAT-ENDERECO-ENTREGA-V1-2.17.60.md`, deploy 2.17.59, `CatalogDeliveryAddressService`, `CatalogSalesService`, Inbox/Produtos frontend, APIs Dashboard.

## 16. Arquivos alterados (pacote 2.17.60)

`catalog-delivery-address-v1.ts`, `CatalogDeliveryAddressService.ts`, `CatalogSalesOrder.ts`, `CatalogSalesService.ts`, `DashboardService.ts`, Inbox/Produtos UI, testes v1, docs, `package.json`, `widget.js`.

## 17. Testes pré-push

**77 passed** (7 suites — revalidação 2026-07-01)

## 18. Gates executados

| Gate | Resultado |
|------|-----------|
| `npm run build` | OK |
| Frontend build | OK |
| `npm run pre-push:gate` | OK |

## 19. QA WhatsApp — CEP

**Pendente Benhur** — agente sem sessão WA.

## 20. QA WhatsApp — confirmação sim

**Pendente Benhur**

## 21. QA WhatsApp — correção não

**Pendente Benhur**

## 22. QA WhatsApp — pin + rua/número

**Pendente Benhur**

## 23. QA WhatsApp — endereço completo

**Pendente Benhur**

## 24. QA WhatsApp — cancelar/sair

**Pendente Benhur**

## 25. QA WhatsApp — retirada regressão

**Pendente Benhur**

## 26. QA Inbox — endereço v1

**Pendente Benhur** (painel autenticado) — strings no bundle produção confirmadas.

## 27. QA Inbox — ações operador

**Pendente Benhur**

## 28. QA Produtos/Pedidos — drawer endereço

**Pendente Benhur**

## 29. QA Produtos/Pedidos — deep link DX

**Pendente Benhur** — código inalterado em 2.17.60.

## 30. QA WebChat

**Pendente Benhur**

## 31. Segurança

Deploy app-only; sem alteração `.env`/volumes/sessões; APIs tenant-scoped; RBAC `orders:update-status`.

## 32. Problemas encontrados pós-deploy

Nenhum bloqueante detectado pelo agente (health OK, bundle/widget 2.17.60).

## 33. Correções feitas nesta etapa

Nenhuma correção de código — apenas push/deploy/validação automática + este documento.

## 34. Pendências para Benhur

Executar checklist §38 em produção com WhatsApp real e painel autenticado.

## 35. Riscos encontrados

- QA humano não executado
- Endereço salvo no contato (reutilização) ainda não implementado
- Pedidos legados dependem de backfill lazy

## 36. Riscos mitigados

- Confirmação obrigatória antes frete/PIX (código)
- Gates verdes pré-push
- Deploy sem prune/volumes

## 37. Próximo passo recomendado

1. Benhur QA cenários A–G WhatsApp + Inbox + Produtos
2. Se OK: marcar checklist
3. Se regressão: hotfix 2.17.61 pontual

## 38. Checklist final

* [ ] CEP gera endereço e pede número
* [ ] CEP + número pede confirmação
* [ ] Pin pede rua/número
* [ ] Pin + rua/número pede confirmação
* [ ] Endereço completo pede confirmação
* [ ] Sim confirma endereço
* [ ] Não permite corrigir
* [ ] Frete só calcula depois da confirmação
* [ ] PIX só aparece depois de endereço/frete
* [ ] Retirada continua funcionando
* [ ] PIX retirada não duplica
* [ ] Inbox mostra status do endereço
* [ ] Inbox mostra botão Google Maps
* [ ] Inbox mostra copiar endereço/coordenadas
* [ ] Atendente consegue corrigir endereço
* [ ] Usuário sem permissão não corrige endereço
* [ ] Pedido mostra snapshot do endereço
* [ ] Produtos/Pedidos mostra endereço v1
* [ ] Deep link DX continua funcionando
* [ ] WebChat mantém paridade
* [ ] Cancelar/sair interrompe fluxo
* [ ] Sem loop de endereço
* [ ] Sem PIX antes de endereço/frete
* [ ] Sem vazamento cross-tenant

---

*Gerado em 2026-07-01 — deploy controlado Endereço Entrega v1.*
