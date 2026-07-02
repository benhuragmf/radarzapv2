# Radar Chat Layout v3 04 — Checklist QA Visual e Funcional

> **Arquivo — pré-implementação.** Substituído por [`RADARCHAT-LAYOUT-V3-09-FASE-4-5-QA-VISUAL-NAVEGAVEL.md`](../RADARCHAT-LAYOUT-V3-09-FASE-4-5-QA-VISUAL-NAVEGAVEL.md).

## 1. Objetivo

Criar checklist obrigatório para validar cada fase visual sem quebrar o Radar Chat. Este documento orienta QA local, por perfil, módulo, viewport e estado extremo. Ele não substitui testes automatizados nem prova funcionamento real sem execução/evidência.

## 2. Ambientes permitidos

| Ambiente | Regra |
|----------|-------|
| Local | Permitido para leitura, build, testes e screenshots quando seguro |
| Branch | Usar `layout-v3` |
| Produção | Não acessar nesta fase visual/documental |
| Banco remoto | Não acessar |
| `.env` sensível | Não abrir, imprimir ou depender dele |
| Dados reais | Não usar |
| Mocks/configs | Podem orientar inspeção, mas não provam funcionamento real |

## 3. Comandos seguros

Scripts encontrados em `package.json`. A execução deve ser decidida por fase, risco e dependências locais.

| Comando | Script encontrado | Uso | Observação |
|---------|-------------------|-----|------------|
| `git status --short --branch` | Git | Leitura | Seguro e recomendado antes/depois |
| `git log --oneline -5 --decorate` | Git | Leitura | Seguro para base |
| `rg`, `Get-Content`, `Get-ChildItem` | Sistema | Leitura | Seguro para inventário |
| `npm run lint` | `eslint src/services/inbox/ticket-token-resend-otp.ts ...` | Lint parcial | Escopo limitado, não cobre visual |
| `npm run lint:all` | `eslint src/**/*.ts` | Lint backend TS | Pode ser mais amplo que etapa visual |
| `npm run typecheck` | `tsc --noEmit` | Typecheck backend/projeto | Rodar quando houver código |
| `npm test` / `npm run test` | `jest` | Testes unit/integration | Pode depender de setup local |
| `npm run build` | `tsc && tsc-alias && node scripts/copy-dashboard-static.cjs` | Build backend/static | Pode gerar artefatos |
| `npm run dashboard:frontend` | `npm run dev --prefix src/services/web-dashboard/frontend` | Dev server frontend | Exige processo local |
| `npm run dashboard` | `ts-node -r tsconfig-paths/register start-dashboard.ts` | Dashboard backend | Exige runtime/env local |
| `npm run dev` | `ts-node-dev ... src/index.ts` | Dev backend | Exige env e serviços locais |
| `npm run test:e2e` | `playwright test` | E2E geral | Exige browser/servidor |
| `npm run qa:prep` | `scripts/qa-prep.ts` | Preparação QA | Usa dotenv; revisar antes |
| `npm run qa:atendimento:gate` | Jest atendimento + `qa:webchat-wa` | Gate atendimento | Amplo; não rodar em doc-only sem necessidade |
| `npm run qa:fase1:e2e` | Build frontend + Playwright specs | E2E fase 1 | Pode gerar artefatos e exigir app |
| `npm run qa:fase1:all` | E2E + gate manual start | Gate amplo | Só com autorização/ambiente pronto |
| `npm run qa:release-gate` | `node scripts/qa-release-gate.mjs` | Release gate | Não é necessário para inventário documental |
| `npm run pre-push:gate` | `node scripts/pre-push-deploy-gate.mjs` | Gate pré-push | Usar antes de push real |

## 4. QA por perfil

| Perfil | Checklist |
|--------|-----------|
| OWNER | Vê dashboard, atendimento, leads, contatos, IA, plano, equipe, permissões, segurança e backup; não vê Admin SaaS se não for staff |
| ADMIN | Vê operação e configurações permitidas; não altera billing global; consegue gerir equipe se cap tiver |
| MANAGER | Vê supervisão, relatórios, Inbox, leads permitidos; não vê gestão de sessão WA se cap não tiver |
| ATTENDANT | Vê Inbox, contatos necessários, status próprio e ações de atendimento; não vê billing, API, backup, Admin SaaS ou permissões indevidas |
| Custom role | Menu e rotas seguem capabilities específicas; sem fallback visual que exponha ação indevida |
| Admin SaaS/staff | Vê aba Admin; distingue global de tenant; não confunde fila global com fila de atendimento |

## 5. QA por módulo

| Módulo | Checklist mínimo |
|--------|------------------|
| Login | Erros legíveis; branding Radar Chat; não usar linguagem interna demais |
| Empresa/workspace | Troca de organização clara; contexto atual visível |
| Dashboard | KPIs carregam; estados vazio/loading/erro; dono entende próximo passo |
| Sidebar | Itens filtrados por perfil; grupos não sobrepõem; mobile abre/fecha |
| Header | Título, empresa, sino, presença, tema, perfil, WA e IA cabem em 1366px |
| Inbox | Lista, filtros, chat, composer, detalhes, ações e `?conv=` preservados |
| Supervisor | Fila, equipe, redistribuição, drawer/monitor e status `supervisor_online` claros |
| Tickets | Lista, detalhe `:ref`, SLA, status, comentários e atualização ao cliente |
| WebChat | Chats, widgets, preview, instalação, horários, IA e visitante sem confusão |
| Leads | Tabs, Kanban/lista, formulário, segmentos, detalhe, WhatsApp e contato vinculado |
| Contatos | Busca, filtros, consentimento, grupos, import/export e histórico |
| LGPD | Lookup, export, anonimização e eventos com confirmação e contexto |
| WhatsApp | Sessão, QR, status, limites, fila de envio e logs por permissão |
| Envios | Enviar agora, campanhas, agendamentos, histórico e modelos |
| IA | Modo, KB, teste, consumo, créditos, fallback e mensagens de risco |
| Billing | Plano, limite, pagamento, bloqueio e linguagem financeira clara |
| Equipe | Convite, papel, custom role, OTP, status e política de perfil |
| Permissões | Capabilities por grupo; sem salvar acidental; reset/restore claro |
| Admin | Dashboard global, empresas, filas, logs, erros, billing, IA global, auditoria |

## 6. QA visual por resolução

| Resolução | Validar |
|-----------|---------|
| 1366x768 | Header não estoura; sidebar scroll; Inbox cabe sem sobreposição |
| 1920x1080 | Espaço extra não vira card gigante; tabelas continuam legíveis |
| Mobile estreito | Menu abre/fecha; header compacto; tabelas/drawers não cortam texto |
| Tablet se aplicável | Sidebar/layout intermediário; painéis não sobrepõem |
| Dark/light se existir | Contraste de texto, badges, botões, cards, previews e estados |

## 7. QA de estados extremos

- Nome grande de cliente, empresa e atendente.
- E-mail grande.
- Telefone grande.
- Muitos leads.
- Muitos tickets.
- Muitas conversas.
- Conversa longa com anexos.
- Tabela grande e paginação.
- WhatsApp desconectado, QR pendente e conectando.
- WebChat visitante sem nome/e-mail.
- IA sem crédito, perto do limite e esgotada.
- Plano vencido, limite atingido ou billing bloqueado.
- Usuário sem permissão para rota.
- Erro de API.
- Loading longo.
- Estado vazio.
- Sidebar com todos os grupos visíveis.
- Header com organização de nome longo.

## 8. QA de segurança visual/RBAC

- Atendente não vê billing indevido.
- Atendente não vê Admin SaaS.
- Atendente não vê chaves API ou webhooks sem permissão.
- Supervisor não recebe atendimento por engano ao usar `supervisor_online`.
- Dono não vê logs técnicos sensíveis por padrão.
- Admin SaaS distingue tenant de global.
- Ações destrutivas exigem confirmação clara.
- Tokens, chaves e API secrets não aparecem expostos.
- LGPD/consentimento não se mistura com atendimento.
- IA/carteira não expõe provider/credencial.
- `ProtectedRoute` redireciona sem vazar conteúdo.
- Menu e rota concordam sobre capability.

## 9. Formato de evidência

| Campo | Valor esperado |
|-------|----------------|
| Data | `YYYY-MM-DD` |
| Branch | `layout-v3` |
| Perfil | OWNER, ADMIN, MANAGER, ATTENDANT, custom, staff |
| Rota | Caminho e query/hash |
| Resolução | Ex.: 1366x768 |
| Resultado | Aprovado, aprovado com ressalva, falhou |
| Evidência | Texto objetivo, screenshot local ou log sem segredo |
| Problema encontrado | Descrição curta |
| Severidade | P0, P1, P2, P3 |
| Próxima ação | Corrigir, aceitar risco, pedir decisão do dono |

## 10. Critério para liberar próxima fase

A próxima fase só deve começar se:

- Inventário de rotas, menus, RBAC e componentes estiver completo o suficiente para a área que será alterada.
- Riscos de RBAC e deep links estiverem mapeados.
- Comandos seguros e não executados estiverem registrados.
- Checklist QA por perfil e módulo estiver pronto.
- Nenhuma alteração crítica tiver sido feita sem autorização.
- O dono aprovar labels/termos quando houver mudança de linguagem.
- O escopo da fase seguinte estiver limitado e reversível.
