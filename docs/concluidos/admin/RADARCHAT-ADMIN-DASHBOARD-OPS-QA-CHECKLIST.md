# Radar Chat — Admin Dashboard Ops — QA Checklist

**Versão alvo:** `2.12.41` · **Rota:** `/admin/dashboard` · **Responsável QA manual:** Benhur

Marcar `[x]` após validar localmente. Anotar bugs em [`RADARCHAT-ADMIN-DASHBOARD-OPS-QA-RESULTADO.md`](./RADARCHAT-ADMIN-DASHBOARD-OPS-QA-RESULTADO.md).

**Status release esperado após checklist:** continua `PRONTO PARA QA MANUAL` até todos os blocos críticos passarem.

---

## Ambiente

- [ ] Backend local rodando (`npm run dev`)
- [ ] Frontend local rodando (`npm run dashboard:frontend`)
- [ ] Mongo conectado
- [ ] Redis conectado ou fallback testado (summary sem cache)
- [ ] Login `SYSTEM_ADMIN`
- [ ] Login `SYSTEM_MODERATOR`
- [ ] Login tenant comum (owner)

---

## Acesso

- [ ] `SYSTEM_ADMIN` acessa `/admin/dashboard`
- [ ] `SYSTEM_MODERATOR` acessa `/admin/dashboard`
- [ ] Tenant comum é bloqueado (redirect ou 403)
- [ ] Sem sessão é bloqueado

---

## Visão geral

- [ ] Cards principais aparecem (Empresas, WA, Atendimento, Leads, IA)
- [ ] Alertas aparecem
- [ ] TOP20 / status mostra **PRONTO PARA QA MANUAL**
- [ ] Botão **Atualizar** refaz request (`?refresh=1`)

---

## Infra

- [ ] Uptime aparece
- [ ] Memória aparece
- [ ] Mongo status + latência
- [ ] Redis status + latência
- [ ] Filas (waiting/active/failed)

---

## Empresas

- [ ] Tabela aparece
- [ ] Filtro por nome funciona (debounce)
- [ ] Filtro por plano funciona
- [ ] Filtro por status funciona
- [ ] Paginação funciona
- [ ] `SYSTEM_MODERATOR` vê read-only (sem botões ação)
- [ ] `SYSTEM_ADMIN` vê ações (estender / plano / cancelar)
- [ ] Estender trial exige motivo ≥ 5 chars
- [ ] Alterar plano exige motivo
- [ ] Cancelar trial exige confirmação + motivo
- [ ] Após ação, summary/contagens atualizam

---

## Atendimento

- [ ] WhatsApp: conectadas / desconectadas / expiradas
- [ ] WebChat: widgets, conversas, fila, bridge
- [ ] Inbox: abertas, fila, em progresso, resolvidas hoje
- [ ] Tickets: open, in_progress, client_replied, fechados mês
- [ ] Leads: hoje, mês, forms ativos

---

## Billing

- [ ] Stripe mode aparece (`off` / `test` / `live`) **sem** exibir key
- [ ] Past_due / pedidos pendentes aparecem se houver dados
- [ ] Nenhuma chamada Stripe real ao navegar (verificar Network)

---

## IA

- [ ] Créditos consumidos no mês
- [ ] Orgs baixo crédito / sem crédito (ou “Não calculado nesta etapa”)
- [ ] Chamadas premium vs básica

---

## Segurança

- [ ] Contagens 24h (erros, lookup ticket, form blocked, billing limit)
- [ ] Alertas do summary na coluna lateral
- [ ] Feed `security-events` carrega
- [ ] Filtro **nível** altera request
- [ ] Filtro **fonte** altera request
- [ ] Janela **24h / 7d** altera request
- [ ] Filtro **kind** (texto) altera request
- [ ] Payload malicioso omitido (`[conteúdo omitido]`)
- [ ] Nenhum `sk_test_`, `whsec_`, `sessionData` no DOM (DevTools)

---

## Go-live

- [ ] Status continua **PRONTO PARA QA MANUAL**
- [ ] Não declara “produção pronta”
- [ ] Não existe botão deploy
- [ ] Não existe botão Stripe live

---

## Evidências

- [ ] Prints salvos (visão geral, empresas, segurança)
- [ ] Erros anotados com passos
- [ ] Logs revisados sem segredo vazado

---

## Referências

- API: [`RADARCHAT-ADMIN-DASHBOARD-OPS-API.md`](./RADARCHAT-ADMIN-DASHBOARD-OPS-API.md)
- Módulo: [`RADARCHAT-ADMIN-DASHBOARD-OPS.md`](./RADARCHAT-ADMIN-DASHBOARD-OPS.md)
- E2E automatizado: `e2e/admin-dashboard.spec.ts`
