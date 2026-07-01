# Produtos — Catálogo, Estoque, Pedidos e PIX

## Objetivo

Centralizar a operação comercial (produtos, estoque, pedidos, PIX, entrega) fora da tela **IA Atendimento**, mantendo a IA focada em perfil comercial, ativação e comportamento.

## Quando o menu aparece

- `Organization.catalogSales.businessCatalogProfile !== 'none'`
- `Organization.catalogSales.enabled === true`
- Admin com perfil escolhido mas catálogo desligado pode ver o grupo no menu e CTA em `/platform/produtos` ou em **IA → Empresa e IA**.

## Relação com IA Atendimento

- **IA → Empresa e IA** (`/platform/inbox/ia#empresa`): perfil comercial, toggle de pedidos via IA, regras de comportamento, alertas e atalhos.
- **Produtos**: cadastro, PIX, pedidos, comprovantes e frete.

## Submenus

| Hash | Rota | Conteúdo |
|------|------|----------|
| (default) `visao` | `/platform/produtos` | KPIs e atalhos |
| `itens` | `#itens` | CRUD produtos (KB categoria **Produtos e estoque**) |
| `pedidos` | `#pedidos` | Lista `CatalogSalesOrder` |
| `comprovantes` | `#comprovantes` | Fila PIX |
| `entrega` | `#entrega` | Origem, km, instruções |
| `configuracoes` | `#configuracoes` | PIX, WA interno, mensagens |

## Produtos e estoque

Artigos em `AiKnowledgeBase`, categoria **Produtos e estoque**, com `salesMeta`. Mesma fonte usada pela IA e `CatalogSalesService`.

## Pedidos

API existente: `GET/POST /api/platform/catalog-sales/orders/*`. Painel Inbox mantém painel rápido na conversa.

## Comprovantes PIX

Fila filtrada por status de comprovante; visualização via rota protegida `…/proof` com RBAC `orders:view-payment-proof`.

## Entrega e frete

UI de `deliveryOriginAddress`, tabela km 1–8, `useDistanceBasedDelivery`. Cálculo permanece no servidor.

## Configurações

Campos em `Organization.catalogSales` via `PATCH /platform/ai/settings`.

## Permissões/RBAC

| Capacidade | Uso |
|------------|-----|
| `inbox:ai:manage` | Catálogo, produtos, config, entrega |
| `orders:view` | Pedidos e comprovantes |
| `orders:approve-payment` / `reject-payment` | Ações financeiras |
| `company:sales-config:update` | WhatsApp interno sensível |

## APIs

Reutilizadas: `/platform/ai/settings`, `/platform/catalog-sales/orders/*`, `lookup-cep` quando aplicável.

## Segurança

- Tenant scoped por `clientId`
- Menu e rotas bloqueados sem catálogo ativo
- Comprovante só com permissão
- Chave PIX não exposta em logs

## QA manual

Ver checklist em `docs/concluidos/RADARCHAT-PRODUTOS-MENU-CATALOGO-CONCLUSAO-2.17.53.md`.

## Limitações conhecidas

- Produtos continuam na KB (não há coleção Mongo separada).
- Tipos do painel espelhados em `frontend/src/lib/catalog/catalogSalesTypes.ts` para build isolado do tsc do Vite.
