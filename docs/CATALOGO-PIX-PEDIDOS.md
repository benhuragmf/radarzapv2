# Catálogo — pedidos PIX com comprovante e conferência humana

**Versão:** 2.17.12 · **Marca:** RadarChat

## Objetivo

Permitir que empresas vendam via IA/catálogo com pagamento PIX: o cliente confirma compra, recebe instruções, envia comprovante no chat; o sistema registra pedido, notifica WhatsApp interno e exige conferência humana antes de aprovar pagamento.

## Configuração (empresa)

Painel → **IA Atendimento** → aba **Empresa e catálogo** → seção **PIX, comprovante e conferência**.

Persistido em `Organization.catalogSales`:

| Campo | Descrição |
|-------|-----------|
| `enabled` | Ativa fluxo de pedidos via IA |
| `pixEnabled` | Pagamento PIX nos pedidos |
| `pixInstructions` | Chave/instruções repassadas pela IA |
| `notifyWhatsapp` | Envia comprovante ao WA interno |
| `internalWhatsapp` | Número E.164 (ex. `5566999999999`) |
| `responsibleName` | Setor/responsável |
| `internalMessageTemplate` | Cabeçalho da mensagem interna |
| `autoCreateOrderOnPurchase` | Cria pedido ao confirmar compra |
| `escalateOnProof` | Move conversa para fila humana |
| `requireHumanApproval` | Default `true` — IA nunca aprova por imagem |
| `allowManualResend` | Reenvio manual se WA falhar |

**RBAC:** alterar `internalWhatsapp` exige `company:sales-config:update` (dono/admin).

## Configuração (produto)

Campo opcional `salesMeta` em artigos da categoria **Produtos e estoque** (`AiKnowledgeBase`):

- `aiSellable`, `acceptsPix`, `useCompanyWhatsapp`, `productWhatsapp`, `responsibleSector`, `requireHumanReview`, `madeToOrder`

## Modo de venda (não quebrar link da loja)

| `salesMeta.saleMode` | Comportamento |
|---------------------|---------------|
| `link` | IA envia só o link/checkout — **não cria pedido PIX** |
| `link_or_pix` (default se tem link) | Cliente escolhe: link **ou** PIX no chat |
| `pix` | Fluxo PIX com conferência humana |

Detecção: pedidos de "link", "loja", "site" **não** abrem fluxo PIX. "PIX", "comprovante" abrem.

## Endereço e entrega

- Empresa: `requireDeliveryAddress`, `forceCollectAddress` (sincroniza **Dados a coletar → Endereço** no prompt), `deliveryInstructions`
- Origem A: `deliveryOriginAddress` — **CEP primeiro** no painel (busca automática ViaCEP); formato salvo: `CEP, rua, número, bairro, cidade, UF, Brasil`
- Taxa por distância: `useDistanceBasedDelivery` + `deliveryKmRates.km1` … `km8` — **rota OSRM** (pela rua) com fallback Haversine; cotação **só no servidor**, mensagem automática ao cliente
- Produto: `deliveryFee`, `requiresDeliveryAddress`
- Pedido: `deliveryAddress`, `deliveryDistanceKm`, `deliveryTierKm`, status `aguardando_endereco` até IA coletar endereço

## Cotação de frete (servidor — não IA)

Com `useDistanceBasedDelivery` ativo:

1. Cliente informa endereço completo → geocoding (OSM) + distância pela **rota** (OSRM) ou estimativa (Haversine se rota indisponível).
2. Sistema aplica faixa 1–8 km na tabela `deliveryKmRates` cadastrada no painel.
3. **Mensagem automática** ao cliente com produto, frete e total (`customerDeliveryQuoteMessage`).
4. A IA **não** informa valores de frete/total — se tentar, o texto é sanitizado.
5. Se o cálculo falhar (endereço, geocoding ou faixa sem taxa), pedido permanece `aguardando_endereco` e o cliente recebe aviso para aguardar confirmação humana.

### Pin de localização no WhatsApp (2.17.20)

Com **requisito de entrega** e frete por km ativos, o cliente pode enviar o **pin de localização fixa** no WhatsApp (não precisa digitar endereço):

1. `WhatsAppService` extrai `locationMessage` (ou `liveLocationMessage` como fallback).
2. Coordenadas são salvas no contato (`locationLat`, `locationLng`) e no pedido (`deliveryLocationLat/Lng`).
3. Reverse geocoding (OSM) preenche endereço legível no cadastro quando possível.
4. Distância empresa → GPS do cliente pela **rota OSRM** + faixa km — mesma mensagem automática de cotação.
5. A IA orienta texto ou pin, mas **nunca** informa frete/total; valores vêm só do servidor.

Se o pin **não tiver número confiável** (comum no WhatsApp), o sistema envia mensagem pedindo **rua e número** antes de cotar. O frete usa o endereço confirmado (geocoding), não só o GPS impreciso.

## Mensagens automáticas ao cliente

Ao aprovar/recusar/pedir novo comprovante no Inbox (`CatalogSalesOrderPanel`):

| Campo | Default |
|-------|---------|
| `notifyCustomerOnApprove` | `true` |
| `notifyCustomerOnReject` | `true` |
| `notifyCustomerOnRequestNewProof` | `true` |
| `customerApproveMessage` | template com `{{productName}}` |
| `customerRejectMessage` | template com `{{productName}}`, `{{reason}}` |
| `customerRequestNewProofMessage` | template com `{{productName}}`, `{{reason}}` |

Canal: WhatsApp (`contactIdentifier`) ou WebChat (mensagem outbound automática).

## Dados no cadastro de contatos

Campos em `Destination` (lista **Contatos**):

| Campo | Origem |
|-------|--------|
| `address` | IA (`collectedAddress`), pedido PIX, edição manual — endereço completo do contato (não só entrega) |
| `taxDocument` | IA (`collectedCpfCnpj`) |
| `name`, `email` | IA + fluxos existentes |

Na próxima conversa a IA lê o cadastro e **não pede o endereço de novo** se já estiver salvo (uso geral ou entrega).

## Status do pedido

`rascunho`, `aguardando_endereco`, `aguardando_pagamento`, `comprovante_recebido`, `em_conferencia`, `pagamento_aprovado`, `pagamento_recusado`, `pedido_confirmado`, `cancelado`, `falha_notificacao_whatsapp`, `pendente_configuracao_whatsapp`, `comprovante_sem_pedido`

## API painel

Base: `/api/platform/catalog-sales`

| Método | Rota | Permissão |
|--------|------|-----------|
| GET | `/lookup-cep?cep=` | `inbox:ai:manage` |
| GET | `/orders` | `orders:view` |
| GET | `/orders/:id` | `orders:view` |
| GET | `/orders/:id/proof` | `orders:view-payment-proof` |
| POST | `/orders/:id/approve` | `orders:approve-payment` |
| POST | `/orders/:id/reject` | `orders:reject-payment` |
| POST | `/orders/:id/request-new-proof` | `orders:update-status` |
| POST | `/orders/:id/resend-notification` | `orders:resend-pix-notification` |
| POST | `/orders/:id/notes` | `orders:add-internal-note` |

Comprovante: rota autenticada; link em notificação WA usa token HMAC (não é URL pública aberta).

## Fluxo resumido

1. Cliente pergunta produto → IA usa KNOWLEDGE (preço/estoque cadastrados).
2. Cliente confirma compra → `CatalogSalesService.maybeCreateOrderFromAiTurn` → status `aguardando_pagamento`.
3. Cliente envia imagem/PDF → `handleInboundProof` → vincula comprovante, notifica WA (`sendInternalAlert`) se configurado.
4. Operador aprova/recusa no Inbox (`CatalogSalesOrderPanel`) → mensagem automática ao cliente se configurado.

## QA manual (checklist)

1. Função desligada: comprovante salvo, sem WA interno.
2. Função ligada + número: pedido + notificação WA.
3. WA desconectado: pedido salvo, status `falha_notificacao_whatsapp`, reenvio manual.
4. Produto sem preço: IA não inventa valor.
5. Comprovante sem pedido: status `comprovante_sem_pedido`.
6. Usuário sem permissão: não altera WA financeiro nem aprova pagamento.

## Limitações conhecidas

- Criação de pedido na IA depende de confirmação explícita ou `shouldCreateCatalogOrder` no JSON da IA.
- WebChat premium triage básica não duplica hook de pedido em todos os modos — validar no modo `premium_assistant`.
- Anexo no WA interno: envio prioritário de link seguro; mídia anexa direta em evolução futura.

## Arquivos principais

- `src/types/catalog-sales.ts`
- `src/models/CatalogSalesOrder.ts`
- `src/services/catalog/CatalogSalesService.ts`
- `src/services/web-dashboard/frontend/src/pages/menu/AiAtendimento.tsx`
- `src/services/web-dashboard/frontend/src/components/inbox/CatalogSalesOrderPanel.tsx`
