# QA manual — Auditoria geral do sistema Radar Chat

Roteiro para validação humana após o ciclo de auditoria `audit-system-health-docs` (2026-06-30).  
**Checklist automatizável:** `npm run qa:auditoria:gate` → preenche `docs/qa-results/auditoria-geral-YYYY-MM-DD.json`  
**Modo rápido (jest + build):** `npm run qa:auditoria:quick`  
**Definição dos gates:** `scripts/qa-auditoria-geral-checklist.json` · **Template estático:** `docs/qa-results/auditoria-geral-TEMPLATE.json`

| Camada | Comando | Cobre |
|--------|---------|-------|
| Automatizado | `npm run qa:auditoria:gate` | ~45 itens (jest + Playwright mock) |
| Manual | Este roteiro | ~35 itens (login real, WA físico, Stripe, fluxo E2E humano) |

**Pré-requisitos humanos:** painel acessível, 2 empresas de teste, papéis (dono, supervisor, atendente, viewer), WhatsApp de teste, widget em página local.

### Legenda nas tabelas

| Coluna **Auto** | Significado |
|-----------------|-------------|
| `gate:atendimento` | `npm run qa:atendimento:jest` (sem exigir WA conectado) |
| `gate:e2e-*` | Playwright (mock auth) |
| `gate:jest-*` | Jest focalizado |
| `manual` | Só humano — marcar no JSON de resultado |

---

## 1. Login e sessão

| # | Passo | Esperado | Auto |
|---|-------|----------|------|
| 1.1 | Login Google (dono) | Redireciona ao painel, cookie sessão | manual |
| 1.2 | Login Discord (equipe) | Acesso conforme papel | manual |
| 1.3 | Logout | Sessão encerrada, `/login` | manual |
| 1.4 | Sessão expirada | Mensagem clara, sem loop | manual |
| 1.5 | UI login | Botões Google/Discord visíveis | gate:e2e-login |

---

## 2. Permissões por perfil

| # | Perfil | Rotas que **deve** abrir | Rotas que **não** deve abrir | Auto |
|---|--------|--------------------------|------------------------------|------|
| 2.1 | OWNER | Inbox, Leads, Settings, Billing | `/admin/*` global | manual |
| 2.2 | ATTENDANT | Inbox atribuídas, contatos permitidos | Admin, billing, equipe | manual |
| 2.3 | MANAGER/Supervisor | Supervisor, relatórios, transferência | Admin global | gate:e2e-fase1 |
| 2.4 | VIEWER | Leitura conforme capability | Mutações bloqueadas | manual |
| 2.5 | SYSTEM_ADMIN | `/admin/dashboard`, ops, backup | — | gate:e2e-admin |
| 2.6 | Menu + API forçada | URL bloqueada + 403 | — | gate:e2e-cross-tenant |

Verificar menu oculto + bloqueio API (403) ao forçar URL.

---

## 3. Admin global

| # | Passo | Esperado | Auto |
|---|-------|----------|------|
| 3.1 | `/admin/dashboard` abas | Summary, empresas, segurança, infra carregam | gate:e2e-admin |
| 3.2 | `/admin/backup` | Política editável; em **dev** banner “desenvolvimento local” | gate:build |
| 3.3 | `/admin/ops` | Métricas VPS sem segredos mascarados | gate:jest-mask-secret |
| 3.4 | Auditoria admin | Ações sensíveis geram evento (se aplicável) | manual |

---

## 4. Dono da empresa

| # | Passo | Esperado | Auto |
|---|-------|----------|------|
| 4.1 | `/settings/team` | Convidar, papéis, permissões | manual |
| 4.2 | Inbox bot → Cadastro CRM | Política contato/lead por canal | gate:e2e-fase1 |
| 4.3 | `/platform/inbox/ia` | Modos atendimento, catálogo PIX | gate:e2e-attendance-modes |
| 4.4 | `/plans` | Planos e limites visíveis | manual |

---

## 5. Supervisor

| # | Passo | Esperado | Auto |
|---|-------|----------|------|
| 5.1 | `/platform/inbox/supervisor` | Métricas equipe, presença | gate:e2e-fase1 |
| 5.2 | Reatribuir conversa | `AttendanceEvent` registrado | gate:atendimento |
| 5.3 | Monitor conversa WA + WebChat | Timeline legível | manual |

---

## 6. Atendente

| # | Passo | Esperado | Auto |
|---|-------|----------|------|
| 6.1 | Presença online/ausente/ocupado | Fila respeita status | gate:e2e-presence |
| 6.2 | Assumir da fila | Conversa atribuída | gate:e2e-inbox |
| 6.3 | Transferir setor | Cliente notificado conforme config | manual |
| 6.4 | Só setores permitidos | Sem vazamento outras filas | manual |

---

## 7. WebChat

| # | Passo | Esperado | Auto |
|---|-------|----------|------|
| 7.1 | Widget em domínio permitido | Abre, pré-chat, mensagens | manual |
| 7.2 | Domínio não permitido | Bloqueado (`assertOrigin`) | gate:jest-webchat-security |
| 7.3 | Anexo imagem/PDF | Upload ≤5 MB | manual |
| 7.4 | Offline / fora horário | Aviso ou fallback WA | gate:atendimento |
| 7.5 | FAQ / TK lookup | Chips e consulta token | gate:atendimento |
| 7.6 | Anti-spam honeypot + IP | Sessão bloqueada se abuso | gate:jest-webchat-security |
| 7.7 | CRM incompleto sem telefone | `crmIncomplete` + «Completar cadastro» | gate:jest-crm-completeness |

---

## 8. WhatsApp

| # | Passo | Esperado | Auto |
|---|-------|----------|------|
| 8.1 | `/sessions` QR | Conecta, status connected | manual |
| 8.2 | Mensagem inbound | Aparece no Inbox | gate:atendimento |
| 8.3 | Resposta painel | Entrega no celular | manual |
| 8.4 | Logout pelo celular | Painel desconectado, **sem loop** reconexão no log | manual |
| 8.5 | `!assumir` / bridge WebChat | Bridge ativa se configurado | gate:atendimento |

---

## 9. Inbox

| # | Passo | Esperado | Auto |
|---|-------|----------|------|
| 9.1 | Lista unificada WA + WebChat | Badges canal corretos | gate:e2e-inbox |
| 9.2 | CSAT ao finalizar | Pesquisa enviada | gate:atendimento |
| 9.3 | Chat interno (supervisor) | `direction: internal` só visível equipe | manual |
| 9.4 | Mensagens não somem após burst | Fix 2.17.24 | manual |

---

## 10. Leads

| # | Passo | Esperado | Auto |
|---|-------|----------|------|
| 10.1 | Captura automática WA/WebChat | Lead em `/platform/leads` | gate:e2e-leads |
| 10.2 | Formulário embed público | Honeypot rejeita bot | manual |
| 10.3 | Abrir Inbox do lead | 1 clique, conversa vinculada | manual |
| 10.4 | Vincular contato manual | Histórico `linked_contact` | manual |

---

## 11. Contatos

| # | Passo | Esperado | Auto |
|---|-------|----------|------|
| 11.1 | `/contact` vs Leads | Fronteiras claras na UI + badges CRM | gate:build |
| 11.2 | Classificação badges | Filtro `?class=` | gate:atendimento |
| 11.3 | Consentimento LGPD | Fluxo renovação | gate:e2e-lgpd |

---

## 12. Tickets

| # | Passo | Esperado | Auto |
|---|-------|----------|------|
| 12.1 | Abrir TK via bot/painel | Número `TK-…` | gate:atendimento |
| 12.2 | Consulta pública token | WebChat/widget | gate:atendimento |
| 12.3 | SLA e status | Painel + notificações | manual |

---

## 13. IA

| # | Passo | Esperado | Auto |
|---|-------|----------|------|
| 13.1 | Modo básico vs premium | Consumo `usageKind` distinto | gate:atendimento |
| 13.2 | Saldo créditos header | Barra IA/LM visível | gate:e2e-fase1 |
| 13.3 | Sem créditos | Fallback ou bloqueio claro | gate:atendimento |
| 13.4 | KB sem inventar preços | Mensagem “sem informação confirmada” | manual |

---

## 14. Billing / créditos IA

| # | Passo | Esperado | Auto |
|---|-------|----------|------|
| 14.1 | Checkout plano | Stripe test/live conforme env | manual |
| 14.2 | Limite mensagens/dia | Bloqueio com alerta sino | gate:atendimento |
| 14.3 | Pacote créditos IA | Carteira atualizada | manual |

---

## 15. Upload / comprovantes / anexos

| # | Passo | Esperado | Auto |
|---|-------|----------|------|
| 15.1 | Comprovante PIX WebChat | Pedido atualizado ou órfão | gate:atendimento |
| 15.2 | Comprovante PIX WA | Mesmo fluxo `CatalogSalesService` | gate:atendimento |
| 15.3 | Aprovar/rejeitar pagamento | RBAC `orders:approve-payment` | manual |
| 15.4 | Link comprovante WA interno | HMAC, sem vazar tenant errado | gate:jest-mask-secret |

---

## 16. Logs e auditoria

| # | Passo | Esperado | Auto |
|---|-------|----------|------|
| 16.1 | `/discord/logs` ou logs plataforma | Tenant-scoped para dono | manual |
| 16.2 | Staff global logs | Só com capability + justificativa | gate:build |
| 16.3 | `AttendanceEvent` | Assign/transfer/ticket registrados | gate:atendimento |

---

## 17. Segurança básica

| # | Passo | Esperado | Auto |
|---|-------|----------|------|
| 17.1 | API sem cookie | 401 em `/api/inbox/*` | gate:atendimento |
| 17.2 | Cross-tenant ID | 404/403 ao trocar ID na URL | gate:e2e-cross-tenant |
| 17.3 | Webhook outbound | Assinatura `X-Radar Chat-Signature` (doc WEBHOOKS) | gate:atendimento |
| 17.4 | Integração `X-API-Key` | Só chaves da empresa | manual |
| 17.5 | CSRF same-origin produção | Mutação sem Origin bloqueada | gate:jest-webchat-security |

---

## 18. Multiempresa

| # | Passo | Esperado | Auto |
|---|-------|----------|------|
| 18.1 | Usuário em 2 orgs | Troca contexto, dados isolados | manual |
| 18.2 | Convite outra empresa | Não vê dados da primeira | gate:e2e-cross-tenant |

---

## 19. Responsividade e UX

| # | Passo | Esperado | Auto |
|---|-------|----------|------|
| 19.1 | Inbox 3 colunas desktop | Usável | gate:e2e-inbox |
| 19.2 | Mobile / tablet | Scroll navegador, CTA login ≥40px | gate:e2e-login |
| 19.3 | Estados vazios | Texto orienta próximo passo | gate:e2e-fase1 |
| 19.4 | Erros API | Toast/mensagem amigável, não stack trace | manual |

---

## 20. Fluxo completo de atendimento (E2E humano)

| # | Passo | Esperado | Auto |
|---|-------|----------|------|
| 20.1 | WebChat → lead → fila → CSAT | Fluxo &lt; 30 min limpo | manual |

Passos de referência:

1. Visitante abre WebChat → pré-chat com telefone  
2. Lead criado (se política) → aparece em Leads  
3. IA triagem ou fila humana  
4. Atendente assume → responde  
5. Transferência setor ou supervisor  
6. Finalizar → CSAT  
7. Ticket opcional → consulta cliente com token  

**Tempo alvo:** &lt; 30 min para um fluxo limpo.

---

## Registro do resultado

**Automatizado (recomendado primeiro):**

```bash
npm run qa:auditoria:gate
# ou só jest/build: npm run qa:auditoria:quick
```

Gera `docs/qa-results/auditoria-geral-YYYY-MM-DD.json` com:

```json
{
  "schema": "radarchat-auditoria-geral-v1",
  "auditCycle": "audit-system-health-docs",
  "version": "2.17.32",
  "overallStatus": "PARTIAL",
  "summary": {
    "automated": { "pass": 0, "fail": 0, "skipped": 0 },
    "manual": { "pending": 0 }
  },
  "gateRuns": [],
  "sections": []
}
```

**Manual:** editar o mesmo JSON — itens `status: "pending"` → `"pass"` ou `"fail"` + `notes`.  
Template vazio: `docs/qa-results/auditoria-geral-TEMPLATE.json`
