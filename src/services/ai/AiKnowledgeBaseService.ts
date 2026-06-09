import mongoose from 'mongoose';
import { AiKnowledgeBase, IAiKnowledgeBase } from '@/models/AiKnowledgeBase';
import {
  AI_AUTO_RESOLVE_MIN_SCORE,
  scoreAiTextMatch,
} from '@/utils/ai-text-match';

export class AiKnowledgeBaseService {
  private static instance: AiKnowledgeBaseService;

  static getInstance(): AiKnowledgeBaseService {
    if (!this.instance) this.instance = new AiKnowledgeBaseService();
    return this.instance;
  }

  async list(clientId: string): Promise<IAiKnowledgeBase[]> {
    return AiKnowledgeBase.find({
      clientId: new mongoose.Types.ObjectId(clientId),
    })
      .sort({ updatedAt: -1 })
      .limit(100);
  }

  async upsert(
    clientId: string,
    item: { id?: string; title: string; content: string; active?: boolean },
  ): Promise<IAiKnowledgeBase> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    if (item.id) {
      const doc = await AiKnowledgeBase.findOneAndUpdate(
        { _id: item.id, clientId: clientOid },
        { title: item.title, content: item.content, active: item.active ?? true },
        { new: true },
      );
      if (!doc) throw new Error('Item da base não encontrado');
      return doc;
    }
    return AiKnowledgeBase.create({
      clientId: clientOid,
      title: item.title,
      content: item.content,
      active: item.active ?? true,
    });
  }

  async remove(clientId: string, id: string): Promise<void> {
    await AiKnowledgeBase.deleteOne({
      _id: id,
      clientId: new mongoose.Types.ObjectId(clientId),
    });
  }

  async buildContextBlock(clientId: string, query?: string): Promise<string> {
    const rows = query?.trim()
      ? (await this.searchRelevant(clientId, query, 5)).map(r => r.row)
      : await AiKnowledgeBase.find({
          clientId: new mongoose.Types.ObjectId(clientId),
          active: true,
        })
          .sort({ updatedAt: -1 })
          .limit(8)
          .select('title content')
          .lean();

    if (!rows.length) return '';
    return rows.map(r => `### ${r.title}\n${r.content}`).join('\n\n');
  }

  async searchRelevant(
    clientId: string,
    query: string,
    limit = 5,
  ): Promise<Array<{ row: IAiKnowledgeBase; score: number }>> {
    const rows = await AiKnowledgeBase.find({
      clientId: new mongoose.Types.ObjectId(clientId),
      active: true,
    })
      .select('title content active')
      .lean();

    return rows
      .map(row => ({
        row: row as unknown as IAiKnowledgeBase,
        score: scoreAiTextMatch(query, row.title, row.content),
      }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async findBestMatch(
    clientId: string,
    query: string,
  ): Promise<{ row: IAiKnowledgeBase; score: number } | null> {
    const hits = await this.searchRelevant(clientId, query, 1);
    const best = hits[0];
    if (!best || best.score < AI_AUTO_RESOLVE_MIN_SCORE) return null;
    return best;
  }
}
