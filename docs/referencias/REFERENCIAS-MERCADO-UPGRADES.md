# Referências de mercado — inspiração para upgrades RadarZap

**Criado:** 2026-06-27  
**Versão ref produto:** `2.12.6`  
**Tipo:** documento interno de **inspiração** — **não copiar** UI, código, textos ou contratos de terceiros.

> **Regra:** usar só para comparar **conceitos**, **posicionamento**, **padrões de produto** e **lacunas do RadarZap**. A implementação final segue arquitetura própria (`/api`, `WhatsAppService`, `InboxService`, etc.).

**Relacionados:** [`RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md`](../concluidos/RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md), [`PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md`](../concluidos/PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md), [`ROADMAP-COMPLETUDE.md`](../ROADMAP-COMPLETUDE.md), [`RADARZAP-PLANO-UPGRADES.md`](../RADARZAP-PLANO-UPGRADES.md)

---

## 1. Resumo executivo

| Referência | URL | Perfil | O que observar para o RadarZap |
|------------|-----|--------|--------------------------------|
| **Conecta360** | https://conecta360.com.br | Integradora BR — automação, ERP, WhatsApp | Posicionamento “integrações inteligentes”; produtos **HubAuto** (leads) + **WhatsAuto** (atendimento WA) |
| **Nextiva** | https://www.nextiva.com | UCaaS/CX global — omnichannel + IA | Plataforma unificada, **XBert AI**, perfil único do cliente, journey orchestration, CSAT/NPS, marketplace |
| **RadarLeads** | https://radarleads.com.br | Prospecção B2B BR — Maps, CNPJ, campanhas WA | Funil **lead → enriquecimento → campanha**; créditos avulsos; mapa geográfico; ROI calculator |
| **VoxCRM** | https://voxcrm.app | CRM + IA para WhatsApp (BR) — API Meta oficial | Inbox multicanal Meta, **funil conversacional**, agentes/supervisor IA, sequências, chat interno, carteirização |

**Complemento local:** Conecta360 e VoxCRM são referências do ecossistema brasileiro; Nextiva é enterprise global; RadarLeads cobre **outbound**; VoxCRM é o concorrente mais próximo em **CRM conversacional + IA + atendimento WA** (com foco em API oficial Meta).

---

## 2. Conecta360

**Site:** [conecta360.com.br](https://conecta360.com.br/#)  
**Posicionamento:** “Integrações inteligentes que otimizam seu negócio” — automação de serviços, recepção 24h, ERP, agendamentos e alertas.

### 2.1 Produtos citados no site

| Produto | Promessa (conceito) | Ideia para RadarZap |
|---------|---------------------|---------------------|
| **HubAuto** | Detecção e coleta automática de leads (MyHonda, Instagram, etc.) | Inspirar módulo futuro de **captura multicanal** além de WebChat/formulário — sem scraper copiado |
| **WhatsAuto** | Atendimento unificado WA, fluxos automatizados, distribuição de contatos | Paridade conceitual com Inbox + fila + modos atendimento + bridge WebChat↔WA |

### 2.2 Padrões de produto observáveis

- **Recepção automática 24h** — alinhado a modos robotic/IA + horário comercial WebChat.
- **Integração com ERPs** — RadarZap já tem webhooks + API REST; backlog: conectores nomeados (Omie, Bling, etc.) como **integrações documentadas**, não clone HubAuto.
- **Agendamentos e alertas automáticos** — inspirar automações pós-atendimento (lembrete, follow-up LGPD, ticket SLA).
- **Landing comercial simples** — blocos “problema → solução → CTA WhatsApp”; útil para site/marketing RadarZap, não para o painel.

### 2.3 RadarZap hoje vs inspiração

| Conceito Conecta360 | RadarZap hoje | Upgrade futuro (Fase D+) |
|---------------------|---------------|---------------------------|
| Distribuição de contatos | Fila, round-robin, setores | Regras por origem/campanha/UTM |
| Fluxos automatizados | Bot menu, IA triagem, ticket | Builder visual leve de fluxos |
| Integração ERP | Webhooks outbound, API | Catálogo integrações + templates evento |
| Coleta leads externa | Form embed, WebChat pré-chat | Import enriquecido + origem “integração” |

---

## 3. Nextiva

**Site:** [nextiva.com](https://www.nextiva.com)  
**Posicionamento:** “AI Customer Experience Management Platform” — voz, chat, e-mail, social, vídeo e IA em **uma plataforma**.

### 3.1 Pilares da NEXT Platform (conceitos)

1. **Customer Interactions** — omnichannel único (voice, video, live chat, email, social, messenger apps incl. WhatsApp).
2. **XBert AI** — agente que atende, agenda, responde FAQ, roteia, transcreve e resume conversas.
3. **Customer Experience** — jornada do cliente, sentimento em tempo real, perfil unificado, CSAT/NPS.
4. **Connected Tools** — marketplace CRM/helpdesk, analytics, REST APIs.

### 3.2 Funcionalidades destacadas (só como referência de mercado)

| Área | O que o mercado espera | RadarZap — status |
|------|------------------------|-------------------|
| Inbox unificado | Todas as conversas + histórico + contexto | ✅ Inbox WA + WebChat unificado (`channel=all`) |
| Perfil do cliente | LTV, interações, sentimento, VIP | 🟡 Contato + ticket; falta CRM/score formal |
| IA autônoma | Agenda, FAQ, handoff inteligente | 🟡 IA Básica/Premium + handoff; sem agenda nativa |
| Agent Assist | Sugestões em tempo real ao atendente | 🟡 Quick replies + assist ticket — expandir copilot |
| Transcrição/resumo | Resumo pós-conversa automático | 🔴 Backlog |
| CSAT/NPS | Pesquisa pós-interação + dashboard | ✅ CSAT Inbox; 🟡 NPS/dashboard CX |
| Journey orchestration | Orquestração ponta a ponta | 🔴 Backlog (automações por evento) |
| Integrações | Salesforce, HubSpot, Zendesk, etc. | 🟡 Webhooks + OpenAPI; sem marketplace UI |
| Workforce | Escala contact center, WFM | 🟡 Supervisor/presença; sem WFM completo |

### 3.3 Ideias de upgrade inspiradas (sem copiar Nextiva)

| # | Ideia | Onde encaixa no RadarZap | Prioridade sugerida |
|---|-------|--------------------------|---------------------|
| 1 | **Painel lateral “360° do cliente”** — origem, tickets, CSAT, bridge, tags, valor estimado | Inbox detalhe conversa | Fase D |
| 2 | **Resumo IA automático** ao encerrar conversa/ticket | `InboxService` / IA Premium | Fase D |
| 3 | **Sentimento/heurística simples** (positivo/neutro/negativo) na timeline | IA Básica local-first | Fase E |
| 4 | **Dashboard CX** — CSAT, TMA, % IA vs humano, NPS opcional | Relatórios plataforma | Fase D |
| 5 | **“Take over” explícito** — botão assumir da IA com audit trail | Já parcial (`!assumir`, Inbox); unificar UX | Fase D |
| 6 | **Catálogo integrações** no painel (não só webhooks genéricos) | `/settings#api-*` | Fase D+ |
| 7 | **Agendamento via IA** (horários comerciais + calendário externo) | WebChat + WA | Fase E+ |

### 3.4 O que **não** perseguir cedo

- Telefonia VoIP / contact center voice-first (escopo diferente do RadarZap).
- Plataforma enterprise multi-região com milhares de integrações nativas.
- “AI employee” como marca — RadarZap mantém **IA no contexto do negócio do cliente**, não produto genérico.

---

## 4. RadarLeads

**Site:** [radarleads.com.br](https://radarleads.com.br)  
**Posicionamento:** “Do lead à campanha, em um lugar só” — extração Google Maps, validação WhatsApp, CNPJ, campanhas em massa, export CSV.

### 4.1 Fluxo produto (conceito)

```txt
Busca (categoria + região) → Enriquecimento (WA + CNPJ) → Campanha ou export → Analytics
```

### 4.2 Padrões comerciais e UX

- **Créditos avulsos** (Start/Pro/Scale) + **planos empresariais** com pool compartilhado — similar ao modelo IA créditos + assinatura RadarZap.
- **Calculadora de ROI** na landing — boa referência para marketing/comercial RadarZap.
- **Mapa interativo** de leads — visualização geográfica de contatos/campanhas.
- **Comparativos “vs mercado”** (Hunter, Apollo, etc.) — referência de copy/SEO, não de produto.
- **Segmentos verticais** (agência, SDR, contabilidade…) — alinhado a templates por segmento (visão produto §3.8).

### 4.3 RadarZap hoje vs inspiração

| Conceito RadarLeads | RadarZap hoje | Upgrade futuro |
|---------------------|---------------|----------------|
| Extração Maps | ❌ Fora do escopo core | Opcional: integração/import CSV de listas externas |
| Validação WA em massa | 🟡 Consentimento + destinos | Ferramenta “validar números” pré-campanha |
| Consulta CNPJ | ❌ | Enriquecimento contato B2B (API Receita) |
| Campanhas em massa | ✅ Campanhas + fila humanizada | Melhorar preview, segmentação, mapa |
| Export CSV/XLSX | ✅ Contatos CSV | Paridade + filtros enriquecidos |
| Mapa de leads | ❌ | Mapa opcional em contatos/campanhas |
| Analytics prospecção | 🟡 Logs campanha | Dashboard outbound dedicado |

### 4.4 Complementaridade estratégica

RadarLeads = **topo de funil outbound** (achar quem contatar).  
RadarZap = **meio/fundo de funil** (atender, converter, ticket, IA, LGPD).

**Sinergia possível (produto RadarZap, implementação própria):**

1. Importar lista enriquecida → segmento → campanha RadarZap.
2. Respostas de campanha caem no **Inbox** com origem rastreada.
3. Lead que responde vira contato com consentimento LGPD.
4. **Não** replicar scraper Maps/CNPJ sem decisão explícita de escopo.

---

## 5. VoxCRM

**Site:** [voxcrm.app](https://voxcrm.app)  
**Posicionamento:** “CRM para WhatsApp que aprende a cada conversa” — plataforma BR que une agentes de IA, atendimento humano e CRM conversacional. Parceiro **Meta BSP** (Business Solution Provider); canais via **API oficial** (WhatsApp, Instagram, Messenger).

### 5.1 Módulos citados no site

| Módulo | Promessa (conceito) | Ideia para RadarZap |
|--------|---------------------|---------------------|
| **Atendimento** | Inbox multicanal, filas, distribuição, app mobile | Paridade com Inbox + fila + presença; backlog app nativo |
| **CRM** | Funil de vendas conversacional ligado às mensagens | Épico Fase D — funil mínimo no contato/conversa |
| **Agentes de IA** | Chatbot com fluxos, múltiplos agentes orquestrados | Modos atendimento + IA Premium; inspirar orquestração leve |
| **Agente Supervisor** | Detecta intenção, aciona agente ideal, transfere entre supervisores | Inspirar camada acima da triagem (roteamento por intenção/setor) |
| **Automações / Sequências** | Jornadas automatizadas pós-contato | Backlog automações por evento (não copiar builder deles) |
| **Campanhas** | Disparos e nurturing | Já existe em RadarZap — comparar UX preview/sequências |
| **Carteirização** | Contatos fixos por vendedor/atendente | Backlog: owner por contato + regras de transferência |
| **Pagamentos** | Cobrança integrada ao CRM | Fora do escopo imediato; referência comercial |
| **Agendamentos** | Agendamento automático no fluxo | Backlog Fase E+ (calendário + IA) |
| **Chat interno** | Comunicação entre equipe | ✅ RadarZap já tem (`direction: internal` no Inbox) |
| **Grupos (API oficial)** | Atendimento em grupos WA Meta | Backlog Fase 2 Cloud API — não priorizar Baileys |
| **Integrações** | API + nativas n8n, menus personalizados na conversa | Webhooks/OpenAPI RadarZap; catálogo integrações |

### 5.2 Padrões comerciais e operacionais

- **Licenciamento por canal** — licença base com até 3 usuários por canal; planos Pro vs Premium por volume de recursos.
- **Trial 14 dias** sem cartão — referência para onboarding comercial RadarZap.
- **Suporte consultivo** — migração de número, treinamento, desenho de fluxo IA (serviço, não só SaaS).
- **Prova de estabilidade** — uptime, status page, métricas públicas (mensagens/ano, usuários).
- **App Android/iOS** — mobilidade do atendente; RadarZap hoje é web-first.

### 5.3 RadarZap hoje vs inspiração

| Conceito VoxCRM | RadarZap hoje | Upgrade futuro (Fase D+) |
|-----------------|---------------|---------------------------|
| Inbox multicanal Meta | 🟡 WA (Baileys) + WebChat; stub Cloud API | Fase 2: Instagram/Messenger via Cloud API |
| Funil CRM conversacional | 🟡 Contatos/tags; sem estágios formais | Funil mínimo (visão produto §3.7) |
| Supervisor de IA | 🟡 Triagem IA + handoff | Camada “supervisor” roteando intenção → setor/agente |
| Múltiplos agentes IA | 🟡 Modos + skills KB | Orquestração por contexto (vendas vs suporte) |
| Sequências / nurturing | 🔴 | Automações pós-consentimento LGPD |
| Carteirização | 🟡 Assign Inbox | Owner persistente no contato + política transferência |
| Distribuição automática | ✅ Round-robin, fila, presença | Regras por carteira/capacidade |
| Chat interno | ✅ Timeline interna Inbox | Paridade — manter simplicidade |
| API + integrações | ✅ `/api`, webhooks, OpenAPI | UI catálogo + templates n8n-like |
| App mobile | ❌ | PWA ou app nativo — backlog longo |
| Pagamentos no CRM | ❌ | Opcional / integração externa |
| Status/uptime público | 🔴 | Página status plataforma (admin) |

### 5.4 Diferenciação RadarZap vs referência VoxCRM

| Onde RadarZap pode se destacar (implementação própria) | Nota |
|--------------------------------------------------------|------|
| **WebChat + bridge site↔WA** | VoxCRM foca canais Meta; RadarZap já tem widget + bridge |
| **Ticket TK + token público** | Rastreabilidade chamado fora do funil genérico |
| **LGPD / consentimento explícito** | Diferencial regulatório BR |
| **Modos de atendimento unificados** | Robotic / básica / premium / híbrido |
| **Baileys hoje + caminho Cloud API** | Flexibilidade PME vs dependência só BSP |
| **Preço PME + IA créditos** | Modelo carteira mensal já documentado |

### 5.5 O que observar sem copiar

- Naming “Agente Supervisor”, layout do funil Kanban, fluxos visuais do chatbot.
- Modelo de licença “3 usuários por canal” — inspirar **limites por plano**, não clonar tabela comercial.
- Integrações n8n — referência de **ecossistema**, implementar conectores RadarZap próprios.

---

## 6. Matriz consolidada — lacunas × referência

| Lacuna RadarZap (backlog) | Inspiração principal | Doc RadarZap |
|---------------------------|----------------------|--------------|
| Funil CRM mínimo | Nextiva + **VoxCRM** (funil conversacional) | `RADARZAP-VISAO-PRODUTO` §3.7 |
| Gatilhos WebChat avançados | Nextiva (journey) + Conecta360 (24h) | §3.5 |
| Relatórios conversão / CX | Nextiva (CSAT dashboard) | §3.9 |
| Templates por vertical | RadarLeads (segmentos) | §3.8 |
| Enriquecimento B2B | RadarLeads (CNPJ) | `LEADS-FORMULARIO`, contatos |
| Mapa geográfico contatos | RadarLeads | backlog campanhas |
| Integrações nomeadas ERP | Conecta360 + **VoxCRM** (n8n/API) | `WEBHOOKS`, API |
| Resumo/transcrição IA | Nextiva (XBert) | IA Premium |
| Onboarding wizard | Nextiva (demo center) | §3.10 |
| Modelo créditos + equipe | RadarLeads + Nextiva | `IA-CREDITOS`, `BILLING` |
| **Carteirização / owner contato** | **VoxCRM** | contatos, Inbox assign |
| **Sequências / nurturing** | **VoxCRM** | campanhas, automações |
| **Supervisor IA (roteamento intenção)** | **VoxCRM** + Nextiva | modos atendimento, triagem |
| **Multicanal Meta (IG/Messenger)** | **VoxCRM** | Fase 2 Cloud API |
| **Status page / uptime** | **VoxCRM** | `PRODUCTION`, admin |
| **App mobile atendente** | **VoxCRM** | backlog longo |

---

## 7. Protocolo de uso (agente e time)

1. **Consultar este doc** antes de épico Fase D+ de produto ou marketing.
2. **Extrair o “porquê”** (job-to-be-done), não o “como” da UI deles.
3. **Mapear** para módulo RadarZap existente antes de criar módulo novo.
4. **Respeitar gate Fase 1** — estabilização atendimento antes de features inspiradas nestas refs.
5. **Nunca** mencionar Conecta360/Nextiva/RadarLeads/**VoxCRM** no código, UI ou docs públicos do produto salvo pedido explícito.
6. Ao implementar item inspirado: registrar em `CHANGELOG.md` como feature RadarZap própria.

---

## 8. Histórico de consulta

| Data | Ação |
|------|------|
| 2026-06-27 | Documento criado a partir de análise [Conecta360](https://conecta360.com.br/#), [Nextiva](https://www.nextiva.com) (snapshot em `uploads/www.nextiva.com-1.md`) e [RadarLeads](https://radarleads.com.br) |
| 2026-06-27 | Adicionada referência [VoxCRM](https://voxcrm.app) — CRM conversacional BR, IA, API Meta |

---

*Referência interna — atualizar ao revisitar sites ou definir épico inspirado em algum bloco acima.*
