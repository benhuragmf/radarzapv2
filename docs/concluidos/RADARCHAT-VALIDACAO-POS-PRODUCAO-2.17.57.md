# RadarChat — Validação Pós-Produção 2.17.57

## 1. Resumo executivo

Pacote **2.17.57** (`d0d3cfb`) confirmado em produção via bundle `index-DhyazO6y.js`, widget `2.17.57` e deploy GitHub Actions **success**. Git local/remoto/main/develop alinhados. Health `healthy`. Strings do pacote 2.17.57 (Pedidos, Comprovantes, Entregadores bloqueado) presentes no JS de produção. **QA painel autenticado e WhatsApp/WebChat real:** pendente Benhur — esta validação foi por Git + CI/deploy + bundle + testes regressão (43/43). **Nenhum novo deploy executado nesta etapa.**

## 2. Versão esperada

`2.17.57` (`package.json`, commit `d0d3cfb`)

## 3. Versão encontrada em produção

| Evidência | Valor |
|-----------|--------|
| Bundle JS | `/assets/index-DhyazO6y.js` (build local 2.17.57) |
| Widget | `WIDGET_BUILD = '2.17.57'` em `/webchat/widget.js` |
| CSS | `index-5xdt30gk.css` |
| Health API `version` | `0.0.0` (comportamento conhecido — não usar como semver) |

**Conclusão:** produção está no pacote **2.17.57**.

## 4. Branch local

`develop` — sincronizada com `origin/develop`

## 5. Commit local esperado

`d0d3cfb` — `fix(products): aplica ajustes pós-QA local 2.17.57`

Inclui também na main: `9bf3dec` (2.17.56) + commits 2.17.55 anteriores.

## 6. Commit remoto encontrado

| Ref | SHA |
|-----|-----|
| `origin/develop` | `d0d3cfb` |
| `origin/main` | `d0d3cfb` |

## 7. Commit em produção

Deploy workflow **28535749453** implantou `d0d3cfb` (headSha confirmado).

## 8. Git status

```
On branch develop
Your branch is up to date with 'origin/develop'.
Untracked: data/, mocker/modelochat/ (não commitados — OK)
Working tree limpa
```

## 9. Workflow/CI

| Workflow | Run ID | Commit | Branch | Status | Duração |
|----------|--------|--------|--------|--------|---------|
| **Deploy** | [28535749453](https://github.com/benhuragmf/radarzapv2/actions/runs/28535749453) | `d0d3cfb` | `main` | **success** | ~5m26s |
| **CI** | 28535749487 | `d0d3cfb` | `main` | **in_progress** na auditoria* | — |

\*CI 28535749487 ainda em execução durante esta validação; runs anteriores (ex. 28534936367) falharam sem bloquear deploy. **Deploy** é o indicador de implantação Coolify/VPS — **success** para 2.17.57.

Deploys anteriores no mesmo dia:
- `28534785912` — 2.17.55 fix (`1324d47`) — success
- `28534457928` — 2.17.55 feat (`f829bdf`) — success

## 10. Deploy/Coolify

- Disparado automaticamente por push `main` (`d0d3cfb`)
- Sem novo deploy nesta validação
- Uptime pós-deploy observado: ~63–149s no health (reinício de container esperado)

## 11. Health check

```json
GET https://app.radarchat.com.br/api/services/health
{"healthy":true,"uptime":208,"version":"0.0.0","checkedAt":"2026-07-01T17:36:19Z"}
```

HTTP 200 em `https://app.radarchat.com.br`

## 12. Bundle em produção

```html
<script type="module" crossorigin src="/assets/index-DhyazO6y.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-5xdt30gk.css">
```

Strings confirmadas no bundle minificado:
- `Pedir novo comprovante`
- `Reenviar notific` (reenviar notificação)
- `Nenhum comprovante aguardando` / `Nenhum comprovante ainda`
- `Estoque a confirmar`
- `Em breve` (entregadores)
- `orders:resend-pix-notification` (RBAC no código compilado)

## 13. Widget build

`WIDGET_BUILD = '2.17.57'` — alinhado com `package.json`.

## 14. Arquivos analisados

Handoffs 2.17.55–2.17.56, componentes Products*, `catalog-sales.ts`, testes catálogo, workflows GitHub.

## 15. Arquivos alterados, se houve

Nesta etapa (validação, sem código):
- `docs/concluidos/RADARCHAT-VALIDACAO-POS-PRODUCAO-2.17.57.md` (novo)
- `docs/concluidos/RADARCHAT-QA-MANUAL-GUIADO-POS-2.17.56.md` (banner reconciliação)
- `docs/concluidos/RADARCHAT-HANDOFF-LOCAL-POS-2.17.55.md` (banner reconciliação)
- `docs/INDICE-DOCUMENTACAO.md`
- `docs/CHANGELOG.md`
- `docs/SISTEMA-REGISTRO.md`

## 16. Correções locais, se houve

Nenhuma correção de código nesta etapa.

## 17. Painel Produtos — validação

| Item | Método | Resultado |
|------|--------|-----------|
| Rotas `/platform/produtos#*` | Código + bundle | Implementado |
| Labels Estoque/Comprovantes | `navConfig.ts` + bundle | Presente |
| ConfigSaveFooter condicional | `Produtos.tsx` | Código OK |
| Login visual no painel | — | **Pendente Benhur** |

## 18. Produtos e estoque — validação

- Formulário colapsável, duplicar/editar: código 2.17.56+ — bundle confirma strings
- Badge estoque a confirmar: presente no bundle
- Coluna Entrega: código 2.17.57
- **Teste cadastro ZAAd em produção:** pendente Benhur

## 19. Pedidos — validação

- Filtros status/canal, coluna Quando, canal formatado: código 2.17.57
- Ações aprovar/recusar com status `comprovante_recebido`/`em_conferencia`: bundle confirma
- Pedir novo comprovante / reenviar notificação: bundle confirma + RBAC caps
- **Teste drawer com pedido real:** pendente Benhur

## 20. Comprovantes PIX — validação

- Empty state: string no bundle
- Proof via `/api/.../proof` com auth: padrão mantido
- **Fila com comprovante real:** pendente Benhur

## 21. Entrega e frete — validação

- `fulfillmentMode` via `businessCatalogProfile`: código inalterado 2.17.54+
- Aviso frete servidor: `ProductsDeliveryTab`
- **ViaCEP em produção:** pendente Benhur

## 22. Configurações — validação

- PIX + OperationalWhatsAppCards: bundle inclui três cards
- **Sessão WA conectada visível:** pendente Benhur

## 23. WhatsApp da loja — validação

- `GET /sessions`, link `/sessions`: código OK
- **Status online em conta real:** pendente Benhur

## 24. WhatsApp conferência — validação

- `internalWhatsapp`, toggles, `company:sales-config:update`: código OK
- **Envio real de comprovante interno:** pendente Benhur

## 25. WhatsApp entregadores bloqueado — validação

- Bundle: `Em breve`, campos disabled, sem backend de envio
- **Confirmado:** recurso bloqueado em produção (evidência bundle + grep código)

## 26. IA Atendimento — validação

- Catálogo operacional movido para Produtos (2.17.53+)
- `AiAtendimento.tsx` mantém Empresa/ativação — não alterado neste pacote
- **Visual em produção:** pendente Benhur

## 27. WhatsApp real — QA

**Não executado** nesta sessão (requer celular + sessão conectada).

Roteiro para Benhur:

```text
ola boa tarde → sim → sim → quero comprar zaad → entregue →
mais tem taxa de entrega? → meu endereço você não vai pegar?
```

Esperado: sem PIX antes CEP; `sim`≠produto; taxa/endereço no contexto.

Testes automatizados catálogo: **43/43 pass** (regressão local).

## 28. WebChat real — QA

**Não executado** nesta sessão. Paridade código via `tryCatalogWebChatShortCircuit`. Pendente Benhur.

## 29. Permissões/RBAC — QA

Validado no código e bundle (`orders:approve-payment`, `orders:resend-pix-notification`, etc.).

**Teste com perfis reais (financeiro/atendente/viewer):** pendente Benhur.

## 30. Segurança

- Comprovante: rota autenticada `/api/platform/catalog-sales/orders/:id/proof`
- Entregadores: sem envio
- Catálogo/PIX backend: inalterado desde 2.17.54
- Sem exposição de secrets nesta auditoria

## 31. Testes executados

```
npx jest catalog-sales.test.ts catalog-menu-gate.test.ts product-display.util.test.ts
→ 3 suites, 43 passed (2026-07-01)
```

## 32. Gates executados

Não reexecutado `pre-push:gate` nesta etapa (sem alteração de código). Último gate antes do deploy: **verde**.

## 33. Comandos não executados

- `npm run pre-push:gate` (sem mudança de código)
- `npm run qa:atendimento:gate`
- QA painel autenticado
- QA WhatsApp/WebChat real

## 34. Problemas encontrados

| # | Problema | Severidade |
|---|----------|------------|
| 1 | Docs handoff 2.17.56 diziam "push não executado" — desatualizado após deploy Benhur | Doc |
| 2 | CI workflow falha em runs anteriores (não bloqueou deploy 2.17.57) | Observação |
| 3 | Health não expõe semver `2.17.57` | Conhecido |

Nenhum bug funcional crítico identificado na reconciliação Git/bundle.

## 35. Problemas corrigidos localmente

- Documentação reconciliada (handoffs + índice + este arquivo)
- Sem hotfix de código

## 36. Riscos encontrados

- QA humano WhatsApp/comprovante ainda não feito pós-deploy 2.17.57
- CI vermelho histórico pode mascarar regressões futuras

## 37. Riscos mitigados

- Commit produção = `d0d3cfb` confirmado em 3 fontes (git, deploy, bundle)
- Regressão catálogo: 43 testes locais verdes
- Entregadores permanecem bloqueados

## 38. Pendências para Benhur

1. Login em `https://app.radarchat.com.br/platform/produtos` — todas as abas
2. Roteiro WhatsApp entrega/retirada/estoque consulte/`zad`
3. WebChat paridade
4. Comprovante real — aprovar/recusar em pedido de teste
5. Permissões por papel
6. Produto ZAAd se ainda não cadastrado

## 39. Próximo passo recomendado

1. Benhur executar checklist §40 no celular e painel
2. Se tudo OK: acumular próximos ajustes antes de 2.17.58
3. Se falhar WhatsApp entrega antes PIX: hotfix local + autorização explícita antes de novo deploy
4. Investigar CI failures separadamente (não bloqueou deploy atual)

## 40. Checklist final

- [x] Confirmar bundle 2.17.57 em produção (`index-DhyazO6y.js`)
- [x] Confirmar widget `2.17.57`
- [x] Confirmar commit `d0d3cfb` na main e deploy success
- [ ] Confirmar menu Produtos (visual Benhur)
- [ ] Confirmar Pedidos (drawer + ações)
- [ ] Confirmar Comprovantes (fila real)
- [ ] Confirmar WhatsApp loja (sessão)
- [ ] Confirmar WhatsApp conferência
- [x] Confirmar entregadores bloqueado (bundle)
- [ ] Testar compra WhatsApp entrega
- [ ] Testar compra WhatsApp retirada
- [ ] Testar estoque consulte
- [ ] Testar produto sem preço
- [ ] Testar produto parecido (`zad`)
- [ ] Testar WebChat
- [ ] Testar permissões
- [ ] Decidir se precisa hotfix
- [x] Não fazer novo deploy nesta etapa
