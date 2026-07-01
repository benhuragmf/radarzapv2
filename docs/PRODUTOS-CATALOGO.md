# Produtos — Catálogo, Estoque, Pedidos e PIX

## Objetivo

Centralizar a operação comercial (produtos, estoque, pedidos, PIX, entrega) fora da tela **IA Atendimento**, mantendo a IA focada em perfil comercial, ativação e comportamento.

**Fluxo WhatsApp (2.17.54+):** com perfil *Varejo com entrega*, escolha *entregue* pede CEP antes do PIX; estoque *consulte* não gera pagamento automático. Ver [`CATALOGO-PIX-PEDIDOS.md`](./CATALOGO-PIX-PEDIDOS.md).

**UX painel (2.17.55):** dashboard na visão geral, tabelas profissionais, três WhatsApps operacionais em Configurações (entregadores bloqueado). Ver [`concluidos/RADARCHAT-PRODUTOS-UX-WHATSAPPS-CONCLUSAO-2.17.55.md`](./concluidos/RADARCHAT-PRODUTOS-UX-WHATSAPPS-CONCLUSAO-2.17.55.md).

**Pedidos (2.17.59):** código curto `DX-####` na lista e drawer; deep link `#pedidos?order=DX-1045`; link Inbox ↔ pedido.

**Endereço Entrega v1 (2.17.60):** em produção — ver [`concluidos/RADARCHAT-DEPLOY-ENDERECO-ENTREGA-V1-2.17.60.md`](./concluidos/RADARCHAT-DEPLOY-ENDERECO-ENTREGA-V1-2.17.60.md).

**Fechamento endereço + localização humana (2.17.61):** correção R1, painel operador (endereço × pin, Maps, cópia manual) — local, sem deploy — [`concluidos/RADARCHAT-FECHAMENTO-ENDERECO-V1-LOCALIZACAO-HUMANA-2.17.61.md`](./concluidos/RADARCHAT-FECHAMENTO-ENDERECO-V1-LOCALIZACAO-HUMANA-2.17.61.md).

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
| (default) `visao` | `/platform/produtos` | KPIs, fluxo operacional, alertas e atalhos (2.17.55) |
| `itens` | `#itens` | CRUD produtos — formulário colapsável + `DataTable` (KB categoria **Produtos e estoque**) |
| `pedidos` | `#pedidos` | Lista `CatalogSalesOrder` com filtros e drawer de detalhe |
| `comprovantes` | `#comprovantes` | Fila PIX com empty state explicativo |
| `entrega` | `#entrega` | Modo atendimento, origem, km, instruções |
| `configuracoes` | `#configuracoes` | PIX, mensagens, **WhatsApps operacionais** (loja / conferência / entregadores futuro) |

### Labels no menu lateral (2.17.55)

| Label completo (aba) | Sidebar (`sidebarLabel`) |
|----------------------|--------------------------|
| Produtos e estoque | Estoque |
| Comprovantes PIX | Comprovantes |

Tooltip/title mantém o texto completo.

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

### WhatsApps operacionais (2.17.55)

| Papel | Origem no sistema | Uso |
|-------|-------------------|-----|
| **WhatsApp da loja** | Sessão WA conectada (`GET /sessions`) | Cliente compra, IA reserva, coleta endereço, envia PIX, recebe comprovante |
| **WhatsApp do responsável pela conferência** | `internalWhatsapp` + `notifyWhatsapp` | Recebe pedido + comprovante para conferir pagamento |
| **WhatsApp dos entregadores** | *Em breve (UI bloqueada)* | Futuro: dados de retirada/entrega após `pagamento_aprovado` — **sem envio nesta versão** |

Diagrama do fluxo na aba Configurações e Visão geral.

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

Ver checklist em `docs/concluidos/RADARCHAT-PRODUTOS-UX-WHATSAPPS-CONCLUSAO-2.17.55.md` (e base 2.17.53).

## Limitações conhecidas

- Produtos continuam na KB (não há coleção Mongo separada).
- Tipos do painel espelhados em `frontend/src/lib/catalog/catalogSalesTypes.ts` para build isolado do tsc do Vite.
