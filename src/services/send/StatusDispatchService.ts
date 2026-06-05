import mongoose from 'mongoose';
import { StatusPost, IStatusPost } from '@/models/StatusPost';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';
import { createServiceLogger } from '@/utils/logger';
import { validateOptionalCampaignSendAt } from '@/utils/schedule-time';
import { parseAndValidateStatusImage } from '@/utils/safe-image-upload';

const logger = createServiceLogger('StatusDispatchService');

export interface CreateStatusPostInput {
  clientId: string;
  title: string;
  type: 'text' | 'image';
  text?: string;
  image?: string;
  caption?: string;
  backgroundColor?: string;
  font?: number;
  audience?: 'whatsapp' | 'all_contacts' | 'consented';
  sendAt?: Date;
}

export class StatusDispatchService {
  private static instance: StatusDispatchService;

  static getInstance(): StatusDispatchService {
    if (!StatusDispatchService.instance) {
      StatusDispatchService.instance = new StatusDispatchService();
    }
    return StatusDispatchService.instance;
  }

  async createStatusPost(input: CreateStatusPostInput): Promise<IStatusPost> {
    const sendAtCheck = validateOptionalCampaignSendAt(input.sendAt);
    if (sendAtCheck.ok === false) throw new Error(sendAtCheck.error);
    const scheduledFor = sendAtCheck.date ?? new Date();

    let imageValidated: ReturnType<typeof parseAndValidateStatusImage> | null = null;
    if (input.type === 'text') {
      const text = (input.text ?? '').trim();
      if (!text) throw new Error('Informe o texto do status');
      if (text.length > 700) throw new Error('Texto do status: máximo 700 caracteres');
    } else {
      if (!input.image?.trim()) throw new Error('Selecione uma imagem para o status');
      imageValidated = parseAndValidateStatusImage(input.image);
      if (imageValidated.ok === false) throw new Error(imageValidated.error);
    }

    const createPayload: Record<string, unknown> = {
      clientId: new mongoose.Types.ObjectId(input.clientId),
      title: input.title.trim(),
      type: input.type,
      text: input.text?.trim(),
      caption: input.caption?.trim(),
      backgroundColor: input.backgroundColor,
      font: input.font,
      audience: input.audience ?? 'whatsapp',
      status: 'pending',
      scheduledFor,
    };

    if (imageValidated?.ok) {
      createPayload.imageData = imageValidated.data;
      createPayload.imageMime = imageValidated.mime;
    }

    const post = await StatusPost.create(createPayload);

    return post;
  }

  /** Publicação imediata em background — não bloqueia a resposta HTTP do painel. */
  queueImmediateDispatch(postId: string): void {
    setImmediate(() => {
      void (async () => {
        const post = await StatusPost.findById(postId);
        if (!post || post.status !== 'pending') return;
        try {
          await this.dispatchOne(post);
        } catch (err) {
          logger.error(`Immediate status dispatch failed ${postId}:`, err);
        }
      })();
    });
  }

  async processPending(): Promise<number> {
    const now = new Date();
    const pending = await StatusPost.find({
      status: 'pending',
      scheduledFor: { $lte: now },
    })
      .sort({ scheduledFor: 1 })
      .limit(5);

    const stuck = await StatusPost.find({
      status: 'processing',
      updatedAt: { $lt: new Date(Date.now() - 10 * 60_000) },
    }).limit(3);

    const toRun = [...pending, ...stuck];
    let processed = 0;
    for (const post of toRun) {
      try {
        await this.dispatchOne(post);
        processed++;
      } catch (err) {
        logger.error(`Status post dispatch failed ${post._id}:`, err);
      }
    }
    return processed;
  }

  async dispatchOne(post: IStatusPost): Promise<void> {
    if (post.status === 'sent' || post.status === 'failed') return;

    const clientId = post.clientId.toString();
    const wa = WhatsAppService.getInstance();

    if (!wa.isClientConnected(clientId)) {
      const overdue = post.scheduledFor.getTime() < Date.now() - 60 * 60_000;
      if (overdue) {
        post.status = 'failed';
        post.lastError = 'WhatsApp desconectado — reconecte em Sessões';
        post.processedAt = new Date();
        await post.save();
      }
      return;
    }

    post.status = 'processing';
    await post.save();

    try {
      const result = await wa.sendStatusUpdate(clientId, {
        type: post.type,
        text: post.text,
        image: this.resolvePostImageDataUrl(post),
        caption: post.caption,
        backgroundColor: post.backgroundColor,
        font: post.font,
        audience: post.audience,
      });

      post.status = 'sent';
      post.processedAt = new Date();
      post.statusJidCount = result.statusJidCount;
      post.whatsappMessageId = result.messageId;
      post.lastError = undefined;
      await post.save();
    } catch (err) {
      post.status = 'failed';
      post.processedAt = new Date();
      post.lastError = (err as Error).message;
      await post.save();
      throw err;
    }
  }

  async cancelStatusPost(clientId: string, postId: string): Promise<boolean> {
    const result = await StatusPost.deleteOne({
      _id: postId,
      clientId: new mongoose.Types.ObjectId(clientId),
      status: 'pending',
    });
    return result.deletedCount > 0;
  }

  /** Data URL para envio ao WhatsApp (buffer novo ou legado em `image`). */
  resolvePostImageDataUrl(post: IStatusPost): string | undefined {
    if (post.imageData?.length && post.imageMime) {
      return `data:${post.imageMime};base64,${post.imageData.toString('base64')}`;
    }
    return post.image;
  }

  /** Buffer + MIME para servir mídia no painel. */
  resolvePostImageBuffer(post: IStatusPost): { data: Buffer; mime: string } | null {
    if (post.imageData?.length && post.imageMime) {
      return { data: post.imageData, mime: post.imageMime };
    }
    if (post.image?.startsWith('data:')) {
      const validated = parseAndValidateStatusImage(post.image);
      if (validated.ok) return { data: validated.data, mime: validated.mime };
    }
    return null;
  }
}
