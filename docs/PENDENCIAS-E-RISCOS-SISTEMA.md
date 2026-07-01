# Pendências e riscos — Radar Chat

**Atualizado:** 2026-06-30 · **Ciclo:** `audit-system-health-docs` · **Versão ref.:** `2.17.26`  
**Fonte:** [`AUDITORIA-GERAL-SISTEMA-RADARCHAT.md`](./AUDITORIA-GERAL-SISTEMA-RADARCHAT.md)

Legenda: **P** prioridade (P0 bloqueia go-live declarado · P1 alto · P2 médio · P3 baixo) · **C** complexidade (S/M/L)

---

## Segurança

| ID | Pendência | P | Impacto | C | Ciclo sugerido | Recomendação |
|----|-----------|---|---------|---|----------------|--------------|
| SEC-01 | Socket.IO visitante WebChat sem validação de origem | ~~P1~~ ✅ 2.17.28 | Hijack de sala com token vazado | M | `hardening-webchat-socket` | `assertVisitorSocketOrigin` no handshake `wcv_*` |
| SEC-02 | `GET /sessions?scope=all` cross-tenant para staff | ~~P1~~ ✅ 2.17.28 | Exposição QR/telefone outras empresas | S | `admin-sessions-scope` | `DASHBOARD_GLOBAL` + mascaramento QR/telefone/avatar |
| SEC-03 | RadarGamer token global único | ~~P1~~ ✅ 2.17.28 | Abuso envio WA se vazar Bearer | M | `integrations-per-tenant` | `X-API-Key` por org; Bearer legado |
| SEC-04 | CSRF: Origin ausente passa em mutações | ~~P1~~ ✅ 2.17.28 | Ataque cross-site com cookie ativo | M | `csrf-hardening` | `Sec-Fetch-Site` / `Referer` válido ou bloqueio |
| SEC-05 | Token WebChat em query `?v=` | P2 | Vazamento em logs/Referer | S | `webchat-token-header-only` | Rejeitar query em produção |
| SEC-06 | Logs globais staff sem tenant default | P2 | Vazamento operacional cross-tenant | S | `logs-tenant-default` | Opt-in explícito `scope=global` |
| SEC-07 | Rate limit inbound integrations no mount | P2 | DoS / abuso API | S | `rate-limit-inbound` | Limiter Express por IP + key |
| SEC-08 | Ticket lookup rate limit in-memory | P2 | Brute-force TK em cluster | M | `ticket-rate-redis` | Redis TTL como RadarGamer idempotency |
| SEC-09 | Body JSON 16 MB global | P2 | DoS memória | S | `body-limit-per-route` | Limites por rota |
| SEC-10 | Template global editável (edge IDOR) | P2 | Alteração template sistema | S | `template-fork-tenant` | Fork obrigatório para tenant |

---

## Estabilidade

| ID | Pendência | P | Impacto | C | Ciclo sugerido | Recomendação |
|----|-----------|---|---------|---|----------------|--------------|
| STAB-01 | 6 suites Jest integração falhando | P1 | CI/ gate incompleto | M | `fix-integration-tests` | **Corrigido** 2.17.27 — 188/188 suites |
| STAB-02 | Testes Vitest sem runner no monorepo root | P2 | Cobertura utils frontend | S | `vitest-setup` | `npm run test:unit` com Vitest ou migrar para Jest |
| STAB-03 | Presença atendentes in-memory | P2 | Fila errada multi-réplica | L | `presence-redis-cluster` | Estado presença em Redis pub/sub |
| STAB-04 | `forceExit: true` no Jest mascara handles | P3 | Flaky tests | S | `jest-open-handles` | `--detectOpenHandles` em CI |

---

## Dados

| ID | Pendência | P | Impacto | C | Ciclo sugerido | Recomendação |
|----|-----------|---|---------|---|----------------|--------------|
| DATA-01 | WebChat sem telefone: CRM incompleto | P2 | Lead/contato ausente | M | `webchat-anonymous-crm` | Política explícita + UI “completar cadastro” |
| DATA-02 | Modo `lead` / `inbox_only` confunde Contatos | P2 | Funcionário não acha cliente | S | `crm-ux-clarify` | Badge + doc operacional |
| DATA-03 | `InboxTransfer.toUserId` não preenchido | P3 | Relatório transferência incompleto | S | `transfer-audit-fields` | Preencher em transferência direta futura |
| DATA-04 | `models/index.ts` subset legado | P3 | Confusão imports | S | `models-index-refresh` | Exportar modelos atuais ou doc “import direto” |

---

## Produto / UX

| ID | Pendência | P | Impacto | C | Ciclo sugerido | Recomendação |
|----|-----------|---|---------|---|----------------|--------------|
| UX-01 | QA manual Fase 1 não preenchido | P0* | Go-live sem evidência | M | humano | [`QA-AUDITORIA-GERAL-SISTEMA.md`](./QA-AUDITORIA-GERAL-SISTEMA.md) |
| UX-02 | OCR comprovante PIX inexistente | P2 | Conferência 100% manual | L | `pix-ocr-optional` | IA visão opcional pós-aprovação humana |
| UX-03 | Anti-spam WebChat básico (sem CAPTCHA) | P2 | Abuso widget público | M | `webchat-abuse` | Rate limit IP + honeypot widget |
| UX-04 | `requireHumanApproval` flag não usada no backend | P3 | Confusão config | S | `catalog-flag-cleanup` | Implementar ou remover da UI |

*P0 operacional conforme `ROADMAP-COMPLETUDE.md` gate estabilização.

---

## Documentação

| ID | Pendência | P | Impacto | C | Recomendação |
|----|-----------|---|---------|---|--------------|
| DOC-01 | `SISTEMA-REGISTRO.md` defasado (2.17.22) | P2 | Agente/desenvolvedor desorientado | **Corrigido** neste ciclo → 2.17.26 |
| DOC-02 | `INDICE-DOCUMENTACAO.md` versão 2.13.2 no header | P2 | Índice desatualizado | **Corrigido** neste ciclo |
| DOC-03 | Backup cron headless precisa rota sem sessão | P3 | Cron VPS frágil | Documentar ou mover rota ingest |

---

## Deploy / Operação

| ID | Pendência | P | Impacto | C | Recomendação |
|----|-----------|---|---------|---|--------------|
| OPS-01 | Validar backup automático só na VPS | P2 | Falso positivo em dev | Banner `automationAvailable` (2.17.25) |
| OPS-02 | Reconectar WA produção pós-deploy | P1 | Atendimento parado | Runbook `/sessions` |
| OPS-03 | Cloud API Meta stub | P2 | Fase 2 produto | `ROADMAP-COMPLETUDE.md` |

---

## O que **não** mudar (contratos legados)

- Variáveis `RADARZAP_*` ainda referenciadas em compose/scripts  
- Header `X-RadarZap-Signature` / outbound `X-Radar Chat-Signature`  
- Volumes Docker `radarzap-*`  
- Tokens CSS `--rz-*`  
- Renomear sem migração coordenada

---

## Priorização sugerida (próximos 3 ciclos)

1. **P0 humano:** QA manual + corrigir 6 suites Jest  
2. **P1 segurança:** ~~SEC-01, SEC-02, SEC-04~~ ✅ 2.17.28
3. **P1 integrações:** ~~SEC-03~~ ✅ 2.17.28 · SEC-07 pendente

---

## Histórico de mitigação recente

| Versão | Mitigação |
|--------|-----------|
| 2.17.26 | Jest/Vitest split; backup token timing-safe; `ensureClientReady` fast-path; docs auditoria |
| 2.17.25 | WA logout 401 blocklist; Redis pub/sub errors; backup dev banner |
| 2.17.24 | Inbox mensagens painel; anti-loop WA; cadeado bloqueios header |
| 2.12.47–59 | Auditoria horizontal AH-R01…AH-D04 (tenant stats, BullMQ, embed fail-closed) |
