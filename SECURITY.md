# Política de segurança — RadarZap

## Reportar vulnerabilidades

Envie relatos **privados** para o mantenedor do projeto (Benhur Augusto Gomes Monteiro Faria).  
**Não** abra issues públicas com detalhes de exploit antes da correção.

Inclua:
- Descrição do impacto
- Passos para reproduzir (sem dados reais de clientes)
- Versão/commit afetado
- Sugestão de mitigação, se houver

## Escopo

- Backend monolito (`DashboardService`, serviços em `src/services/`)
- Painel React (`src/services/web-dashboard/frontend/`)
- Integrações: Discord, WhatsApp (Baileys), Stripe, webhooks outbound
- Infra: Docker, GitHub Actions, MongoDB, Redis

## O que esperamos

- Correção priorizada por severidade (ver `SECURITY_FIX_PLAN.md`)
- Divulgação coordenada após patch
- Sem engenharia reversa agressiva nem testes em produção sem autorização

## Documentação relacionada

| Arquivo | Conteúdo |
|---------|----------|
| [SECURITY_AUDIT.md](SECURITY_AUDIT.md) | Auditoria completa |
| [SECURITY_FIX_PLAN.md](SECURITY_FIX_PLAN.md) | Plano de correção |
| [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) | Checklist operacional |
| [SECURITY_RECOMMENDATIONS.md](SECURITY_RECOMMENDATIONS.md) | Melhorias futuras |
| [docs/security/README.md](docs/security/README.md) | Boas práticas do time |

## Versão auditada

`2.5.1` — junho 2026
