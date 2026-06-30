import mongoose from 'mongoose';
import { AiKnowledgeBase, IAiKnowledgeBase } from '@/models/AiKnowledgeBase';
import {
  AI_AUTO_RESOLVE_MIN_SCORE,
  normalizeAiSearchText,
  scoreAiTextMatch,
} from '@/utils/ai-text-match';
import { sanitizeWebChatActionLinks } from '@/utils/webchat-safe-url.util';
import type {
  WebChatActionLink,
  WebChatFaqCatalog,
  WebChatFaqQuickReply,
  WebChatKbSuggestion,
} from '@/types/webchat';
import {
  WEBCHAT_FAQ_PICKER_MAX,
  WEBCHAT_FAQ_PICKER_MIN_SCORE,
} from '@/utils/webchat-faq-reply.util';

/** Categoria padrão quando o artigo não tem categoria definida. */
export const AI_KB_DEFAULT_CATEGORY = 'Geral';

export type KnowledgeBaseUpsertInput = {
  id?: string;
  title: string;
  content: string;
  category?: string;
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
      category: normalizeKbCategory(item.category),
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

  async findByIdForClient(clientId: string, id: string): Promise<IAiKnowledgeBase | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const row = await AiKnowledgeBase.findOne({
      _id: new mongoose.Types.ObjectId(id),
      clientId: new mongoose.Types.ObjectId(clientId),
      active: true,
    }).lean();
    return row ? (row as unknown as IAiKnowledgeBase) : null;
  }

  /** Artigos candidatos ao seletor numerado no widget (pergunta aberta). */
  async searchForWebChatPicker(
    clientId: string,
    query: string,
    limit = WEBCHAT_FAQ_PICKER_MAX,
  ): Promise<Array<{ row: IAiKnowledgeBase; score: number }>> {
    const hits = await this.searchRelevant(clientId, query, limit);
    return hits.filter(h => h.score >= WEBCHAT_FAQ_PICKER_MIN_SCORE);
  }

  buildKbSuggestions(
    hits: Array<{ row: IAiKnowledgeBase; score: number }>,
  ): WebChatKbSuggestion[] {
    return hits.slice(0, WEBCHAT_FAQ_PICKER_MAX).map((h, i) => ({
      id: String(h.row._id),
      label: (h.row.quickReplyLabel?.trim() || h.row.title).slice(0, 80),
      index: i + 1,
    }));
  }

  async countActiveArticles(clientId: string): Promise<number> {
    return AiKnowledgeBase.countDocuments({
      clientId: new mongoose.Types.ObjectId(clientId),
      active: true,
    });
  }

  /** Catálogo FAQ agrupado por categoria para o botão FAQ do widget. */
  async listFaqCatalog(clientId: string): Promise<WebChatFaqCatalog> {
    const rows = await AiKnowledgeBase.find({
      clientId: new mongoose.Types.ObjectId(clientId),
      active: true,
    })
      .sort({ category: 1, title: 1 })
      .select('title category quickReplyLabel')
      .lean();

    const grouped = new Map<string, WebChatFaqCatalog['categories'][number]['articles']>();
    for (const row of rows) {
      const category = normalizeKbCategory(row.category);
      const article = {
        id: String(row._id),
        title: row.title,
        label: (row.quickReplyLabel?.trim() || row.title).slice(0, 80),
      };
      const list = grouped.get(category) ?? [];
      list.push(article);
      grouped.set(category, list);
    }

    const categories = [...grouped.entries()]
      .map(([name, articles]) => ({ name, articles }))
      .sort((a, b) => {
        if (a.name === AI_KB_DEFAULT_CATEGORY) return 1;
        if (b.name === AI_KB_DEFAULT_CATEGORY) return -1;
        return a.name.localeCompare(b.name, 'pt-BR');
      });

    return { categories };
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
          .select('title content category links')
          .lean();

    if (!rows.length) return '';
    return rows.map(r => this.formatContextRow(r)).join('\n\n');
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
      .select('title content category keywords active links showAsQuickReply quickReplyLabel')
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

  /** Formata artigo para o prompt, incluindo links úteis do chat/site. */
  private formatContextRow(
    row: Pick<IAiKnowledgeBase, 'title' | 'content'> &
      Partial<Pick<IAiKnowledgeBase, 'category' | 'links'>>,
  ): string {
    const links = sanitizeWebChatActionLinks(row.links ?? []);
    const linkBlock = links.length
      ? `\nLinks úteis:\n${links.map(link => `- ${link.label}: ${link.url}`).join('\n')}`
      : '';
    const category = normalizeKbCategory(row.category);
    return `### ${row.title}\nCategoria: ${category}\n${row.content}${linkBlock}`;
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

export function normalizeKbCategory(raw?: string | null): string {
  const trimmed = String(raw ?? '').trim().slice(0, 80);
  return trimmed || AI_KB_DEFAULT_CATEGORY;
}
