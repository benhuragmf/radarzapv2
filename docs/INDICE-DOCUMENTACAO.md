# RadarZap v2 — Índice de documentação

**Versão do produto:** `2.12.6` · **Atualizado:** 2026-06-24

### Leitura principal obrigatória

1. [`RADARZAP-SISTEMA-COMPLETO.md`](./RADARZAP-SISTEMA-COMPLETO.md) — documentação mestre
2. [`RADARZAP-RESULTADO-FINAL-TOP-01-20.md`](./RADARZAP-RESULTADO-FINAL-TOP-01-20.md) — resumo executivo pós-TOP 20
3. [`top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md`](./top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md) — **fonte oficial** status, checklists e go-live
4. [`QA-FASE1-RESULTADO-TEMPLATE.md`](./QA-FASE1-RESULTADO-TEMPLATE.md) — registrar QA manual A–J

Mapa completo abaixo. Novas entregas: atualizar este índice ([`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md)).

---

## Documentação mestre

| Documento | Descrição |
|-----------|-----------|
| [`RADARZAP-SISTEMA-COMPLETO.md`](./RADARZAP-SISTEMA-COMPLETO.md) | **Entrada principal** — visão consolidada, módulos, gates, TOPs, agente IA |
| [`RADARZAP-RESULTADO-FINAL-TOP-01-20.md`](./RADARZAP-RESULTADO-FINAL-TOP-01-20.md) | Resultado final TOP 01–20 — leitura rápida |

---

## Governança e versão

| Documento | Descrição |
|-----------|-----------|
| [`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md) | Protocolo de versionamento e documentação |
| [`CHANGELOG.md`](./CHANGELOG.md) | Changelog append-only |
| [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md) | Registro vivo (espelho versionado) |
| [`design-system/CONFIG-SAVE-FEEDBACK.md`](./design-system/CONFIG-SAVE-FEEDBACK.md) | Padrão botão Salvar + toast Sonner no painel |
| [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md) | Roadmap, gate estabilização |
| [`PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md`](./PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md) | Plano consulta → doc → aplicação |
| [`RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md`](./RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md) | Visão produto / diferenciação |
| [`referencias/REFERENCIAS-MERCADO-UPGRADES.md`](./referencias/REFERENCIAS-MERCADO-UPGRADES.md) | Referências mercado (Conecta360, Nextiva, RadarLeads, VoxCRM) — inspiração upgrades |
| [`RADARZAP-PLANO-UPGRADES.md`](./RADARZAP-PLANO-UPGRADES.md) | **Plano 21 upgrades** — principais, intermediários, baixa, opcionais (checklists completos) |

---

## Módulos (referência por domínio)

| Documento | Descrição |
|-----------|-----------|
| [`INBOX-ATENDIMENTO.md`](./INBOX-ATENDIMENTO.md) | Inbox, triagem, fila, CSAT, supervisor |
| [`TICKET-ATENDIMENTO.md`](./TICKET-ATENDIMENTO.md) | Chamados TK, SLA, token público |
| [`WEBCHAT.md`](./WEBCHAT.md) | Widget, API pública, fila, FAQ |
| [`LEADS-FORMULARIO.md`](./LEADS-FORMULARIO.md) | Formulários embed e captura |
| [`IA-CREDITOS-E-CARTEIRA.md`](./IA-CREDITOS-E-CARTEIRA.md) | Créditos IA e carteira |
| [`RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`](./RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md) | Modos de atendimento (consolidado) |
| [`EQUIPE-RBAC.md`](./EQUIPE-RBAC.md) | Papéis e capabilities |
| [`CONSENTIMENTO-LGPD.md`](./CONSENTIMENTO-LGPD.md) | Consentimento LGPD |
| [`BILLING.md`](./BILLING.md) | Stripe, planos, limites |
| [`WEBHOOKS.md`](./WEBHOOKS.md) | Webhooks outbound |
| [`MENU-PAGES-REGISTRY.md`](./MENU-PAGES-REGISTRY.md) | Rotas → componentes → API |
| [`MENUS-SISTEMA.md`](./MENUS-SISTEMA.md) | Menus UX do painel |
| [`CONTATOS-CSV-IMPORTACAO.md`](./CONTATOS-CSV-IMPORTACAO.md) | Import/export contatos |
| [`CONTATOS-CLASSIFICACAO.md`](./CONTATOS-CLASSIFICACAO.md) | Classificação CRM (tipo, LGPD, funil, campanhas) |
| [`DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md) | Tokens `--rz-*`, componentes |

---

## TOPs 01–21 (auditoria e fechamento)

> **Regra:** arquivos `docs/top/RADARZAP-TOP-NN-*.md` são histórico de auditoria — **não remover nem mover** sem autorização Benhur. Ver [`top/RADARZAP-TOP-21-DOCUMENTACAO-FINAL-UNICA-ORGANIZACAO.md`](./top/RADARZAP-TOP-21-DOCUMENTACAO-FINAL-UNICA-ORGANIZACAO.md) § Preservação.

| # | Documento |
|---|-----------|
| 01 | [`top/RADARZAP-TOP-01-DIAGNOSTICO-INICIAL.md`](./top/RADARZAP-TOP-01-DIAGNOSTICO-INICIAL.md) |
| 02 | [`top/RADARZAP-TOP-02-GOVERNANCA-BASELINE-GATES.md`](./top/RADARZAP-TOP-02-GOVERNANCA-BASELINE-GATES.md) |
| 03 | [`top/RADARZAP-TOP-03-PLANOS-MENSALIDADES-LIMITES.md`](./top/RADARZAP-TOP-03-PLANOS-MENSALIDADES-LIMITES.md) |
| 04 | [`top/RADARZAP-TOP-04-RBAC-PERMISSOES-EQUIPE-SEGURANCA.md`](./top/RADARZAP-TOP-04-RBAC-PERMISSOES-EQUIPE-SEGURANCA.md) |
| 05 | [`top/RADARZAP-TOP-05-STATUS-PRESENCA-FILA.md`](./top/RADARZAP-TOP-05-STATUS-PRESENCA-FILA.md) |
| 06 | [`top/RADARZAP-TOP-06-MODOS-ATENDIMENTO.md`](./top/RADARZAP-TOP-06-MODOS-ATENDIMENTO.md) |
| 07 | [`top/RADARZAP-TOP-07-INBOX-CONVERSAS-FILA-TRANSFERENCIA.md`](./top/RADARZAP-TOP-07-INBOX-CONVERSAS-FILA-TRANSFERENCIA.md) |
| 08 | [`top/RADARZAP-TOP-08-TICKETS-CHAMADOS-TK-RASTREABILIDADE.md`](./top/RADARZAP-TOP-08-TICKETS-CHAMADOS-TK-RASTREABILIDADE.md) |
| 09 | [`top/RADARZAP-TOP-09-CONTATOS-LEADS-KANBAN-DEDUPLICACAO.md`](./top/RADARZAP-TOP-09-CONTATOS-LEADS-KANBAN-DEDUPLICACAO.md) |
| 10 | [`top/RADARZAP-TOP-10-FORMULARIOS-PUBLICOS-EMBED-CAPTURA-LEADS.md`](./top/RADARZAP-TOP-10-FORMULARIOS-PUBLICOS-EMBED-CAPTURA-LEADS.md) |
| 11 | [`top/RADARZAP-TOP-11-WEBCHAT-WIDGET-FALLBACK-EXPERIENCIA.md`](./top/RADARZAP-TOP-11-WEBCHAT-WIDGET-FALLBACK-EXPERIENCIA.md) |
| 12 | [`top/RADARZAP-TOP-12-WHATSAPP-SESSAO-QR-RECONEXAO-COMANDOS.md`](./top/RADARZAP-TOP-12-WHATSAPP-SESSAO-QR-RECONEXAO-COMANDOS.md) |
| 13 | [`top/RADARZAP-TOP-13-BRIDGE-WEBCHAT-WHATSAPP.md`](./top/RADARZAP-TOP-13-BRIDGE-WEBCHAT-WHATSAPP.md) |
| 14 | [`top/RADARZAP-TOP-14-IA-BASICA-TRIAGEM-ENCAMINHAMENTO.md`](./top/RADARZAP-TOP-14-IA-BASICA-TRIAGEM-ENCAMINHAMENTO.md) |
| 15 | [`top/RADARZAP-TOP-15-IA-PREMIUM-KB-HANDOFF.md`](./top/RADARZAP-TOP-15-IA-PREMIUM-KB-HANDOFF.md) |
| 16 | [`top/RADARZAP-TOP-16-IA-CREDITOS-CARTEIRA-CONSUMO-FALLBACK.md`](./top/RADARZAP-TOP-16-IA-CREDITOS-CARTEIRA-CONSUMO-FALLBACK.md) |
| 17 | [`top/RADARZAP-TOP-17-BILLING-ASSINATURAS-LIMITES-BLOQUEIOS.md`](./top/RADARZAP-TOP-17-BILLING-ASSINATURAS-LIMITES-BLOQUEIOS.md) |
| 18 | [`top/RADARZAP-TOP-18-AUDITORIA-SEGURANCA-LGPD-HARDENING.md`](./top/RADARZAP-TOP-18-AUDITORIA-SEGURANCA-LGPD-HARDENING.md) |
| 19 | [`top/RADARZAP-TOP-19-QA-FINAL-REGRESSAO-GO-LIVE.md`](./top/RADARZAP-TOP-19-QA-FINAL-REGRESSAO-GO-LIVE.md) |
| 20 | [`top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md`](./top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md) |
| 21 | [`top/RADARZAP-TOP-21-DOCUMENTACAO-FINAL-UNICA-ORGANIZACAO.md`](./top/RADARZAP-TOP-21-DOCUMENTACAO-FINAL-UNICA-ORGANIZACAO.md) — extra pós-TOP20 |

---

## QA e testes

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
| [`QA-FASE1-RESULTADO-2026-06-22.md`](./QA-FASE1-RESULTADO-2026-06-22.md) | Sessão QA anterior (histórico) |

---

## Produção e migração

| Documento | Descrição |
|-----------|-----------|
| [`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md) | Infra, env, deploy |
| [`PRODUCTION.md`](./PRODUCTION.md) | Runbook go-live |
| [`RADARZAP-V2-MIGRACAO.md`](./RADARZAP-V2-MIGRACAO.md) | Migração v1 → v2 |

---

## Arquivados e auditorias

| Pasta / doc | Descrição |
|-------------|-----------|
| [`concluidos/`](./concluidos/README.md) | Entregas e fases arquivadas |
| [`audits/`](./audits/) | Auditorias incrementais |
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
