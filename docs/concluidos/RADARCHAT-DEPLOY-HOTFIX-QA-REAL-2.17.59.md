# RadarChat — Deploy Hotfix QA Real WhatsApp, Inbox e Pedido 2.17.59

## 1. Resumo executivo

Hotfix **2.17.59** implantado em produção via push `develop` → fast-forward `main` → workflow Deploy **success**. Commit final **`f1f54ee`** (substitui `d2358ce` após amend do hash no handoff). Produção: widget `2.17.59`, bundle `index-CFrXD9Ca.js`, health `healthy`. **66 testes** catálogo verdes na revalidação desta etapa; `pre-push:gate` verde. **QA WhatsApp/WebChat/painel autenticado:** pendente Benhur (agente sem sessão WA/login).

## 2. Versão inicial em produção

`2.17.58` (`e3a1415`) — deploy [28537807467](https://github.com/benhuragmf/radarzapv2/actions/runs/28537807467)

## 3. Versão final implantada

`2.17.59` (`f1f54ee`)

## 4. Branch inicial

`develop` @ `f1f54ee` (já com hotfix local; handoff anterior documentava `d2358ce` antes do amend)

## 5. Branch final

`develop` e `main` alinhadas em `f1f54ee`

## 6. Commit develop

| SHA | Mensagem |
|-----|----------|
| `f1f54ee` | `fix(catalog): corrige loop endereço inbox localização e pedido 2.17.59` |

Nota: `d2358ce` é ancestral amendado — mesmo escopo, hash final em produção é `f1f54ee`.

## 7. Commit main

`f1f54ee` (fast-forward de `e3a1415`)

## 8. Push develop

Executado em 2026-07-01 — `e3a1415..f1f54ee` → `origin/develop` (etapa autorizada pelo Benhur; revalidado nesta auditoria: branch up to date).

## 9. Merge main

`git merge --ff-only develop` — **success** (fast-forward)

Push: `e3a1415..f1f54ee` → `origin/main`

## 10. Deploy workflow

| Campo | Valor |
|-------|--------|
| Workflow | Deploy |
| Run ID | [28542629760](https://github.com/benhuragmf/radarzapv2/actions/runs/28542629760) |
| Branch | `main` |
| Commit | `f1f54eee083db14fd54eb63e8c730f69a644ff99` |
| Status | **success** |
| Duração | ~5m51s (build-and-push ~3m11s + deploy Coolify ~2m30s) |
| Jobs | `build-and-push` success · `deploy` (Coolify SSH) success |

Sem full-republish, prune destrutivo, alteração de volumes, sessões WhatsApp ou `.env`.

## 11. Health check

```json
GET https://app.radarchat.com.br/api/services/health
{"healthy":true,"uptime":208,"version":"0.0.0","checkedAt":"2026-07-01T19:40:22Z"}
```

HTTP **200** em `https://app.radarchat.com.br`

## 12. Bundle em produção

```html
<script type="module" crossorigin src="/assets/index-CFrXD9Ca.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-C1EuxmRD.css">
```

Bundle anterior (2.17.58): `index-D1GaRBSy.js` / `index-5xdt30gk.css` — **substituído**.

Strings confirmadas no bundle minificado: `Pedido aguardando endereço`, `orderCode`, `#pedidos?order=`, `Copiar coordenadas`.

## 13. Widget build

`WIDGET_BUILD = '2.17.59'` em `/webchat/widget.js`

## 14. Arquivos analisados

- `docs/concluidos/RADARCHAT-HOTFIX-QA-REAL-WHATSAPP-INBOX-PEDIDO-2.17.59.md`
- `docs/concluidos/RADARCHAT-DEPLOY-HOTFIX-CATALOGO-2.17.58.md`
- `docs/concluidos/RADARCHAT-HOTFIX-CATALOGO-WA-ENDERECO-PIX-2.17.58.md`
- `docs/concluidos/RADARCHAT-VALIDACAO-POS-PRODUCAO-2.17.57.md`
- `docs/CATALOGO-PIX-PEDIDOS.md`, `docs/PRODUTOS-CATALOGO.md`
- `docs/CHANGELOG.md`, `docs/SISTEMA-REGISTRO.md`, `docs/INDICE-DOCUMENTACAO.md`
- Código hotfix: tipos, utils, `CatalogSalesService`, `AiConversationService`, modelo pedido, Inbox/Produtos frontend

## 15. Arquivos alterados (hotfix 2.17.59)

**Backend:** `catalog-sales.ts`, `catalog-delivery-address.ts`, `catalog-delivery.util.ts`, `catalog-order-code.util.ts`, `CatalogSalesService.ts`, `AiConversationService.ts`, `CatalogSalesOrder.ts`, `DashboardService.ts`

**Frontend:** `InboxMessageBubble.tsx`, `CatalogSalesOrderPanel.tsx`, `ProductsOrdersTab.tsx`

**Versão:** `package.json`, `webchat/widget.js`

**Testes:** `catalog-flow-commands.test.ts`, `catalog-order-code.test.ts`, `catalog-delivery-location-confirm.test.ts`

## 16. Testes pré-push

| Suite | Resultado |
|-------|-----------|
| `catalog-sales.test.ts` |  pass |
| `catalog-menu-gate.test.ts` | pass |
| `product-display.util.test.ts` | pass |
| `catalog-delivery-location-confirm.test.ts` | 6 pass |
| `catalog-flow-commands.test.ts` | pass |
| `catalog-order-code.test.ts` | pass |

**Total: 66 passed** (revalidação 2026-07-01)

## 17. Gates executados

| Gate | Resultado |
|------|-----------|
| `npm run build` | OK (~11s) |
| `npm run build --prefix src/services/web-dashboard/frontend` | OK (~14s) |
| `npm run pre-push:gate` (incl. Docker `frontend-builder`) | OK (~29s) |

## 18. QA WhatsApp — áudio não abre setores

**Status:** Pendente Benhur (agente sem WhatsApp conectado)

**Código:** `AiConversationService` + `hasActiveCatalogFlow` + `buildCatalogMediaInFlowReply`

**Esperado:** sem menu Comercial/Financeiro/Suporte; pedir texto para continuar compra.

## 19. QA WhatsApp — pin + rua/número

**Status:** Pendente Benhur

**Código:** `mergeLocationConfirmReply`, `parseStreetNumberReply`, `resolveBrazilStateUf`

**Esperado:** aceitar `Rua jose pinto, 120`; região do pin; sem loop; frete ou CEP.

## 20. QA WhatsApp — variações Avenida

**Status:** Pendente Benhur

**Esperado:** `Av. jose pinto,120` e `Avenida José pinto, 1020` aceitos (coberto por testes unitários de parser).

## 21. QA WhatsApp — CEP

**Status:** Pendente Benhur

**Código:** `tryProcessCatalogFlowCommand` — intent CEP

**Esperado:** responde que sim e pede CEP; não repete rua/número.

## 22. QA WhatsApp — atendente

**Status:** Pendente Benhur

**Esperado:** escala humano; para pedir endereço.

## 23. QA WhatsApp — cancelar

**Status:** Pendente Benhur

**Esperado:** abandona fluxo; sem PIX; resposta única.

## 24. QA WhatsApp — sair

**Status:** Pendente Benhur

**Esperado:** encerra compra; resposta única.

## 25. QA WhatsApp — saudação nova

**Status:** Pendente Benhur

**Código:** `shouldIgnoreStaleCatalogRecovery`, `isCatalogGreetingOnly`

**Esperado:** não recupera pedido antigo; sem “tive dificuldade em confirmar essa etapa”.

## 26. QA WhatsApp — retirada preservada

**Status:** Pendente Benhur (OK em 2.17.58 — regressão a validar)

**Esperado:** endereço retirada real; PIX uma vez; sem placeholder.

## 27. QA Inbox — localização

**Status:** Pendente Benhur (painel autenticado)

**Código:** `InboxMessageBubble` — card Maps + copiar coordenadas (strings no bundle produção).

## 28. QA Inbox — card pedido por status

**Status:** Pendente Benhur

**Código:** `CatalogSalesOrderPanel` — `aguardando_endereco` → “Pedido aguardando endereço” (não “Comprovante PIX recebido”).

## 29. QA Pedido — código curto DX

**Status:** Pendente Benhur

**Código:** `orderCode` no modelo + backfill lazy + UI clicável.

## 30. QA Pedido — deep link

**Status:** Pendente Benhur

**Rota:** `/platform/produtos#pedidos?order=DX-####`

## 31. QA WebChat

**Status:** Pendente Benhur

Paridade mínima esperada com WhatsApp (mesmos guards em `WebChatAiService`).

## 32. Segurança

| Item | Status |
|------|--------|
| Sem secrets em logs desta etapa | OK |
| Comprovante só rota autenticada | inalterado |
| Sem dados entregador automáticos | inalterado |
| `orderCode` tenant-scoped | implementado |
| Sem alteração volumes/sessões/.env | OK |
| Sem full-republish/prune | OK |

## 33. Problemas encontrados pós-deploy

Nenhum bloqueante detectado pelo agente (health OK, bundle/widget corretos). QA humano ainda não executado.

## 34. Correções feitas nesta etapa

Nenhuma correção de código — deploy já concluído. Esta etapa: revalidação Git/gates/produção + documentação de conclusão.

**Divergência documental resolvida:** handoff 2.17.59 dizia “sem push/deploy” e commit `d2358ce`; produção está em `f1f54ee` com deploy success.

## 35. Pendências para Benhur

1. QA WhatsApp cenários A–I em produção (lista §18–26)
2. QA Inbox: localização, títulos card, código DX
3. QA Produtos: lista, busca DX, deep link, RBAC
4. QA WebChat paridade (opcional)
5. Confirmar pin real Rondonópolis / Mato Grosso → MT em conversa viva

## 36. Riscos encontrados

- QA humano não executado pelo agente
- Pedidos legados recebem `orderCode` no primeiro acesso (lazy backfill)
- Health API retorna `version: 0.0.0` (não usar como semver)

## 37. Riscos mitigados

- Gates verdes antes e após deploy
- Anti-loop endereço (CEP → humano após 3 tentativas)
- Stale order ignorado em saudação
- Mídia no catálogo não abre triagem
- Deploy app-only Coolify sem prune/volumes

## 38. Próximo passo recomendado

1. Benhur executar checklist §39 em produção com WhatsApp real
2. Se QA passar: marcar checklist e arquivar pendências
3. Se regressão: hotfix 2.17.60 pontual (sem full-republish)

## 39. Checklist final

* [ ] Áudio não abre setores
* [ ] Pin + Rua jose pinto, 120 funciona
* [ ] Av. jose pinto,120 funciona
* [ ] Avenida José pinto, 1020 funciona
* [ ] Posso te enviar o CEP? responde corretamente
* [ ] Falar com atendente para o bot
* [ ] Cancelar para o fluxo
* [ ] Sair para o fluxo
* [ ] Não repete mensagem de endereço em loop
* [ ] Saudação nova não usa pedido antigo
* [ ] Inbox não mostra comprovante se está aguardando endereço
* [ ] Inbox mostra localização do cliente
* [ ] Botão Google Maps funciona
* [ ] Pedido tem código tipo DX-1045
* [ ] Clicar no código abre pedido exato
* [ ] Pedido abre conversa exata
* [ ] Sem permissão não acessa pedido
* [ ] WebChat mantém paridade

---

*Gerado em 2026-07-01 — etapa push/deploy controlado + revalidação pós-hotfix 2.17.59.*
