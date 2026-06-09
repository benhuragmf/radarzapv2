import mongoose from 'mongoose';
import { AiPrompt, IAiPrompt } from '@/models/AiPrompt';
import { InboxDepartment } from '@/models/InboxDepartment';
import { Organization } from '@/models/Organization';
import { DEFAULT_AI_SYSTEM_PROMPT } from '@/types/ai-assistant';
import { AiKnowledgeBaseService } from './AiKnowledgeBaseService';

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

  async buildSystemPrompt(clientId: string): Promise<string> {
    const [prompt, org, departments, kb] = await Promise.all([
      this.getOrCreatePrompt(clientId),
      Organization.findById(clientId).select('name').lean(),
      InboxDepartment.find({
        clientId: new mongoose.Types.ObjectId(clientId),
        isActive: true,
        clientVisible: { $ne: false },
      })
        .select('name menuKey')
        .lean(),
      AiKnowledgeBaseService.getInstance().buildContextBlock(clientId),
    ]);

    const companyName = org?.name ?? 'sua empresa';
    const collectFields: string[] = [];
    if (prompt.collectName) collectFields.push('nome');
    if (prompt.collectEmail) collectFields.push('e-mail');
    if (prompt.collectProblem) collectFields.push('problema/dúvida');
    if (prompt.collectCpfCnpj) collectFields.push('CPF ou CNPJ');
    if (prompt.collectAddress) collectFields.push('endereço');
    if (prompt.collectOrderNumber) collectFields.push('número do pedido');
    if (prompt.collectUrgency) collectFields.push('urgência');

    const deptList = departments
      .map(d => `- ${d.menuKey}: ${d.name}`)
      .join('\n');

    const base = (prompt.systemPrompt || DEFAULT_AI_SYSTEM_PROMPT).replace(
      /\{companyName\}/g,
      companyName,
    );

    return `${base}

Dados a coletar (obrigatórios antes de transferir): ${collectFields.join(', ') || 'nome, e-mail, problema'}.

Setores disponíveis (use departmentMenuKey com a chave numérica):
${deptList || '(nenhum setor cadastrado)'}

Base de conhecimento da empresa:
${kb || '(vazia — não invente informações)'}

Responda SEMPRE em JSON válido com este formato:
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
  "internalSummary": "resumo interno para o atendente"
}

Regras importantes:
- Envie ao cliente APENAS o texto do campo "reply" — nunca o JSON completo.
- Mantenha shouldEscalate como false até coletar todos os dados obrigatórios.
- Na primeira mensagem do cliente, cumprimente e peça o primeiro dado; não transfira ainda.`;
  }
}
