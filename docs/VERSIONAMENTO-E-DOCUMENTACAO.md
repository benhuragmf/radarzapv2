# RadarZap — Versionamento e documentação (.md)

**Versão do protocolo:** 1.0 · **Vigência a partir de:** `2.11.0` (`package.json`) · **Data:** 2026-06-19

A partir desta versão, **toda entrega de código** no RadarZap v2 deve:

1. **Incrementar** `package.json` (`version`).
2. **Registrar** o que foi feito em arquivos **`.md`** (nunca só no chat ou commit).
3. **Atualizar** o espelho versionado [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md) e [`.cursor/rules/radarzap-v2-system-registry.mdc`](../.cursor/rules/radarzap-v2-system-registry.mdc).

---

## Índice

1. [Semver interno](#1-semver-interno)
2. [Checklist por entrega](#2-checklist-por-entrega)
3. [Onde documentar](#3-onde-documentar)
4. [Templates](#4-templates)
5. [Índice de documentos](#5-índice-de-documentos)
6. [Modos de atendimento (módulo ativo)](#6-modos-de-atendimento-módulo-ativo)

---

## 1. Semver interno

Formato: **`MAJOR.MINOR.PATCH`** (ex.: `2.11.0`).

| Incremento | Quando usar | Exemplo |
|------------|-------------|---------|
| **PATCH** `2.11.x` | Fix, polish, doc-only, testes | `2.11.1` fix WebChat |
| **MINOR** `2.x.0` | Feature nova ou conjunto coeso de features | `2.11.0` modos de atendimento Fases 1–4 |
| **MAJOR** `x.0.0` | Breaking change de contrato/API ou migração grande | reservado |

Regras:

- Uma entrega = **uma** linha no [`CHANGELOG.md`](./CHANGELOG.md) + **uma** linha no changelog de [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md).
- `scripts/sync-widget-build.cjs` propaga versão para `WIDGET_BUILD` no build — rodar `npm run build` após bump.
- Não pular versão entre entregas na mesma branch.

---

## 2. Checklist por entrega

Copiar mentalmente (ou na descrição do PR) antes de commitar:

```
[ ] package.json version incrementada
[ ] docs/CHANGELOG.md — nova entrada no topo
[ ] docs/SISTEMA-REGISTRO.md — linha no changelog + campos/modelos se aplicável
[ ] .cursor/rules/radarzap-v2-system-registry.mdc — versão + linha changelog
[ ] Doc de módulo atualizado (ex.: WEBCHAT.md, INBOX-ATENDIMENTO.md)
[ ] docs/MENU-PAGES-REGISTRY.md — se rota/menu/API mudou
[ ] Doc de feature/fase — se escopo grande (ex.: RADARZAP-*-PHASE-N.md)
[ ] Doc consolidado do módulo — se existir (ex.: RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md)
[ ] Testes/build passando
[ ] Commit + push (sem sessions/, .env, credenciais)
```

---

## 3. Onde documentar

| Tipo de mudança | Arquivo principal |
|-----------------|-------------------|
| Qualquer entrega | [`CHANGELOG.md`](./CHANGELOG.md) |
| Registro vivo do produto | [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md) |
| Rotas/menus/API painel | [`MENU-PAGES-REGISTRY.md`](./MENU-PAGES-REGISTRY.md) |
| Inbox/triagem/CSAT/IA WA | [`INBOX-ATENDIMENTO.md`](./INBOX-ATENDIMENTO.md) |
| WebChat/widget | [`WEBCHAT.md`](./WEBCHAT.md) |
| Tickets | [`TICKET-ATENDIMENTO.md`](./TICKET-ATENDIMENTO.md) |
| Modos de atendimento | [`RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`](./RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md) |
| Análise / decisão arquitetural | doc dedicado `docs/ANALISE-*.md` ou seção no consolidado |
| Fase de feature grande | `docs/RADARZAP-*-PHASE-N.md` + atualizar consolidado |
| Roadmap / produção | [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md) |

**Regra:** se não existir doc de módulo, criar **`docs/NOME-MODULO.md`** mínimo (escopo, rotas, modelos, changelog local).

---

## 4. Templates

### Entrada em `CHANGELOG.md`

```markdown
## [2.11.x] — YYYY-MM-DD

### Adicionado
- …

### Alterado
- …

### Corrigido
- …

### Documentação
- …

**Commits:** `abc1234` · **Docs:** `docs/….md`
```

### Novo doc de fase (`RADARZAP-*-PHASE-N.md`)

```markdown
# RadarZap — [Nome] (Fase N)

**Versão:** 2.11.x · **Data:** YYYY-MM-DD
**Consolidado:** [link](./RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md)

## O que foi feito
## O que NÃO foi feito
## Arquivos alterados
## Como testar
## Próxima fase
```

### Atualizar consolidado de módulo

No doc consolidado (ex. modos de atendimento):

1. Atualizar tabela de fases (versão + status).
2. Adicionar seção/arquivo na lista de arquivos.
3. Atualizar **Versão atual** no cabeçalho.

---

## 5. Índice de documentos

Ver [`INDICE-DOCUMENTACAO.md`](./INDICE-DOCUMENTACAO.md) — lista completa e links.

Documentos-chave criados/atualizados no ciclo **Modos de atendimento**:

| Documento | Propósito |
|-----------|-----------|
| [`ANALISE-MODOS-ATENDIMENTO.md`](./ANALISE-MODOS-ATENDIMENTO.md) | Análise pré-implementação (leitura only) |
| [`RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`](./RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md) | **Consolidado** Fases 1–4 |
| [`RADARZAP-ATTENDANCE-MODES-PHASE-1.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-1.md) | Fases 0–2 |
| [`RADARZAP-ATTENDANCE-MODES-PHASE-3.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-3.md) | Persistência `attendanceMode` |
| [`RADARZAP-ATTENDANCE-MODES-PHASE-4.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-4.md) | Robotizado WebChat |
| [`CHANGELOG.md`](./CHANGELOG.md) | Changelog append-only do projeto |
| [`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md) | Este protocolo |

---

## 6. Modos de atendimento (módulo ativo)

**Baseline versionada:** `2.11.0` (Fases 1–4 + governança de docs).

| Fase | Versão | Status | Doc |
|------|--------|--------|-----|
| 0–2 UI + adapter | 2.10.106 | ✅ | PHASE-1 |
| 3 Mongo `attendanceMode` | 2.10.107 | ✅ | PHASE-3 |
| 4 WebChat robotizado | 2.10.108 | ✅ | PHASE-4 |
| 5 IA Básica local-first | 2.11.1 | ✅ | PHASE-5 |
| 6–8 Premium/custos/E2E | — | ⏳ | |

**Próxima entrega esperada:** Fase 5 → bump `2.11.1` ou `2.12.0` conforme escopo; criar `RADARZAP-ATTENDANCE-MODES-PHASE-5.md`; atualizar consolidado + CHANGELOG.

---

*Protocolo mantido pelo time/agente — qualquer exceção deve ser registrada neste arquivo.*
