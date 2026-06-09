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

  /**
   * Tenta resolver sem chamar LLM — economiza créditos.
   * Prioridade: skill aprovada > item da base de conhecimento.
   */
  async tryResolve(clientId: string, problemText: string): Promise<AiAutoResolveResult> {
    const query = problemText.trim();
    if (query.length < 10) return { hit: false };

    const skillSvc = AiSkillService.getInstance();
    const skillMatch = await skillSvc.findBestMatch(clientId, query);
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
