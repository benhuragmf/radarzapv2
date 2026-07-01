# RadarChat — Hotfix QA Real WhatsApp, Inbox Localização e Código Pedido 2.17.59

## 1. Resumo executivo

Hotfix local **2.17.59** corrige QA real pós-2.17.58: áudio/mídia não abre triagem no catálogo; pin + rua/número com UF por nome de estado; anti-loop endereço; comandos atendente/cancelar/sair; contexto stale de pedido; card Inbox por status; localização no chat; código curto `DX-####` e deep link pedido ↔ Inbox. **Sem push/deploy** nesta etapa.

## 2. Versão inicial

`2.17.58` (produção)

## 3. Versão final

`2.17.59` (local)

## 4. Branch

`develop`

## 5. Commit local

`d2358ce` — `fix(catalog): corrige loop endereço inbox localização e pedido 2.17.59`

## 6. Produção

Produção **não** executada nesta etapa — aguardar autorização explícita do Benhur.

## 7. Push/deploy

| Ação | Status |
|------|--------|
| Push remoto | **Não executado** |
| Merge main | **Não executado** |
| Deploy Coolify | **Não executado** |

## 8. Prints/QA Benhur considerados

- Áudio no meio do catálogo abriu triagem/setores
- Pin + `Rua jose pinto, 120` em loop
- `Posso te enviar o cep?` / `Falar com atendente` / `Cancelar` / `Sair` ignorados
- Saudação `Olá` + `s` disparou recovery de pedido antigo
- Card Inbox com título “Comprovante PIX” em `aguardando_endereco`
- Retirada com endereço OK em 2.17.58 (mantida)

## 9. Bugs corrigidos

1. Mídia/áudio no fluxo catálogo → resposta contextual, sem triagem
2. Parser rua/número + merge pin com estado “Mato Grosso” → MT
3. Anti-loop endereço (CEP alternativo / escala humano após 3 tentativas)
4. Comandos humano/cancelar/sair/CEP no fluxo
5. Ignorar pedido stale em saudação nova
6. Título dinâmico do card Inbox
7. Card de localização no chat + painel pedido
8. `orderCode` DX-#### + deep link `#pedidos?order=`

## 10. Áudio/mídia no fluxo catálogo

`AiConversationService`: antes de `releaseToStandardTriage`, verifica `hasActiveCatalogFlow` e responde com `buildCatalogMediaInFlowReply`.

## 11. Pin + rua/número

`resolveBrazilStateUf`, `parseRegionFromDisplayAddress`, `mergeLocationConfirmReply` com fallback do pin; `parseStreetNumberReply` ampliado.

## 12. Anti-loop endereço

`addressConfirmAttempts` + `buildCatalogAddressRetryReply` (tentativa 2 → CEP; 3 → humano).

## 13. Atendente/cancelar/sair

`tryProcessCatalogFlowCommand` + short-circuit no `AiConversationService`.

## 14. Contexto stale de catálogo

`findResolvableActiveOrderForConversation`, `shouldIgnoreStaleCatalogRecovery`, saudação em `recoverFromAiFailure`.

## 15. Card Inbox por status

`CatalogSalesOrderPanel` — títulos por `status`.

## 16. Localização no Inbox

`InboxMessageBubble` — card com Maps + copiar coordenadas; painel pedido com lat/lng.

## 17. Código curto do pedido

Campo `orderCode` no modelo, geração na criação, backfill lazy, filtro API `orderCode`.

## 18. Deep link pedido ↔ Inbox

`/platform/produtos#pedidos?order=DX-1045` abre drawer; Inbox link `?conv=`; código clicável no painel.

## 19. Segurança

Tenant-scoped em `getOrderByCode`; comprovante inalterado; sem URL pública de coordenadas.

## 20. Arquivos analisados

Docs 2.17.58, `catalog-sales.ts`, `CatalogSalesService.ts`, `AiConversationService.ts`, Inbox/Produtos frontend.

## 21. Arquivos alterados

Backend: `catalog-sales.ts`, `catalog-delivery-address.ts`, `catalog-delivery.util.ts`, `CatalogSalesService.ts`, `AiConversationService.ts`, `CatalogSalesOrder.ts`, `catalog-order-code.util.ts`, `DashboardService.ts`

Frontend: `InboxMessageBubble.tsx`, `CatalogSalesOrderPanel.tsx`, `ProductsOrdersTab.tsx`

Versão: `package.json`, `widget.js`

Testes: `catalog-flow-commands.test.ts`, `catalog-order-code.test.ts`, `catalog-delivery-location-confirm.test.ts`

## 22. Testes criados/alterados

- `catalog-flow-commands.test.ts` (novo)
- `catalog-order-code.test.ts` (novo)
- `catalog-delivery-location-confirm.test.ts` (pin Jose Pinto + UF)

## 23. Testes executados

66 passed (6 suites catálogo + flow + order code)

## 24. Gates executados

| Gate | Resultado |
|------|-----------|
| `npm run build` | OK |
| Frontend build | OK |
| `npm run pre-push:gate` | OK |

## 25. QA manual executado

Não executado (ambiente local WA real) — coberto por testes unitários.

## 26. QA pendente para Benhur

Cenários A–E WhatsApp em produção após deploy; WebChat paridade; painel Inbox/Produtos com pedido real.

## 27. Riscos encontrados

- QA humano ainda necessário para confirmar pin em Rondonópolis real
- Pedidos antigos recebem `orderCode` no primeiro list/get (lazy)

## 28. Riscos mitigados

- Sem deploy automático
- Gates verdes
- Anti-loop evita spam
- Stale order não bloqueia saudação

## 29. Próximo passo recomendado

1. Benhur autorizar push `develop` → merge `main` → deploy
2. QA WhatsApp cenários A–E em produção
3. Validar código DX no painel e deep link

## 30. Checklist para Benhur testar

- [ ] Áudio não abre setores
- [ ] Pin + Rua jose pinto, 120 funciona
- [ ] Av. jose pinto,120 funciona
- [ ] Avenida José pinto, 1020 funciona
- [ ] Posso te enviar o CEP? responde corretamente
- [ ] Falar com atendente para o bot
- [ ] Cancelar para o fluxo
- [ ] Sair para o fluxo
- [ ] Não repete mensagem de endereço em loop
- [ ] Saudação nova não usa pedido antigo
- [ ] Inbox não mostra comprovante se está aguardando endereço
- [ ] Inbox mostra localização do cliente
- [ ] Botão Google Maps funciona
- [ ] Pedido tem código tipo DX-1045
- [ ] Clicar no código abre pedido exato
- [ ] Pedido abre conversa exata
- [ ] Sem permissão não acessa pedido
