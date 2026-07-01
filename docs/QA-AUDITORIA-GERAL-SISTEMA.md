# QA manual — Auditoria geral do sistema Radar Chat

Roteiro para validação humana após o ciclo de auditoria `audit-system-health-docs` (2026-06-30).  
Registrar resultados em `docs/qa-results/` usando o template `QA-FASE1-RESULTADO-TEMPLATE.md` ou JSON equivalente.

**Pré-requisitos:** painel acessível, pelo menos 2 empresas de teste, 1 usuário por papel (dono, supervisor, atendente, viewer), WhatsApp de teste, widget WebChat em página local.

---

## 1. Login e sessão

| # | Passo | Esperado | OK? | Notas |
|---|-------|----------|-----|-------|
| 1.1 | Login Google (dono) | Redireciona ao painel, cookie sessão | | |
| 1.2 | Login Discord (equipe) | Acesso conforme papel | | |
| 1.3 | Logout | Sessão encerrada, `/login` | | |
| 1.4 | Sessão expirada | Mensagem clara, sem loop | | |

---

## 2. Permissões por perfil

| # | Perfil | Rotas que **deve** abrir | Rotas que **não** deve abrir |
|---|--------|--------------------------|------------------------------|
| 2.1 | OWNER | Inbox, Leads, Settings, Billing | `/admin/*` global |
| 2.2 | ATTENDANT | Inbox atribuídas, contatos permitidos | Admin, billing, equipe |
| 2.3 | MANAGER/Supervisor | Supervisor, relatórios, transferência | Admin global |
| 2.4 | VIEWER | Leitura conforme capability | Mutações bloqueadas |
| 2.5 | SYSTEM_ADMIN | `/admin/dashboard`, ops, backup | — |

Verificar menu oculto + bloqueio API (403) ao forçar URL.

---

## 3. Admin global

| # | Passo | Esperado |
|---|-------|----------|
| 3.1 | `/admin/dashboard` abas | Summary, empresas, segurança, infra carregam |
| 3.2 | `/admin/backup` | Política editável; em **dev** banner “desenvolvimento local” |
| 3.3 | `/admin/ops` | Métricas VPS sem segredos mascarados |
| 3.4 | Auditoria admin | Ações sensíveis geram evento (se aplicável) |

---

## 4. Dono da empresa

| # | Passo | Esperado |
|---|-------|----------|
| 4.1 | `/settings/team` | Convidar, papéis, permissões |
| 4.2 | Inbox bot → Cadastro CRM | Política contato/lead por canal |
| 4.3 | `/platform/inbox/ia` | Modos atendimento, catálogo PIX |
| 4.4 | `/plans` | Planos e limites visíveis |

---

## 5. Supervisor

| # | Passo | Esperado |
|---|-------|----------|
| 5.1 | `/platform/inbox/supervisor` | Métricas equipe, presença |
| 5.2 | Reatribuir conversa | `AttendanceEvent` registrado |
| 5.3 | Monitor conversa WA + WebChat | Timeline legível |

---

## 6. Atendente

| # | Passo | Esperado |
|---|-------|----------|
| 6.1 | Presença online/ausente/ocupado | Fila respeita status |
| 6.2 | Assumir da fila | Conversa atribuída |
| 6.3 | Transferir setor | Cliente notificado conforme config |
| 6.4 | Só setores permitidos | Sem vazamento outras filas |

---

## 7. WebChat

| # | Passo | Esperado |
|---|-------|----------|
| 7.1 | Widget em domínio permitido | Abre, pré-chat, mensagens |
| 7.2 | Domínio não permitido | Bloqueado (`assertOrigin`) |
| 7.3 | Anexo imagem/PDF | Upload ≤5 MB |
| 7.4 | Offline / fora horário | Aviso ou fallback WA |
| 7.5 | FAQ / TK lookup | Chips e consulta token |

---

## 8. WhatsApp

| # | Passo | Esperado |
|---|-------|----------|
| 8.1 | `/sessions` QR | Conecta, status connected |
| 8.2 | Mensagem inbound | Aparece no Inbox |
| 8.3 | Resposta painel | Entrega no celular |
| 8.4 | Logout pelo celular | Painel desconectado, **sem loop** reconexão no log |
| 8.5 | `!assumir` / bridge WebChat | Bridge ativa se configurado |

---

## 9. Inbox

| # | Passo | Esperado |
|---|-------|----------|
| 9.1 | Lista unificada WA + WebChat | Badges canal corretos |
| 9.2 | CSAT ao finalizar | Pesquisa enviada |
| 9.3 | Chat interno (supervisor) | `direction: internal` só visível equipe |
| 9.4 | Mensagens não somem após burst | Fix 2.17.24 |

---

## 10. Leads

| # | Passo | Esperado |
|---|-------|----------|
| 10.1 | Captura automática WA/WebChat | Lead em `/platform/leads` |
| 10.2 | Formulário embed público | Honeypot rejeita bot |
| 10.3 | Abrir Inbox do lead | 1 clique, conversa vinculada |
| 10.4 | Vincular contato manual | Histórico `linked_contact` |

---

## 11. Contatos

| # | Passo | Esperado |
|---|-------|----------|
| 11.1 | `/contact` vs Leads | Fronteiras claras na UI |
| 11.2 | Classificação badges | Filtro `?class=` |
| 11.3 | Consentimento LGPD | Fluxo renovação |

---

## 12. Tickets

| # | Passo | Esperado |
|---|-------|----------|
| 12.1 | Abrir TK via bot/painel | Número `TK-…` |
| 12.2 | Consulta pública token | WebChat/widget |
| 12.3 | SLA e status | Painel + notificações |

---

## 13. IA

| # | Passo | Esperado |
|---|-------|----------|
| 13.1 | Modo básico vs premium | Consumo `usageKind` distinto |
| 13.2 | Saldo créditos header | Barra IA/LM visível |
| 13.3 | Sem créditos | Fallback ou bloqueio claro |
| 13.4 | KB sem inventar preços | Mensagem “sem informação confirmada” |

---

## 14. Billing / créditos IA

| # | Passo | Esperado |
|---|-------|----------|
| 14.1 | Checkout plano | Stripe test/live conforme env |
| 14.2 | Limite mensagens/dia | Bloqueio com alerta sino |
| 14.3 | Pacote créditos IA | Carteira atualizada |

---

## 15. Upload / comprovantes / anexos

| # | Passo | Esperado |
|---|-------|----------|
| 15.1 | Comprovante PIX WebChat | Pedido atualizado ou órfão |
| 15.2 | Comprovante PIX WA | Mesmo fluxo `CatalogSalesService` |
| 15.3 | Aprovar/rejeitar pagamento | RBAC `orders:approve-payment` |
| 15.4 | Link comprovante WA interno | HMAC, sem vazar tenant errado |

---

## 16. Logs e auditoria

| # | Passo | Esperado |
|---|-------|----------|
| 16.1 | `/discord/logs` ou logs plataforma | Tenant-scoped para dono |
| 16.2 | Staff global logs | Só com capability + justificativa |
| 16.3 | `AttendanceEvent` | Assign/transfer/ticket registrados |

---

## 17. Segurança básica

| # | Passo | Esperado |
|---|-------|----------|
| 17.1 | API sem cookie | 401 em `/api/inbox/*` |
| 17.2 | Cross-tenant ID | 404/403 ao trocar ID na URL |
| 17.3 | Webhook outbound | Assinatura `X-Radar Chat-Signature` (doc WEBHOOKS) |
| 17.4 | Integração `X-API-Key` | Só chaves da empresa |

---

## 18. Multiempresa

| # | Passo | Esperado |
|---|-------|----------|
| 18.1 | Usuário em 2 orgs | Troca contexto, dados isolados |
| 18.2 | Convite outra empresa | Não vê dados da primeira |

---

## 19. Responsividade e UX

| # | Passo | Esperado |
|---|-------|----------|
| 19.1 | Inbox 3 colunas desktop | Usável |
| 19.2 | Mobile / tablet | Scroll navegador, não preso |
| 19.3 | Estados vazios | Texto orienta próximo passo |
| 19.4 | Erros API | Toast/mensagem amigável, não stack trace |

---

## 20. Fluxo completo de atendimento (E2E humano)

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

```json
{
  "auditCycle": "audit-system-health-docs",
  "version": "2.17.26",
  "date": "2026-06-30",
  "tester": "",
  "environment": "local|staging|production",
  "passed": 0,
  "failed": 0,
  "blocked": 0,
  "notes": ""
}
```

Salvar em: `docs/qa-results/auditoria-geral-YYYY-MM-DD.json`
