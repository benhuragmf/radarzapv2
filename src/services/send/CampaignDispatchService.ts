import mongoose from 'mongoose';
import { MessageQueue, IMessageQueue } from '@/models/MessageQueue';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';
import { delay } from '@/services/whatsapp/waSessionEvents';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('CampaignDispatchService');

const PRIORITY_MAP = { high: 8, medium: 5, low: 2 } as const;

export type CampaignPriority = keyof typeof PRIORITY_MAP;

export interface CreateCampaignInput {
  clientId: string;
  title: string;
  message: string;
  image?: string;
  destinations: Array<{ type: 'group' | 'contact'; identifier: string; name: string }>;
  sendAt?: Date;
  priority?: CampaignPriority;
  delayBetweenMs?: number;
  requireConnected?: boolean;
}

/**
 * Cria e despacha campanhas de envio manual (painel Enviar agora).
 */
export class CampaignDispatchService {
  private static instance: CampaignDispatchService;

  static getInstance(): CampaignDispatchService {
    if (!CampaignDispatchService.instance) {
      CampaignDispatchService.instance = new CampaignDispatchService();
    }
    return CampaignDispatchService.instance;
  }

  priorityValue(p: CampaignPriority = 'medium'): number {
    return PRIORITY_MAP[p] ?? 5;
  }

  async createCampaign(input: CreateCampaignInput): Promise<IMessageQueue> {
    const scheduledFor = input.sendAt && input.sendAt > new Date()
      ? input.sendAt
      : new Date();

    const msg = await MessageQueue.createMessage(
      new mongoose.Types.ObjectId(input.clientId),
      {
        text: input.message.trim(),
        image: input.image,
        template: 'manual-send',
        variables: {
          title: input.title,
          delayBetweenMs: input.delayBetweenMs ?? 3000,
          requireConnected: input.requireConnected !== false,
          priority: input.priority ?? 'medium',
        },
      },
      input.destinations,
      this.priorityValue(input.priority),
      scheduledFor,
    );

    if (scheduledFor <= new Date()) {
      await this.dispatchOne(msg);
    }

    return msg;
  }

  async processPending(): Promise<number> {
    const pending = await MessageQueue.findPendingMessages(15);
    let processed = 0;
    for (const msg of pending) {
      try {
        await this.dispatchOne(msg);
        processed++;
      } catch (err) {
        logger.error(`Campaign dispatch failed ${msg._id}:`, err);
      }
    }
    return processed;
  }

  async dispatchOne(msg: IMessageQueue): Promise<void> {
    if (msg.status !== 'pending' && msg.status !== 'processing') return;

    const clientId = msg.clientId.toString();
    const wa = WhatsAppService.getInstance();
    const requireConnected = msg.content.variables?.requireConnected !== false;

    if (requireConnected && !wa.isClientConnected(clientId)) {
      const overdue = msg.scheduledFor.getTime() < Date.now() - 60 * 60 * 1000;
      if (overdue) {
        await msg.markAsFailed('WhatsApp desconectado — reconecte em Conexão WhatsApp');
      }
      return;
    }

    await msg.markAsProcessing();
    const delayBetweenMs = Number(msg.content.variables?.delayBetweenMs) || 3000;
    const errors: string[] = [];
    let sent = 0;

    for (let i = 0; i < msg.destinations.length; i++) {
      const dest = msg.destinations[i];
      try {
        if (i > 0 && delayBetweenMs > 0) await delay(delayBetweenMs);
        await wa.sendManualMessage(
          clientId,
          dest.identifier,
          msg.content.text,
          msg.content.image,
        );
        sent++;
      } catch (e) {
        errors.push(`${dest.name}: ${(e as Error).message}`);
      }
    }

    if (sent === msg.destinations.length) {
      await msg.markAsSent();
    } else if (sent > 0) {
      await msg.markAsFailed(`Enviado para ${sent}/${msg.destinations.length}. ${errors.join('; ')}`);
    } else {
      await msg.markAsFailed(errors.join('; ') || 'Falha ao enviar para todos os destinos');
    }
  }

  async cancelCampaign(id: string, clientId: string): Promise<boolean> {
    const msg = await MessageQueue.findOne({
      _id: id,
      clientId: new mongoose.Types.ObjectId(clientId),
      status: 'pending',
    });
    if (!msg) return false;
    await msg.markAsFailed('Cancelado pelo usuário');
    return true;
  }
}
