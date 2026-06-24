import mongoose from 'mongoose';
import { AiMemory, IAiMemory, AiMemoryStatus } from '@/models/AiMemory';
import type { IAiConversationState } from '@/models/AiConversationState';
import { scoreAiTextMatch } from '@/utils/ai-text-match';
import { AiWalletService } from './AiWalletService';
import { AiUsageMeterService } from './AiUsageMeterService';

export interface AiMemoryPayload {
  id: string;
  title: string;
  content: string;
  tags: string;
  status: AiMemoryStatus;
  source: 'learned' | 'manual';
  usageCount: number;
  updatedAt: Date;
}

export class AiMemoryService {
  private static instance: AiMemoryService;

  static getInstance(): AiMemoryService {
    if (!this.instance) this.instance = new AiMemoryService();
    return this.instance;
  }

  async list(clientId: string): Promise<IAiMemory[]> {
    return AiMemory.find({ clientId: new mongoose.Types.ObjectId(clientId) })
      .sort({ updatedAt: -1 })
      .limit(100);
  }

  async listApproved(clientId: string): Promise<IAiMemory[]> {
    return AiMemory.find({
      clientId: new mongoose.Types.ObjectId(clientId),
      status: 'approved',
    })
      .sort({ usageCount: -1, updatedAt: -1 })
      .limit(40);
  }

  toPayload(row: IAiMemory): AiMemoryPayload {
    return {
      id: String(row._id),
      title: row.title,
      content: row.content,
      tags: row.tags ?? '',
      status: row.status,
      source: row.source,
      usageCount: row.usageCount ?? 0,
      updatedAt: row.updatedAt,
    };
  }

  async approve(clientId: string, memoryId: string, userId: string): Promise<IAiMemory> {
    const doc = await AiMemory.findOneAndUpdate(
      { _id: memoryId, clientId: new mongoose.Types.ObjectId(clientId) },
      {
        status: 'approved',
        approvedByUserId: new mongoose.Types.ObjectId(userId),
        approvedAt: new Date(),
        rejectedAt: undefined,
      },
      { new: true },
    );
    if (!doc) throw new Error('Memória não encontrada');
    return doc;
  }

  async reject(clientId: string, memoryId: string): Promise<IAiMemory> {
    const doc = await AiMemory.findOneAndUpdate(
      { _id: memoryId, clientId: new mongoose.Types.ObjectId(clientId) },
      { status: 'rejected', rejectedAt: new Date() },
      { new: true },
    );
    if (!doc) throw new Error('Memória não encontrada');
    return doc;
  }

  buildContextBlock(memories: IAiMemory[], query?: string): string {
    if (!memories.length) return '';
    const ranked = query
      ? [...memories]
          .map(m => ({
            memory: m,
            score: scoreAiTextMatch(query, m.title, `${m.tags} ${m.content}`),
          }))
          .filter(r => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map(r => r.memory)
      : memories.slice(0, 6);

    const list = (ranked.length ? ranked : memories.slice(0, 4)).map(
      m => `- ${m.title}: ${m.content}`,
    );
    return list.join('\n');
  }

  async proposeFromConversation(
    clientId: string,
    conversationId: mongoose.Types.ObjectId,
    state: IAiConversationState,
    lastAiReply?: string,
  ): Promise<IAiMemory | null> {
    const problem = state.collectedProblem?.trim();
    const summary = state.summary?.trim();
    if (!problem && !summary) return null;

    const usage = await AiUsageMeterService.getInstance().getUsageSnapshot(clientId);
    const learningCheck = AiWalletService.getInstance().canRunLearning(usage.wallet);
    if (!learningCheck.allowed) return null;

    const clientOid = new mongoose.Types.ObjectId(clientId);
    const exists = await AiMemory.findOne({
      clientId: clientOid,
      sourceConversationId: conversationId,
      status: { $ne: 'rejected' },
    });
    if (exists) return exists;

    const title =
      problem && problem.length >= 8
        ? problem.split(/\s+/).slice(0, 5).join(' ').slice(0, 80)
        : 'Contexto de atendimento';

    const parts = [
      problem && `Problema: ${problem}`,
      summary && `Resumo: ${summary}`,
      state.collectedName && `Cliente: ${state.collectedName}`,
      lastAiReply && `Última orientação IA: ${lastAiReply.slice(0, 500)}`,
    ].filter(Boolean);

    const content = parts.join('\n').slice(0, 4000);
    if (content.length < 20) return null;

    const memory = await AiMemory.create({
      clientId: clientOid,
      title,
      content,
      tags: problem?.slice(0, 500) ?? '',
      status: 'pending',
      source: 'learned',
      sourceConversationId: conversationId,
    });
    await AiWalletService.getInstance().recordLearningOp(clientId, 'memory');
    return memory;
  }

  async syncPayload(
    clientId: string,
    items: Array<{
      id?: string;
      title: string;
      content: string;
      tags?: string;
      status?: AiMemoryStatus;
      _delete?: boolean;
    }>,
  ): Promise<void> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    for (const item of items) {
      if (item._delete && item.id) {
        await AiMemory.deleteOne({ _id: item.id, clientId: clientOid });
        continue;
      }
      if (!item.title?.trim() || !item.content?.trim()) continue;
      if (item.id) {
        await AiMemory.findOneAndUpdate(
          { _id: item.id, clientId: clientOid },
          {
            title: item.title,
            content: item.content,
            tags: item.tags ?? '',
            ...(item.status ? { status: item.status } : {}),
          },
        );
      } else {
        await AiMemory.create({
          clientId: clientOid,
          title: item.title,
          content: item.content,
          tags: item.tags ?? '',
          status: item.status ?? 'approved',
          source: 'manual',
        });
      }
    }
  }
}
