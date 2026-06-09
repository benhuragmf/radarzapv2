import mongoose from 'mongoose';
import { AiKnowledgeBase, IAiKnowledgeBase } from '@/models/AiKnowledgeBase';

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

  async buildContextBlock(clientId: string): Promise<string> {
    const rows = await AiKnowledgeBase.find({
      clientId: new mongoose.Types.ObjectId(clientId),
      active: true,
    })
      .sort({ updatedAt: -1 })
      .limit(20)
      .select('title content')
      .lean();
    if (!rows.length) return '';
    return rows.map(r => `### ${r.title}\n${r.content}`).join('\n\n');
  }
}
