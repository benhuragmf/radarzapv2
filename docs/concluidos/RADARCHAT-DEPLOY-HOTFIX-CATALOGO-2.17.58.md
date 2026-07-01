# RadarChat — Deploy Hotfix Catálogo WhatsApp 2.17.58

## 1. Resumo executivo

Hotfix **2.17.58** implantado em produção via push `develop` → fast-forward `main` → workflow Deploy **success**. Commit final `e3a1415`. Produção: widget `2.17.58`, bundle `index-D1GaRBSy.js`, health `healthy`. **57 testes** catálogo verdes na revalidação desta etapa. **QA WhatsApp/WebChat/painel autenticado:** pendente Benhur (agente sem sessão/login). Bug visual Inbox documentado para 2.17.59.

## 2. Versão inicial em produção

`2.17.57` (`d0d3cfb`)

## 3. Versão final implantada

`2.17.58` (`e3a1415`)

## 4. Branch inicial

`develop` @ `2f5c489` (hotfix) → `e3a1415` (parser)

## 5. Branch final

`develop` e `main` alinhadas em `e3a1415`

## 6. Commit develop

| SHA | Mensagem |
|-----|----------|
| `2f5c489` | `fix(catalog): corrige retirada endereço e respostas duplicadas 2.17.58` |
| `e3a1415` | `fix(catalog): melhora parser rua/número Avenida e número 2.17.58` |

## 7. Commit main

`e3a1415` (fast-forward de `d0d3cfb`)

## 8. Push develop

Executado em 2026-07-01 — `d0d3cfb..e3a1415` → `origin/develop`

## 9. Merge main

`git merge --ff-only develop` — **success** (fast-forward)

Push: `d0d3cfb..e3a1415` → `origin/main`

## 10. Deploy workflow

| Campo | Valor |
|-------|--------|
| Workflow | Deploy |
| Run ID | [28537807467](https://github.com/benhuragmf/radarzapv2/actions/runs/28537807467) |
| Branch | `main` |
| Commit | `e3a1415` |
| Status | **success** |
| Duração | ~5m42s (build ~3m + deploy Coolify ~2m28s) |
| Jobs | `build-and-push` success · `deploy` (Coolify SSH) success |

CI paralelo [28537806826](https://github.com/benhuragmf/radarzapv2/actions/runs/28537806826): **failure** (histórico — não bloqueou deploy).

Sem full-republish, prune ou alteração de volumes.

## 11. Health check

```json
GET https://app.radarchat.com.br/api/services/health
{"healthy":true,"uptime":303,"version":"0.0.0","checkedAt":"2026-07-01T18:15:11Z"}
```

HTTP 200 em `https://app.radarchat.com.br`

## 12. Bundle em produção

```html
<script type="module" crossorigin src="/assets/index-D1GaRBSy.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-5xdt30gk.css">
```

Strings confirmadas no bundle minificado: `Estoque a confirmar`, `Pedir novo comprovante` (features painel 2.17.57+ mantidas).

## 13. Widget build

`WIDGET_BUILD = '2.17.58'` em `/webchat/widget.js`

## 14. Arquivos analisados

Hotfix 2.17.58: `catalog-sales.ts`, `catalog-delivery-address.ts`, `catalog-delivery.util.ts`, `CatalogSalesService.ts`, `AiConversationService.ts`, `WebChatAiService.ts`, testes, `CatalogSalesOrderPanel.tsx`.

## 15. Arquivos alterados no hotfix

20 arquivos (ver `RADARCHAT-HOTFIX-CATALOGO-WA-ENDERECO-PIX-2.17.58.md`). Esta etapa: apenas documentação de deploy.

## 16. Testes pré-push

Revalidação 2026-07-01:

```
catalog-sales + menu-gate + product-display + address-loose + location-confirm
→ 5 suites, 57 passed
```

## 17. Gates executados

| Gate | Resultado |
|------|-----------|
| `npm run build` | OK (etapa push anterior) |
| Frontend build | OK |
| `npm run pre-push:gate` | OK (etapa push anterior) |

Nenhum gate reexecutado nesta etapa de conclusão (código já em produção).

## 18. QA WhatsApp — retirada

**Pendente Benhur** — cenário A: `Olá` → `s` → `Gostaria de comprar um zaad` → `retirar`

Esperado pós-2.17.58: PIX uma vez; sem endereço → humano sem PIX.

## 19. QA WhatsApp — entrega endereço completo

**Pendente Benhur** — cenário B: compra → `entregue` → `Rua: Salmen Hanze, 1326 Vila Birigui, Rondonópolis MT`

## 20. QA WhatsApp — pin + rua/número

**Pendente Benhur** — cenário C: pin → `Rua: Salmen Hanze, 1326`

## 21. QA WhatsApp — pergunta taxa/endereço

**Pendente Benhur** — cenário D após `entregue`

## 22. QA WhatsApp — reenvio explícito PIX

**Pendente Benhur** — cenário E: `manda o pix de novo`

## 23. QA WebChat

**Pendente Benhur** — paridade endereço/retirada

## 24. QA painel Inbox

**Pendente Benhur** — validar card de pedido no Inbox.

**Bug visual conhecido (não corrigido nesta etapa):** `CatalogSalesOrderPanel.tsx` linha 60 usa título fixo `🧾 Comprovante PIX recebido` mesmo quando `status === aguardando_endereco`. Subtítulo correto aparece abaixo, mas título engana. **Registrar para 2.17.59.**

## 25. QA Produtos/Pedidos

**Pendente Benhur** — `/platform/produtos#pedidos`, `#comprovantes`

## 26. Segurança

- Sem secrets em logs desta auditoria
- Comprovante via rota autenticada `/api/platform/catalog-sales/orders/:id/proof`
- Entregadores bloqueados (bundle `Em breve`)
- Sem alteração em sessões/volumes/.env

## 27. Problemas encontrados pós-deploy

| # | Problema | Severidade | Ação |
|---|----------|------------|------|
| 1 | Título Inbox sempre “Comprovante PIX recebido” | Visual/médio | 2.17.59 |
| 2 | CI workflow failure (não bloqueia deploy) | Observação | Investigar separado |
| 3 | QA WhatsApp real não executado pelo agente | Pendência humana | Benhur |

Nenhum bug crítico de backend detectado na validação automatizada pós-deploy.

## 28. Correções feitas nesta etapa

Nenhuma correção de código — deploy e documentação de conclusão apenas.

## 29. Pendências para Benhur

1. Executar cenários A–E no WhatsApp real
2. WebChat paridade
3. Validar painel Inbox/Produtos
4. Confirmar se retirada sem endereço escala humano corretamente
5. Decidir prioridade fix título Inbox (2.17.59)

## 30. Riscos encontrados

- QA humano ainda não confirma bugs corrigidos em produção real
- CI vermelho pode mascarar regressões futuras

## 31. Riscos mitigados

- Deploy controlado app-only (sem prune/volumes)
- Fast-forward sem conflito
- Gate verde antes do push
- Produção confirmada 2.17.58 em 3 fontes

## 32. Próximo passo recomendado

1. Benhur: QA WhatsApp cenários A–E em produção
2. Se OK: fechar hotfix; se falhar: hotfix 2.17.59 com evidência
3. Incluir fix título Inbox em 2.17.59 se confirmado visualmente

## 33. Checklist final

- [x] Push develop (`e3a1415`)
- [x] Merge main fast-forward
- [x] Deploy success (28537807467)
- [x] Widget `2.17.58`
- [x] Bundle `index-D1GaRBSy.js`
- [x] Health healthy
- [ ] Retirada não duplica PIX (Benhur)
- [ ] Retirada sem endereço não libera PIX (Benhur)
- [ ] Retirada com endereço libera PIX uma vez (Benhur)
- [ ] Entrega pede endereço antes do PIX (Benhur)
- [ ] Endereço completo sem CEP não gera instabilidade (Benhur)
- [ ] Rua: Salmen Hanze, 1326 é aceito (Benhur)
- [ ] Pin + rua/número funciona (Benhur)
- [ ] Pergunta taxa não repete PIX (Benhur)
- [ ] Pergunta endereço não repete PIX (Benhur)
- [x] Estoque consulte bloqueia PIX (código + testes)
- [x] Produto sem preço bloqueia PIX (código + testes)
- [ ] WebChat paridade (Benhur)
- [ ] Inbox mostra status correto do pedido (Benhur — título fixo pendente 2.17.59)
- [x] Comprovante protegido (código)
- [x] Entregadores bloqueados (código + bundle)
