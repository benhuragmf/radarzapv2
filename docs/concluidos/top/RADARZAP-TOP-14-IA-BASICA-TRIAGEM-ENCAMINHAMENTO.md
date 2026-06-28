# RadarZap — TOP 14/20 — IA Básica, Triagem e Encaminhamento

**Data:** 2026-06-24  
**Versão após TOP 14:** `2.12.0`  
**Branch:** `main`

---

## Resumo executivo

O TOP 14 consolidou a **IA Básica** como módulo de **triagem e roteamento** (não chat livre): classificador local expandido (`ticket_status`, `complaint`, `partnership`), thresholds oficiais de confiança (≥0.75 roteia), helpers `basic-triage.util.ts`, integração WA (`AiBasicTriageService`) e WebChat (`WebChatBasicTriageService`), auditoria `triage.classified`, anti-bridge, e fallback humano/fila para confiança baixa.

LLM opcional permanece com gate de créditos. IA Premium profunda → TOP 15.

---

## Herança dos TOPs anteriores

### TOP 01–13

IA Básica parcial; modos `basic_triage`/`hybrid`; WebChat/WA/Bridge/Inbox/Leads/Tickets fechados nos TOPs 07–13.

### Documentação mestre

`RADARZAP-SISTEMA-COMPLETO.md` §17 atualizada.

### Esta etapa fecha

Classificador, intenções, confiança, roteamento, fallback, WA/WebChat, anti-loop bridge, auditoria, testes.

### Esta etapa não faz

IA Premium (15), créditos/recarga (16), billing (17), chat livre.

---

## Estado Git inicial

| Item | Valor |
|------|-------|
| Branch | `main` |
| Último commit antes | `073222d` — `chore(top): bridge webchat whatsapp 2.11.99` |
| Modificados antes | Nenhum |
| Untracked | `data/`, `mocker/modelochat/` (não commitar) |

---

## Escopo autorizado

IA Básica, classificador, roteamento, fallback, integrações canal, testes, docs.

---

## Diagnóstico atual da IA Básica

| Item | Existe? | Arquivo | Observação |
|------|---------|---------|------------|
| Serviço WA | Sim | `AiBasicTriageService.ts` | `basic_triage` + `hybrid` |
| Serviço WebChat | Sim | `webchat-basic-triage.service.ts` | Bot triagem site |
| Classificador local | Sim | `basic-triage-classifier.ts` | Sem LLM obrigatório |
| Classificador LLM | Sim | `tryLlmClassification` | Opcional + gate créditos |
| Intenções | Sim | 10 intents internas | Mapeadas para produto |
| Confiança | Sim | 0–1 + tiers | HIGH 0.75, LOW 0.45 |
| Roteamento | Sim | `routeFromTriageChoice` / `escalate` | menuKey setor |
| Fallback | Sim | clarify / queue | `resolveBasicTriageAction` |
| WebChat | Sim | pipeline `queueStatus: bot` | |
| WhatsApp | Sim | `InboxService` → `AiBasicTriageService` | |
| hybrid | Sim | cadeia básica → premium se falhar | |
| Leads | Sim | `hasCommercialLeadIntent` | TOP 09 |
| Tickets | Sim | `ticket_status` orienta TK | não cria TK auto |
| Créditos | Sim | `AiUsageMeterService` | só LLM fallback |
| Logs | Sim | `triage.classified` | sem texto cliente |
| Testes | Sim | 3+ suites | + TOP 14 |

---

## Diagnóstico do classificador local

- Normalização: `normalizeAiSearchText` via `normalizeTriageText`.
- Keywords: comercial, financeiro, suporte, humano, TK, reclamação, parceria.
- Match por nome de setor cadastrado.
- Saudação → `greeting` (não roteia).
- KB/skills: `AiAutoResolveService` antes do classificador.

---

## Diagnóstico de intenções e confiança

| Intenção produto | Código interno | Confiança típica | Ação |
|------------------|----------------|------------------|------|
| sales | commercial | 0.76–0.88 | route se ≥0.75 |
| billing | finance | 0.80 | route |
| support | support | 0.74 | clarify (média) |
| ticket_status | ticket_status | 0.82 | clarify (orientação TK) |
| human_request | human_request | 0.88 | queue imediata |
| complaint | complaint | 0.80 | route |
| partnership | partnership | 0.77 | route |
| unknown | unknown/greeting | baixa | queue/clarify |

---

## Diagnóstico de roteamento por departamento

- Departamentos `clientVisible` via `loadClientVisibleDepartments`.
- menuKey 1–4 padrão mapeado por intent.
- Departamento inativo → hint inválido.
- Sem atendente online → fila TOP 07 (round-robin/presença).
- `supervisor_online` não recebe automático (TOP 05).

---

## Diagnóstico WebChat

- Modos `basic_triage` / `hybrid`.
- Bridge ativa → skip (`shouldSkipBasicTriageForBridge`).
- Confiança alta → `escalate` setor.
- Baixa → fila geral.
- `oi` → greeting, sem lead.

---

## Diagnóstico WhatsApp

- Pipeline após comandos `!` e bridge handler.
- `basic_triage` não cai em menu robotizado.
- Rate limit/envio humanizado herdado TOP 12.

---

## Diagnóstico Bridge

- WebChat: `whatsappBridgeActive` pula IA Básica.
- Mensagens forward/loop TOP 13 não reentram.

---

## Diagnóstico Leads, Contatos e Tickets

- Lead: `hasCommercialLeadIntent` — não em `oi`.
- Ticket: `ticket_status` responde orientação; não cria TK.
- Contato: criado pelo inbound canal, não pela IA.

---

## Diagnóstico de custo, créditos e fallback

- Classificador local: **sem custo** / sem créditos.
- LLM fallback: `basicTriageLlmFallbackEnabled` + `AiUsageMeterService.allowed`.
- Sem crédito → permanece local ou fila.
- `usageKind` básica vs premium separados (TOP 07 modos).

---

## Intenções oficiais

`sales`, `support`, `billing`, `ticket_status`, `human_request`, `complaint`, `partnership`, `unknown` — mapeadas em `basic-triage.util.ts`.

---

## Regras oficiais de confiança

- ≥ 0.75 (`TRIAGE_CONFIDENCE_HIGH`): encaminhar.
- 0.45–0.74: esclarecer.
- < 0.45: fila humana.

---

## Regras oficiais de roteamento

1. menuKey válido + departamento ativo.
2. human_request → fila imediata.
3. ticket_status → orientação, sem TK automático.
4. hybrid: baixa confiança passa para premium (TOP 15).

---

## Regras oficiais de fallback humano

Confiança baixa ou `unknown` → fila geral (menu 4) ou esclarecimento único.

---

## Regras oficiais anti-loop

Bridge ativa não reclassifica. Comandos `!` antes da IA no WA.

---

## Eventos, logs e rastreabilidade

`AttendanceEvent` kind `triage.classified` — meta: intent, confidence, action, menuKey, channel, fallback.

---

## Atualização da documentação mestre

`RADARZAP-SISTEMA-COMPLETO.md` §17, README, INDICE, CHANGELOG, SISTEMA-REGISTRO → `2.12.0`.

---

## Correções ou ajustes aplicados

1. Intenções `ticket_status`, `complaint`, `partnership`.
2. Threshold roteamento 0.75.
3. `basic-triage.util.ts` — produto, confiança, ação, bridge skip, auditoria.
4. Integração `resolveBasicTriageAction` em WA + WebChat.
5. Evento `triage.classified`.

---

## Testes criados ou atualizados

| Arquivo | Cobertura |
|---------|-----------|
| `basic-triage.util.test.ts` | **novo** |
| `basic-triage-classifier.test.ts` | intenções + threshold |
| `webchat-basic-triage.service.test.ts` | fila baixa confiança |

---

## Gates executados

```bash
npm run typecheck
npm run build
npm test
npm run qa:atendimento:gate
npm run qa:webchat-wa
```

---

## Arquivos alterados

- `src/utils/basic-triage-classifier.ts`
- `src/types/basic-triage.util.ts` (novo)
- `src/types/__tests__/basic-triage.util.test.ts` (novo)
- `src/services/ai/AiBasicTriageService.ts`
- `src/services/webchat/webchat-basic-triage.service.ts`
- `src/models/AttendanceEvent.ts`
- Testes classifier + webchat
- Docs TOP 14 + mestre + versionamento

---

## Riscos reduzidos

- IA Básica definida como triagem, não chat.
- TK não criado automaticamente.
- Lead só comercial.
- Bridge não reativa classificação.
- LLM gated por créditos.

---

## Riscos restantes

- Threshold 0.75 pode aumentar esclarecimentos vs 0.65 anterior.
- QA manual modos hybrid em produção.
- Mapeamento menuKey fixo 1–4 vs departamentos custom.

---

## Decisões pendentes para Benhur

1. Ajustar threshold por organização no painel.
2. LLM fallback default on/off por plano.
3. Perguntas de esclarecimento customizáveis por setor.

---

## Próximo passo recomendado

**TOP 15 — IA Premium profunda:** base de conhecimento, respostas generativas, gate créditos, fallback fila.
