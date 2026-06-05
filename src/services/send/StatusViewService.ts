import mongoose from 'mongoose';
import { StatusPost } from '@/models/StatusPost';
import { Destination } from '@/models';
import { createServiceLogger } from '@/utils/logger';
import { wuidToPhone } from '@/services/whatsapp/waSessionEvents';

const logger = createServiceLogger('StatusViewService');

export interface StatusViewEvent {
  jid: string;
  phone?: string;
  name?: string;
  viewedAt: Date;
}

export class StatusViewService {
  private static instance: StatusViewService;

  static getInstance(): StatusViewService {
    if (!StatusViewService.instance) {
      StatusViewService.instance = new StatusViewService();
    }
    return StatusViewService.instance;
  }

  /** Registra visualização de status a partir de receipt do WhatsApp (status@broadcast). */
  async recordView(
    clientId: string,
    messageId: string,
    viewerJid: string,
    viewedAt: Date,
  ): Promise<void> {
    if (!messageId || !viewerJid) return;

    const post = await StatusPost.findOne({
      clientId: new mongoose.Types.ObjectId(clientId),
      whatsappMessageId: messageId,
      status: 'sent',
    });
    if (!post) return;

    const normalizedJid = viewerJid.includes('@') ? viewerJid : `${viewerJid}@s.whatsapp.net`;
    const existing = post.viewEvents ?? [];
    if (existing.some(v => v.jid === normalizedJid)) return;

    const phone = wuidToPhone(normalizedJid) ?? undefined;
    let name: string | undefined;
    if (phone) {
      const withPlus = phone.startsWith('+') ? phone : `+${phone}`;
      const dest = await Destination.findOne({
        clientId: new mongoose.Types.ObjectId(clientId),
        identifier: { $in: [phone, withPlus, phone.replace(/^\+/, '')] },
      })
        .select('name')
        .lean();
      name = dest?.name ?? undefined;
    }

    const event: StatusViewEvent = {
      jid: normalizedJid,
      phone,
      name,
      viewedAt,
    };

    post.viewEvents = [...existing, event];
    post.viewCount = post.viewEvents.length;
    await post.save();

    logger.debug('Status view registrada', {
      clientId,
      postId: post._id,
      viewerJid: normalizedJid,
      viewCount: post.viewCount,
    });
  }
}
