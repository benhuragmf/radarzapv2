import { AiKnowledgeBaseService } from './AiKnowledgeBaseService';
import { AiSkillService } from './AiSkillService';
import { AiMemoryService } from './AiMemoryService';
import { AI_AUTO_RESOLVE_MIN_SCORE, scoreAiTextMatch } from '@/utils/ai-text-match';

export interface AiAutoResolveResult {
  hit: boolean;
  reply?: string;
  source?: 'knowledge_base' | 'skill' | 'memory';
  sourceId?: string;
  sourceTitle?: string;
  score?: number;
}

export class AiAutoResolveService {
  private static instance: AiAutoResolveService;

  static getInstance(): AiAutoResolveService {
    if (!this.instance) this.instance = new AiAutoResolveService();
    return this.instance;
  }

  /** Evita skill técnica de rastreador em dúvidas de plano/VIP/comercial (inbox/WhatsApp). */
  shouldAttemptAutoResolve(problemText: string, threadContext?: string): boolean {
    const query = problemText.trim();
    if (query.length < 12) return false;

    const combined = `${threadContext ?? ''} ${query}`.toLowerCase();
    if (
      /\b(plano|vip|sala de jogos|contrat|acesso vip|comercial|benef[ií]cio|assinatura|pacote|nome do plano)\b/i.test(
        combined,
      )
    ) {
      return false;
    }

    if (/^(sim|nao|não|s|ss|ok|isso|confirmo|correto)$/i.test(query)) return false;

    const techKeywords =
      /\b(n[aã]o conecta|aplicativo|app|erro|instala[cç][aã]o|configurar|offline|equipamento|sinal|gps|cobran[cç]a|boleto|pagamento|rastreador|rastreadores|parou)\b/i;
    if (query.length < 28 && !techKeywords.test(query)) return false;

    return true;
  }

  /** WebChat: permite busca na base para dúvidas comerciais e técnicas concretas. */
  shouldAttemptWebChatInquiry(problemText: string, threadContext?: string): boolean {
    const query = problemText.trim();
    if (query.length < 12) return false;
    if (/^(sim|nao|não|s|ss|ok|isso|confirmo|correto)$/i.test(query)) return false;

    const combined = `${threadContext ?? ''} ${query}`.toLowerCase();
    const inquiryKeywords =
      /\b(produto|promo[cç]|venda|pre[cç]o|plano|contrat|assinatura|pacote|desconto|oferta|rastreador|parou|n[aã]o funciona|n[aã]o conecta|aplicativo|app|erro|gps|offline|cobran[cç]a|boleto|pagamento)\b/i;
    return inquiryKeywords.test(combined);
  }

  /**
   * Tenta resolver sem chamar LLM — economiza créditos.
   * Prioridade: skill aprovada > item da base de conhecimento.
   */
  async tryResolve(
    clientId: string,
    problemText: string,
    opts?: { threadContext?: string; ticketAssist?: boolean; webchatInquiry?: boolean },
  ): Promise<AiAutoResolveResult> {
    const query = problemText.trim();
    if (!opts?.ticketAssist) {
      const allowed = opts?.webchatInquiry
        ? this.shouldAttemptWebChatInquiry(query, opts?.threadContext)
        : this.shouldAttemptAutoResolve(query, opts?.threadContext);
      if (!allowed) return { hit: false };
    }
    if (opts?.ticketAssist && query.length < 6) return { hit: false };

    const financeHint =
      /\b(cobran[cç]a|boleto|pagamento|mensalidade|financeiro|inadimpl|devendo|cortou|bloqueou|corte)\b/i.test(
        query,
      );
    const techOnlyHint =
      /\b(n[aã]o conecta|aplicativo|app|erro|instala[cç][aã]o|configurar)\b/i.test(query) &&
      !financeHint;

    const skillSvc = AiSkillService.getInstance();
    const skillMatch = techOnlyHint || !financeHint
      ? await skillSvc.findBestMatch(clientId, query)
      : null;
    if (skillMatch) {
      await skillSvc.recordUsage(String(skillMatch.skill._id));
      return {
        hit: true,
        reply: this.formatReply(skillMatch.skill.solution, skillMatch.skill.title),
        source: 'skill',
        sourceId: String(skillMatch.skill._id),
        sourceTitle: skillMatch.skill.title,
        score: skillMatch.score,
      };
    }

    const memorySvc = AiMemoryService.getInstance();
    const memories = await memorySvc.listApproved(clientId);
    let bestMem: { memory: (typeof memories)[0]; score: number } | null = null;
    for (const memory of memories) {
      const score = scoreAiTextMatch(query, memory.title, `${memory.tags} ${memory.content}`);
      if (score < AI_AUTO_RESOLVE_MIN_SCORE) continue;
      if (!bestMem || score > bestMem.score) bestMem = { memory, score };
    }
    if (bestMem) {
      return {
        hit: true,
        reply: this.formatReply(bestMem.memory.content, bestMem.memory.title),
        source: 'memory',
        sourceId: String(bestMem.memory._id),
        sourceTitle: bestMem.memory.title,
        score: bestMem.score,
      };
    }

    const kbSvc = AiKnowledgeBaseService.getInstance();
    const kbMatch = await kbSvc.findBestMatch(clientId, query);
    if (kbMatch) {
      return {
        hit: true,
        reply: this.formatReply(kbMatch.row.content, kbMatch.row.title),
        source: 'knowledge_base',
        sourceId: String(kbMatch.row._id),
        sourceTitle: kbMatch.row.title,
        score: kbMatch.score,
      };
    }

    return { hit: false };
  }

  private formatReply(body: string, title: string): string {
    const trimmed = body.trim();
    if (trimmed.length <= 1200) return trimmed;
    return `${trimmed.slice(0, 1150).trim()}…\n\n(Referência: ${title})`;
  }
}
