# RadarZap v2 — registro do sistema

> Espelho versionado de `.cursor/rules/radarzap-v2-system-registry.mdc` (pasta `.cursor/` não vai ao git).

**Versão atual:** `2.1.0` (`package.json`) · **Última revisão doc:** 2026-06-05

Documentação por módulo: `MENU-PAGES-REGISTRY.md`, `INBOX-ATENDIMENTO.md`, `EQUIPE-RBAC.md`, `CONSENTIMENTO-LGPD.md`, `RADARZAP-V2-MIGRACAO.md`, `ROADMAP-COMPLETUDE.md`, `PRODUCTION.md`

---

## Changelog (semver interno)

| Versão | Escopo principal |
|--------|------------------|
| **2.0.0** | Migração limpa do v1; microserviços; painel `/api`; Baileys; campanhas; consentimento LGPD base |
| **2.0.x** | Inbox MVP (triagem, filas, bot, round-robin, WS); segmentos automáticos; tickets; mídia; respostas rápidas |
| **2.1.0** | Setores internos (`internalRank`); papéis custom ilimitados; consentimento 1x/2x; scroll navegador no painel |

**Ao entregar feature nova:** incrementar patch (`2.1.x`) ou minor (`2.2.0`) em `package.json` e adicionar linha nesta tabela.

---

## Arquitetura rápida

| Camada | Onde |
|--------|------|
| Backend | `src/index.ts`, serviços em `src/services/*` |
| API painel + integrações | `src/services/web-dashboard/DashboardService.ts` — base `/api` |
| Auth/RBAC | `src/auth/rbac/*` |
| Frontend painel | `src/services/web-dashboard/frontend/src/` |
| Modelos Mongo | `src/models/*` |
| Tipos compartilhados | `src/types/*` |

---

## Módulos (v2.1)

Ver detalhes em `EQUIPE-RBAC.md`, `INBOX-ATENDIMENTO.md`, `CONSENTIMENTO-LGPD.md`.

| Módulo | Destaques |
|--------|-----------|
| Equipe/RBAC | `customRoles[]`, `roleKey`, preset CUSTOM oculto na UI |
| Inbox | `clientVisible`, `internalRank`, escalação na transferência |
| Consentimento | `consentRenewalApprovals` 0–2, `/contact?consent=waiting` |
| Painel | scroll do navegador; `Layout.tsx` `min-h-screen` |

---

## Modelos / campos recentes

| Modelo | Campo | Desde |
|--------|-------|-------|
| `Organization` | `customRoles[]` | 2.1.0 |
| `CompanyMember` | `customRoleId` | 2.1.0 |
| `InboxDepartment` | `clientVisible`, `internalRank` | 2.1.0 |
| `Destination` | `consentRenewalApprovals` | 2.1.0 |

---

## Protocolo ao criar ou alterar features

1. Implementar backend + frontend nos padrões do projeto
2. Atualizar `MENU-PAGES-REGISTRY.md` se rota/menu/API mudou
3. Atualizar doc do módulo se comportamento de domínio mudou
4. Atualizar **este arquivo** e `.cursor/rules/radarzap-v2-system-registry.mdc`
5. Versionar `package.json` quando fizer sentido
6. **Commit e push** ao concluir a tarefa (não deixar alterações locais sem enviar)
7. **Roadmap/produção:** atualizar `ROADMAP-COMPLETUDE.md` e `PRODUCTION.md` quando feature impactar lacunas ou deploy
8. Nunca commitar `sessions/`, `.env`, credenciais
