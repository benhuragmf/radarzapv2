# RadarChat — QA Real Pós-Deploy Endereço de Entrega v1 2.17.60

> **Atualização 2026-07-01:** produção evoluiu para **2.17.61** (`4a7c690`) com hotfix R1 e UI localização humana. Doc vigente de QA/congelamento: [`RADARCHAT-QA-FINAL-CONGELAMENTO-CATALOGO-ENDERECO-PIX-2.17.61.md`](./RADARCHAT-QA-FINAL-CONGELAMENTO-CATALOGO-ENDERECO-PIX-2.17.61.md). Este arquivo permanece como registro histórico do QA automatizado 2.17.60.

## 1. Resumo executivo

Validação **automática** pós-deploy 2.17.60 concluída: produção em `2.17.60` (`95666e9`), health OK, bundle/widget corretos, strings Endereço v1 no bundle. **QA humano WhatsApp, Inbox autenticado, Produtos drawer e WebChat não executado pelo agente** (sem sessão WA, sem login painel). **2.17.60 não está aprovada para congelamento** até Benhur executar checklist §33. **Hotfix 2.17.61 não iniciado** — nenhuma falha confirmada em produção; 1 risco de código documentado no cenário C (correção inline após `não`).

## 2. Versão validada

`2.17.60` (produção — validação parcial automatizada)

## 3. Commit em produção

`95666e9` — `feat(catalog): implementa endereco de entrega v1 2.17.60`

Docs deploy em `develop`: `561b560` (não em `main`)

## 4. Bundle em produção

```html
<script type="module" crossorigin src="/assets/index-D0EQsI0a.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-B9jEu0ig.css">
```

Verificado em 2026-07-01T21:23:55Z

## 5. Widget build

`WIDGET_BUILD = '2.17.60'` — confirmado

## 6. Health check

```json
{"healthy":true,"uptime":581,"version":"0.0.0","checkedAt":"2026-07-01T21:23:55Z"}
```

HTTP 200 em `https://app.radarchat.com.br`

## 7. Branch local

`develop` @ `561b560` (up to date com `origin/develop`)

Working tree limpa (untracked: `data/`, `mocker/` — não commitados)

## 8. Arquivos analisados

- `docs/concluidos/RADARCHAT-DEPLOY-ENDERECO-ENTREGA-V1-2.17.60.md`
- `docs/concluidos/RADARCHAT-ENDERECO-ENTREGA-V1-2.17.60.md`
- `CatalogDeliveryAddressService.ts`, `CatalogSalesService.ts`
- Bundle produção `index-D0EQsI0a.js`

## 9. QA WhatsApp — CEP

| Campo | Valor |
|-------|--------|
| Status | **Não testado** |
| Executor | Agente (sem WhatsApp) |
| Horário | — |
| Evidência | — |

**Validação indireta:** testes unitários CEP + ViaCEP em `catalog-delivery-address-v1.test.ts` passam.

## 10. QA WhatsApp — confirmação sim

| Campo | Valor |
|-------|--------|
| Status | **Não testado** |
| Esperado | `sim` → confirmed → frete → PIX após frete |

Teste unitário: `processClientInput` com `sim` em `needs_confirmation` → `confirmed` — **pass**.

## 11. QA WhatsApp — correção não

| Campo | Valor |
|-------|--------|
| Status | **Não testado** |
| Risco código | **Médio** — ver §24 |

Mensagem `não, é número 120` pode cair em `textIsAddressConfirmationNo` e pedir endereço completo genérico, **sem** atualizar só o número inline. Benhur deve validar cenário C.

## 12. QA WhatsApp — pin + rua/número

| Campo | Valor |
|-------|--------|
| Status | **Não testado** |
| Esperado | pin → pede rua/número → confirmação → sem PIX antes de `sim` |

Testes pin merge em `catalog-delivery-location-confirm.test.ts` — **pass** (local).

## 13. QA WhatsApp — endereço completo

| Campo | Valor |
|-------|--------|
| Status | **Não testado** |

## 14. QA WhatsApp — cancelar/sair

| Campo | Valor |
|-------|--------|
| Status | **Não testado** |

Testes `catalog-flow-commands.test.ts` — cancelar/sair — **pass** (local).

## 15. QA WhatsApp — retirada regressão

| Campo | Valor |
|-------|--------|
| Status | **Não testado** |
| Nota | Fluxo retirada não usa `deliveryAddressV1`; regressão possível mas não observada em produção |

## 16. QA WhatsApp — estoque/preço

| Campo | Valor |
|-------|--------|
| Status | **Não testado** |

## 17. QA Inbox — endereço v1

| Campo | Valor |
|-------|--------|
| Status | **Não testado** (sem login) |

**Evidência bundle:** strings presentes — `deliveryAddressV1`, `Endereço aguardando confirmação`, `Endereço confirmado`, `Copiar endereço`, `Google Maps`, `deliveryAddressSnapshot`.

## 18. QA Inbox — ações operador

| Campo | Valor |
|-------|--------|
| Status | **Não testado** |

**Evidência bundle:** `Confirmar endereço`, `Solicitar correção` presentes.

## 19. QA Produtos/Pedidos — drawer endereço

| Campo | Valor |
|-------|--------|
| Status | **Não testado** |

## 20. QA Produtos/Pedidos — deep link DX

| Campo | Valor |
|-------|--------|
| Status | **Não testado** |

Código `orderCode` + `#pedidos?order=` inalterado desde 2.17.59.

## 21. QA WebChat

| Campo | Valor |
|-------|--------|
| Status | **Não testado** |

Mesmo serviço via `CatalogSalesService.processIncrementalAddressInput` (paridade esperada).

## 22. QA Permissões/RBAC

| Campo | Valor |
|-------|--------|
| Status | **Não testado** |

APIs usam `orders:update-status` / `orders:view` — revisão estática OK.

## 23. Segurança

| Item | Status |
|------|--------|
| Sem alteração volumes/sessões/.env nesta etapa | OK |
| APIs tenant-scoped (código) | OK |
| Bundle sem chave PIX exposta | OK (não auditado linha a linha) |
| QA cross-tenant / comprovante | Pendente Benhur |

## 24. Problemas encontrados

### Confirmados em produção

Nenhum (agente não executou fluxos WA/Inbox).

### Riscos / suspeitas (revisão código)

| ID | Severidade | Cenário | Descrição |
|----|------------|---------|-----------|
| R1 | **Médio** | C — correção `não` | `textIsAddressConfirmationNo("não, é número 120")` retorna true antes de `processFreeText` parsear o número — cliente pode receber pedido genérico de endereço em vez de atualizar número e reconfirmar |
| R2 | **Baixo** | H | Endereço salvo no contato (reutilização) não implementado — escopo futuro |

**Ação:** Benhur validar R1 no cenário C. Se falhar → hotfix **2.17.61** (parse inline após `não`).

## 25. Correções locais, se houve

Nenhuma. Versão permanece **2.17.60**.

## 26. Testes executados

| Suite | Resultado |
|-------|-----------|
| `catalog-delivery-address-v1.test.ts` | pass |
| `catalog-flow-commands.test.ts` | pass |
| `catalog-sales.test.ts` | pass |

**60 passed** (amostra QA — suite completa 77 passed no deploy)

## 27. Gates executados

Não reexecutados nesta etapa (verdes no deploy 28547931838). Recomendado antes de hotfix 2.17.61.

## 28. Comandos não executados

- Fluxos WhatsApp A–H (manual)
- Login painel Inbox/Produtos
- WebChat widget embed
- RBAC multi-perfil
- `npm run pre-push:gate` (sem alteração código)

## 29. Pendências para Benhur

1. Executar checklist §33 completo no WhatsApp real
2. Validar cenário C (`não, é número 120`) — confirmar ou refutar R1
3. Inbox: badges, Maps, copiar, confirmar/solicitar correção
4. Produtos: drawer v1, snapshot, deep link DX
5. WebChat paridade
6. Retirada regressão (cenário G)
7. Se R1 confirmado: autorizar hotfix 2.17.61 + deploy

## 30. Riscos encontrados

- QA humano zero nesta etapa
- R1 correção inline após `não`
- Pedidos legados backfill lazy não validados em pedido real antigo

## 31. Riscos mitigados

- Produção 2.17.60 confirmada (health, bundle, widget)
- Confirmação antes frete/PIX implementada (código + testes unitários)
- Deploy anterior sem prune/volumes

## 32. Próximo passo recomendado

1. **Benhur:** QA manual §33 (prioridade: A, B, C, D, G)
2. Se **tudo passar:** marcar 2.17.60 aprovada; congelar Catálogo/Endereço/PIX
3. Se **R1 falhar:** solicitar hotfix 2.17.61 local → gates → deploy controlado
4. Merge `561b560` docs para `main` (opcional, só documentação)

## 33. Checklist final

* [ ] CEP gera endereço e pede número
* [ ] CEP + número pede confirmação
* [ ] Pin pede rua/número
* [ ] Pin + rua/número pede confirmação
* [ ] Endereço completo pede confirmação
* [ ] Sim confirma endereço
* [ ] Não permite corrigir *(validar R1)*
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

## Evidências automatizadas (agente)

| Verificação | Resultado | Timestamp |
|-------------|-----------|-----------|
| Health API | healthy | 2026-07-01T21:23:55Z |
| HTTP 200 app | OK | idem |
| Widget 2.17.60 | OK | idem |
| Bundle index-D0EQsI0a.js | OK | idem |
| CSS index-B9jEu0ig.css | OK | idem |
| String deliveryAddressV1 no bundle | OK | idem |
| UI Confirmar/Solicitar correção | OK | idem |

---

*Gerado em 2026-07-01 — QA real pós-deploy; execução humana pendente Benhur.*
