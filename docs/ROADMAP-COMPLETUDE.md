# RadarZap v2 — completude do sistema e roadmap

> Análise consolidada do estado atual (v2.1.0), lacunas e prioridades de evolução.  
> Produção: `PRODUCTION.md` · Registro técnico: `SISTEMA-REGISTRO.md`

**Última revisão:** 2026-06-05

---

## Resumo executivo

O RadarZap v2 **já é operável** para uso diário: Inbox WhatsApp, consentimento LGPD, campanhas, equipe com RBAC, integrações API (parcial), Discord → WA e painel completo.  
Ainda **não está fechado** para produção comercial em escala: faltam webhooks outbound, deploy/CI documentado, billing, e-mail de convite, polish mobile e Cloud API Meta.

---

## O que já está sólido (v2.1)

| Área | Status | Referência |
|------|--------|------------|
| **Inbox WhatsApp** | Triagem, filas, setores público/interno, round-robin, supervisor, tickets, respostas rápidas, bot, relatórios, WebSocket | `INBOX-ATENDIMENTO.md` |
| **Contatos + LGPD** | CRUD, segmentos, consentimento 1x/2x, Aguardando aprovação | `CONSENTIMENTO-LGPD.md` |
| **Equipe / RBAC** | Papéis sistema + custom ilimitados, permissões por aba | `EQUIPE-RBAC.md` |
| **Envios** | Enviar agora, agendado, campanhas, fila, modelos | `/send`, `/platform/campanhas` |
| **WhatsApp (Baileys)** | Sessões, QR, status, logs, reconexão | `/sessions`, `/platform/wa-status` |
| **Discord → WA** | Canais, regras, templates, fila | aba Discord |
| **Integrações API** | Chaves, OpenAPI, playground, rate limit (UI) | `/settings#api-*` |
| **Painel** | Menus preenchidos, scroll navegador, notificações tempo real | `MENU-PAGES-REGISTRY.md` |

---

## Lacunas principais (o que falta para “completar”)

| # | Lacuna | Evidência no código |
|---|--------|---------------------|
| 1 | **Webhooks sem disparo real** | `WebhookEndpoint` + CRUD; sem `WebhookDispatcher` / `fetch` nos eventos |
| 2 | **Deploy / CI** | Sem GitHub Actions; dev = `npm run dev` + Vite; Docker = microserviços legados |
| 3 | **Convite de equipe** | Membro por e-mail; sem SMTP/Resend |
| 4 | **Billing / pagamentos** | Planos na UI; `/admin/payments` é stub |
| 5 | **Admin operacional** | Moderação, API global, backup admin = páginas informativas |
| 6 | **Backup tenant** | Só export CSV; sem restore completo da org |
| 7 | **Inbox fase operacional** | `/enc`, `closed` automático, CSAT, SLA alertas incompletos |
| 8 | **WhatsApp Cloud API** | Só Baileys; Enterprise Meta não implementado |
| 9 | **Mobile** | Sidebar empilha; sem hamburger; Inbox desktop-first |
| 10 | **Testes** | Bons unitários em utils; pouco em Inbox, consentimento, integrações |

---

## Top 10 atualizações recomendadas (prioridade 1 → 10)

### 1. Motor de webhooks outbound

**O quê:** `WebhookDispatcher` com HMAC, retry, log de entrega; eventos `campaign.*`, `session.*`, `consent.updated` + **`inbox.*`**.

**Por quê:** integração API prometida fica incompleta sem entrega HTTP.

**Esforço:** médio · **Versão alvo:** 2.2.0

---

### 2. Deploy produção + CI/CD

**O quê:** stack documentada (app + painel + Mongo + Redis), GitHub Actions (build, test, deploy), secrets, HTTPS.

**Por quê:** bloqueia ir a produção com confiança.

**Esforço:** médio–alto · Ver `PRODUCTION.md`

---

### 3. Inbox — inatividade, encerramento e SLA

**O quê:** automatizar `/enc`, timeout no bot, conversas `closed` por inatividade, alertas de fila parada.

**Por quê:** operação de call center real exige isso.

**Esforço:** médio · **Versão alvo:** 2.2.x

---

### 4. Convite de equipe por e-mail

**O quê:** e-mail “convidado para {empresa}” + link; status “aguardando login” já existe na UI.

**Por quê:** onboarding manual hoje.

**Esforço:** baixo–médio · Requer SMTP/Resend em produção

---

### 5. Painel mobile

**O quê:** menu hamburger, Inbox em abas (lista ↔ chat), touch-friendly.

**Por quê:** atendentes usam celular.

**Esforço:** médio

---

### 6. Billing / assinatura (Stripe ou Asaas)

**O quê:** checkout, fatura, bloqueio por plano, webhook de pagamento → `Organization.plan`.

**Por quê:** monetização ainda placeholder.

**Esforço:** alto

---

### 7. Camada WhatsApp Cloud API (Meta)

**O quê:** `WhatsAppChannelProvider` — Baileys hoje / Cloud API amanhã; mesmo contrato REST interno.

**Por quê:** Enterprise e estabilidade oficial.

**Esforço:** alto · Fase 5 em `INBOX-ATENDIMENTO.md`

---

### 8. Backup e restore completo do tenant

**O quê:** export/import JSON (contatos, setores, papéis, automações, Inbox); UI em `/settings/backup`.

**Por quê:** disaster recovery e migração.

**Esforço:** médio

---

### 9. Testes integração + E2E críticos

**O quê:** supertest consentimento 1x/2x/3x, transferência `internalRank`, convite; Playwright Inbox.

**Por quê:** módulos 2.1 com pouca cobertura.

**Esforço:** médio

---

### 10. Admin operacional e observabilidade

**O quê:** métricas reais, moderação com UI, alertas Slack/e-mail quando sessão cai.

**Por quê:** `MetricsCollector` e admin com TODOs.

**Esforço:** médio

---

## Mapa esforço × impacto

```
Alto impacto + relativamente rápido  →  1 Webhooks, 4 E-mail equipe
Alto impacto + mais tempo            →  2 Deploy, 3 Inbox SLA, 6 Billing, 7 Cloud API
Qualidade / escala                   →  8 Backup, 9 Testes, 10 Admin ops
UX                                   →  5 Mobile
```

---

## Páginas / módulos ainda “finos” (não bloqueiam MVP)

| Rota | Situação atual |
|------|----------------|
| `/settings/permissions` | Lista estática de papéis; redireciona para `/settings/team` |
| `/settings/security` | Reusa painel de chaves API |
| `/settings/backup` | Só CSV de contatos |
| `/admin/payments` | Stub com links |
| `/admin/moderation` | Stub com links |
| `/admin/api` | Stub com links |

---

## Como usar este documento

1. Escolher item do Top 10 → implementar → atualizar changelog em `SISTEMA-REGISTRO.md`
2. Se envolver deploy, secrets ou infra → atualizar `PRODUCTION.md`
3. Commit + push ao concluir cada entrega

*Espelho para agentes: `.cursor/rules/production-roadmap-mindset.mdc`*
