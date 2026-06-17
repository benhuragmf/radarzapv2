import mongoose from 'mongoose';
import { WebChatWidget, type IWebChatWidget } from '../../models/WebChatWidget';
import { WebChatConversation, type IWebChatConversation } from '../../models/WebChatConversation';
import { WebChatMessage, type IWebChatMessage } from '../../models/WebChatMessage';
import {
  DEFAULT_WEBCHAT_APPEARANCE,
  type WebChatConversationDto,
  type WebChatMessageDto,
  type WebChatPublicConfig,
  type WebChatWidgetAppearance,
} from '../../types/webchat';
import {
  generateWebChatPublicKey,
  generateWebChatVisitorToken,
  hashWebChatVisitorToken,
  isWebChatOriginAllowed,
} from './webchat-token.util';
import { emitWebChatToTenant, emitWebChatToVisitor } from './WebChatRealtime';

export class WebChatService {
  private static instance: WebChatService;

  static getInstance(): WebChatService {
    if (!WebChatService.instance) {
      WebChatService.instance = new WebChatService();
    }
    return WebChatService.instance;
  }

  async createWidget(
    clientId: string,
    data: { name: string; allowedDomains?: string[]; appearance?: Partial<WebChatWidgetAppearance> },
  ): Promise<IWebChatWidget> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const doc = await WebChatWidget.create({
      clientId: clientOid,
      name: data.name.trim(),
      publicKey: generateWebChatPublicKey(),
      allowedDomains: (data.allowedDomains ?? []).map(d => d.trim()).filter(Boolean),
      appearance: { ...DEFAULT_WEBCHAT_APPEARANCE, ...data.appearance },
    });
    return doc;
  }

  async listWidgets(clientId: string) {
    return WebChatWidget.find({
      clientId: new mongoose.Types.ObjectId(clientId),
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  async updateWidget(
    clientId: string,
    widgetId: string,
    patch: {
      name?: string;
      active?: boolean;
      allowedDomains?: string[];
      appearance?: Partial<WebChatWidgetAppearance>;
    },
  ): Promise<IWebChatWidget | null> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const widgetOid = new mongoose.Types.ObjectId(widgetId);
    const existing = await WebChatWidget.findOne({ _id: widgetOid, clientId: clientOid });
    if (!existing) return null;

    if (patch.name !== undefined) existing.name = patch.name.trim();
    if (patch.active !== undefined) existing.active = patch.active;
    if (patch.allowedDomains !== undefined) {
      existing.allowedDomains = patch.allowedDomains.map(d => d.trim()).filter(Boolean);
    }
    if (patch.appearance) {
      existing.appearance = { ...existing.appearance, ...patch.appearance };
    }
    await existing.save();
    return existing;
  }

  async deleteWidget(clientId: string, widgetId: string): Promise<boolean> {
    const res = await WebChatWidget.deleteOne({
      _id: new mongoose.Types.ObjectId(widgetId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    return res.deletedCount > 0;
  }

  async getActiveWidgetByPublicKey(publicKey: string): Promise<IWebChatWidget | null> {
    return WebChatWidget.findOne({ publicKey, active: true });
  }

  toPublicConfig(widget: IWebChatWidget): WebChatPublicConfig {
    const a = widget.appearance ?? DEFAULT_WEBCHAT_APPEARANCE;
    return {
      publicKey: widget.publicKey,
      title: a.title,
      subtitle: a.subtitle,
      greeting: a.greeting,
      primaryColor: a.primaryColor,
      position: a.position,
      askName: a.askName,
      askEmail: a.askEmail,
    };
  }

  assertOrigin(widget: IWebChatWidget, origin?: string | null, referer?: string | null): void {
    if (!isWebChatOriginAllowed(widget.allowedDomains ?? [], origin, referer)) {
      throw new Error('Origem não autorizada para este widget');
    }
  }

  async resolveVisitorToken(visitorToken: string): Promise<IWebChatConversation | null> {
    if (!visitorToken?.startsWith('wcv_')) return null;
    const hash = hashWebChatVisitorToken(visitorToken);
    return WebChatConversation.findOne({ visitorTokenHash: hash, status: 'open' });
  }

  private toMessageDto(msg: IWebChatMessage | Record<string, unknown>): WebChatMessageDto {
    const m = msg as IWebChatMessage;
    return {
      id: String(m._id),
      direction: m.direction,
      body: m.body,
      createdAt: (m.createdAt ?? new Date()).toISOString(),
      senderName: m.senderName,
    };
  }

  private async widgetNameMap(widgetIds: mongoose.Types.ObjectId[]): Promise<Map<string, string>> {
    const widgets = await WebChatWidget.find({ _id: { $in: widgetIds } }).select('name').lean();
    const map = new Map<string, string>();
    for (const w of widgets) {
      map.set(String(w._id), w.name);
    }
    return map;
  }

  private toConversationDto(
    conv: IWebChatConversation | Record<string, unknown>,
    widgetName?: string,
  ): WebChatConversationDto {
    const c = conv as IWebChatConversation;
    return {
      id: String(c._id),
      status: c.status,
      visitorName: c.visitorName,
      visitorEmail: c.visitorEmail,
      pageUrl: c.pageUrl,
      lastMessageAt: c.lastMessageAt?.toISOString(),
      lastMessagePreview: c.lastMessagePreview,
      unreadCount: c.unreadAgentCount ?? 0,
      assignedUserId: c.assignedUserId,
      widgetName,
    };
  }

  async createOrResumeSession(
    publicKey: string,
    opts: {
      visitorToken?: string;
      visitorName?: string;
      visitorEmail?: string;
      pageUrl?: string;
      userAgent?: string;
      origin?: string | null;
      referer?: string | null;
    },
  ): Promise<{ visitorToken: string; conversationId: string; messages: WebChatMessageDto[] }> {
    const widget = await this.getActiveWidgetByPublicKey(publicKey);
    if (!widget) throw new Error('Widget não encontrado');

    this.assertOrigin(widget, opts.origin, opts.referer);

    let visitorToken = opts.visitorToken?.trim();
    let conversation: IWebChatConversation | null = null;

    if (visitorToken) {
      conversation = await this.resolveVisitorToken(visitorToken);
      if (conversation && String(conversation.widgetId) !== String(widget._id)) {
        conversation = null;
      }
    }

    if (!conversation) {
      visitorToken = generateWebChatVisitorToken();
      conversation = await WebChatConversation.create({
        clientId: widget.clientId,
        widgetId: widget._id,
        visitorTokenHash: hashWebChatVisitorToken(visitorToken),
        visitorName: opts.visitorName?.trim() || undefined,
        visitorEmail: opts.visitorEmail?.trim() || undefined,
        pageUrl: opts.pageUrl?.trim() || undefined,
        userAgent: opts.userAgent?.trim() || undefined,
        status: 'open',
        unreadAgentCount: 0,
      });

      const greeting = widget.appearance?.greeting?.trim();
      if (greeting) {
        await this.appendMessage(conversation, {
          direction: 'system',
          body: greeting,
          notifyVisitor: false,
        });
      }
    } else {
      const patch: Partial<IWebChatConversation> = {};
      if (opts.visitorName?.trim()) patch.visitorName = opts.visitorName.trim();
      if (opts.visitorEmail?.trim()) patch.visitorEmail = opts.visitorEmail.trim();
      if (opts.pageUrl?.trim()) patch.pageUrl = opts.pageUrl.trim();
      if (Object.keys(patch).length) {
        Object.assign(conversation, patch);
        await conversation.save();
      }
    }

    const messages = await WebChatMessage.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    return {
      visitorToken: visitorToken!,
      conversationId: String(conversation._id),
      messages: messages.map(m => this.toMessageDto(m)),
    };
  }

  async listConversations(
    clientId: string,
    opts: { status?: 'open' | 'closed'; limit?: number } = {},
  ): Promise<WebChatConversationDto[]> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const filter: Record<string, unknown> = {
      clientId: new mongoose.Types.ObjectId(clientId),
    };
    if (opts.status) filter.status = opts.status;

    const rows = await WebChatConversation.find(filter)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(limit)
      .lean();

    const widgetIds = [...new Set(rows.map(r => r.widgetId as mongoose.Types.ObjectId))];
    const names = await this.widgetNameMap(widgetIds);

    return rows.map(r =>
      this.toConversationDto(r, names.get(String(r.widgetId))),
    );
  }

  async getConversationForAgent(
    clientId: string,
    conversationId: string,
  ): Promise<{ conversation: WebChatConversationDto; messages: WebChatMessageDto[] } | null> {
    const conv = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    }).lean();
    if (!conv) return null;

    const widget = await WebChatWidget.findById(conv.widgetId).select('name').lean();
    const messages = await WebChatMessage.find({ conversationId: conv._id })
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();

    if (conv.unreadAgentCount > 0) {
      await WebChatConversation.updateOne(
        { _id: conv._id },
        { $set: { unreadAgentCount: 0 } },
      );
    }

    return {
      conversation: this.toConversationDto(conv, widget?.name),
      messages: messages.map(m => this.toMessageDto(m)),
    };
  }

  private async appendMessage(
    conversation: IWebChatConversation,
    data: {
      direction: 'inbound' | 'outbound' | 'system';
      body: string;
      senderUserId?: string;
      senderName?: string;
      notifyVisitor?: boolean;
    },
  ): Promise<IWebChatMessage> {
    const preview = data.body.slice(0, 280);
    const now = new Date();

    const msg = await WebChatMessage.create({
      conversationId: conversation._id,
      clientId: conversation.clientId,
      direction: data.direction,
      body: data.body.trim(),
      senderUserId: data.senderUserId,
      senderName: data.senderName,
    });

    const unreadDelta = data.direction === 'inbound' ? 1 : 0;
    await WebChatConversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessageAt: now,
          lastMessagePreview: preview,
          status: 'open',
        },
        ...(unreadDelta ? { $inc: { unreadAgentCount: unreadDelta } } : {}),
      },
    );

    const clientId = String(conversation.clientId);
    const conversationId = String(conversation._id);
    const messageDto = this.toMessageDto(msg);
    const convDoc = await WebChatConversation.findById(conversation._id).lean();
    const widget = await WebChatWidget.findById(conversation.widgetId).select('name').lean();
    const conversationDto = convDoc
      ? this.toConversationDto(convDoc, widget?.name)
      : undefined;

    const payload = { clientId, conversationId, message: messageDto, conversation: conversationDto };

    emitWebChatToTenant(clientId, 'webchat:message', payload);
    if (data.notifyVisitor !== false) {
      emitWebChatToVisitor(conversationId, 'webchat:message', payload);
    }
    if (conversationDto) {
      emitWebChatToTenant(clientId, 'webchat:conversation', {
        clientId,
        conversationId,
        conversation: conversationDto,
      });
    }

    return msg;
  }

  async listVisitorMessages(
    visitorToken: string,
    origin?: string | null,
    referer?: string | null,
  ): Promise<{ conversationId: string; status: string; messages: WebChatMessageDto[] }> {
    if (!visitorToken?.startsWith('wcv_')) throw new Error('Sessão inválida ou encerrada');
    const hash = hashWebChatVisitorToken(visitorToken);
    const conversation = await WebChatConversation.findOne({ visitorTokenHash: hash });
    if (!conversation) throw new Error('Sessão inválida ou encerrada');

    const widget = await WebChatWidget.findById(conversation.widgetId);
    if (!widget?.active) throw new Error('Widget inativo');
    this.assertOrigin(widget, origin, referer);

    const messages = await WebChatMessage.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    return {
      conversationId: String(conversation._id),
      status: conversation.status,
      messages: messages.map(m => this.toMessageDto(m)),
    };
  }

  async sendVisitorMessage(
    visitorToken: string,
    body: string,
    origin?: string | null,
    referer?: string | null,
  ): Promise<WebChatMessageDto> {
    const text = body?.trim();
    if (!text) throw new Error('Mensagem vazia');

    const conversation = await this.resolveVisitorToken(visitorToken);
    if (!conversation) throw new Error('Sessão inválida ou encerrada');

    const widget = await WebChatWidget.findById(conversation.widgetId);
    if (!widget?.active) throw new Error('Widget inativo');

    this.assertOrigin(widget, origin, referer);

    const msg = await this.appendMessage(conversation, {
      direction: 'inbound',
      body: text,
    });
    return this.toMessageDto(msg);
  }

  async sendAgentMessage(
    clientId: string,
    userId: string,
    conversationId: string,
    body: string,
    senderName?: string,
  ): Promise<WebChatMessageDto> {
    const text = body?.trim();
    if (!text) throw new Error('Mensagem vazia');

    const conversation = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!conversation) throw new Error('Conversa não encontrada');
    if (conversation.status === 'closed') throw new Error('Conversa encerrada');

    const msg = await this.appendMessage(conversation, {
      direction: 'outbound',
      body: text,
      senderUserId: userId,
      senderName: senderName?.trim() || 'Atendente',
    });
    return this.toMessageDto(msg);
  }

  async closeConversation(
    clientId: string,
    conversationId: string,
    _userId: string,
  ): Promise<void> {
    const conversation = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!conversation) throw new Error('Conversa não encontrada');

    conversation.status = 'closed';
    await conversation.save();

    await this.appendMessage(conversation, {
      direction: 'system',
      body: 'Atendimento encerrado. Obrigado pelo contato!',
    });

    const clientIdStr = String(conversation.clientId);
    const convId = String(conversation._id);
    const widget = await WebChatWidget.findById(conversation.widgetId).select('name').lean();
    const conversationDto = this.toConversationDto(conversation, widget?.name);

    emitWebChatToTenant(clientIdStr, 'webchat:conversation', {
      clientId: clientIdStr,
      conversationId: convId,
      conversation: conversationDto,
    });
    emitWebChatToVisitor(convId, 'webchat:conversation', {
      clientId: clientIdStr,
      conversationId: convId,
      conversation: conversationDto,
    });
  }
}
