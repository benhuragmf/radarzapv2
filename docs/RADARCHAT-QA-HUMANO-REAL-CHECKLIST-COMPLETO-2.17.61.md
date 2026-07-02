# RadarChat — Checklist QA Humano Real COMPLETO — Fase 1 + Catálogo + Auditoria — 2.17.61

> **Arquivo único** para fechar pendências humanas documentadas em `docs/PENDENCIAS-HUMANAS-FASE1.md`.  
> Substitui o checklist só-catálogo ([`concluidos/RADARCHAT-QA-HUMANO-REAL-CHECKLIST-CATALOGO-ENDERECO-PIX-2.17.61.md`](./concluidos/RADARCHAT-QA-HUMANO-REAL-CHECKLIST-CATALOGO-ENDERECO-PIX-2.17.61.md)).

| Campo | Preencher |
|-------|-----------|
| **Testador** | Benhur |
| **Data início** | ____/____/2026 |
| **Data fim** | ____/____/2026 |
| **Ambiente** | `https://app.radarchat.com.br` (prod) / dev / piloto |
| **Versão** | `2.17.61` · commit `4a7c690` |
| **Empresa/tenant** | ________________________________ |
| **WA loja** | ________________________________ |
| **Celular cliente** | ________________________________ |
| **Produto teste** | `zaad` ou ______________________ |

### Legenda

| Símbolo | Status |
|---------|--------|
| ⬜ | Não testado |
| ✅ | OK — você confirmou |
| ❌ | Falhou — anotar P0–P3 |
| ⏸ | Bloqueado (config, WA off, etc.) |
| ➖ | N/A justificado |
| 🤖 | Já verde em CI/Jest (revalidar se quiser) |

### Mapa — o que cada parte fecha

| Parte | Fecha o quê | Bloqueia |
|-------|-------------|----------|
| **0** | Gates automáticos (referência) | — |
| **A–E, D-perfil** | Gate § Estabilização Fase 1 (`ROADMAP-COMPLETUDE.md`) | Go-live formal |
| **F–G** | Congelamento catálogo/endereço/PIX (`APROVADO PARA CONGELAMENTO`) | Módulo comercial |
| **H** | Auditoria geral manual (~35 itens) | Confiança sistema |
| **I** | Admin Ops browser VPS | Staff global |
| **J** | P2 visual (opcional) | Nada crítico |

**Docs oficiais:** `QA-FASE1-CHECKLIST.md` · [`concluidos/QA-AUDITORIA-GERAL-SISTEMA.md`](./concluidos/QA-AUDITORIA-GERAL-SISTEMA.md) (detalhe histórico) · `CATALOGO-PIX-PEDIDOS.md` · `QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`

---

# PARTE 0 — Gates automáticos (rodar antes ou depois do manual)

| Comando | Quando | Status | Data/evidência |
|---------|--------|--------|----------------|
| `npm run qa:prep` | Antes do manual WA | ⬜ | |
| `npm run qa:atendimento:gate` | Antes de fechar Fase 1 | ⬜ | |
| `npm run qa:fase1:e2e` | Playwright mock (33+) | 🤖 | CI 2026-06 |
| `npm run qa:auditoria:quick` | Build + jest segurança | ⬜ | |
| `npm run qa:auditoria:gate` | Completo + E2E | ⬜ | |
| `npm run pre-push:gate` | Só antes de deploy futuro | ➖ | Não neste QA |

---

# PARTE 1 — Preparação geral (todas as fases)

| # | Item | Status | Evidência |
|---|------|--------|-----------|
| 1.1 | Logado em `app.radarchat.com.br` | ⬜ | |
| 1.2 | WA empresa conectado `/sessions` | ⬜ | |
| 1.3 | Celular cliente disponível | ⬜ | |
| 1.4 | CSAT ON em `/platform/inbox/bot` (para § A) | ⬜ | |
| 1.5 | Widget WebChat ativo (para § C) | ⬜ / ➖ | |
| 1.6 | Membro equipe com WA verificado (`!assumir`) | ⬜ | |
| 1.7 | Contato de teste identificado | ⬜ | Tel: ______ |
| 1.8 | 2ª empresa para cross-tenant (opcional) | ⬜ / ➖ | |

---

# PARTE A — WhatsApp Fase 1 (§ A — 10 cenários críticos)

> **Bloqueia:** Gate § Estabilização · Doc: `QA-FASE1-CHECKLIST.md` § A

| # | Cenário | Esperado | Status | Notas/evidência |
|---|---------|----------|--------|-------------------|
| A1 | Triagem → humano responde | Inbox OK; sem ticket espúrio | ⬜ | |
| A2 | **Finalizar** no painel | CSAT enviado na hora | ⬜ | |
| A3 | Cliente: `avaliar` | CSAT; **não** reabre TK antigo | ⬜ | |
| A4 | Cliente: `4` (nota) | Agradecimento; nota gravada | ⬜ | |
| A5 | Pós-CSAT: `Ola` / `gostaria de atendimento` | Novo fluxo; **sem** loop CSAT | ⬜ | |
| A6 | `falar com atendente` | Escala; sem lembrete CSAT indevido | ⬜ | |
| A7 | TK fechado (dias) + msg nova | Novo atendimento; não captura TK | ⬜ | |
| A8 | Envio via **Ticket** + reply < 12 h | Mesmo TK | ⬜ | |
| A9 | IA promete transferir | Escala; não trava triagem | ⬜ | |
| A10 | Menu ticket `1`/`2` com inbox ativo | Sem colisão fluxos | ⬜ | |

**Parte A sem falha crítica?** ⬜ Sim · ⬜ Não

---

# PARTE B — Painel rotas (§ B — smoke visual/funcional)

| Rota | Verificar | Status | Notas |
|------|-----------|--------|-------|
| B1 | `/platform/inbox` — métricas, filtros, 3 colunas, WA+site | ⬜ | 🤖 E2E mock |
| B2 | `/platform/inbox/tickets` — busca, paginação | ⬜ | 🤖 |
| B3 | `/platform/inbox/setores` — público/interno | ⬜ | 🤖 |
| B4 | `/platform/inbox/bot` — CSAT, fallback WA, salvar | ⬜ | 🤖 |
| B5 | `/platform/inbox/respostas` — busca, prévia | ⬜ | 🤖 |
| B6 | `/platform/inbox/supervisor` — fila, equipe | ⬜ | 🤖 |
| B7 | `/platform/webchat` — widgets, snippet | ⬜ | 🤖 |
| B8 | `/platform/inbox/ia` — modos, catálogo | ⬜ | 🤖 |
| B9 | `/platform/inbox/relatorios` — período, KPIs | ⬜ | |
| B10 | `/platform/produtos` — abas visíveis | ⬜ | |
| B11 | `/settings/team` — equipe, papéis | ⬜ | |
| B12 | `/plans` — planos/limites | ⬜ | |

---

# PARTE B.1 — Leads (§ B.1)

| # | Cenário | Esperado | Status | Notas |
|---|---------|----------|--------|-------|
| B1.1 | Embed formulário / API pública | Lead em `/platform/leads` | ⬜ | |
| B1.2 | **Iniciar atendimento** do lead | Inbox abre conversa | ⬜ | |
| B1.3 | **Continuar no Inbox** (deep link) | `?conv=` funciona | ⬜ | |
| B1.4 | Fila por capacidade (2 atendentes) | RR respeita limite | ⬜ / ➖ | |

---

# PARTE C — WebChat + fallback + bridge (§ C)

> Roteiro: `QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`

| # | Cenário | Esperado | Status | Notas |
|---|---------|----------|--------|-------|
| C1 | Pré-chat → mensagem | Triagem/bot | ⬜ | |
| C2 | Escalação → Inbox **Assumir** | Lista webchat | ⬜ | |
| C3 | Atendente anexo imagem/PDF | Widget recebe | ⬜ | |
| C4 | Finalizar conversa site | Encerramento visitante | ⬜ | |
| C5 | Consulta TK+token no widget | OK; token errado genérico | ⬜ | |
| C6 | FAQ chips + links | KB + https | ⬜ | |
| C7 | Fallback **offline** | Alerta WA `TK-` | ⬜ | |
| C8 | Fallback **deferido** (online) | Sino vermelho após timeout | ⬜ | |
| C9 | `!assumir` / `!ticket` / `!encerrar` | Só número Equipe | ⬜ | |
| C10 | Bridge site ↔ WA | Ida/volta + badge Bridge | ⬜ | |
| C11 | IA Básica WebChat | 1ª msg ≠ menu robotizado | ⬜ | |
| C12 | Presença + round-robin | Ocupado não recebe prioridade | ⬜ | |
| C13 | Widget: salvar seções / aplicar modelo | Persiste | ⬜ | |
| C14 | Balão proativo | Aparece após delay | ⬜ / ➖ | |

---

# PARTE D — Perfil equipe (RBAC perfil)

| # | Cenário | Esperado | Status |
|---|---------|----------|--------|
| D1 | Dono cadastra atendente (nome, e-mail, WA) | Salvo; pendente na lista | ⬜ |
| D2 | Atendente confirma e-mail OTP `/settings#perfil` | `emailVerifiedAt` | ⬜ |
| D3 | Atendente confirma WA OTP | `whatsappPhoneVerifiedAt` | ⬜ |
| D4 | Edição bloqueada (padrão) | Só confirma, não edita | ⬜ |
| D5 | Edição liberada (toggle owner) | Edita com OTP | ⬜ / ➖ |

---

# PARTE E — Presença, supervisor, alertas (§ E)

| # | Cenário | Esperado | Status | Notas |
|---|---------|----------|--------|-------|
| E1 | Online / Ocupado / Ausente | RR respeita | ⬜ | |
| E2 | Idle → auto-ausente | Prompt restaurar | ⬜ | |
| E3 | `/platform/inbox/supervisor` | Equipe, fila, monitor | ⬜ | |
| E4 | Reassign conversa `wc:` | Reatribuída | ⬜ | |
| E5 | Sino fallback perdido WebChat | `webchat:fallback_missed` | ⬜ | |
| E5b | **Fallback fila WA nativa** (2.12.67) | Alerta `TK-`; `!assumir` | ⬜ | Parte 3c roteiro |
| E6 | Alertas billing/IA/config | Badge vermelho; perm correta | ⬜ / ➖ | |

**Parte E sem falha crítica?** ⬜ Sim · ⬜ Não

---

# PARTE F — Catálogo IA / PIX (P1b — C1 a C9)

> Doc: `CATALOGO-PIX-PEDIDOS.md` · Config: IA → Empresa e IA + Produtos

### F0 — Preparação catálogo

| # | Item | Status | Evidência |
|---|------|--------|-----------|
| F0.1 | Catálogo/IA pedidos ON | ⬜ | |
| F0.2 | PIX ON + chave cadastrada | ⬜ | |
| F0.3 | Produto `zaad` com preço e estoque | ⬜ | |
| F0.4 | WA interno conferência configurado | ⬜ | Nº: ______ |
| F0.5 | Perfil comercial ≠ `none` | ⬜ | |

### F1 — Cenários catálogo (WhatsApp)

| # | Mensagem/ação | Esperado | Status | Evidência |
|---|---------------|----------|--------|-----------|
| C1 | Catálogo **vazio** (desligar produtos) | Mensagem honesta; **sem** loop PIX | ⬜ | |
| C2 | `quero comprar zaad` | Oferta retirar/entregue | ⬜ | |
| C3a | Após oferta: `entregue` | Fluxo entrega (CEP…) | ⬜ | |
| C3b | Após oferta: `retirar` | Fluxo retirada | ⬜ | (ver também G4) |
| C4 | `zad` (ambíguo) | **Sugestão**; não oferta direta | ⬜ | |
| C5 | `ola boa tarde` | **Não** abre catálogo | ⬜ | |
| C6 | Repetir `zaad` após oferta | Lembrete fulfillment; não re-oferta completa | ⬜ | |
| C7a | Produto estoque **0** | Não gera PIX automático | ⬜ | |
| C7b | Produto **sem preço** | Não gera PIX | ⬜ | |
| C8 | Comprovante + WA interno | Notificação conferência | ⬜ | (ver G5) |
| C9 | Paridade **WebChat** C2–C4 | Mesmo comportamento | ⬜ / ➖ | |

---

# PARTE G — Catálogo: entrega, CEP, R1, Inbox, Produtos (P1c — §32)

> **Bloqueia congelamento** catálogo · Prioridade: **R1** `não, é número 120`

### G1 — Compra + entrega + CEP + frete + PIX

| Passo | Ação | Esperado | Real | Status | Evidência |
|-------|------|----------|------|--------|-----------|
| G1.1 | `oi` | Saudação | | ⬜ | |
| G1.2 | `quero comprar zaad` | Oferta produto | | ⬜ | |
| G1.3 | `entregue` | Pede CEP; **sem PIX** | | ⬜ | |
| G1.4 | CEP: ______ | Endereço / pede número | | ⬜ | |
| G1.5 | Número: ______ | Pedido confirmar | | ⬜ | |
| G1.6 | `sim` | Confirma | | ⬜ | |
| G1.7 | — | Frete calculado | | ⬜ | R$ ______ |
| G1.8 | — | PIX **após** frete | | ⬜ | |
| G1.9 | — | PIX **1x** (não duplicou) | | ⬜ | |

**DX-________** · Horário: ______

### G2 — R1 correção inline (CRÍTICO)

| # | Mensagem | Esperado | Real | Status | Sev. |
|---|----------|----------|------|--------|------|
| G2.0 | `não, é número 120` | Atualiza nº; invalida frete; reconfirma; **sem PIX** | | ⬜ | P1 se falhar |
| G2.0b | `sim` após correção | Frete + PIX normais | | ⬜ | |
| G2.1 | `não é numero 120` | Corrige número | | ⬜ | |
| G2.2 | `errado, é número 120` | Corrige número | | ⬜ | |
| G2.3 | `não é 1326 é 120` | Corrige número | | ⬜ | |
| G2.4 | `não, é Rua José Pinto, 120` | Corrige rua+nº | | ⬜ | |
| G2.5 | `não, é Av. José Pinto, 1020` | Corrige av+nº | | ⬜ | |
| G2.6 | `não, cep 78705022` | Fluxo CEP | | ⬜ | |
| G2.7 | `não, bairro é Vila Birigui` | Corrige bairro | | ⬜ | |
| G2.8 | `não, complemento casa 2` | Corrige complemento | | ⬜ | |
| G2.9 | `não` (simples) | Pede endereço; sem PIX | | ⬜ | |

### G3 — Retirada (regressão)

| # | Item | Status | Evidência |
|---|------|--------|-----------|
| G3.1 | `quero comprar zaad` → `retirar` | ⬜ | |
| G3.2 | Sem CEP/endereço entrega | ⬜ | |
| G3.3 | Sem frete entrega | ⬜ | |
| G3.4 | PIX uma vez | ⬜ | |
| G3.5 | Pedido no painel | ⬜ | DX-________ |

### G4 — Comprovante + WA interno

| # | Item | Status | Evidência |
|---|------|--------|-----------|
| G4.1 | Enviar comprovante (img/PDF) | ⬜ | |
| G4.2 | Pedido em conferência | ⬜ | |
| G4.3 | WA interno recebeu alerta | ⬜ | |
| G4.4 | IA **não** aprovou sozinha | ⬜ | |
| G4.5 | Fila Produtos → Comprovantes | ⬜ | |

### G5 — Pin / localização

| # | Item | Status | Evidência |
|---|------|--------|-----------|
| G5.1 | Enviar pin WA + rua/número | ⬜ | |
| G5.2 | Confirmação + frete + PIX | ⬜ | |
| G5.3 | Inbox: pin ≠ endereço confirmado | ⬜ | |
| G5.4 | Google Maps + copiar manual | ⬜ | |
| G5.5 | Alerta divergência ~400 m (se aplicável) | ⬜ / ➖ | |
| G5.6 | **Sem** envio motoboy automático | ⬜ | |

### G6 — Inbox (pedido real)

| # | Item | Status | Evidência |
|---|------|--------|-----------|
| G6.1 | Conversa + pedido vinculado | ⬜ | |
| G6.2 | DX-####, status, produto, valores | ⬜ | |
| G6.3 | Comprovante visível | ⬜ | |
| G6.4 | Bloco endereço confirmado | ⬜ | |
| G6.5 | Bloco localização (se pin) | ⬜ / ➖ | |
| G6.6 | Copiar entrega manual (só clipboard) | ⬜ | |
| G6.7 | Aprovar / rejeitar / novo comprovante | ⬜ | |

### G7 — Produtos/Pedidos

| # | Item | Status | Evidência |
|---|------|--------|-----------|
| G7.1 | Lista `#pedidos` | ⬜ | |
| G7.2 | Drawer completo | ⬜ | |
| G7.3 | Deep link `?order=DX-####` | ⬜ | |
| G7.4 | RBAC: sem perm não aprova | ⬜ / ➖ | |

### G8 — Cancelar / sair

| Msg | Esperado | Status |
|-----|----------|--------|
| `cancelar` | Interrompe fluxo | ⬜ |
| `sair` | Opt-out / interrompe conforme regra | ⬜ |

**Congelamento catálogo (Parte F+G) sem P0/P1?** ⬜ Sim · ⬜ Não

---

# PARTE H — Auditoria geral manual (detalhe: [`concluidos/QA-AUDITORIA-GERAL-SISTEMA.md`](./concluidos/QA-AUDITORIA-GERAL-SISTEMA.md))

> Complementa Fase 1 · Marque só o que **não** foi coberto acima

### H1 — Login e sessão

| # | Passo | Status | Notas |
|---|-------|--------|-------|
| H1.1 | Login Google (dono) | ⬜ | |
| H1.2 | Login Discord (equipe) | ⬜ / ➖ | |
| H1.3 | Logout | ⬜ | |
| H1.4 | Sessão expirada — mensagem clara | ⬜ | |

### H2 — Permissões por perfil

| Perfil | Rotas OK | Rotas bloqueadas | Status |
|--------|----------|------------------|--------|
| OWNER | Inbox, Leads, Settings, Billing | `/admin/*` | ⬜ |
| ATTENDANT | Inbox atribuídas | Admin, billing | ⬜ |
| MANAGER | Supervisor, relatórios | Admin global | ⬜ |
| VIEWER | Leitura | Mutações | ⬜ / ➖ |
| SYSTEM_ADMIN | `/admin/dashboard` | — | ⬜ / ➖ |
| Forçar URL + API | 403 | ⬜ | 🤖 E2E cross-tenant |

### H3 — Admin global (tenant staff)

| # | Passo | Status |
|---|-------|--------|
| H3.1 | `/admin/dashboard` abas | ⬜ / ➖ |
| H3.2 | `/admin/backup` | ⬜ / ➖ |
| H3.3 | `/admin/ops` sem segredos expostos | ⬜ / ➖ |
| H3.4 | Auditoria admin ações sensíveis | ⬜ / ➖ |

### H4 — Contatos e classificação

| # | Passo | Status |
|---|-------|--------|
| H4.1 | `/contact` vs Leads — fronteiras UI | ⬜ |
| H4.2 | Filtro classificação `?class=` | ⬜ | 🤖 |
| H4.3 | Consentimento LGPD renovação | ⬜ | 🤖 E2E lgpd |

### H5 — Tickets

| # | Passo | Status |
|---|-------|--------|
| H5.1 | Abrir TK bot/painel | ⬜ |
| H5.2 | Consulta pública token | ⬜ | 🤖 |
| H5.3 | SLA e status painel | ⬜ |

### H6 — IA e créditos

| # | Passo | Status |
|---|-------|--------|
| H6.1 | Modo básico vs premium (`usageKind`) | ⬜ | 🤖 |
| H6.2 | Barra créditos header | ⬜ | 🤖 |
| H6.3 | Sem créditos — bloqueio claro | ⬜ | 🤖 |
| H6.4 | KB não inventa preços | ⬜ | |

### H7 — Billing

| # | Passo | Status |
|---|-------|--------|
| H7.1 | Checkout Stripe (test/live) | ⬜ / ➖ | |
| H7.2 | Limite mensagens + alerta sino | ⬜ | 🤖 |
| H7.3 | Pacote créditos IA | ⬜ / ➖ | |

### H8 — Segurança operacional

| # | Passo | Status |
|---|-------|--------|
| H8.1 | API sem cookie → 401 | ⬜ | 🤖 |
| H8.2 | Cross-tenant ID → 403/404 | ⬜ | 🤖 |
| H8.3 | Webhook assinatura HMAC | ⬜ | 🤖 |
| H8.4 | API key só da empresa | ⬜ | |
| H8.5 | CSRF same-origin prod | ⬜ | 🤖 |

### H9 — Multiempresa

| # | Passo | Status |
|---|-------|--------|
| H9.1 | Usuário 2 orgs — troca contexto | ⬜ | |
| H9.2 | Convite outra empresa — isolamento | ⬜ | 🤖 |

### H10 — UX / responsivo

| # | Passo | Status |
|---|-------|--------|
| H10.1 | Inbox desktop 3 colunas | ⬜ | 🤖 |
| H10.2 | Mobile/tablet scroll | ⬜ | |
| H10.3 | Estados vazios orientam | ⬜ | 🤖 |
| H10.4 | Erro API sem stack trace | ⬜ | |

### H11 — Fluxo E2E humano completo (< 30 min)

| # | Passo | Status |
|---|-------|--------|
| H11.1 | WebChat → lead → fila → CSAT (fluxo limpo) | ⬜ / ➖ | |

---

# PARTE I — Admin Ops browser VPS (`admin/RADARCHAT-QA-MANUAL-POS-AUDITORIA-2.12.60-63.md`)

> Requer `SYSTEM_ADMIN` ou staff · Ambiente VPS/prod staff

### Bloco A — Admin Ops

| # | Item | Status |
|---|------|--------|
| I-A1 | Menu Empresas / Usuários separados | ⬜ / ➖ |
| I-A2 | `/admin/clients` | ⬜ / ➖ |
| I-A3 | `/admin/dashboard?tab=tenants` | ⬜ / ➖ |
| I-A4 | `/admin/moderation` | ⬜ / ➖ |
| I-A5 | `/admin/ai-blueprint` | ⬜ / ➖ |
| I-A6 | `/admin/ai-platform` | ⬜ / ➖ |
| I-A7 | **Bloco E:** alterar plano org + `AuditLog` | ⬜ / ➖ |
| I-A8 | Moderador read-only empresas | ⬜ / ➖ |

### Bloco B — Portal LGPD

| # | Item | Status |
|---|------|--------|
| I-B1 | `/platform/lgpd` abre | ⬜ |
| I-B2 | Busca telefone | ⬜ |
| I-B3 | Exportar JSON | ⬜ |
| I-B4 | Feed eventos export | ⬜ |
| I-B5 | Anonimizar contato teste | ⬜ |
| I-B6 | Re-busca pós-anonimizar | ⬜ |
| I-B7 | Evento `lgpd.anonymized` | ⬜ |

### Bloco C — Infra health

| # | Item | Status |
|---|------|--------|
| I-C1 | `/api/services/health` healthy | ⬜ | 🤖 smoke |
| I-C2 | Staff infra-health Mongo+Redis | ⬜ / ➖ |
| I-C3 | Degraded boot dev (opcional) | ➖ | |

### Bloco D — Bridge dedup

| # | Item | Status |
|---|------|--------|
| I-D1 | Bridge encaminha 1x | ⬜ |
| I-D2 | Retry não duplica | ⬜ |

---

# PARTE J — P2 opcional (não bloqueia gate)

| # | Item | Status |
|---|------|--------|
| J1 | Modelos visuais chatbox (`QA-WEBCHAT-CHATBOX-MODELS.md`) | ⬜ / ➖ |
| J2 | Barra header IA/LM/WA (`IA-CREDITOS-E-CARTEIRA.md`) | ⬜ / ➖ |

---

# REGISTRO DE FALHAS

| Data | Parte | # | Severidade | Descrição | Print/commit |
|------|-------|---|------------|-----------|--------------|
| | | | P0/P1/P2/P3 | | |
| | | | | | |

---

# DECISÕES FINAIS

## 1) Congelamento catálogo/endereço/PIX (Partes F + G)

| Pergunta | Resposta |
|----------|----------|
| **Decisão** | ⬜ APROVADO PARA CONGELAMENTO · ⬜ APROVADO COM RESSALVAS · ⬜ REPROVADO — HOTFIX |
| **R1 `não, é número 120` passou?** | ⬜ Sim · ⬜ Não |
| **Motivo** | |
| **Hotfix 2.17.62?** | ⬜ Sim · ⬜ Não |

## 2) Gate § Estabilização Fase 1 (Partes A–E + B + C + H essencial)

| Pergunta | Resposta |
|----------|----------|
| **Gate Fase 1 liberado?** | ⬜ Sim · ⬜ Não |
| **§ A sem falha crítica?** | ⬜ Sim · ⬜ Não |
| **§ C bridge/fallback OK?** | ⬜ Sim · ⬜ Não · ➖ N/A |
| **§ E supervisor/presença OK?** | ⬜ Sim · ⬜ Não |
| **Motivo se não** | |
| **Atualizar `ROADMAP-COMPLETUDE.md`?** | ⬜ Sim (após tudo verde) · ⬜ Não |

## 3) Auditoria geral + Admin

| Pergunta | Resposta |
|----------|----------|
| **Parte H manual concluída?** | ⬜ Sim · ⬜ Parcial · ⬜ Não |
| **Admin Ops (Parte I) concluída?** | ⬜ Sim · ⬜ N/A · ⬜ Não |
| **JSON `qa:auditoria:gate` gerado?** | ⬜ Sim · ⬜ Não — path: ______ |

## 4) Operações

| Item | Valor |
|------|-------|
| Deploy neste QA | **NÃO** |
| Push neste QA | **NÃO** |
| Produção alterada | **NÃO** |

---

# CHECKLIST RESUMO — CONTAGEM

Preencha ao final:

| Bloco | Total itens | ✅ OK | ❌ Falhou | ⏸ Bloq | ➖ N/A |
|-------|-------------|-------|----------|--------|--------|
| Parte A (Fase 1 WA) | 10 | | | | |
| Parte B (painel) | 12 | | | | |
| Parte C (WebChat) | 14 | | | | |
| Parte F+G (catálogo) | ~50 | | | | |
| Parte H (auditoria) | ~30 | | | | |
| Parte I (admin) | ~15 | | | | |

---

# PRÓXIMOS PASSOS APÓS PREENCHER

1. Copiar resultado para `docs/concluidos/QA-FASE1-RESULTADO-YYYY-MM-DD.md` (template `QA-FASE1-RESULTADO-TEMPLATE.md`)
2. Se catálogo verde → atualizar `RADARCHAT-QA-FINAL-CONGELAMENTO-...-2.17.61.md` §29
3. Se Fase 1 verde → marcar gate em `ROADMAP-COMPLETUDE.md`
4. Consolidar em `RADARCHAT-QA-HUMANO-REAL-FINAL-CATALOGO-ENDERECO-PIX-2.17.61-2026-07-01.md` (me envie preenchido ou peça consolidação)

---

*Checklist completo — RadarChat 2.17.61 — uma única fonte para QA humano real*
