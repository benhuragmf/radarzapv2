import mongoose from 'mongoose';
import { AiSkill, IAiSkill, AiSkillStatus } from '@/models/AiSkill';
import type { IAiConversationState } from '@/models/AiConversationState';
import {
  AI_AUTO_RESOLVE_MIN_SCORE,
  scoreAiTextMatch,
} from '@/utils/ai-text-match';

export interface AiSkillPayload {
  id: string;
  title: string;
  triggers: string;
  solution: string;
  status: AiSkillStatus;
  source: 'learned' | 'manual';
  sourceProblem?: string;
  usageCount: number;
  updatedAt: Date;
}

export class AiSkillService {
  private static instance: AiSkillService;

  static getInstance(): AiSkillService {
    if (!this.instance) this.instance = new AiSkillService();
    return this.instance;
  }

  async list(clientId: string): Promise<IAiSkill[]> {
    return AiSkill.find({ clientId: new mongoose.Types.ObjectId(clientId) })
      .sort({ updatedAt: -1 })
      .limit(100);
  }

  async listApproved(clientId: string): Promise<IAiSkill[]> {
    return AiSkill.find({
      clientId: new mongoose.Types.ObjectId(clientId),
      status: 'approved',
    })
      .sort({ usageCount: -1, updatedAt: -1 })
      .limit(30);
  }

  toPayload(row: IAiSkill): AiSkillPayload {
    return {
      id: String(row._id),
      title: row.title,
      triggers: row.triggers,
      solution: row.solution,
      status: row.status,
      source: row.source,
      sourceProblem: row.sourceProblem,
      usageCount: row.usageCount ?? 0,
      updatedAt: row.updatedAt,
    };
  }

  async upsert(
    clientId: string,
    item: {
      id?: string;
      title: string;
      triggers: string;
      solution: string;
      status?: AiSkillStatus;
      source?: 'learned' | 'manual';
    },
  ): Promise<IAiSkill> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    if (item.id) {
      const doc = await AiSkill.findOneAndUpdate(
        { _id: item.id, clientId: clientOid },
        {
          title: item.title,
          triggers: item.triggers,
          solution: item.solution,
          ...(item.status ? { status: item.status } : {}),
        },
        { new: true },
      );
      if (!doc) throw new Error('Skill não encontrada');
      return doc;
    }
    return AiSkill.create({
      clientId: clientOid,
      title: item.title,
      triggers: item.triggers,
      solution: item.solution,
      status: item.status ?? 'approved',
      source: item.source ?? 'manual',
    });
  }

  async remove(clientId: string, id: string): Promise<void> {
    await AiSkill.deleteOne({
      _id: id,
      clientId: new mongoose.Types.ObjectId(clientId),
    });
  }

  async approve(clientId: string, skillId: string, userId: string): Promise<IAiSkill> {
    const doc = await AiSkill.findOneAndUpdate(
      { _id: skillId, clientId: new mongoose.Types.ObjectId(clientId) },
      {
        status: 'approved',
        approvedByUserId: new mongoose.Types.ObjectId(userId),
        approvedAt: new Date(),
        rejectedAt: undefined,
      },
      { new: true },
    );
    if (!doc) throw new Error('Skill não encontrada');
    return doc;
  }

  async reject(clientId: string, skillId: string): Promise<IAiSkill> {
    const doc = await AiSkill.findOneAndUpdate(
      { _id: skillId, clientId: new mongoose.Types.ObjectId(clientId) },
      { status: 'rejected', rejectedAt: new Date() },
      { new: true },
    );
    if (!doc) throw new Error('Skill não encontrada');
    return doc;
  }

  async findBestMatch(
    clientId: string,
    query: string,
  ): Promise<{ skill: IAiSkill; score: number } | null> {
    const rows = await this.listApproved(clientId);
    let best: { skill: IAiSkill; score: number } | null = null;
    for (const skill of rows) {
      const score = scoreAiTextMatch(query, skill.title, `${skill.triggers} ${skill.solution}`);
      if (score < AI_AUTO_RESOLVE_MIN_SCORE) continue;
      if (!best || score > best.score) best = { skill, score };
    }
    return best;
  }

  async recordUsage(skillId: string): Promise<void> {
    await AiSkill.updateOne(
      { _id: skillId },
      { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } },
    );
  }

  async proposeFromConversation(
    clientId: string,
    conversationId: mongoose.Types.ObjectId,
    state: IAiConversationState,
    lastAiReply?: string,
  ): Promise<IAiSkill | null> {
    const problem = state.collectedProblem?.trim();
    if (!problem || problem.length < 12) return null;

    const clientOid = new mongoose.Types.ObjectId(clientId);
    const exists = await AiSkill.findOne({
      clientId: clientOid,
      sourceConversationId: conversationId,
      status: { $ne: 'rejected' },
    });
    if (exists) return exists;

    const tokens = problem.split(/\s+/).slice(0, 6).join(' ');
    const title = tokens.length > 40 ? `${tokens.slice(0, 40)}…` : tokens;
    const solution =
      lastAiReply?.trim() ||
      state.summary?.trim() ||
      'Atendimento encaminhado à equipe com contexto coletado pela IA.';

    return AiSkill.create({
      clientId: clientOid,
      title,
      triggers: problem.slice(0, 500),
      solution: solution.slice(0, 8000),
      status: 'pending',
      source: 'learned',
      sourceConversationId: conversationId,
      sourceProblem: problem.slice(0, 2000),
    });
  }

  buildApprovedContextBlock(skills: IAiSkill[], query?: string): string {
    if (!skills.length) return '';
    const ranked = query
      ? [...skills]
          .map(s => ({
            skill: s,
            score: scoreAiTextMatch(query, s.title, `${s.triggers} ${s.solution}`),
          }))
          .filter(r => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map(r => r.skill)
      : skills.slice(0, 8);

    const list = (ranked.length ? ranked : skills.slice(0, 5)).map(
      s => `### Skill: ${s.title}\nGatilhos: ${s.triggers}\nSolução: ${s.solution}`,
    );
    return list.join('\n\n');
  }

  async syncPayload(
    clientId: string,
    items: Array<{
      id?: string;
      title: string;
      triggers: string;
      solution: string;
      status?: AiSkillStatus;
      _delete?: boolean;
    }>,
  ): Promise<void> {
    for (const item of items) {
      if (item._delete && item.id) {
        await this.remove(clientId, item.id);
      } else if (item.title?.trim() && item.solution?.trim()) {
        await this.upsert(clientId, item);
      }
    }
  }
}
