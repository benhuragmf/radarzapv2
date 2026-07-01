# RadarChat — Deploy Fechamento Endereço v1 e Localização Humana Segura 2.17.61

## 1. Resumo executivo

Deploy controlado **2.17.61** concluído com sucesso: push `develop`, fast-forward `main`, workflow Deploy verde, produção validada (health, bundle, widget, strings UI). Escopo: R1 correção inline, localização humana segura (Inbox/Produtos), sem motoboy automático. **QA humano WhatsApp/Inbox/WebChat pendente Benhur.**

## 2. Versão inicial em produção

`2.17.60` — commit `95666e9`, bundle `index-D0EQsI0a.js`, widget `2.17.60`

## 3. Versão final implantada

`2.17.61` — commit `4a7c690`

## 4. Branch inicial

`develop` (local, 3 commits à frente de `origin/develop`)

## 5. Branch final

`main` @ `4a7c690` (produção)

## 6. Commits locais (pacote 2.17.61)

| Hash | Mensagem |
|------|----------|
| `68e451c` | docs: QA real pos-deploy endereco entrega v1 2.17.60 pendente Benhur |
| `9b3b637` | fix(catalog): corrige negativa com ajuste de endereco 2.17.61 |
| `4a7c690` | fix(catalog): fecha endereco v1 e correcao manual segura 2.17.61 |

## 7. Commit develop

`4a7c690` (HEAD após push)

## 8. Commit main

`4a7c690` (fast-forward de `95666e9`)

## 9. Push develop

| Campo | Valor |
|-------|--------|
| Antes | `origin/develop` @ `561b560` |
| Depois | `origin/develop` @ `4a7c690` |
| Range | `561b560..4a7c690` |
| Horário | 2026-07-01 ~22:04 UTC |
| Resultado | **success** |

## 10. Merge main

| Campo | Valor |
|-------|--------|
| Antes | `origin/main` @ `95666e9` |
| Depois | `origin/main` @ `4a7c690` |
| Tipo | `git merge --ff-only develop` |
| Resultado | **success** (fast-forward) |

## 11. Deploy workflow

| Campo | Valor |
|-------|--------|
| Workflow | Deploy (`.github/workflows/deploy.yml`) |
| Run ID | [28550770502](https://github.com/benhuragmf/radarzapv2/actions/runs/28550770502) |
| Branch | `main` |
| Commit | `4a7c690` |
| Status | **success** |
| Duração | ~5m 38s (22:04:35 → 22:10:13 UTC) |
| Jobs | `build-and-push` ✓ (2m54s) · `deploy` ✓ Coolify via SSH (2m36s) |
| App-only | Sim — deploy padrão GitHub → Coolify SSH |
| Prune/volumes/sessões | **Não executado** |

CI paralelo: run [28550770458](https://github.com/benhuragmf/radarzapv2/actions/runs/28550770458) (em andamento no momento da validação inicial pós-deploy).

## 12. Health check

```
GET https://app.radarchat.com.br/api/services/health
→ {"healthy":true,"uptime":86.1,"version":"0.0.0","checkedAt":"2026-07-01T22:10:55.733Z"}
```

HTTP 200 · **healthy**

## 13. Bundle em produção

| Asset | Valor |
|-------|--------|
| JS | `index-CZ9OsJHJ.js` |
| CSS | `index-C7-sdis1.css` |
| Anterior (2.17.60) | `index-D0EQsI0a.js` / `index-B9jEu0ig.css` |

Strings confirmadas no bundle (match parcial/minificado):

- `deliveryAddressV1` ✓
- `confirmado para entrega` ✓
- `enviada pelo cliente` ✓
- `Copiar dados para entrega manual` ✓
- `Confirmar endere` ✓
- `Solicitar corre` ✓
- `Google Maps` ✓

## 14. Widget build

```
GET https://app.radarchat.com.br/webchat/widget.js
→ WIDGET_BUILD = '2.17.61'
```

## 15. Arquivos analisados

Handoff `RADARCHAT-FECHAMENTO-ENDERECO-V1-LOCALIZACAO-HUMANA-2.17.61.md`, serviços catálogo, painéis Inbox/Produtos, testes 8 suites.

## 16. Arquivos alterados (pacote)

20 arquivos no merge `95666e9..4a7c690` — ver commit `4a7c690`.

## 17. Testes pré-push

8 suites · **92 testes** — todos verdes (revalidados antes do push).

## 18. Gates executados

`npm run pre-push:gate` — **exit 0** (backend + frontend + Docker frontend-builder).

## 19. QA WhatsApp — R1 número

**Pendente Benhur** — cenário A: `não, é número 120` após confirmação.

## 20. QA WhatsApp — R1 rua/número

**Pendente Benhur** — cenário B: `não, é Rua José Pinto, 120`.

## 21. QA WhatsApp — R1 avenida

**Pendente Benhur** — cenário C: `não, é Av. José Pinto, 1020`.

## 22. QA WhatsApp — CEP

**Pendente Benhur** — cenário D: `não, cep 78705022`.

## 23. QA WhatsApp — bairro/complemento

**Pendente Benhur** — cenários E.

## 24. QA WhatsApp — negativa simples

**Pendente Benhur** — cenário F: `não`.

## 25. QA WhatsApp — pin/localização

**Pendente Benhur** — cenário G.

## 26. QA WhatsApp — retirada regressão

**Pendente Benhur** — cenário H.

## 27. QA Inbox — endereço confirmado

**Pendente Benhur** — validar bloco separado em `/platform/inbox`.

## 28. QA Inbox — localização enviada

**Pendente Benhur** — pin + Maps + copiar coordenadas.

## 29. QA Inbox — copiar dados entrega manual

**Pendente Benhur** — botão clipboard no painel pedido.

## 30. QA Inbox — divergência pin/endereço

**Pendente Benhur** — alerta ~400 m quando aplicável.

## 31. QA Produtos/Pedidos — drawer endereço

**Pendente Benhur** — `/platform/produtos#pedidos`.

## 32. QA Produtos/Pedidos — deep link DX

**Pendente Benhur** — `#pedidos?order=DX-####`.

## 33. QA WebChat

**Pendente Benhur** — paridade entrega + R1 se widget ativo.

## 34. Segurança

Deploy app-only; sem alteração `.env`/volumes/sessões; sem motoboy automático; comprovante/chave PIX não expostos em validação automatizada.

## 35. Problemas encontrados pós-deploy

Nenhum bloqueante na validação automatizada (health, bundle, widget).

## 36. Correções feitas nesta etapa

Nenhuma correção de código pós-deploy — apenas push/merge/deploy/doc.

## 37. Pendências para Benhur

Executar checklist §41 no WhatsApp real, Inbox, Produtos e WebChat.

## 38. Riscos encontrados

| Risco | Status |
|-------|--------|
| R1 não validado em WA real | Aberto — QA humano |
| Pin/endereço divergente não testado em prod | Aberto |

## 39. Riscos mitigados

- R1 coberto por 92 testes unitários
- UI humana no bundle de produção
- Frete/PIX bloqueados por código até confirmação

## 40. Próximo passo recomendado

1. Benhur executar QA §41 (prioridade cenário A `não, é número 120`)
2. Marcar checklist no doc após validação
3. Se OK, considerar endereço v1 **congelado** para operação

## 41. Checklist final

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
* [ ] Sem vazamento cross-tenant
* [ ] Sem PIX antes de endereço/frete
