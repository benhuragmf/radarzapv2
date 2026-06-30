# Radar Chat v2 — Índice de documentação

**Versão do produto:** `2.13.2` · **Atualizado:** 2026-06-30

### Leitura principal obrigatória

1. [`RADARZAP-SISTEMA-COMPLETO.md`](./RADARZAP-SISTEMA-COMPLETO.md) — documentação mestre
2. [`PENDENCIAS-HUMANAS-FASE1.md`](./PENDENCIAS-HUMANAS-FASE1.md) — **única lista do que falta (QA humano)**
3. [`concluidos/RADARZAP-RESULTADO-FINAL-TOP-01-20.md`](./concluidos/RADARZAP-RESULTADO-FINAL-TOP-01-20.md) — resumo executivo pós-TOP 20
4. [`concluidos/top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md`](./concluidos/top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md) — **fonte oficial** status, checklists e go-live
5. [`QA-FASE1-RESULTADO-TEMPLATE.md`](./QA-FASE1-RESULTADO-TEMPLATE.md) — registrar QA manual A–J

Mapa completo abaixo. Novas entregas: atualizar este índice ([`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md)).

---

## Documentação mestre

| Documento | Descrição |
|-----------|-----------|
| [`RADARZAP-SISTEMA-COMPLETO.md`](./RADARZAP-SISTEMA-COMPLETO.md) | **Entrada principal** — visão consolidada, módulos, gates, TOPs, agente IA |
| [`RADARZAP-RESULTADO-FINAL-TOP-01-20.md`](./concluidos/RADARZAP-RESULTADO-FINAL-TOP-01-20.md) | Resultado final TOP 01–20 — leitura rápida |

---

## Governança e versão

| Documento | Descrição |
|-----------|-----------|
| [`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md) | Protocolo de versionamento e documentação |
| [`CHANGELOG.md`](./CHANGELOG.md) | Changelog append-only |
| [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md) | Registro vivo (espelho versionado) |
| [`design-system/CONFIG-SAVE-FEEDBACK.md`](./design-system/CONFIG-SAVE-FEEDBACK.md) | Padrão botão Salvar + toast Sonner no painel |
| [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md) | Roadmap, gate estabilização |
| [`PENDENCIAS-HUMANAS-FASE1.md`](./PENDENCIAS-HUMANAS-FASE1.md) | **Pendências só humanas** — QA manual + Admin VPS |
| [`concluidos/PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md`](./concluidos/PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md) | Plano consulta → doc → aplicação (arquivo) |
| [`concluidos/RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md`](./concluidos/RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md) | Visão produto / diferenciação (arquivo) |
| [`referencias/REFERENCIAS-MERCADO-UPGRADES.md`](./referencias/REFERENCIAS-MERCADO-UPGRADES.md) | Referências mercado (Conecta360, Nextiva, RadarLeads, VoxCRM) — inspiração upgrades |
| [`RADARZAP-PLANO-UPGRADES.md`](./RADARZAP-PLANO-UPGRADES.md) | **Plano 21 upgrades** — backlog pós-gate Fase 1 |

---

## Layout v3

| Documento | Descrição |
|-----------|-----------|
| [`RADARZAP-LAYOUT-V3-06-FASE-2-MENU-E-NAVEGACAO.md`](./RADARZAP-LAYOUT-V3-06-FASE-2-MENU-E-NAVEGACAO.md) | Fase 2 — menu e navegação |
| [`RADARZAP-LAYOUT-V3-07-FASE-3-HEADER-OPERACIONAL.md`](./RADARZAP-LAYOUT-V3-07-FASE-3-HEADER-OPERACIONAL.md) | Fase 3 — header operacional |
| [`RADARZAP-LAYOUT-V3-08-FASE-4-COMPONENTES-VISUAIS-COMPARTILHADOS.md`](./RADARZAP-LAYOUT-V3-08-FASE-4-COMPONENTES-VISUAIS-COMPARTILHADOS.md) | Fase 4 — componentes visuais compartilhados |
| [`RADARZAP-LAYOUT-V3-09-FASE-4-5-QA-VISUAL-NAVEGAVEL.md`](./RADARZAP-LAYOUT-V3-09-FASE-4-5-QA-VISUAL-NAVEGAVEL.md) | Fase 4.5 — QA visual navegável, marca Radar Chat e domínios |

---

## Módulos (referência por domínio)

| Documento | Descrição |
|-----------|-----------|
| [`INBOX-ATENDIMENTO.md`](./INBOX-ATENDIMENTO.md) | Inbox, triagem, fila, CSAT, supervisor |
| [`MODO-ATENDENTE-DESKTOP.md`](./MODO-ATENDENTE-DESKTOP.md) | PWA, notificações SO e atalhos — posto de atendimento sem app nativo |
| [`TICKET-ATENDIMENTO.md`](./TICKET-ATENDIMENTO.md) | Chamados TK, SLA, token público |
| [`WEBCHAT.md`](./WEBCHAT.md) | Widget, API pública, fila, FAQ |
| [`ONBOARDING-VERTICAL.md`](./ONBOARDING-VERTICAL.md) | Pré-configuração por tipo de comércio (11 verticais) |
| [`LEADS-FORMULARIO.md`](./LEADS-FORMULARIO.md) | Formulários embed e captura |
| [`IA-CREDITOS-E-CARTEIRA.md`](./IA-CREDITOS-E-CARTEIRA.md) | Créditos IA e carteira |
| [`RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`](./RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md) | Modos de atendimento (consolidado) |
| [`EQUIPE-RBAC.md`](./EQUIPE-RBAC.md) | Papéis e capabilities |
| [`CONSENTIMENTO-LGPD.md`](./CONSENTIMENTO-LGPD.md) | Consentimento LGPD |
| [`BILLING.md`](./BILLING.md) | Stripe, planos, limites |
| [`concluidos/admin/RADARZAP-ADMIN-DASHBOARD-OPS.md`](./concluidos/admin/RADARZAP-ADMIN-DASHBOARD-OPS.md) | Dashboard ops global (arquivo) |
| [`concluidos/admin/RADARZAP-ADMIN-DASHBOARD-OPS-API.md`](./concluidos/admin/RADARZAP-ADMIN-DASHBOARD-OPS-API.md) | **API** — contrato REST Admin Ops (arquivo) |
| [`admin/README.md`](./admin/README.md) | Redirect → `concluidos/admin/` |
| [`concluidos/ENTREGA-ADMIN-DASHBOARD-OPS-2.12.37-38.md`](./concluidos/ENTREGA-ADMIN-DASHBOARD-OPS-2.12.37-38.md) | Entrega Etapas 1–3 |
| [`concluidos/ENTREGA-AUDITORIA-HORIZONTAL-2.12.47-59.md`](./concluidos/ENTREGA-AUDITORIA-HORIZONTAL-2.12.47-59.md) | Entrega auditoria 2.12.47–63 |
| [`WEBHOOKS.md`](./WEBHOOKS.md) | Webhooks outbound |
| [`DISCORD-MONITORAMENTO.md`](./DISCORD-MONITORAMENTO.md) | Discord bot, regras, dry-run, multi-regra, auditoria |
| [`RADARCHAT_INTEGRATION_CONTRACT.md`](./RADARCHAT_INTEGRATION_CONTRACT.md) | Integração inbound RadarGamer -> RadarChat |
| [`RADARCHAT_NEXT_PROMPT.md`](./RADARCHAT_NEXT_PROMPT.md) | Prompt de retomada da integração RadarGamer -> RadarChat |
| [`MENU-PAGES-REGISTRY.md`](./MENU-PAGES-REGISTRY.md) | Rotas → componentes → API |
| [`MENUS-SISTEMA.md`](./MENUS-SISTEMA.md) | Menus UX do painel |
| [`CONTATOS-CSV-IMPORTACAO.md`](./CONTATOS-CSV-IMPORTACAO.md) | Import/export contatos |
| [`CONTATOS-CLASSIFICACAO.md`](./CONTATOS-CLASSIFICACAO.md) | Classificação CRM (tipo, LGPD, funil, campanhas) |
| [`DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md) | Tokens `--rz-*`, componentes |

---

## TOPs 01–21 (auditoria e fechamento)

> **Arquivo (2026-06-28):** TOP 01–21 em [`concluidos/top/`](./concluidos/top/) · redirect legado [`top/README.md`](./top/README.md).

| # | Documento |
|---|-----------|
| 01 | [`top/RADARZAP-TOP-01-DIAGNOSTICO-INICIAL.md`](./concluidos/top/RADARZAP-TOP-01-DIAGNOSTICO-INICIAL.md) |
| 02 | [`top/RADARZAP-TOP-02-GOVERNANCA-BASELINE-GATES.md`](./concluidos/top/RADARZAP-TOP-02-GOVERNANCA-BASELINE-GATES.md) |
| 03 | [`top/RADARZAP-TOP-03-PLANOS-MENSALIDADES-LIMITES.md`](./concluidos/top/RADARZAP-TOP-03-PLANOS-MENSALIDADES-LIMITES.md) |
| 04 | [`top/RADARZAP-TOP-04-RBAC-PERMISSOES-EQUIPE-SEGURANCA.md`](./concluidos/top/RADARZAP-TOP-04-RBAC-PERMISSOES-EQUIPE-SEGURANCA.md) |
| 05 | [`top/RADARZAP-TOP-05-STATUS-PRESENCA-FILA.md`](./concluidos/top/RADARZAP-TOP-05-STATUS-PRESENCA-FILA.md) |
| 06 | [`top/RADARZAP-TOP-06-MODOS-ATENDIMENTO.md`](./concluidos/top/RADARZAP-TOP-06-MODOS-ATENDIMENTO.md) |
| 07 | [`top/RADARZAP-TOP-07-INBOX-CONVERSAS-FILA-TRANSFERENCIA.md`](./concluidos/top/RADARZAP-TOP-07-INBOX-CONVERSAS-FILA-TRANSFERENCIA.md) |
| 08 | [`top/RADARZAP-TOP-08-TICKETS-CHAMADOS-TK-RASTREABILIDADE.md`](./concluidos/top/RADARZAP-TOP-08-TICKETS-CHAMADOS-TK-RASTREABILIDADE.md) |
| 09 | [`top/RADARZAP-TOP-09-CONTATOS-LEADS-KANBAN-DEDUPLICACAO.md`](./concluidos/top/RADARZAP-TOP-09-CONTATOS-LEADS-KANBAN-DEDUPLICACAO.md) |
| 10 | [`top/RADARZAP-TOP-10-FORMULARIOS-PUBLICOS-EMBED-CAPTURA-LEADS.md`](./concluidos/top/RADARZAP-TOP-10-FORMULARIOS-PUBLICOS-EMBED-CAPTURA-LEADS.md) |
| 11 | [`top/RADARZAP-TOP-11-WEBCHAT-WIDGET-FALLBACK-EXPERIENCIA.md`](./concluidos/top/RADARZAP-TOP-11-WEBCHAT-WIDGET-FALLBACK-EXPERIENCIA.md) |
| 12 | [`top/RADARZAP-TOP-12-WHATSAPP-SESSAO-QR-RECONEXAO-COMANDOS.md`](./concluidos/top/RADARZAP-TOP-12-WHATSAPP-SESSAO-QR-RECONEXAO-COMANDOS.md) |
| 13 | [`top/RADARZAP-TOP-13-BRIDGE-WEBCHAT-WHATSAPP.md`](./concluidos/top/RADARZAP-TOP-13-BRIDGE-WEBCHAT-WHATSAPP.md) |
| 14 | [`top/RADARZAP-TOP-14-IA-BASICA-TRIAGEM-ENCAMINHAMENTO.md`](./concluidos/top/RADARZAP-TOP-14-IA-BASICA-TRIAGEM-ENCAMINHAMENTO.md) |
| 15 | [`top/RADARZAP-TOP-15-IA-PREMIUM-KB-HANDOFF.md`](./concluidos/top/RADARZAP-TOP-15-IA-PREMIUM-KB-HANDOFF.md) |
| 16 | [`top/RADARZAP-TOP-16-IA-CREDITOS-CARTEIRA-CONSUMO-FALLBACK.md`](./concluidos/top/RADARZAP-TOP-16-IA-CREDITOS-CARTEIRA-CONSUMO-FALLBACK.md) |
| 17 | [`top/RADARZAP-TOP-17-BILLING-ASSINATURAS-LIMITES-BLOQUEIOS.md`](./concluidos/top/RADARZAP-TOP-17-BILLING-ASSINATURAS-LIMITES-BLOQUEIOS.md) |
| 18 | [`top/RADARZAP-TOP-18-AUDITORIA-SEGURANCA-LGPD-HARDENING.md`](./concluidos/top/RADARZAP-TOP-18-AUDITORIA-SEGURANCA-LGPD-HARDENING.md) |
| 19 | [`top/RADARZAP-TOP-19-QA-FINAL-REGRESSAO-GO-LIVE.md`](./concluidos/top/RADARZAP-TOP-19-QA-FINAL-REGRESSAO-GO-LIVE.md) |
| 20 | [`top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md`](./concluidos/top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md) |
| 21 | [`top/RADARZAP-TOP-21-DOCUMENTACAO-FINAL-UNICA-ORGANIZACAO.md`](./concluidos/top/RADARZAP-TOP-21-DOCUMENTACAO-FINAL-UNICA-ORGANIZACAO.md) — extra pós-TOP20 |

---

## QA e testes

> **O que falta fechar:** [`PENDENCIAS-HUMANAS-FASE1.md`](./PENDENCIAS-HUMANAS-FASE1.md)

| Documento | Descrição |
|-----------|-----------|
| [`QA-FASE1-RESULTADO-TEMPLATE.md`](./QA-FASE1-RESULTADO-TEMPLATE.md) | **Template** — inclui § QA Manual TOP 20 |
| [`QA-FASE1-ROTEIRO.md`](./QA-FASE1-ROTEIRO.md) | Roteiro passo a passo |
| [`QA-FASE1-CHECKLIST.md`](./QA-FASE1-CHECKLIST.md) | Checklist imprimível |
| [`QA-FASE1-RAPIDO.md`](./QA-FASE1-RAPIDO.md) | Checklist 1 página |
| [`QA-FASE1-KICKOFF.md`](./QA-FASE1-KICKOFF.md) | Start gate humano |
| [`QA-FASE1-AUTOMATIZACAO.md`](./QA-FASE1-AUTOMATIZACAO.md) | Jest/Playwright vs manual |
| [`QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`](./QA-WEBCHAT-WA-FALLBACK-BRIDGE.md) | Fallback e bridge |
| [`QA-WEBCHAT-CHATBOX-MODELS.md`](./QA-WEBCHAT-CHATBOX-MODELS.md) | Modelos chat box |
| [`RADARZAP-LAYOUT-V3-09-FASE-4-5-QA-VISUAL-NAVEGAVEL.md`](./RADARZAP-LAYOUT-V3-09-FASE-4-5-QA-VISUAL-NAVEGAVEL.md) | QA visual Layout v3 Fase 4.5 |
| [`QA-FASE1-RESULTADO-2026-06-22.md`](./concluidos/QA-FASE1-RESULTADO-2026-06-22.md) | Sessão QA anterior (histórico, arquivo) |

---

## Produção e migração

| Documento | Descrição |
|-----------|-----------|
| [`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md) | Infra, env, deploy |
| [`COOLIFY-DEPLOY.md`](./COOLIFY-DEPLOY.md) | Deploy Coolify — produção ZAP migrada 2.12.71 |
| [`concluidos/ENTREGA-COOLIFY-MIGRACAO-2.12.71.md`](./concluidos/ENTREGA-COOLIFY-MIGRACAO-2.12.71.md) | Entrega migração sslip.io → Coolify |
| [`PREPARACAO-PRODUCAO-EXECUCAO.md`](./PREPARACAO-PRODUCAO-EXECUCAO.md) | Tracker vivo — checklist infra + Coolify |
| [`PRODUCTION.md`](./PRODUCTION.md) | Runbook go-live |
| [`RADARZAP-V2-MIGRACAO.md`](./RADARZAP-V2-MIGRACAO.md) | Migração v1 → v2 |

---

## Arquivados e auditorias

| Pasta / doc | Descrição |
|-------------|-----------|
| [`concluidos/`](./concluidos/README.md) | Entregas arquivadas (admin, TOP, auditoria horizontal, modos) |
| [`concluidos/top/`](./concluidos/top/) | TOP 01–21 — auditoria e fechamento |
| [`concluidos/RADARZAP-AUDITORIA-HORIZONTAL-SEGURANCA-ESTABILIDADE.md`](./concluidos/RADARZAP-AUDITORIA-HORIZONTAL-SEGURANCA-ESTABILIDADE.md) | **Auditoria horizontal** — achados + status 2.12.47–63 |
| [`concluidos/RADARZAP_AUDITORIA_INCREMENTAL.md`](./concluidos/RADARZAP_AUDITORIA_INCREMENTAL.md) | Auditoria incremental (arquivo) |
| [`audits/README.md`](./audits/README.md) | Redirect → `concluidos/` |
| [`concluidos/operacao/RUNBOOK-SPOF-MONGO-REDIS.md`](./concluidos/operacao/RUNBOOK-SPOF-MONGO-REDIS.md) | Runbook SPOF Mongo/Redis (AH-S01) |
| [`operacao/README.md`](./operacao/README.md) | Redirect → `concluidos/operacao/` |
| [`security/`](./security/) | Notas de segurança |

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
