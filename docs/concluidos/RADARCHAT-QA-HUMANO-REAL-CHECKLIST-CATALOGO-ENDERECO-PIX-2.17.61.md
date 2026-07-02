# RadarChat — Checklist QA Humano Real — Catálogo, Endereço, PIX, Inbox e Produtos — 2.17.61

> ⚠️ **Substituído pelo checklist completo:** use [`../RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md`](../RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md) (Fase 1 + catálogo + auditoria + Admin Ops).

**Use este arquivo teste a teste.** Marque cada item e preencha **Evidência** (print, horário, código DX, texto da IA).

| Campo | Valor |
|-------|-------|
| **Ambiente** | `https://app.radarchat.com.br` |
| **Versão prod** | `2.17.61` · commit `4a7c690` |
| **Testador** | Benhur |
| **Data início** | ____/____/2026 |
| **Empresa/tenant testado** | ________________________________ |
| **WhatsApp loja (número)** | ________________________________ |
| **Celular cliente teste** | ________________________________ |
| **Produto usado** | `zaad` ou: ______________________ |

### Legenda de status

| Status | Significado |
|--------|-------------|
| ⬜ | Ainda não testado |
| ✅ OK | Passou — você confirmou |
| ❌ FALHOU | Não passou — anotar severidade P0–P3 |
| ⏸ BLOQUEADO | Não deu para testar (config, WA desconectado, etc.) |
| ➖ N/A | Não se aplica (ex.: WebChat sem embed) |

### Severidade (se falhar)

| Nível | Quando usar |
|-------|-------------|
| **P0** | Pagamento aprovado indevido, vazamento cross-tenant, dado de outra empresa |
| **P1** | R1 falhou, PIX antes de frete/`sim`, PIX duplicado, pedido não aparece, WA interno não recebeu |
| **P2** | Funciona mas com atrito, texto confuso, UX ruim |
| **P3** | Melhoria cosmética |

---

## FASE 1 — Preparação (obrigatório antes do WA)

Teste **na ordem**. Se algum item falhar, corrija antes de seguir.

| # | Item | Status | Evidência / observação |
|---|------|--------|------------------------|
| 1.1 | Logado em `app.radarchat.com.br` (não fica na tela de login) | ⬜ | |
| 1.2 | Sessão WhatsApp conectada em `/sessions` (status connected) | ⬜ | |
| 1.3 | Celular/WhatsApp **cliente** disponível para enviar mensagens | ⬜ | |
| 1.4 | Produto `zaad` (ou equivalente) cadastrado em Produtos → Estoque | ⬜ | Nome: ______ |
| 1.5 | Produto tem **preço** claro (ex.: R$ …) | ⬜ | |
| 1.6 | Produto tem **estoque** (número ou “sob encomenda” se aplicável) | ⬜ | |
| 1.7 | Catálogo/IA ativo (IA → Empresa e IA → pedidos via catálogo ON) | ⬜ | |
| 1.8 | PIX ativo (Produtos → Configurações) | ⬜ | |
| 1.9 | Chave/instrução PIX cadastrada | ⬜ | |
| 1.10 | WhatsApp **interno conferência** configurado (`internalWhatsapp` + notificar) | ⬜ | Número: ______ |
| 1.11 | Abre `/platform/inbox` sem erro | ⬜ | |
| 1.12 | Abre `/platform/produtos#pedidos` sem erro | ⬜ | |
| 1.13 | Sei qual **empresa/tenant** estou testando | ⬜ | Nome org: ______ |

**Fase 1 concluída?** ⬜ Sim — posso seguir para Fase 2 · ⬜ Não — itens bloqueados: ______

---

## FASE 2 — WhatsApp: compra + entrega + CEP + frete + PIX

**Canal:** WhatsApp **cliente** → número da **loja**.

| Passo | O que fazer | Resposta esperada | Resposta real (cole texto IA) | Status | Evidência |
|-------|-------------|-------------------|-------------------------------|--------|-----------|
| 2.1 | Enviar `oi` | Saudação / atendimento normal | | ⬜ | |
| 2.2 | Enviar `quero comprar zaad` | Oferta do produto | | ⬜ | |
| 2.3 | — | Oferta menciona **retirar** e/ou **entregue** | | ⬜ | |
| 2.4 | Responder `entregue` | Pede **CEP** (não manda PIX ainda) | | ⬜ | |
| 2.5 | — | **Não** enviou chave PIX antes do endereço | | ⬜ | |
| 2.6 | Enviar CEP de teste: `________` | Monta endereço / pede número | | ⬜ | |
| 2.7 | — | Pede **número** do endereço | | ⬜ | |
| 2.8 | Enviar número: `________` | Mostra endereço para **confirmar** | | ⬜ | |
| 2.9 | Responder `sim` | Confirma endereço | | ⬜ | |
| 2.10 | — | Calcula e informa **frete** | | ⬜ | Valor frete: ______ |
| 2.11 | — | Envia **PIX só depois** do frete/endereço OK | | ⬜ | |
| 2.12 | — | **PIX não duplicou** (contar mensagens com chave PIX) | | ⬜ | Qtd PIX: ___ |

**Código pedido (se já aparecer):** `DX-________` · **Horário:** ______

**Fase 2 concluída?** ⬜ Sim · ⬜ Falhou (severidade: ___)

---

## FASE 3 — R1: correção inline de endereço (CRÍTICO)

**Objetivo:** Na confirmação do endereço, testar correções após `não`.

> Faça **um pedido novo** (ou continue até `needs_confirmation`) para cada cenário, ou anote se reutilizou o mesmo fluxo.

### 3.1 — Cenário prioritário (obrigatório)

| Campo | Valor |
|-------|-------|
| Mensagem enviada | `não, é número 120` |
| Número antes | ______ |
| Resposta esperada | Atualiza número para **120**; mantém rua/bairro/cidade; **invalida frete**; pede confirmar de novo; **sem PIX** |
| Resposta real | |
| Status | ⬜ |
| Evidência | |
| Se falhou | Severidade: **P1** (obrigatório) |

Depois de corrigir, envie `sim` e confirme:

| Passo | Esperado | Real | Status |
|-------|----------|------|--------|
| 3.1b | Após novo `sim` → frete normal | | ⬜ |
| 3.1c | Após novo `sim` → PIX normal (1x) | | ⬜ |
| 3.1d | PIX **não** veio antes do novo `sim` | | ⬜ |

### 3.2 — Outros cenários R1 (se der tempo)

| # | Mensagem | Esperado (resumo) | Resposta real | Status | Sev. se falhou |
|---|----------|-------------------|---------------|--------|----------------|
| 3.2a | `não é numero 120` | Corrige número | | ⬜ | |
| 3.2b | `errado, é número 120` | Corrige número | | ⬜ | |
| 3.2c | `não é 1326 é 120` | Corrige número | | ⬜ | |
| 3.2d | `não, é Rua José Pinto, 120` | Corrige rua + número | | ⬜ | |
| 3.2e | `não, é Av. José Pinto, 1020` | Corrige av. + número | | ⬜ | |
| 3.2f | `não, cep 78705022` | Fluxo CEP / reconfirma | | ⬜ | |
| 3.2g | `não, bairro é Vila Birigui` | Corrige bairro | | ⬜ | |
| 3.2h | `não, complemento casa 2` | Corrige complemento | | ⬜ | |
| 3.2i | `não` (simples) | Pede endereço correto; **sem PIX** | | ⬜ | |

**Fase 3 concluída?** ⬜ Sim · ⬜ Falhou R1 prioritário → **parar e avaliar hotfix 2.17.62**

---

## FASE 4 — WhatsApp: retirada

| Passo | O que fazer | Esperado | Real | Status | Evidência |
|-------|-------------|----------|------|--------|-----------|
| 4.1 | `quero comprar zaad` | Oferta produto | | ⬜ | |
| 4.2 | `retirar` | Fluxo retirada | | ⬜ | |
| 4.3 | — | **Não** pede CEP/endereço entrega | | ⬜ | |
| 4.4 | — | **Não** calcula frete entrega | | ⬜ | |
| 4.5 | — | PIX enviado **1 vez só** | | ⬜ | |
| 4.6 | — | Pedido criado | | ⬜ | DX-________ |
| 4.7 | Painel | Aparece Inbox / Produtos | | ⬜ | |

**Fase 4 concluída?** ⬜ Sim · ⬜ Falhou (sev.: ___)

---

## FASE 5 — Comprovante PIX + WA interno

Use um pedido em **aguardando pagamento** (entrega ou retirada).

| Passo | O que fazer | Esperado | Real | Status | Evidência |
|-------|-------------|----------|------|--------|-----------|
| 5.1 | Enviar **imagem ou PDF** de comprovante no WA cliente | Sistema aceita | | ⬜ | |
| 5.2 | — | Pedido registra comprovante | | ⬜ | |
| 5.3 | — | Status tipo **em conferência** / aguardando humano | | ⬜ | |
| 5.4 | WA **interno conferência** | Recebe alerta pedido + comprovante | | ⬜ | Print WA interno |
| 5.5 | — | **IA não aprovou** pagamento sozinha | | ⬜ | |
| 5.6 | Produtos → **Comprovantes** | Pedido/comprovante na fila | | ⬜ | |

**Fase 5 concluída?** ⬜ Sim · ⬜ Falhou (sev.: ___)

---

## FASE 6 — Inbox (`/platform/inbox`)

Abra a **conversa do cliente de teste** usada acima.

| # | Item | Esperado | Viu? | Status | Evidência |
|---|------|----------|------|--------|-----------|
| 6.1 | Conversa aparece na lista | Sim | | ⬜ | |
| 6.2 | Pedido vinculado à conversa | Sim | | ⬜ | |
| 6.3 | Código `DX-####` | Visível | | ⬜ | DX-________ |
| 6.4 | Status do pedido | Correto | | ⬜ | |
| 6.5 | Produto | Nome correto | | ⬜ | |
| 6.6 | Valor produto | Correto | | ⬜ | |
| 6.7 | Frete (se entrega) | Correto / N/A retirada | | ⬜ | |
| 6.8 | Total | Correto | | ⬜ | |
| 6.9 | Comprovante (se enviou) | Visível | | ⬜ | |
| 6.10 | Bloco **Endereço confirmado para entrega** | Aparece (se entrega) | | ⬜ | |
| 6.11 | Bloco **Localização enviada pelo cliente** | Se houve pin | ⬜ / N/A | | ⬜ | |
| 6.12 | Botão **Google Maps** | Abre mapa (se endereço/pin) | | ⬜ | |
| 6.13 | **Copiar dados para entrega manual** | Copia texto | | ⬜ | |
| 6.14 | Copiar manual **não** envia WA motoboy | Só clipboard | | ⬜ | |
| 6.15 | **Aprovar pagamento** (se tiver botão) | Funciona com seu perfil | | ⬜ | |
| 6.16 | **Rejeitar pagamento** | Funciona | | ⬜ | |
| 6.17 | **Pedir novo comprovante** | Funciona (se existir) | | ⬜ | |

**Fase 6 concluída?** ⬜ Sim · ⬜ Falhou (sev.: ___)

---

## FASE 7 — Produtos / Pedidos (`/platform/produtos#pedidos`)

| # | Item | Esperado | Status | Evidência |
|---|------|----------|--------|-----------|
| 7.1 | Pedido na **lista** | Aparece | ⬜ | |
| 7.2 | Código **DX-####** na lista | Visível | ⬜ | DX-________ |
| 7.3 | Abrir **drawer** do pedido | Abre | ⬜ | |
| 7.4 | Produto no drawer | Correto | ⬜ | |
| 7.5 | Cliente | Correto | ⬜ | |
| 7.6 | Canal (WhatsApp/WebChat) | Correto | ⬜ | |
| 7.7 | Status | Correto | ⬜ | |
| 7.8 | Valor + frete + total | Corretos | ⬜ | |
| 7.9 | Comprovante no drawer | Se aplicável | ⬜ | |
| 7.10 | Endereço confirmado | Se entrega | ⬜ | |
| 7.11 | Pin/localização | Se aplicável | ⬜ / N/A | |
| 7.12 | **Copiar entrega manual** no drawer | Funciona | ⬜ | |
| 7.13 | Deep link `#pedidos?order=DX-####` | Abre pedido certo | ⬜ | URL testada: ______ |

**Fase 7 concluída?** ⬜ Sim · ⬜ Falhou (sev.: ___)

---

## FASE 8 — Pin / localização (opcional mas recomendado)

| # | Item | Status | Evidência |
|---|------|--------|-----------|
| 8.1 | Iniciou compra com **entregue** | ⬜ | |
| 8.2 | Enviou **pin/localização** pelo WA | ⬜ | |
| 8.3 | Sistema pediu rua/número se faltou | ⬜ | |
| 8.4 | Confirmou com `sim` | ⬜ | |
| 8.5 | Frete + PIX após confirmar | ⬜ | |
| 8.6 | Inbox: pin **separado** de endereço confirmado | ⬜ | |
| 8.7 | Alerta se pin/endereço divergem (~400 m) | ⬜ | |

---

## FASE 9 — WebChat

**Widget publicado em site/domínio permitido?** ⬜ Sim · ⬜ Não

Se **Não** → marque fase inteira: **N/A JUSTIFICADO** e pule para Fase 10.

| Passo | Ação | Status | Evidência |
|-------|------|--------|-----------|
| 9.1 | `quero comprar zaad` | ⬜ | |
| 9.2 | Oferta + `entregue` | ⬜ | |
| 9.3 | CEP + número + confirmação | ⬜ | |
| 9.4 | Correção inline (ex.: `não, é número 120`) | ⬜ | |
| 9.5 | Frete + PIX | ⬜ | |
| 9.6 | Comprovante | ⬜ | |
| 9.7 | Pedido no Inbox + Produtos | ⬜ | |

---

## FASE 10 — RBAC financeiro (se tiver 2 perfis)

| # | Teste | Perfil usado | Esperado | Status |
|---|-------|--------------|----------|--------|
| 10.1 | Ver comprovante | Atendente / Viewer | Conforme permissão | ⬜ |
| 10.2 | Aprovar pagamento | **Sem** permissão | Bloqueado 403 ou botão oculto | ⬜ |
| 10.3 | Aprovar pagamento | **Com** permissão | Funciona | ⬜ |
| 10.4 | Cross-tenant: outra empresa | — | **Não** vê pedido | ⬜ |

---

## FASE 11 — Cancelar / sair (regressão)

| Mensagem | Esperado | Real | Status |
|----------|----------|------|--------|
| `cancelar` | Interrompe fluxo catálogo | | ⬜ |
| `sair` | Interrompe / opt-out conforme regra | | ⬜ |

---

## REGISTRO DE FALHAS (preencher se houver)

| # | Fase | Descrição | Severidade | Print/log |
|---|------|-----------|------------|-----------|
| 1 | | | P0/P1/P2/P3 | |
| 2 | | | | |
| 3 | | | | |

---

## DECISÃO FINAL (preencher ao terminar)

| Pergunta | Resposta |
|----------|----------|
| **Decisão** | ⬜ APROVADO PARA CONGELAMENTO · ⬜ APROVADO COM RESSALVAS · ⬜ REPROVADO — EXIGE HOTFIX |
| **Motivo (1 parágrafo)** | |
| **R1 `não, é número 120` passou?** | ⬜ Sim · ⬜ Não |
| **Precisa hotfix 2.17.62?** | ⬜ Sim · ⬜ Não |
| **Data conclusão QA** | ____/____/2026 |
| **Deploy neste QA?** | NÃO |
| **Push neste QA?** | NÃO |

### Critérios rápidos

**APROVADO PARA CONGELAMENTO** — só se: Fases 2–7 OK, R1 prioritário OK, comprovante OK, sem P0/P1.

**APROVADO COM RESSALVAS** — fluxo principal OK, só P2/P3 ou WebChat N/A.

**REPROVADO — EXIGE HOTFIX** — R1 falhou, PIX antes de frete/`sim`, PIX duplicado, IA aprovou sozinha, cross-tenant, pedido não aparece.

---

## Próximo passo

Quando terminar, copie este arquivo preenchido ou peça para consolidar em:

`RADARCHAT-QA-HUMANO-REAL-FINAL-CATALOGO-ENDERECO-PIX-2.17.61-2026-07-01.md`

---

*Checklist vivo — RadarChat 2.17.61 — QA humano real*
