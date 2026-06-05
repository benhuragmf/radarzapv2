# Menus do RadarZap v2 — resumo e funções

Documento de referência para produto, suporte e desenvolvimento.  
Painel: `http://localhost:5174` (frontend) · API: `/api` (backend).

---

## Como o menu é organizado

O painel tem **duas abas** no topo:

| Aba | Público | Função |
|-----|---------|--------|
| **Plataforma** | Toda empresa (tenant) | Envio manual, contatos, WhatsApp, automações, API, plano |
| **Discord** | Clientes com servidor vinculado | Automação Discord → WhatsApp (canais, regras, templates dw-*) |

Quem vê o quê depende do **papel (RBAC)**:

- **Usuário / empresa** — menu `TENANT_PLATFORM_NAV`
- **Staff RadarZap (admin)** — menu tenant + blocos **Operação**, **Gestão** e **Sistema**
- **Moderador interno** — operação e gestão limitada

---

## Plataforma — Dashboard

Resumo da conta e indicadores operacionais.

### Visão geral (`/dashboard`)

Painel operacional do **cliente**. Mostra em tempo real:

- Mensagens enviadas hoje
- Sessões WhatsApp ativas
- Jobs pendentes na fila
- Falhas recentes
- Gráfico de mensagens por hora (atualização via WebSocket)

**Função:** acompanhar o dia a dia do envio sem entrar em telas detalhadas.

### Plataforma (`/platform`)

Hub da área **Plataforma** (separada da automação Discord). Mostra:

- Contatos ativos, mensagens hoje, status WhatsApp, fila pendente
- Atalhos para modelos, relatórios, import de contatos
- Resumo Discord (se houver servidor vinculado)

**Função:** visão consolidada do tenant na vertical “envio direto / campanhas / modelos pw-*”.

### Relatórios (`/platform/reports`)

Relatórios **do tenant** (sua empresa):

- Aba **Meu negócio:** logs de envio + fila de mensagens filtrados por organização
- Aba **Sistema** (só staff): links para fila/logs globais

**Função:** investigar envios, atrasos e histórico operacional da conta.

### Auditoria resumida (`/platform/audit`)

Resumo dos **últimos 7 dias**:

- Envios (logs)
- Erros
- Campanhas criadas
- Contatos ativos

**Função:** snapshot rápido de conformidade e volume, com links para relatórios completos.

---

## Plataforma — Mensagens

Envio manual, campanhas e modelos **pw-*** (plataforma).

### Enviar agora (`/send`)

Envio **manual imediato** ou em lote:

- Selecionar contatos, grupos WhatsApp ou ambos
- Filtrar por **grupo de contato** e marcar grupo inteiro
- Texto livre ou modelo pw-* com prévia WhatsApp
- Validação de consentimento LGPD e participação em grupo WA
- Opção de fila segura (lotes) e aceite de risco WhatsApp

**Função:** disparo pontual para lista escolhida na hora.

### Campanhas (`/platform/campanhas`)

Lista todas as **campanhas** (pendentes, em andamento e concluídas):

- Status, destinos, progresso
- Atalho para criar nova campanha (`/send`) e agendamentos

**Função:** gerenciar envios em massa já criados.

### Agendamentos (`/send/agendamentos`)

Campanhas com **data/hora futura**:

- Criar, editar, cancelar agendamentos
- Envio único programado (não confundir com automações recorrentes)

**Função:** planejar envios sem executar na hora.

### Histórico de envios (`/send/historico`)

Campanhas **já processadas** (enviadas, falhas, canceladas).

**Função:** consultar o que saiu da fila e resultados passados.

### Modelos de mensagem (`/platform/templates`)

Editor de templates **pw-*** da plataforma:

- Aniversário, informativos, campanhas
- Variáveis (`{nome}`, `{mensagem}`, etc.)
- Prévia e reset para padrão do catálogo

**Função:** padronizar layout das mensagens de envio manual e automações.

---

## Plataforma — Contatos e destinos

Cadastro de quem recebe mensagem no WhatsApp + LGPD.

### Contatos (`/contact`)

Tela principal de **destinos tipo contato**:

- Listar, buscar, filtrar por consentimento
- **Sidebar de grupos de contato** (segmentação interna — não é grupo WA)
- Criar/editar contato (nome, telefone, e-mail, tags, birthday, grupos)
- Atribuir contato a um ou mais **grupos de contato**
- Histórico de consentimento por contato

> **Contato — cadastro**
> - Criar contato individual (modal ou linha na tabela)
> - Editar dados, mover entre grupos de contato
> - Status de consentimento (pendente, aceito, recusado, bloqueado)

> **Grupo de contato** (segmento)
> - Criar/renomear/excluir grupo na sidebar
> - Agrupar contatos para filtros em `/send`, automações e segmentos
> - *Não* envia mensagem sozinho — é filtro/organização

**Função:** base de pessoas elegíveis para envio, com consentimento e segmentação.

### Grupos (`/grupos`)

**Grupos WhatsApp** cadastrados como destino:

- Importar grupos da sessão WA conectada
- Salvar como destino `type: group` para envio manual ou regras Discord
- Validar se o número da sessão participa do grupo antes de enviar

> **Grupo WhatsApp**
> - Lista grupos da sessão + destinos já salvos
> - Vincular ID do grupo WA ao cadastro
> - Usado em envios para grupo e automações com escopo “grupos WA”

**Função:** destinos coletivos no WhatsApp (diferente de “grupo de contato”).

### Listas / Segmentos (`/platform/segmentos`)

Visão dos **grupos de contato** com contagem de membros e link para gestão em `/contact`.

**Função:** visão rápida de segmentação sem abrir a tela completa de contatos.

### Importar CSV / VCF (`/platform/contacts`)

Importação em massa:

- CSV (vários formatos) e VCF
- Mapeamento de colunas, birthday, tags
- Export CSV de contatos

**Função:** onboarding de base grande de contatos.

### Consentimento (submenu — mesma tela `/contact` com filtro)

Atalhos que abrem **Contatos** já filtrados:

| Item | Filtro | Função |
|------|--------|--------|
| Pendentes | `?consent=pending` | Aguardando aceite LGPD |
| Aceitos | `?consent=accepted` | Podem receber envio |
| Recusados | `?consent=refused` | Opt-out |
| Bloqueados manualmente | `?consent=blocked` | Bloqueio administrativo |

---

## Plataforma — Automações

Regras **recorrentes ou agendadas** (não confundir com agendamento único em `/send/agendamentos`).

### Mensagens automáticas (`/platform/automacoes`)

CRUD de regras com:

- Gatilhos: aniversário, dia do mês, dia útil, semanal, **envio único (data/hora)**
- Destinos: contatos, grupos de contato, grupos WA ou ambos
- Mensagem: modelo pw-* ou texto manual
- Horário / `scheduledAt`
- Testar agora (regras ativas)

**Função:** marketing e rotinas automáticas (ex.: parabéns no aniversário, aviso todo dia 10).

### Gatilhos avançados (`/platform/gatilhos`)

Página explicativa + atalho para **Mensagens automáticas** (tipos de gatilho disponíveis).

**Função:** onboarding sobre quando cada automação dispara.

---

## Plataforma — WhatsApp

Conexão da sessão e operação da fila.

### Conexões / Sessões / QR Code (`/sessions`)

Mesma tela — gestão da **sessão WhatsApp** da empresa:

- Conectar (QR), desconectar, reiniciar
- Status: conectado, desconectado, aguardando QR
- Foto e número do perfil WA

**Função:** manter o canal WhatsApp online para envios.

### Status das conexões (`/platform/wa-status`)

Wrapper com foco em **estado das sessões** (mesmo componente de sessões, contexto “monitoramento”).

### Fila de envio (`/admin/queue` no menu tenant)

Fila BullMQ — jobs aguardando, ativos, falhos (visão global para quem tem permissão `queue:global`; tenant vê fila filtrada em Relatórios).

### Logs WhatsApp (`/platform/wa-logs`)

Logs filtrados por serviço **WhatsAppService** do tenant.

**Função:** debug de conexão, envio e erros WA.

---

## Plataforma — Integrações

API REST para ERP, CRM, scripts externos. Base: **`/api`** · auth: **`X-API-Key`** ou cookie de sessão.

### Chaves de API (`/settings#api-chaves`)

Gerar, listar (prefixo) e revogar chaves por organização.

### Webhooks (`/settings#api-webhooks`)

Cadastrar URLs HTTPS para eventos (`campaign.sent`, `campaign.failed`, `consent.updated`, `session.*`).

### Playground (`/send#playground`)

Formulário de teste que chama `POST /integrations/playground` (mesmo contrato de envio de teste).

### Documentação (`/settings#api-docs`)

Tabela OpenAPI dos endpoints expostos (`GET /integrations/openapi`).

### Rate Limit (`/settings#api-rate`)

Limites do plano (mensagens/dia) e janela de requisições API.

---

## Plataforma — Minha empresa

Configurações da **organização** (tenant).

### Cargos e acessos (`/settings/team`)

Convidar membros (OWNER, ADMIN, ATTENDANT) — papéis da empresa no painel.

### Plano e limites (`/plans`)

Plano atual, cotas, upgrade (e visão admin para staff).

### Configurações gerais (`/settings`)

Dados da conta Discord, papel, plano, servidores vinculados + seções de API (hashes acima).

### Permissões (`/settings/permissions`)

Explicação dos papéis OWNER / ADMIN / ATTENDANT e link para equipe.

### Segurança (`/settings/security`)

Gestão de chaves API e boas práticas de integração.

### Backup (`/settings/backup`)

Export CSV de contatos (`GET /destinations/export-csv`).

---

## Admin interno (staff RadarZap)

Visível para **SYSTEM_ADMIN** (e parcialmente **SYSTEM_MODERATOR**). Home: `/admin/dashboard`.

### Dashboard global (`/admin/dashboard`)

Painel interno RadarZap (métricas globais — em expansão).

### Operação

| Menu | Rota | Função |
|------|------|--------|
| Sessões WhatsApp | `/admin/sessions` | Todas as sessões WA do sistema |
| Fila global | `/admin/queue` | Filas BullMQ sem filtro de tenant |
| Logs globais | `/admin/logs` | SystemLog de todos os clientes |
| API global | `/admin/api` | Visão admin de integrações |
| Monitoramento | `/admin/monitoring` | Saúde MongoDB/Redis + stats ao vivo |
| Erros do sistema | `/admin/errors` | Logs level=error últimas 24h |

### Gestão

| Menu | Rota | Função |
|------|------|--------|
| Clientes | `/admin/clients` | Lista usuários/organizações, plano |
| Servidores | `/admin/servers` | Resumo WA + guilds Discord + canais ativos |
| Planos | `/admin/plans` | Gestão de planos |
| Pagamentos | `/admin/payments` | Pagamentos (placeholder admin) |
| Moderação | `/admin/moderation` | Bloqueio de contatos, links consentimento |
| Auditoria | `/admin/audit` | AuditLog de ações administrativas |

### Sistema

| Menu | Rota | Função |
|------|------|--------|
| Configurações gerais | `/admin/settings` | Health dos serviços (`/services/health`) |
| Permissões / Segurança / Backup | mesmas rotas tenant | Mesmas telas, contexto admin |

---

## Discord — Automação Discord → WhatsApp

Requer **servidor Discord selecionado** no topo. Rotas prefixo `/discord/`.

### Canais (`/discord/channels`)

Vincular canais Discord monitorados pelo bot.

### Regras e filtros (`/discord/rules`)

Regras que disparam envio WA quando há mensagem no Discord:

- Filtros (live, palavras, etc.)
- Destinos: contatos e/ou **grupos WhatsApp**
- Bloqueio por regra se sessão WA não está no grupo
- Alerta no menu quando há erro de grupo

### Formato no WhatsApp (`/discord/templates`)

Templates **dw-*** (layout das mensagens replicadas do Discord).

### Destinos WhatsApp

| Item | Rota | Função |
|------|------|--------|
| Contatos | `/discord/contact` | Mesma UI de contatos, escopo Discord |
| Grupos | `/discord/grupos` | Grupos WA para regras Discord |
| Histórico de envios | `/discord/contact/historico` | Campanhas originadas da automação |

### Monitoramento Discord

| Item | Rota | Função |
|------|------|--------|
| Fila de envio | `/discord/fila` | Fila filtrada automação Discord |
| Logs | `/discord/logs` | Pipeline Discord → WhatsApp |

### Configurações do servidor (`/discord/settings`)

Preferências do guild Discord selecionado.

---

## Glossário rápido

| Termo | Significado |
|-------|-------------|
| **Contato** | Pessoa (número E.164) cadastrada como destino |
| **Grupo de contato** | Segmento interno (tags organizacionais) — filtro em envios |
| **Grupo WhatsApp** | Destino coletivo no WA (`type: group`) |
| **Campanha** | Lote de mensagens enfileiradas (manual ou agendada) |
| **Automação** | Regra recorrente ou envio único com gatilho |
| **Template pw-*** | Modelo plataforma (envio manual/automações) |
| **Template dw-*** | Modelo Discord → WhatsApp |
| **Tenant** | Organização/cliente no RadarZap |

---

## Referências técnicas

- Mapa rota → código: `docs/MENU-PAGES-REGISTRY.md`
- Configuração do menu: `src/services/web-dashboard/frontend/src/lib/navConfig.ts`
- Regra IA (preencher menus automaticamente): `.cursor/rules/menu-content-automatic.mdc`

*Última atualização: junho/2026 — RadarZap v2.*
