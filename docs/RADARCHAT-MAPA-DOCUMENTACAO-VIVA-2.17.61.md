# RadarChat — Mapa documentação viva vs arquivo — 2.17.61

**Gerado:** 2026-07-01 · **Versão produto:** `2.17.61` · **Produção:** `app.radarchat.com.br` @ `4a7c690`

Este mapa responde: *qual doc usar hoje* vs *o que é só histórico*.

---

## Fonte da verdade (use estes — nota ≥ 8)

| Necessidade | Documento |
|-------------|-----------|
| Visão geral do sistema | [`RADARCHAT-SISTEMA-COMPLETO.md`](./RADARCHAT-SISTEMA-COMPLETO.md) |
| O que falta (humano) | [`PENDENCIAS-HUMANAS-FASE1.md`](./PENDENCIAS-HUMANAS-FASE1.md) |
| QA humano completo | [`RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md`](./RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md) |
| Extratos de docs secundários | [`RADARCHAT-EXTRAIDOS-LEGACY-2.17.61.md`](./RADARCHAT-EXTRAIDOS-LEGACY-2.17.61.md) |
| Roadmap / gate Fase 1 | [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md) |
| Índice geral | [`INDICE-DOCUMENTACAO.md`](./INDICE-DOCUMENTACAO.md) |
| Escala 1–10 + lista legacy | [`legacy/README.md`](./legacy/README.md) |
| Auditoria segurança (fechada) | [`concluidos/RADARCHAT-AUDITORIA-GERAL-...-2.17.62.md`](./concluidos/RADARCHAT-AUDITORIA-GERAL-SEGURANCA-DADOS-ESTABILIDADE-5-ETAPAS-2.17.62.md) |
| Deploy produção | [`COOLIFY-DEPLOY.md`](./COOLIFY-DEPLOY.md) |
| Módulos (Inbox, WebChat, catálogo…) | `INBOX-ATENDIMENTO.md`, `WEBCHAT.md`, `CATALOGO-PIX-PEDIDOS.md`, etc. |

---

## Três pastas de arquivo

| Pasta | Critério | Exemplo |
|-------|----------|---------|
| **`docs/` raiz** | Nota **≥ 8** — referência ativa | `INBOX-ATENDIMENTO.md` |
| **`legacy/`** | Nota **&lt; 8** — consulta pontual | `QA-FASE1-ROTEIRO.md`, `PREPARACAO-PRODUCAO.md` |
| **`concluidos/`** | Entregas fechadas (deploy, TOP, auditorias) | `RADARCHAT-DEPLOY-*-2.17.61.md` |

---

## Arquivados em `concluidos/` (não usar como guia ativo)

### Auditoria / pendências jun-2026
- `AUDITORIA-GERAL-SISTEMA-RADARCHAT.md` → substituído por auditoria `2.17.62`
- `PENDENCIAS-E-RISCOS-SISTEMA.md` → `PENDENCIAS-HUMANAS-FASE1.md`
- `QA-AUDITORIA-GERAL-SISTEMA.md` → Parte H do checklist completo

### QA Fase 1 (redundantes)
- `QA-FASE1-KICKOFF.md`, `QA-FASE1-RAPIDO.md` → checklist completo

### Infra / layout
- `PREPARACAO-PRODUCAO-EXECUCAO.md` → tracker migração Coolify @ `2.12.71`
- `RADARCHAT-LAYOUT-V3-01`…`08` → planejamento/entregas layout
- `RADARCHAT-UX-VISUAL-01`…`03` → diagnóstico pré-layout
- `RADARCHAT_NEXT_PROMPT.md` → sessão Codex

---

## Movidos para `legacy/` (2026-07-01)

QA complementar, templates, runbooks pré-go-live, migração v1, Discord, CSV detalhado, contrato RadarGamer (extratos no consolidado).

Ver tabela completa com notas 1–10: [`legacy/README.md`](./legacy/README.md).

---

## Árvore resumida

```
docs/
├── VIVO (nota ≥ 8)
│   ├── PENDENCIAS-HUMANAS-FASE1.md
│   ├── RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md
│   ├── RADARCHAT-EXTRAIDOS-LEGACY-2.17.61.md
│   ├── RADARCHAT-SISTEMA-COMPLETO.md
│   └── INBOX, WEBCHAT, CATALOGO, COOLIFY-DEPLOY, …
├── legacy/          ← nota < 8 (QA detalhe, PREPARACAO, PRODUCTION, …)
├── concluidos/      ← entregas e TOPs fechados
└── security/        ← SECURITY_CHECKLIST ativo; fix plan em legacy/
```
