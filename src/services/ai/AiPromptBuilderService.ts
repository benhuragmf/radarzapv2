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

export interface BuildSystemPromptOptions {
  contactContext?: AiContactContext;
  clientText?: string;
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
    const [blueprint, org] = await Promise.all([
      PlatformAiBlueprintService.getInstance().getGlobal(),
      Organization.findById(clientId).select('name').lean(),
    ]);
    const varCtx = {
      companyName: org?.name ?? 'sua empresa',
      agentName: blueprint.agentName,
      contact: contactContext,
    };
    const template =
      contactContext?.knownFields.name && contactContext.name
        ? blueprint.greetingKnown
        : blueprint.greetingUnknown;
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
        Organization.findById(clientId).select('name').lean(),
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
    const varCtx = {
      companyName,
      agentName: blueprint.agentName,
      contact: opts.contactContext,
    };

    const ctxSvc = AiContextService.getInstance();
    const contactCtx = prompt.useSystemContext ? opts.contactContext : undefined;

    const collectFields: string[] = [];
    if (prompt.collectName) collectFields.push('nome');
    if (prompt.collectEmail) collectFields.push('e-mail');
    if (prompt.collectProblem) collectFields.push('problema/dúvida');
    if (prompt.collectCpfCnpj) collectFields.push('CPF ou CNPJ');
    if (prompt.collectAddress) collectFields.push('endereço');
    if (prompt.collectOrderNumber) collectFields.push('número do pedido');
    if (prompt.collectUrgency) collectFields.push('urgência');

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

Política de cadastro:
1. Confirme o nome com o cliente no início (mesmo se USER já tiver nome) — evita atender pessoa errada no mesmo WhatsApp.
2. Complete e-mail e dados básicos faltantes antes de encerrar ou transferir.
3. Uma pergunta por vez; não repita o que o cliente já informou nesta conversa.
4. Ao confirmar dado curto (nome de plano, produto), repita **uma vez** exatamente como o cliente disse — nunca duplique (ex.: "Rastreador", não "RastreadorRastreador").
5. Dúvidas de plano, VIP, comercial ou benefícios → use LLM ou encaminhe ao setor Comercial; não use resposta técnica de rastreador/app.

Dados a coletar antes de transferir: ${mustCollect.join(', ') || 'problema/dúvida'}.
${skipKnown.length ? `Já temos no cadastro (não pergunte de novo): ${skipKnown.join(', ')}.\n` : ''}
${contactCtx?.knownFields.name && contactCtx.name ? `Nome no cadastro (confirmar): ${contactCtx.name}.\n` : ''}
Setores (departmentMenuKey):
${deptList || '(nenhum setor cadastrado)'}

Prioridade:
1. KNOWLEDGE + SKILLS + MEMORY para resolver sem escalar.
2. Só peça dados faltantes.
3. shouldEscalate=true só quando necessário; shouldCreateTicket=true só para casos assíncronos.
4. Cliente quer complementar ticket existente: preencha targetTicketRef (TK-XXXXXX) e, ao receber o dado, shouldAppendToTicket=true + ticketAppendBody com o texto a gravar no ticket.

JSON obrigatório:
{
  "reply": "mensagem ao cliente em português",
  "collectedName": "",
  "collectedEmail": "",
  "collectedProblem": "",
  "collectedCpfCnpj": "",
  "collectedAddress": "",
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
  "internalSummary": "resumo interno"
}`;
  }
}
