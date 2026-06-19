import mongoose from 'mongoose';
import { AiKnowledgeBase, IAiKnowledgeBase } from '@/models/AiKnowledgeBase';
import {
  AI_AUTO_RESOLVE_MIN_SCORE,
  normalizeAiSearchText,
  scoreAiTextMatch,
} from '@/utils/ai-text-match';
import { sanitizeWebChatActionLinks } from '@/utils/webchat-safe-url.util';
import type { WebChatActionLink, WebChatFaqQuickReply } from '@/types/webchat';

export type KnowledgeBaseUpsertInput = {
  id?: string;
  title: string;
  content: string;
  active?: boolean;
  keywords?: string[];
  links?: WebChatActionLink[];
  showAsQuickReply?: boolean;
  quickReplyLabel?: string;
};

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

  async upsert(clientId: string, item: KnowledgeBaseUpsertInput): Promise<IAiKnowledgeBase> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const payload = {
      title: item.title.trim(),
      content: item.content.trim(),
      active: item.active ?? true,
      keywords: (item.keywords ?? [])
        .map(k => k.trim())
        .filter(Boolean)
        .slice(0, 30),
      links: sanitizeWebChatActionLinks(item.links),
      showAsQuickReply: Boolean(item.showAsQuickReply),
      quickReplyLabel: item.quickReplyLabel?.trim().slice(0, 60) || undefined,
    };

    if (item.id) {
      const doc = await AiKnowledgeBase.findOneAndUpdate(
        { _id: item.id, clientId: clientOid },
        payload,
        { new: true },
      );
      if (!doc) throw new Error('Item da base não encontrado');
      return doc;
    }
    return AiKnowledgeBase.create({
      clientId: clientOid,
      ...payload,
    });
  }

  async remove(clientId: string, id: string): Promise<void> {
    await AiKnowledgeBase.deleteOne({
      _id: id,
      clientId: new mongoose.Types.ObjectId(clientId),
    });
  }

  async listQuickReplies(clientId: string): Promise<WebChatFaqQuickReply[]> {
    const rows = await AiKnowledgeBase.find({
      clientId: new mongoose.Types.ObjectId(clientId),
      active: true,
      showAsQuickReply: true,
    })
      .sort({ updatedAt: -1 })
      .limit(8)
      .select('title quickReplyLabel')
      .lean();

    return rows.map(r => ({
      id: String(r._id),
      label: (r.quickReplyLabel?.trim() || r.title).slice(0, 60),
      title: r.title,
    }));
  }

  private scoreRow(query: string, row: Pick<IAiKnowledgeBase, 'title' | 'content' | 'keywords'>): number {
    const keywordText = (row.keywords ?? []).join(' ');
    return scoreAiTextMatch(query, row.title, `${row.content} ${keywordText}`);
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
      .select('title content keywords active links showAsQuickReply quickReplyLabel')
      .lean();

    return rows
      .map(row => ({
        row: row as unknown as IAiKnowledgeBase,
        score: this.scoreRow(query, row),
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

  /** Match para widget — inclui clique em sugestão rápida (título/rótulo). */
  async matchForWebChat(
    clientId: string,
    query: string,
  ): Promise<{ row: IAiKnowledgeBase; score: number } | null> {
    const q = query.trim();
    if (!q) return null;

    const norm = normalizeAiSearchText(q);
    const rows = await AiKnowledgeBase.find({
      clientId: new mongoose.Types.ObjectId(clientId),
      active: true,
    }).lean();

    for (const row of rows) {
      const candidates = [
        row.title,
        row.quickReplyLabel ?? '',
        ...(row.keywords ?? []),
      ]
        .map(s => normalizeAiSearchText(String(s)))
        .filter(Boolean);
      if (candidates.some(c => c === norm)) {
        return { row: row as unknown as IAiKnowledgeBase, score: 100 };
      }
    }

    const hits = rows
      .map(row => ({
        row: row as unknown as IAiKnowledgeBase,
        score: this.scoreRow(q, row),
      }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);

    const best = hits[0];
    if (!best || best.score < AI_AUTO_RESOLVE_MIN_SCORE) return null;
    return best;
  }
}
