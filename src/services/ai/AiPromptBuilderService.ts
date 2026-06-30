import mongoose from 'mongoose';
import { AiPrompt, IAiPrompt } from '@/models/AiPrompt';
import { InboxDepartment } from '@/models/InboxDepartment';
import { Organization } from '@/models/Organization';
import { buildBootstrapPrompt, missingBootstrapLine } from '@/utils/ai-bootstrap';
import { applyAiPromptVars } from '@/utils/ai-prompt-vars';
import { AiKnowledgeBaseService } from './AiKnowledgeBaseService';
import { AiSkillService } from './AiSkillService';
import { AiMemoryService } from './AiMemoryService';
import { PlatformAiBlueprintService } from './PlatformAiBlueprintService';
import type { AiContactContext } from './AiContextService';
import { AiContextService } from './AiContextService';
import type { TicketBriefForAssist } from '@/types/ticket-assist';
import type { TicketClientIntent } from '@/utils/ticket-client-intent';
import { normalizeCatalogSalesConfig } from '@/types/catalog-sales';
import { formatKmRatesForAiPrompt, normalizeKmRates } from '@/utils/catalog-delivery.util';

export interface BuildSystemPromptOptions {
  contactContext?: AiContactContext;
  clientText?: string;
  ticketContext?: TicketBriefForAssist;
  ticketClientIntent?: TicketClientIntent;
}

export class AiPromptBuilderService {
  private static instance: AiPromptBuilderService;

  static getInstance(): AiPromptBuilderService {
    if (!this.instance) this.instance = new AiPromptBuilderService();
    return this.instance;
  }

  async getOrCreatePrompt(clientId: string): Promise<IAiPrompt> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    let doc = await AiPrompt.findOne({ clientId: clientOid });
    if (!doc) doc = await AiPrompt.create({ clientId: clientOid });
    return doc;
  }

  async buildGreeting(
    clientId: string,
    contactContext?: AiContactContext,
  ): Promise<string> {
    const [blueprint, org, prompt] = await Promise.all([
      PlatformAiBlueprintService.getInstance().getGlobal(),
      Organization.findById(clientId).select('name').lean(),
      this.getOrCreatePrompt(clientId),
    ]);
    const varCtx = {
      companyName: org?.name ?? 'sua empresa',
      agentName: prompt.agentName?.trim() || blueprint.agentName,
      contact: contactContext,
    };
    const template =
      contactContext?.knownFields.name && contactContext.name
        ? prompt.greetingKnown?.trim() || blueprint.greetingKnown
        : prompt.greetingUnknown?.trim() || blueprint.greetingUnknown;
    return applyAiPromptVars(template, varCtx);
  }

  async buildSystemPrompt(
    clientId: string,
    opts: BuildSystemPromptOptions = {},
  ): Promise<string> {
    const [prompt, blueprint, org, departments, kb, approvedSkills, approvedMemories] =
      await Promise.all([
        this.getOrCreatePrompt(clientId),
        PlatformAiBlueprintService.getInstance().getGlobal(),
        Organization.findById(clientId).select('name address catalogSales').lean(),
        InboxDepartment.find({
          clientId: new mongoose.Types.ObjectId(clientId),
          isActive: true,
          clientVisible: { $ne: false },
        })
          .select('name menuKey')
          .lean(),
        AiKnowledgeBaseService.getInstance().buildContextBlock(clientId, opts.clientText),
        AiSkillService.getInstance().listApproved(clientId),
        AiMemoryService.getInstance().listApproved(clientId),
      ]);

    const companyName = org?.name ?? 'sua empresa';
    const agentName = prompt.agentName?.trim() || blueprint.agentName;
    const varCtx = {
      companyName,
      agentName,
      contact: opts.contactContext,
    };

    const ctxSvc = AiContextService.getInstance();
    const contactCtx = prompt.useSystemContext ? opts.contactContext : undefined;

    const collectFields: string[] = [];
    if (prompt.collectName) collectFields.push('nome');
    if (prompt.collectEmail) collectFields.push('e-mail');
    if (prompt.collectProblem) collectFields.push('problema/dúvida');
    if (prompt.collectCpfCnpj) collectFields.push('CPF ou CNPJ');
    if (prompt.collectAddress) collectFields.push('endereço completo');
    if (prompt.collectPhone) collectFields.push('telefone/WhatsApp');
    if (prompt.collectCompany) collectFields.push('empresa');
    if (prompt.collectDeliveryNotes) collectFields.push('complemento ou ponto de referência');
    if (prompt.collectPreferredSchedule) collectFields.push('horário preferido para entrega/visita');
    if (prompt.collectOrderNumber) collectFields.push('número do pedido');
    if (prompt.collectUrgency) collectFields.push('urgência');

    const catalogCfg = normalizeCatalogSalesConfig(org?.catalogSales);
    const catalogWantsAddress =
      catalogCfg.enabled &&
      catalogCfg.pixEnabled &&
      catalogCfg.requireDeliveryAddress === true;
    if (catalogWantsAddress && !collectFields.some(f => f.includes('endereço'))) {
      collectFields.push('endereço completo ou pin de localização no WhatsApp');
    }

    const skipKnown = contactCtx ? ctxSvc.fieldsAlreadyKnown(contactCtx, prompt) : [];
    const mustCollect = collectFields.filter(f => !skipKnown.includes(f));
    if (prompt.collectName && !mustCollect.includes('nome')) {
      mustCollect.unshift('confirmação do nome');
    }

    const identity = applyAiPromptVars(blueprint.identity, varCtx);
    const soul = applyAiPromptVars(blueprint.soul, varCtx);
    const agentsBase = applyAiPromptVars(blueprint.agents, varCtx);
    const tenantRules = prompt.customRules?.trim();
    const agents = tenantRules
      ? `${agentsBase}\n\n## Regras adicionais da empresa\n${tenantRules}`
      : agentsBase;
    const toolsNotes = applyAiPromptVars(blueprint.tools, varCtx);

    const userBlock =
      contactCtx && prompt.useSystemContext
        ? ctxSvc.formatContextBlock(contactCtx)
        : missingBootstrapLine('USER');

    const tenantMemories = AiMemoryService.getInstance().buildContextBlock(
      approvedMemories,
      opts.clientText,
    );
    const memoryBlock = [
      applyAiPromptVars(blueprint.memoryGuide, varCtx),
      tenantMemories ? `\nMemórias aprovadas da empresa:\n${tenantMemories}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const tenantSkills = AiSkillService.getInstance().buildApprovedContextBlock(
      approvedSkills,
      opts.clientText,
    );
    const skillsBlock = [
      applyAiPromptVars(blueprint.skillsGuide, varCtx),
      tenantSkills ? `\nSkills aprovadas:\n${tenantSkills}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const knowledgeBlock = [
      applyAiPromptVars(blueprint.knowledgeGuide, varCtx),
      kb ? `\nItens da base do cliente:\n${kb}` : '\n(Base de conhecimento do cliente vazia — não invente)',
    ].join('\n');

    const finalRules = applyAiPromptVars(blueprint.finalRules, varCtx);
    const deptList = departments.map(d => `- ${d.menuKey}: ${d.name}`).join('\n');

    const deliveryOrigin =
      catalogCfg.deliveryOriginAddress?.trim() || org?.address?.trim() || '';
    const catalogDeliveryBlock =
      catalogCfg.enabled && catalogCfg.pixEnabled
        ? [
            catalogCfg.pixInstructions?.trim()
              ? `Instruções PIX da empresa: ${catalogCfg.pixInstructions.trim()}`
              : '',
            catalogCfg.deliveryInstructions?.trim()
              ? `Entrega/frete: ${catalogCfg.deliveryInstructions.trim()}`
              : '',
            catalogCfg.useDistanceBasedDelivery && deliveryOrigin
              ? formatKmRatesForAiPrompt(
                  deliveryOrigin,
                  normalizeKmRates(catalogCfg.deliveryKmRates),
                )
              : '',
            catalogWantsAddress
              ? 'Endereço obrigatório antes do PIX — peça CEP e número OU oriente o pin no WhatsApp; se o pin for impreciso o sistema pede rua e número — não informe frete.'
              : '',
          ]
            .filter(Boolean)
            .join('\n')
        : '';

    const ticketBlock = opts.ticketContext
      ? [
          `## TICKET ATIVO (${opts.ticketContext.ticketRef})`,
          opts.ticketContext.contextBlock,
          opts.ticketClientIntent
            ? `Intenção detectada do cliente: ${opts.ticketClientIntent}`
            : '',
          'Responda perguntas sobre o chamado; grave no ticket só dados novos do cliente.',
        ]
          .filter(Boolean)
          .join('\n')
      : '';

    const workspaceBootstrap = buildBootstrapPrompt([
      { key: 'identity', title: 'IDENTITY', content: identity },
      { key: 'soul', title: 'SOUL', content: soul, maxChars: 5000 },
      { key: 'agents', title: 'AGENTS', content: agents },
      { key: 'user', title: 'USER', content: userBlock },
      { key: 'tools', title: 'TOOLS', content: toolsNotes },
      { key: 'memory', title: 'MEMORY', content: memoryBlock },
      { key: 'skills', title: 'SKILLS', content: skillsBlock },
      { key: 'knowledge', title: 'KNOWLEDGE', content: knowledgeBlock },
      { key: 'final', title: 'REGRA FINAL', content: finalRules },
    ]);

    return `Blueprint RadarZap v${blueprint.version} — empresa ${companyName} (system prompt Gemini/OpenAI).

${workspaceBootstrap}
${ticketBlock ? `\n${ticketBlock}\n` : ''}

Política de cadastro e nome:
1. WhatsApp sem nome no USER: peça o nome. Com nome no USER: confirme levemente antes de aprofundar.
2. Chat do site ou USER com nome/e-mail conhecidos: use o nome — não peça nem confirme de novo.
3. Complete e-mail e dados básicos faltantes antes de encerrar ou transferir (uma pergunta por vez).
4. Ao confirmar dado curto (plano, produto), repita **uma vez** exatamente como o cliente disse.

Política de resolução (antes de transferir):
1. Pedido vago de setor/suporte/comercial → pergunte o que precisa; shouldEscalate=false.
2. Dúvida concreta → SKILLS, depois KNOWLEDGE, depois MEMORY.
3. Depois de orientar, pergunte se resolveu ou se quer humano.
4. shouldEscalate=true só após tentativa de ajuda, insistência do cliente ou caso urgente/sensível.
5. Não prometa encaminhamento na primeira mensagem sobre um assunto.
6. Comercial/promoções: responda pela KNOWLEDGE antes de sugerir setor humano.

Dados a coletar antes de transferir: ${mustCollect.join(', ') || 'problema/dúvida'}.
${skipKnown.length ? `Já temos no cadastro (não pergunte de novo): ${skipKnown.join(', ')}.\n` : ''}
${contactCtx?.knownFields.name && contactCtx.name ? `Nome no cadastro: ${contactCtx.name}.\n` : ''}
Politica comercial, catalogo e pagamento:
1. Para perguntas sobre empresa, produtos, estoque, preco, frete, link de compra ou checkout, use KNOWLEDGE primeiro.
2. Se o artigo tiver links, envie o link direto adequado ao produto, checkout ou rastreio — o cliente pode comprar pela loja sem fluxo PIX.
3. Nunca invente estoque, valor, desconto, prazo ou disponibilidade. Se faltar dado na base, peca confirmacao ou escale.
4. Se o cliente enviar comprovante/PIX por imagem, registre como anexo/coleta e transfira para Financeiro/humano quando for preciso confirmar baixa. Nao confirme pagamento apenas pela imagem sem integracao oficial.
5. Para confirmar compra com PIX no chat (nao pelo link), preencha shouldCreateCatalogOrder=true, catalogProductId e catalogProductName. Se precisar de endereco, colete collectedAddress antes do PIX. Com entrega por distancia ativa, NUNCA informe frete nem total — o sistema envia mensagem automatica com valores exatos.
6. Se o cliente pedir link, loja ou site, priorize o link — nao force PIX nem shouldCreateCatalogOrder.
${catalogDeliveryBlock ? `\nConfiguracao comercial PIX/entrega da empresa:\n${catalogDeliveryBlock}\n` : ''}

Setores (departmentMenuKey):
${deptList || '(nenhum setor cadastrado)'}

Prioridade:
1. SKILLS + KNOWLEDGE + MEMORY para resolver sem escalar.
2. Só peça dados faltantes.
3. shouldEscalate=true só quando necessário; shouldCreateTicket=true só para casos assíncronos.
4. Cliente quer complementar ticket existente: preencha targetTicketRef (TK-XXXXXX) e, ao receber dado factual novo (telefone, endereço, descrição), shouldAppendToTicket=true + ticketAppendBody.
5. Pergunta sobre status/andamento do ticket: responda com clareza; shouldAppendToTicket=false — nunca grave perguntas como complemento.
6. Cliente recusou ("não obrigado", "nada mais"): despedida curta; shouldAppendToTicket=false.
7. Tente resolver com a base antes de só registrar no ticket.

JSON obrigatório:
{
  "reply": "mensagem ao cliente em português",
  "collectedName": "",
  "collectedEmail": "",
  "collectedProblem": "",
  "collectedCpfCnpj": "",
  "collectedAddress": "",
  "collectedPhone": "",
  "collectedCompany": "",
  "collectedDeliveryNotes": "",
  "collectedPreferredSchedule": "",
  "collectedOrderNumber": "",
  "urgency": "low|medium|high|critical",
  "intent": "",
  "departmentMenuKey": "",
  "confidence": 0.0,
  "shouldEscalate": false,
  "shouldCreateTicket": false,
  "ticketReason": "",
  "targetTicketRef": "",
  "shouldAppendToTicket": false,
  "ticketAppendBody": "",
  "escalationReason": "",
  "internalSummary": "resumo interno",
  "shouldCreateCatalogOrder": false,
  "catalogProductId": "",
  "catalogProductName": ""
}`;
  }
}
