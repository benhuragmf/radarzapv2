# RadarZap — Visão de produto e diferenciação

**Origem:** consolidação de `gg1.md`  
**Versão ref:** `2.11.13` · **Data:** 2026-06-21  
**Fase:** D+ (após estabilização) — **não bloqueia Fase 1**

**Plano de aplicação:** [`PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md`](./PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md)

---

## 1. Posicionamento

> **RadarZap é uma central inteligente de atendimento e vendas para sites brasileiros, unindo chat online, WhatsApp, IA e acompanhamento de chamados em um único painel.**

Alternativa comercial:

> **Transforme visitantes do seu site em clientes no WhatsApp — com atendimento automático, IA e equipe humana no mesmo lugar.**

Diferencial vs concorrentes globais (Intercom, Zendesk, Tidio): **simplicidade, preço acessível, foco PME Brasil, WhatsApp nativo, LGPD, linguagem local**.

---

## 2. Princípio central

Não competir só em “ter IA”. Competir em:

**Simples + barato + bonito + rápido + converter visitante em venda.**

---

## 3. Pilares de produto

### 3.1 Central de vendas (não só chat)

Fluxo alvo:

1. Visitante entra no site → gatilho proativo (30s, página de preço, exit intent)
2. IA ou humano qualifica intenção
3. Lead capturado (nome, telefone, motivo)
4. Continuidade no WhatsApp **mesmo histórico**
5. Follow-up autorizado (LGPD)
6. Relatório: conversas → oportunidades → vendas

**Já parcialmente no RadarZap:** WebChat, bridge WA, ticket, pré-chat, FAQ/IA, painel Inbox 3 colunas.

**Falta (backlog):** funil CRM explícito, gatilhos avançados, relatórios de conversão.

### 3.2 Chat site + WhatsApp unificado

O atendente deve ver:

- Página de origem, tempo no site
- Pré-chat (nome, telefone, motivo)
- Histórico site + WA + chamado `TK-…`
- Status do lead (novo → em atendimento → proposta → fechado → perdido)

**Hoje:** histórico WebChat + ticket + bridge; CRM leve **não** formalizado.

### 3.3 IA treinada no negócio

Base de conhecimento: FAQ, PDFs, site, regras “quando chamar humano”.

**Hoje:** KB/skills IA Premium; melhorar UX de “Base de conhecimento” e limites por plano.

### 3.4 Humano + copilot IA

IA resolve básico; humano fecha venda; painel sugere resposta/intenção.

**Hoje:** assistente ticket, quick replies, triagem — expandir sugestões contextuais.

### 3.5 Gatilhos inteligentes no site

Além de “30 segundos na página”:

- Página de preço / checkout
- Segunda visita
- Exit intent
- Produto específico
- Fora do horário
- Origem campanha (UTM)

**Hoje:** saudação proativa 30s (2.10.25); demais gatilhos = backlog.

### 3.6 Painel simples

Inbox estilo WhatsApp, dados do cliente lateral, assumir, tags, notas internas, resumo IA.

**Hoje:** design system 2.8.x, Inbox upgrade 2.10.18 — manter simplicidade ao adicionar CRM.

### 3.7 CRM leve embutido

Estágios mínimos:

`Novo lead → Em atendimento → Proposta enviada → Fechado → Perdido`

Campos: responsável, valor estimado, origem, motivo perda, lembrete.

**Hoje:** tags/contatos parciais — **épico Fase D**.

### 3.8 Automação por segmento

Templates prontos: clínica, loja, oficina, imobiliária, advocacia, restaurante, energia solar, suporte técnico, etc.

Cada template: mensagens pré-chat, FAQ seed, setores, horário, modo atendimento.

**Hoje:** `seed-platform-templates` — expandir por vertical.

### 3.9 Relatórios que mostram valor

Métricas desejadas:

- Conversas do site → leads → vendas (manual ou integração)
- Tempo médio resposta, conversão por atendente
- Páginas que mais geram chat
- % resolvido só com IA
- Chamados abertos/fechados

**Hoje:** relatórios inbox básicos — enriquecer com funil.

### 3.10 Instalação simples

Wizard: conta → cor → widget → colar script → conectar WA → testar.

Integrações: WordPress, Shopify, Nuvemshop, HTML, React.

**Hoje:** embed `widget.js` + docs — wizard onboarding = backlog.

### 3.11 Diferencial brasileiro

Pix, WhatsApp, LGPD, consentimento, horário comercial BR, templates locais, suporte PT-BR, planos em real.

**Hoje:** consentimento LGPD, WebChat horário — reforçar messaging comercial.

---

## 4. O que NÃO fazer na Fase 1 (estabilização)

- CRM completo
- Gatilhos avançados em massa
- Painel analytics enterprise
- Competir feature-a-feature com Zendesk

Priorizar **estabilidade atendimento** ([`ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md`](./concluidos/ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md)).

---

## 5. Roadmap sugerido (produto)

| Ordem | Épico | Depende de |
|-------|-------|------------|
| 1 | Estabilização WA/WebChat/Ticket | Gate Fase 1 |
| 2 | Funil CRM mínimo no contato/conversa | Fase D |
| 3 | Gatilhos WebChat (preço, exit, UTM) | Fase D |
| 4 | Templates por segmento | Fase D |
| 5 | Relatórios conversão | Fase D |
| 6 | Onboarding wizard | Fase D |
| 7 | IA Básica local-first | Fase E |

---

## 6. Combinação vencedora (resumo)

**Chat bonito + WhatsApp integrado + IA no negócio + humano + chamado TK+token + automações por comportamento + relatórios + preço PME.**

Chatbot genérico = commodity. **Central de conversão para pequenos negócios brasileiros** = posicionamento RadarZap.
