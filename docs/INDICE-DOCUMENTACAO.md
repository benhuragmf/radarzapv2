# Radar Chat v2 — Índice de documentação

**Versão do produto:** `2.17.61` · **Atualizado:** 2026-07-01

### Leitura principal obrigatória

1. [`RADARCHAT-SISTEMA-COMPLETO.md`](./RADARCHAT-SISTEMA-COMPLETO.md) — documentação mestre
2. [`PENDENCIAS-HUMANAS-FASE1.md`](./PENDENCIAS-HUMANAS-FASE1.md) — **única lista do que falta (QA humano)**
3. [`concluidos/RADARCHAT-RESULTADO-FINAL-TOP-01-20.md`](./concluidos/RADARCHAT-RESULTADO-FINAL-TOP-01-20.md) — resumo executivo pós-TOP 20
4. [`concluidos/top/RADARCHAT-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md`](./concluidos/top/RADARCHAT-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md) — **fonte oficial** status, checklists e go-live
5. [`RADARCHAT-MAPA-DOCUMENTACAO-VIVA-2.17.61.md`](./RADARCHAT-MAPA-DOCUMENTACAO-VIVA-2.17.61.md) — **o que é vivo vs arquivo**  
6. [`RADARCHAT-EXTRAIDOS-LEGACY-2.17.61.md`](./RADARCHAT-EXTRAIDOS-LEGACY-2.17.61.md) — extratos de docs em `legacy/`  
7. [`RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md`](./RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md) — **QA humano master**

Mapa completo abaixo. Novas entregas: atualizar este índice ([`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md)).

---

## Documentação mestre

| Documento | Descrição |
|-----------|-----------|
| [`RADARCHAT-SISTEMA-COMPLETO.md`](./RADARCHAT-SISTEMA-COMPLETO.md) | **Entrada principal** — visão consolidada, módulos, gates, TOPs, agente IA |
| [`RADARCHAT-RESULTADO-FINAL-TOP-01-20.md`](./concluidos/RADARCHAT-RESULTADO-FINAL-TOP-01-20.md) | Resultado final TOP 01–20 — leitura rápida |

---

## Governança e versão

| Documento | Descrição |
|-----------|-----------|
| [`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md) | Protocolo de versionamento e documentação |
| [`CHANGELOG.md`](./CHANGELOG.md) | Changelog append-only |
| [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md) | Registro vivo (espelho versionado) |
| [`design-system/CONFIG-SAVE-FEEDBACK.md`](./legacy/design-system/CONFIG-SAVE-FEEDBACK.md) | Padrão botão Salvar + toast Sonner (legacy) |
| [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md) | Roadmap, gate estabilização |
| [`PENDENCIAS-HUMANAS-FASE1.md`](./PENDENCIAS-HUMANAS-FASE1.md) | **Pendências só humanas** — QA manual + Admin VPS |
| [`concluidos/PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md`](./concluidos/PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md) | Plano consulta → doc → aplicação (arquivo) |
| [`concluidos/RADARCHAT-VISAO-PRODUTO-DIFERENCIACAO.md`](./concluidos/RADARCHAT-VISAO-PRODUTO-DIFERENCIACAO.md) | Visão produto / diferenciação (arquivo) |
| [`legacy/referencias/REFERENCIAS-MERCADO-UPGRADES.md`](./legacy/referencias/REFERENCIAS-MERCADO-UPGRADES.md) | Referências mercado (legacy) |
| [`legacy/RADARCHAT-PLANO-UPGRADES.md`](./legacy/RADARCHAT-PLANO-UPGRADES.md) | Plano 21 upgrades — backlog pós-gate (legacy) |
| [`legacy/README.md`](./legacy/README.md) | **Índice legacy** — docs nota &lt; 8 + escala 1–10 |
| [`RADARCHAT-EXTRAIDOS-LEGACY-2.17.61.md`](./RADARCHAT-EXTRAIDOS-LEGACY-2.17.61.md) | Extratos operacionais dos legacy |

---

## Layout v3

| Documento | Descrição |
|-----------|-----------|
| [`legacy/RADARCHAT-LAYOUT-V3-09-FASE-4-5-QA-VISUAL-NAVEGAVEL.md`](./legacy/RADARCHAT-LAYOUT-V3-09-FASE-4-5-QA-VISUAL-NAVEGAVEL.md) | QA visual Layout v3 (legacy @ 2.12.71) |
| [`concluidos/RADARCHAT-LAYOUT-V3-06-FASE-2-MENU-E-NAVEGACAO.md`](./concluidos/RADARCHAT-LAYOUT-V3-06-FASE-2-MENU-E-NAVEGACAO.md) … [`08`](./concluidos/RADARCHAT-LAYOUT-V3-08-FASE-4-COMPONENTES-VISUAIS-COMPARTILHADOS.md) | Entregas fases 2–4 (arquivo) |
| [`concluidos/RADARCHAT-LAYOUT-V3-01-INVENTARIO-ROTAS-MENUS-RBAC.md`](./concluidos/RADARCHAT-LAYOUT-V3-01-INVENTARIO-ROTAS-MENUS-RBAC.md) … [`05`](./concluidos/RADARCHAT-LAYOUT-V3-05-PROXIMAS-FASES-E-PROMPTS.md) | Pré-implementação (arquivo) |

---

## Módulos (referência por domínio)

| Documento | Descrição |
|-----------|-----------|
| [`INBOX-ATENDIMENTO.md`](./INBOX-ATENDIMENTO.md) | Inbox, triagem, fila, CSAT, supervisor |
| [`legacy/MODO-ATENDENTE-DESKTOP.md`](./legacy/MODO-ATENDENTE-DESKTOP.md) | PWA atendente (legacy) |
| [`TICKET-ATENDIMENTO.md`](./TICKET-ATENDIMENTO.md) | Chamados TK, SLA, token público |
| [`WEBCHAT.md`](./WEBCHAT.md) | Widget, API pública, fila, FAQ |
| [`legacy/ONBOARDING-VERTICAL.md`](./legacy/ONBOARDING-VERTICAL.md) | Pré-config por vertical (legacy) |
| [`LEADS-FORMULARIO.md`](./LEADS-FORMULARIO.md) | Formulários embed e captura |
| [`IA-CREDITOS-E-CARTEIRA.md`](./IA-CREDITOS-E-CARTEIRA.md) | Créditos IA e carteira |
| [`CATALOGO-PIX-PEDIDOS.md`](./CATALOGO-PIX-PEDIDOS.md) | Catálogo, pedidos via IA, PIX e fulfillment |
| [`PRODUTOS-CATALOGO.md`](./PRODUTOS-CATALOGO.md) | Menu Produtos — estoque, pedidos, PIX, frete, WhatsApps operacionais (2.17.55) |
| [`concluidos/RADARCHAT-QA-REAL-POS-DEPLOY-ENDERECO-V1-2.17.60.md`](./concluidos/RADARCHAT-QA-REAL-POS-DEPLOY-ENDERECO-V1-2.17.60.md) | **QA real** pós-deploy Endereço v1 2.17.60 — pendente Benhur |
| [`concluidos/RADARCHAT-QA-FINAL-CONGELAMENTO-CATALOGO-ENDERECO-PIX-2.17.61.md`](./concluidos/RADARCHAT-QA-FINAL-CONGELAMENTO-CATALOGO-ENDERECO-PIX-2.17.61.md) | **QA final + congelamento** catálogo/endereço/PIX 2.17.61 — smoke OK; QA humano pendente |
| [`concluidos/RADARCHAT-HOTFIX-ENDERECO-CORRECAO-INLINE-2.17.61.md`](./concluidos/RADARCHAT-HOTFIX-ENDERECO-CORRECAO-INLINE-2.17.61.md) | **Hotfix R1** correção inline após `não` — incluído em prod `4a7c690` |
| [`concluidos/RADARCHAT-FECHAMENTO-ENDERECO-V1-LOCALIZACAO-HUMANA-2.17.61.md`](./concluidos/RADARCHAT-FECHAMENTO-ENDERECO-V1-LOCALIZACAO-HUMANA-2.17.61.md) | **Fechamento** endereço v1 + localização humana — **em produção** |
| [`concluidos/RADARCHAT-DEPLOY-FECHAMENTO-ENDERECO-V1-LOCALIZACAO-HUMANA-2.17.61.md`](./concluidos/RADARCHAT-DEPLOY-FECHAMENTO-ENDERECO-V1-LOCALIZACAO-HUMANA-2.17.61.md) | **Deploy** 2.17.61 — run [28550770502](https://github.com/benhuragmf/radarzapv2/actions/runs/28550770502) |
| [`concluidos/RADARCHAT-DEPLOY-ENDERECO-ENTREGA-V1-2.17.60.md`](./concluidos/RADARCHAT-DEPLOY-ENDERECO-ENTREGA-V1-2.17.60.md) | **Deploy** Endereço Entrega v1 — produção `95666e9` |
| [`concluidos/RADARCHAT-ENDERECO-ENTREGA-V1-2.17.60.md`](./concluidos/RADARCHAT-ENDERECO-ENTREGA-V1-2.17.60.md) | **Endereço Entrega v1** — implementação 2.17.60 |
| [`concluidos/RADARCHAT-DEPLOY-HOTFIX-QA-REAL-2.17.59.md`](./concluidos/RADARCHAT-DEPLOY-HOTFIX-QA-REAL-2.17.59.md) | **Deploy + QA** hotfix 2.17.59 — produção `f1f54ee` |
| [`concluidos/RADARCHAT-HOTFIX-QA-REAL-WHATSAPP-INBOX-PEDIDO-2.17.59.md`](./concluidos/RADARCHAT-HOTFIX-QA-REAL-WHATSAPP-INBOX-PEDIDO-2.17.59.md) | **Hotfix** QA real — áudio, pin, anti-loop, Inbox, orderCode (implementação 2.17.59) |
| [`concluidos/RADARCHAT-DEPLOY-HOTFIX-CATALOGO-2.17.58.md`](./concluidos/RADARCHAT-DEPLOY-HOTFIX-CATALOGO-2.17.58.md) | **Deploy** hotfix catálogo 2.17.58 |
| [`concluidos/RADARCHAT-HOTFIX-CATALOGO-WA-ENDERECO-PIX-2.17.58.md`](./concluidos/RADARCHAT-HOTFIX-CATALOGO-WA-ENDERECO-PIX-2.17.58.md) | **Hotfix** catálogo WA — retirada, endereço, PIX duplicado (2.17.58) |
| [`concluidos/RADARCHAT-VALIDACAO-POS-PRODUCAO-2.17.57.md`](./concluidos/RADARCHAT-VALIDACAO-POS-PRODUCAO-2.17.57.md) | **Validação pós-produção** 2.17.57 — Git, deploy, bundle, QA pendente |
| [`concluidos/RADARCHAT-QA-MANUAL-GUIADO-POS-2.17.56.md`](./concluidos/RADARCHAT-QA-MANUAL-GUIADO-POS-2.17.56.md) | QA manual guiado pós-2.17.56 (histórico pré-deploy) |
| [`concluidos/RADARCHAT-HANDOFF-LOCAL-POS-2.17.55.md`](./concluidos/RADARCHAT-HANDOFF-LOCAL-POS-2.17.55.md) | Handoff local pós-2.17.55 (histórico pré-deploy) |
| [`concluidos/RADARCHAT-PRODUTOS-UX-WHATSAPPS-CONCLUSAO-2.17.55.md`](./concluidos/RADARCHAT-PRODUTOS-UX-WHATSAPPS-CONCLUSAO-2.17.55.md) | **Conclusão** UX Produtos + WhatsApps operacionais |
| [`concluidos/RADARCHAT-PRODUTOS-MENU-CATALOGO-CONCLUSAO-2.17.53.md`](./concluidos/RADARCHAT-PRODUTOS-MENU-CATALOGO-CONCLUSAO-2.17.53.md) | **Conclusão** menu Produtos e reorganização catálogo |
| [`concluidos/CATALOGO-IA-COMPRA-HANDOFF-GPT.md`](./concluidos/CATALOGO-IA-COMPRA-HANDOFF-GPT.md) | Handoff GPT — métodos, fluxo compra WA/WebChat, QA |
| [`concluidos/RADARCHAT-CATALOGO-IA-PIX-PRODUCAO-CONCLUSAO-2.17.52.md`](./concluidos/RADARCHAT-CATALOGO-IA-PIX-PRODUCAO-CONCLUSAO-2.17.52.md) | **Conclusão** auditoria catálogo IA/PIX + produção |
| [`RADARCHAT-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`](./RADARCHAT-MODOS-ATENDIMENTO-IMPLEMENTACAO.md) | Modos de atendimento (consolidado) |
| [`EQUIPE-RBAC.md`](./EQUIPE-RBAC.md) | Papéis e capabilities |
| [`CONSENTIMENTO-LGPD.md`](./CONSENTIMENTO-LGPD.md) | Consentimento LGPD |
| [`BILLING.md`](./BILLING.md) | Stripe, planos, limites |
| [`concluidos/admin/RADARCHAT-ADMIN-DASHBOARD-OPS.md`](./concluidos/admin/RADARCHAT-ADMIN-DASHBOARD-OPS.md) | Dashboard ops global (arquivo) |
| [`concluidos/admin/RADARCHAT-ADMIN-DASHBOARD-OPS-API.md`](./concluidos/admin/RADARCHAT-ADMIN-DASHBOARD-OPS-API.md) | **API** — contrato REST Admin Ops (arquivo) |
| [`admin/README.md`](./admin/README.md) | Redirect → `concluidos/admin/` |
| [`concluidos/ENTREGA-ADMIN-DASHBOARD-OPS-2.12.37-38.md`](./concluidos/ENTREGA-ADMIN-DASHBOARD-OPS-2.12.37-38.md) | Entrega Etapas 1–3 |
| [`concluidos/ENTREGA-AUDITORIA-HORIZONTAL-2.12.47-59.md`](./concluidos/ENTREGA-AUDITORIA-HORIZONTAL-2.12.47-59.md) | Entrega auditoria 2.12.47–63 |
| [`WEBHOOKS.md`](./WEBHOOKS.md) | Webhooks outbound |
| [`legacy/DISCORD-MONITORAMENTO.md`](./legacy/DISCORD-MONITORAMENTO.md) | Discord bot (legacy) |
| [`legacy/RADARCHAT_INTEGRATION_CONTRACT.md`](./legacy/RADARCHAT_INTEGRATION_CONTRACT.md) | RadarGamer inbound — ver também extratos §4 |
| [`concluidos/RADARCHAT_NEXT_PROMPT.md`](./concluidos/RADARCHAT_NEXT_PROMPT.md) | Prompt Codex integração (arquivo) |
| [`MENU-PAGES-REGISTRY.md`](./MENU-PAGES-REGISTRY.md) | Rotas → componentes → API |
| [`MENUS-SISTEMA.md`](./MENUS-SISTEMA.md) | Menus UX do painel |
| [`legacy/CONTATOS-CSV-IMPORTACAO.md`](./legacy/CONTATOS-CSV-IMPORTACAO.md) | Import/export CSV — extratos §5 |
| [`CONTATOS-CLASSIFICACAO.md`](./CONTATOS-CLASSIFICACAO.md) | Classificação CRM (tipo, LGPD, funil, campanhas) |
| [`DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md) | Tokens `--rz-*`, componentes |

---

## TOPs 01–21 (auditoria e fechamento)

> **Arquivo (2026-06-28):** TOP 01–21 em [`concluidos/top/`](./concluidos/top/) · redirect legado [`top/README.md`](./top/README.md).

| # | Documento |
|---|-----------|
| 01 | [`top/RADARCHAT-TOP-01-DIAGNOSTICO-INICIAL.md`](./concluidos/top/RADARCHAT-TOP-01-DIAGNOSTICO-INICIAL.md) |
| 02 | [`top/RADARCHAT-TOP-02-GOVERNANCA-BASELINE-GATES.md`](./concluidos/top/RADARCHAT-TOP-02-GOVERNANCA-BASELINE-GATES.md) |
| 03 | [`top/RADARCHAT-TOP-03-PLANOS-MENSALIDADES-LIMITES.md`](./concluidos/top/RADARCHAT-TOP-03-PLANOS-MENSALIDADES-LIMITES.md) |
| 04 | [`top/RADARCHAT-TOP-04-RBAC-PERMISSOES-EQUIPE-SEGURANCA.md`](./concluidos/top/RADARCHAT-TOP-04-RBAC-PERMISSOES-EQUIPE-SEGURANCA.md) |
| 05 | [`top/RADARCHAT-TOP-05-STATUS-PRESENCA-FILA.md`](./concluidos/top/RADARCHAT-TOP-05-STATUS-PRESENCA-FILA.md) |
| 06 | [`top/RADARCHAT-TOP-06-MODOS-ATENDIMENTO.md`](./concluidos/top/RADARCHAT-TOP-06-MODOS-ATENDIMENTO.md) |
| 07 | [`top/RADARCHAT-TOP-07-INBOX-CONVERSAS-FILA-TRANSFERENCIA.md`](./concluidos/top/RADARCHAT-TOP-07-INBOX-CONVERSAS-FILA-TRANSFERENCIA.md) |
| 08 | [`top/RADARCHAT-TOP-08-TICKETS-CHAMADOS-TK-RASTREABILIDADE.md`](./concluidos/top/RADARCHAT-TOP-08-TICKETS-CHAMADOS-TK-RASTREABILIDADE.md) |
| 09 | [`top/RADARCHAT-TOP-09-CONTATOS-LEADS-KANBAN-DEDUPLICACAO.md`](./concluidos/top/RADARCHAT-TOP-09-CONTATOS-LEADS-KANBAN-DEDUPLICACAO.md) |
| 10 | [`top/RADARCHAT-TOP-10-FORMULARIOS-PUBLICOS-EMBED-CAPTURA-LEADS.md`](./concluidos/top/RADARCHAT-TOP-10-FORMULARIOS-PUBLICOS-EMBED-CAPTURA-LEADS.md) |
| 11 | [`top/RADARCHAT-TOP-11-WEBCHAT-WIDGET-FALLBACK-EXPERIENCIA.md`](./concluidos/top/RADARCHAT-TOP-11-WEBCHAT-WIDGET-FALLBACK-EXPERIENCIA.md) |
| 12 | [`top/RADARCHAT-TOP-12-WHATSAPP-SESSAO-QR-RECONEXAO-COMANDOS.md`](./concluidos/top/RADARCHAT-TOP-12-WHATSAPP-SESSAO-QR-RECONEXAO-COMANDOS.md) |
| 13 | [`top/RADARCHAT-TOP-13-BRIDGE-WEBCHAT-WHATSAPP.md`](./concluidos/top/RADARCHAT-TOP-13-BRIDGE-WEBCHAT-WHATSAPP.md) |
| 14 | [`top/RADARCHAT-TOP-14-IA-BASICA-TRIAGEM-ENCAMINHAMENTO.md`](./concluidos/top/RADARCHAT-TOP-14-IA-BASICA-TRIAGEM-ENCAMINHAMENTO.md) |
| 15 | [`top/RADARCHAT-TOP-15-IA-PREMIUM-KB-HANDOFF.md`](./concluidos/top/RADARCHAT-TOP-15-IA-PREMIUM-KB-HANDOFF.md) |
| 16 | [`top/RADARCHAT-TOP-16-IA-CREDITOS-CARTEIRA-CONSUMO-FALLBACK.md`](./concluidos/top/RADARCHAT-TOP-16-IA-CREDITOS-CARTEIRA-CONSUMO-FALLBACK.md) |
| 17 | [`top/RADARCHAT-TOP-17-BILLING-ASSINATURAS-LIMITES-BLOQUEIOS.md`](./concluidos/top/RADARCHAT-TOP-17-BILLING-ASSINATURAS-LIMITES-BLOQUEIOS.md) |
| 18 | [`top/RADARCHAT-TOP-18-AUDITORIA-SEGURANCA-LGPD-HARDENING.md`](./concluidos/top/RADARCHAT-TOP-18-AUDITORIA-SEGURANCA-LGPD-HARDENING.md) |
| 19 | [`top/RADARCHAT-TOP-19-QA-FINAL-REGRESSAO-GO-LIVE.md`](./concluidos/top/RADARCHAT-TOP-19-QA-FINAL-REGRESSAO-GO-LIVE.md) |
| 20 | [`top/RADARCHAT-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md`](./concluidos/top/RADARCHAT-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md) |
| 21 | [`top/RADARCHAT-TOP-21-DOCUMENTACAO-FINAL-UNICA-ORGANIZACAO.md`](./concluidos/top/RADARCHAT-TOP-21-DOCUMENTACAO-FINAL-UNICA-ORGANIZACAO.md) — extra pós-TOP20 |

---

## QA e testes

> **O que falta fechar:** [`PENDENCIAS-HUMANAS-FASE1.md`](./PENDENCIAS-HUMANAS-FASE1.md)

### Auditoria geral (2026-06-30 — arquivo)

| Documento | Descrição |
|-----------|-----------|
| [`concluidos/AUDITORIA-GERAL-SISTEMA-RADARCHAT.md`](./concluidos/AUDITORIA-GERAL-SISTEMA-RADARCHAT.md) | Relatório jun/2026 — **substituído** por auditoria 2.17.62 |
| [`concluidos/QA-AUDITORIA-GERAL-SISTEMA.md`](./concluidos/QA-AUDITORIA-GERAL-SISTEMA.md) | Roteiro manual jun/2026 — **Parte H** do checklist completo |
| [`concluidos/PENDENCIAS-E-RISCOS-SISTEMA.md`](./concluidos/PENDENCIAS-E-RISCOS-SISTEMA.md) | Backlog jun/2026 (arquivo) |
| [`concluidos/RADARCHAT-AUDITORIA-GERAL-SEGURANCA-DADOS-ESTABILIDADE-5-ETAPAS-2.17.62.md`](./concluidos/RADARCHAT-AUDITORIA-GERAL-SEGURANCA-DADOS-ESTABILIDADE-5-ETAPAS-2.17.62.md) | **Auditoria atual** — encerrada 2026-07-01 |

| Documento | Descrição |
|-----------|-----------|
| [`RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md`](./RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md) | **Checklist QA humano master** |
| [`RADARCHAT-EXTRAIDOS-LEGACY-2.17.61.md`](./RADARCHAT-EXTRAIDOS-LEGACY-2.17.61.md) | Gates, fallback WA, RadarGamer, CSV — extratos |
| [`legacy/QA-FASE1-ROTEIRO.md`](./legacy/QA-FASE1-ROTEIRO.md) | Roteiro detalhado (legacy) |
| [`legacy/QA-FASE1-CHECKLIST.md`](./legacy/QA-FASE1-CHECKLIST.md) | Checklist imprimível (legacy) |
| [`legacy/QA-FASE1-AUTOMATIZACAO.md`](./legacy/QA-FASE1-AUTOMATIZACAO.md) | Jest/Playwright vs manual (legacy) |
| [`legacy/QA-FASE1-RESULTADO-TEMPLATE.md`](./legacy/QA-FASE1-RESULTADO-TEMPLATE.md) | Template resultado (legacy) |
| [`legacy/QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`](./legacy/QA-WEBCHAT-WA-FALLBACK-BRIDGE.md) | Fallback e bridge detalhado (legacy) |
| [`legacy/QA-WEBCHAT-CHATBOX-MODELS.md`](./legacy/QA-WEBCHAT-CHATBOX-MODELS.md) | Modelos chat box (legacy) |
| [`concluidos/RADARCHAT-QA-HUMANO-RESULTADO-CATALOGO-ENDERECO-PIX-2.17.61-2026-07-01.md`](./concluidos/RADARCHAT-QA-HUMANO-RESULTADO-CATALOGO-ENDERECO-PIX-2.17.61-2026-07-01.md) | Resultado QA automático catálogo — APROVADO COM RESSALVAS |
| [`concluidos/RADARCHAT-AUDITORIA-GERAL-SEGURANCA-DADOS-ESTABILIDADE-5-ETAPAS-2.17.62.md`](./concluidos/RADARCHAT-AUDITORIA-GERAL-SEGURANCA-DADOS-ESTABILIDADE-5-ETAPAS-2.17.62.md) | Auditoria segurança 5 etapas — encerrada |
| [`concluidos/RADARCHAT-POS-SEGURANCA-FECHAMENTO-OPERACIONAL-ROADMAP-2.17.62.md`](./concluidos/RADARCHAT-POS-SEGURANCA-FECHAMENTO-OPERACIONAL-ROADMAP-2.17.62.md) | Pós-segurança — fechamento operacional |

---

## Produção e migração

| Documento | Descrição |
|-----------|-----------|
| [`COOLIFY-DEPLOY.md`](./COOLIFY-DEPLOY.md) | **Deploy produção** (ativo) |
| [`legacy/PREPARACAO-PRODUCAO.md`](./legacy/PREPARACAO-PRODUCAO.md) | Infra/env genérico (legacy) |
| [`legacy/PRODUCTION.md`](./legacy/PRODUCTION.md) | Runbook go-live histórico (legacy) |
| [`legacy/RADARCHAT-V2-MIGRACAO.md`](./legacy/RADARCHAT-V2-MIGRACAO.md) | Migração v1 → v2 (legacy) |

---

## Arquivados e auditorias

| Pasta / doc | Descrição |
|-------------|-----------|
| [`legacy/`](./legacy/README.md) | Docs nota &lt; 8 + escala 1–10 |
| [`concluidos/`](./concluidos/README.md) | Entregas arquivadas (admin, TOP, auditoria horizontal, modos) |
| [`concluidos/top/`](./concluidos/top/) | TOP 01–21 — auditoria e fechamento |
| [`concluidos/RADARCHAT-AUDITORIA-HORIZONTAL-SEGURANCA-ESTABILIDADE.md`](./concluidos/RADARCHAT-AUDITORIA-HORIZONTAL-SEGURANCA-ESTABILIDADE.md) | **Auditoria horizontal** — achados + status 2.12.47–63 |
| [`concluidos/RADARCHAT_AUDITORIA_INCREMENTAL.md`](./concluidos/RADARCHAT_AUDITORIA_INCREMENTAL.md) | Auditoria incremental (arquivo) |
| [`audits/README.md`](./audits/README.md) | Redirect → `concluidos/` |
| [`concluidos/operacao/RUNBOOK-SPOF-MONGO-REDIS.md`](./concluidos/operacao/RUNBOOK-SPOF-MONGO-REDIS.md) | Runbook SPOF Mongo/Redis (AH-S01) |
| [`operacao/README.md`](./operacao/README.md) | Redirect → `concluidos/operacao/` |
| [`security/`](./security/README.md) | Checklist deploy · [`SECURITY.md`](../SECURITY.md) na raiz |
| [`legacy/security/`](./legacy/security/) | Fix plan e recomendações (legacy) |
| [`concluidos/SECURITY_AUDIT.md`](./concluidos/SECURITY_AUDIT.md) | Auditoria OWASP v2.5.1 (arquivo) |

---

## Código ↔ documentação (atalhos)

| Área | Código | Doc |
|------|--------|-----|
| Modos | `src/types/attendance-mode.ts` | Modos consolidado |
| Inbox | `InboxService.ts` | INBOX-ATENDIMENTO |
| WebChat | `WebChatService.ts` | WEBCHAT |
| IA créditos | `AiWalletService.ts` | IA-CREDITOS-E-CARTEIRA |
| Billing | `BillingService.ts` | BILLING |
| RBAC | `src/auth/rbac/` | EQUIPE-RBAC |

---

*Adicionar linha neste índice ao criar qualquer novo `docs/*.md` de módulo ou feature.*
