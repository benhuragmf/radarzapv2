import mongoose from 'mongoose';
import { AiPrompt, IAiPrompt } from '@/models/AiPrompt';
import { InboxDepartment } from '@/models/InboxDepartment';
import { Organization } from '@/models/Organization';
import { DEFAULT_AI_SYSTEM_PROMPT } from '@/types/ai-assistant';
import { buildBootstrapPrompt, missingBootstrapLine } from '@/utils/ai-bootstrap';
import { AiKnowledgeBaseService } from './AiKnowledgeBaseService';
import { AiSkillService } from './AiSkillService';
import { AiMemoryService } from './AiMemoryService';
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

  async buildSystemPrompt(
    clientId: string,
    opts: BuildSystemPromptOptions = {},
  ): Promise<string> {
    const [prompt, org, departments, kb, approvedSkills, approvedMemories] = await Promise.all([
      this.getOrCreatePrompt(clientId),
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

    const soul = (prompt.systemPrompt || DEFAULT_AI_SYSTEM_PROMPT).replace(
      /\{companyName\}/g,
      companyName,
    );

    const identity = prompt.identityBlock?.trim() || missingBootstrapLine('IDENTITY');
    const agentsRaw = [prompt.agentsGuide?.trim(), prompt.customRules?.trim()].filter(Boolean).join('\n\n');
    const agents = agentsRaw || missingBootstrapLine('AGENTS');
    const toolsNotes = prompt.toolsNotes?.trim() || missingBootstrapLine('TOOLS');

    const userBlock =
      contactCtx && prompt.useSystemContext
        ? ctxSvc.formatContextBlock(contactCtx)
        : missingBootstrapLine('USER (dados do contato)');

    const memoryBlock = AiMemoryService.getInstance().buildContextBlock(
      approvedMemories,
      opts.clientText,
    );

    const skillsBlock = AiSkillService.getInstance().buildApprovedContextBlock(
      approvedSkills,
      opts.clientText,
    );

    const deptList = departments.map(d => `- ${d.menuKey}: ${d.name}`).join('\n');

    const workspaceBootstrap = buildBootstrapPrompt([
      { key: 'identity', title: 'IDENTITY', content: identity },
      { key: 'soul', title: 'SOUL', content: soul, maxChars: 5000 },
      { key: 'agents', title: 'AGENTS', content: agents },
      { key: 'user', title: 'USER', content: userBlock },
      { key: 'tools', title: 'TOOLS', content: toolsNotes },
      {
        key: 'memory',
        title: 'MEMORY',
        content: memoryBlock || missingBootstrapLine('MEMORY (memória aprovada)'),
      },
      {
        key: 'skills',
        title: 'SKILLS',
        content: skillsBlock || '(nenhuma skill aprovada ainda)',
      },
      {
        key: 'kb',
        title: 'KNOWLEDGE',
        content: kb || '(base vazia — não invente informações)',
      },
    ]);

    return `Workspace da empresa ${companyName} (bootstrap injetado no system prompt — compatível Gemini/OpenAI).

${workspaceBootstrap}

Dados a coletar antes de transferir: ${mustCollect.join(', ') || 'problema/dúvida'}.
${skipKnown.length ? `Já temos no cadastro: ${skipKnown.join(', ')} — pule essas perguntas.\n` : ''}
Setores (departmentMenuKey):
${deptList || '(nenhum setor cadastrado)'}

Prioridade de atendimento:
1. Use MEMORY, SKILLS e KNOWLEDGE para RESOLVER automaticamente quando possível.
2. Só peça dados que ainda faltam.
3. Só transfira (shouldEscalate=true) quando não resolver, cliente pedir humano, ou coletar tudo para handoff.

Responda SEMPRE em JSON válido:
{
  "reply": "mensagem ao cliente em português",
  "collectedName": "",
  "collectedEmail": "",
  "collectedProblem": "",
  "collectedCpfCnpj": "",
  "collectedAddress": "",
  "collectedOrderNumber": "",
  "urgency": "low|medium|high",
  "intent": "",
  "departmentMenuKey": "",
  "confidence": 0.0,
  "shouldEscalate": false,
  "escalationReason": "",
  "internalSummary": "resumo interno"
}

Regras:
- reply: só texto para o cliente, nunca JSON cru.
- shouldEscalate: false até resolver ou coletar o necessário.
- collectedProblem: só quando o cliente descrever o motivo (não invente).
- Se MEMORY/SKILL/KNOWLEDGE tiver solução, explique os passos no reply antes de escalar.`;
  }
}
