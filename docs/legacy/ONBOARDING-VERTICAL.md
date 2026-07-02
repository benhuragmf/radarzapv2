# Onboarding por tipo de comércio

Pré-configuração inicial da empresa a partir de **11 verticais** (10 segmentos + **Outro**).

**Versão:** 2.17.13 · **API base:** `/api/onboarding/*`

---

## Fluxo

1. Dono ou **Administrador** abre o painel pela primeira vez (ou **Configurações → Empresa**).
2. Escolhe o tipo de negócio no wizard (`BusinessVerticalOnboardingGate`).
3. `POST /api/onboarding/apply-vertical` aplica o preset no Mongo.
4. Campos `Organization.businessVertical` e `businessVerticalAppliedAt` são gravados.

O modal pode ser adiado (“Configurar depois”) — volta na próxima sessão do navegador (`sessionStorage`).

---

## API

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| GET | `/onboarding/verticals` | `billing:view` | Lista presets públicos (id, label, description, icon, suggestedAttendanceMode) |
| GET | `/onboarding/status` | `billing:view` | `{ businessVertical, businessVerticalAppliedAt, needsOnboarding }` |
| POST | `/onboarding/apply-vertical` | `billing:manage` **ou** `account:settings` | Aplica preset. Body: `{ verticalId, overwrite? }` |

OpenAPI: `GET /integrations/openapi` → paths `/onboarding/*`.

---

## O que cada preset aplica

| Camada | Modelo / serviço | Comportamento |
|--------|------------------|---------------|
| Setores | `InboxDepartment` | 4 setores por vertical. **Substitui** defaults só se zero conversas e sem membros nos setores |
| Bot Inbox | `InboxSettings` | Textos, horário comercial, mensagens fora do expediente |
| WebChat | `WebChatWidget` | Cria widget se não existir; patch aparência, motivos de contato, saudação proativa |
| FAQ | `AiKnowledgeBase` | Merge por título (não duplica) |
| Respostas rápidas | `InboxSettings.quickReplies` | Merge por `code` |
| Prompt IA | `AiPrompt` | Nome, saudações, coleta de dados; `systemPrompt` + `agentsGuide` → **`customRules`** (runtime) |
| Modo IA | `AiSettings` | `basic_triage`, `robotic` ou `disabled` por vertical; transfer rules parciais |
| Skills | `AiSkill` | Inseridas com `status: approved` |
| Memórias | `AiMemory` | Inseridas com `status: approved` |

### Plano free

Todos os dados acima são **gravados** sem checar plano. O **runtime** da IA (limites diários, credencial Radar Chat) continua bloqueado conforme `getAiPlanLimits('free')`. Ao fazer upgrade, KB/skills/memórias/prompt já estão prontos.

---

## Re-aplicar e overwrite

- Primeira aplicação: falha com **409** se `businessVertical` já existir (use `overwrite: true`).
- **`overwrite: false`** (padrão): KB/skills/memórias fazem merge; prompt preserva `customRules` existentes; modo IA não muda se já estiver ativo.
- **`overwrite: true`**: tenta substituir setores (mesmas regras de segurança); demais campos seguem merge por título/código onde aplicável.

---

## Código-fonte

| Arquivo | Função |
|---------|--------|
| `src/types/business-vertical.ts` | IDs, interfaces, `verticalAiRulesText()` |
| `src/constants/business-vertical-presets.ts` | Setores, inbox, webchat, KB base, quick replies |
| `src/constants/business-vertical-ai-packs.ts` | IA por vertical (`VERTICAL_AI_PACKS`, `mergeVerticalAiPack`) |
| `src/services/onboarding/BusinessVerticalSetupService.ts` | Orquestra apply no Mongo |
| `src/models/Organization.ts` | `businessVertical`, `businessVerticalAppliedAt` |
| Frontend | `BusinessVerticalPicker`, `BusinessVerticalOnboardingGate`, `BusinessVerticalSettingsSection` |

Testes: `src/constants/__tests__/business-vertical-presets.test.ts`, `src/services/onboarding/__tests__/business-vertical-setup.integration.test.ts`.

---

## Verticais

| ID | Label | Modo IA sugerido |
|----|-------|------------------|
| `varejo_fisico` | Loja física / varejo | basic_triage |
| `ecommerce` | E-commerce | basic_triage |
| `restaurante` | Restaurante / delivery | robotic |
| `clinica` | Clínica / consultório | basic_triage |
| `escritorio` | Escritório (adv/contábil) | basic_triage |
| `imobiliaria` | Imobiliária | basic_triage |
| `beleza` | Salão / estética | robotic |
| `auto_center` | Oficina / auto center | basic_triage |
| `educacao` | Escola / curso | basic_triage |
| `servicos` | Prestador de serviços | basic_triage |
| `outro` | Outro | disabled |

---

## Fora do escopo (backlog)

- Formulário de leads por vertical
- Tags / segmentos automáticos
- Templates de campanha exemplo
- Pré-chat (`prechatFields`) por segmento
- Catálogo PIX / `catalogSales` por vertical

Ver também: `docs/RADARCHAT-PLANO-UPGRADES.md` § Templates por segmento.
