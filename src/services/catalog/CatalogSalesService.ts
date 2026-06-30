import mongoose from 'mongoose';
import crypto from 'crypto';
import { CatalogSalesOrder, ICatalogSalesOrder } from '@/models/CatalogSalesOrder';
import { Organization } from '@/models/Organization';
import { AiKnowledgeBase } from '@/models/AiKnowledgeBase';
import { InboxConversation } from '@/models/InboxConversation';
import { WebChatConversation } from '@/models/WebChatConversation';
import { AttendanceEvent } from '@/models/AttendanceEvent';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';
import { config } from '@/config/environment';
import { createServiceLogger } from '@/utils/logger';
import type { AiStructuredReply } from '@/types/ai-assistant';
import {
  type CatalogSalesChannel,
  type CatalogSalesCompanyConfig,
  type CatalogSalesOrderStatus,
  DEFAULT_CATALOG_CUSTOMER_APPROVE_MESSAGE,
  DEFAULT_CATALOG_CUSTOMER_NEW_PROOF_MESSAGE,
  DEFAULT_CATALOG_CUSTOMER_REJECT_MESSAGE,
  buildOrderAmountSummary,
  isValidCatalogSalesPhone,
  normalizeCatalogSalesConfig,
  normalizeProductSalesMeta,
  orderRequiresDeliveryAddress,
  parseProductDeliveryFeeFromContent,
  parseProductPriceFromContent,
  parseProductSkuFromContent,
  parseProductStockFromContent,
  productHasClearPrice,
  productStockIsZero,
  renderCatalogCustomerMessage,
  resolveProductSaleMode,
  shouldOpenPixOrderFlow,
} from '@/types/catalog-sales';
import {
  estimateDeliveryFromAddresses,
  normalizeKmRates,
} from '@/utils/catalog-delivery.util';
import { deliveryAddressValidationError, isCompleteDeliveryAddress } from '@/types/catalog-delivery-address';

const logger = createServiceLogger('CatalogSalesService');

const ACTIVE_ORDER_STATUSES: CatalogSalesOrderStatus[] = [
  'aguardando_endereco',
  'aguardando_pagamento',
  'comprovante_recebido',
  'em_conferencia',
  'falha_notificacao_whatsapp',
  'pendente_configuracao_whatsapp',
];

const PROOF_MEDIA_TYPES = new Set(['image', 'document']);

export interface CatalogSalesInboundMedia {
  mediaUrl: string;
  mediaMime?: string;
  mediaType?: string;
  messageId?: string;
}

export interface CatalogSalesConversationRef {
  conversationId: string;
  channel: CatalogSalesChannel;
  destinationId?: string;
  contactIdentifier?: string;
  contactName?: string;
}

export class CatalogSalesService {
  private static instance: CatalogSalesService;

  static getInstance(): CatalogSalesService {
    if (!this.instance) this.instance = new CatalogSalesService();
    return this.instance;
  }

  async loadCompanyConfig(clientId: string): Promise<
    CatalogSalesCompanyConfig & ReturnType<typeof normalizeCatalogSalesConfig>
  > {
    const org = await Organization.findById(clientId).select('catalogSales name address').lean();
    const cfg = normalizeCatalogSalesConfig(org?.catalogSales);
    if (!cfg.deliveryOriginAddress?.trim() && org?.address?.trim()) {
      const fallback = org.address.trim();
      if (isCompleteDeliveryAddress(fallback)) {
        return { ...cfg, deliveryOriginAddress: fallback };
      }
    }
    return cfg;
  }

  async updateCompanyConfig(
    clientId: string,
    patch: CatalogSalesCompanyConfig,
  ): Promise<CatalogSalesCompanyConfig> {
    const normalized = normalizeCatalogSalesConfig(patch);
    if (normalized.internalWhatsapp && !isValidCatalogSalesPhone(normalized.internalWhatsapp)) {
      throw new Error('WhatsApp responsável inválido. Use DDI, ex.: 5566999999999');
    }
    if (normalized.useDistanceBasedDelivery) {
      const originErr = deliveryAddressValidationError(normalized.deliveryOriginAddress);
      if (originErr) {
        throw new Error(
          `Entrega por distância: ${originErr} Exemplo: 01001-000, Praça da Sé, 100, Sé, São Paulo, SP, Brasil`,
        );
      }
    }
    await Organization.findByIdAndUpdate(clientId, { $set: { catalogSales: normalized } });

    const shouldSyncAddressCollect =
      normalized.forceCollectAddress === true || normalized.requireDeliveryAddress === true;
    if (shouldSyncAddressCollect) {
      const { AiPrompt } = await import('@/models/AiPrompt');
      await AiPrompt.updateOne(
        { clientId: new mongoose.Types.ObjectId(clientId) },
        { $set: { collectAddress: true } },
      );
    }

    return normalized;
  }

  async findActiveOrderForConversation(
    clientId: string,
    conversationId: string,
    productId?: string,
  ): Promise<ICatalogSalesOrder | null> {
    const filter: Record<string, unknown> = {
      clientId: new mongoose.Types.ObjectId(clientId),
      conversationId: new mongoose.Types.ObjectId(conversationId),
      status: { $in: ACTIVE_ORDER_STATUSES },
    };
    if (productId) filter.productId = new mongoose.Types.ObjectId(productId);
    return CatalogSalesOrder.findOne(filter).sort({ updatedAt: -1 });
  }

  async maybeCreateOrderFromAiTurn(opts: {
    clientId: string;
    conversation: CatalogSalesConversationRef;
    clientText: string;
    structured: AiStructuredReply;
    aiSummary?: string;
  }): Promise<ICatalogSalesOrder | null> {
    const cfg = await this.loadCompanyConfig(opts.clientId);
    if (!cfg.enabled || !cfg.autoCreateOrderOnPurchase) return null;

    let product = null as Awaited<ReturnType<typeof this.resolveProductForOrder>>;
    if (opts.structured.catalogProductId) {
      product = await this.resolveProductForOrder(opts.clientId, opts.structured.catalogProductId);
    }
    if (!product && opts.structured.catalogProductName) {
      product = await this.resolveProductByName(opts.clientId, opts.structured.catalogProductName);
    }
    if (!product) {
      product = await this.guessProductFromText(opts.clientId, opts.clientText);
    }
    if (!product) return null;

    const salesMeta = normalizeProductSalesMeta(product.salesMeta);
    if (salesMeta.aiSellable === false) return null;

    const hasLink = Boolean((product.links ?? []).some(l => l.url?.trim()));
    const saleMode = resolveProductSaleMode(salesMeta, hasLink);
    const openPix = shouldOpenPixOrderFlow({
      saleMode,
      clientText: opts.clientText,
      structuredWantsOrder: opts.structured.shouldCreateCatalogOrder,
      companyPixEnabled: cfg.pixEnabled,
    });
    if (!openPix) return null;

    const price = parseProductPriceFromContent(product.content);
    if (!productHasClearPrice(price)) {
      logger.info('Pedido catálogo bloqueado — preço indefinido', {
        clientId: opts.clientId,
        productId: product._id,
      });
      return null;
    }

    const stock = parseProductStockFromContent(product.content);
    if (productStockIsZero(stock) && !salesMeta.madeToOrder) return null;

    const existing = await this.findActiveOrderForConversation(
      opts.clientId,
      opts.conversation.conversationId,
      String(product._id),
    );
    if (existing) {
      await this.maybeAttachAddressToOrder(existing, opts.structured.collectedAddress, cfg, salesMeta);
      if (opts.aiSummary) {
        existing.aiSummary = opts.aiSummary;
        await existing.save();
      }
      return existing;
    }

    const deliveryFee =
      salesMeta.deliveryFee?.trim() ||
      parseProductDeliveryFeeFromContent(product.content) ||
      undefined;
    const needsAddress = orderRequiresDeliveryAddress(cfg, salesMeta);
    const collectedAddress = opts.structured.collectedAddress?.trim();
    const initialStatus: CatalogSalesOrderStatus =
      needsAddress && !collectedAddress ? 'aguardando_endereco' : 'aguardando_pagamento';

    return this.createOrder({
      clientId: opts.clientId,
      conversation: opts.conversation,
      productId: String(product._id),
      productName: product.title,
      sku: parseProductSkuFromContent(product.content) ?? undefined,
      subtotalAmount: price ?? undefined,
      deliveryFee,
      amount: buildOrderAmountSummary(price ?? undefined, deliveryFee),
      totalAmount: buildOrderAmountSummary(price ?? undefined, deliveryFee),
      deliveryAddress: collectedAddress || undefined,
      stockSnapshot: stock ?? undefined,
      aiSummary: opts.aiSummary,
      status: initialStatus,
    });
  }

  /** Atualiza endereço em pedido pendente e avança para aguardando pagamento. */
  async maybeAttachAddressToOrder(
    order: ICatalogSalesOrder,
    collectedAddress?: string,
    companyCfg?: CatalogSalesCompanyConfig,
    productMeta?: ReturnType<typeof normalizeProductSalesMeta>,
  ): Promise<void> {
    const addr = collectedAddress?.trim();
    if (!addr || order.status !== 'aguardando_endereco') return;
    order.deliveryAddress = addr.slice(0, 500);
    const cfg =
      companyCfg ?? (await this.loadCompanyConfig(String(order.clientId)));
    await this.applyDeliveryEstimateToOrder(order, cfg, productMeta);
    order.status = 'aguardando_pagamento';
    order.history.push({
      at: new Date(),
      action: 'address_collected',
      status: 'aguardando_pagamento',
    });
    await order.save();
  }

  private async applyDeliveryEstimateToOrder(
    order: ICatalogSalesOrder,
    cfg: CatalogSalesCompanyConfig,
    productMeta?: ReturnType<typeof normalizeProductSalesMeta>,
  ): Promise<void> {
    if (!cfg.useDistanceBasedDelivery) return;
    const origin = cfg.deliveryOriginAddress?.trim();
    const dest = order.deliveryAddress?.trim();
    if (!origin || !dest) return;
    if (deliveryAddressValidationError(origin) || deliveryAddressValidationError(dest)) {
      logger.warn('Endereço incompleto — cálculo de entrega por distância ignorado', {
        clientId: String(order.clientId),
        orderId: String(order._id),
        hasOriginError: Boolean(deliveryAddressValidationError(origin)),
        hasDestError: Boolean(deliveryAddressValidationError(dest)),
      });
      return;
    }

    const rates = normalizeKmRates(cfg.deliveryKmRates);
    const estimate = await estimateDeliveryFromAddresses({
      originAddress: origin,
      destinationAddress: dest,
      rates,
      countryCode: 'Brasil',
    });
    if (!estimate) return;

    order.deliveryDistanceKm = estimate.distanceKm;
    order.deliveryTierKm = estimate.tierKm;

    if (estimate.deliveryFee) {
      order.deliveryFee = estimate.deliveryFee;
      const subtotal = order.subtotalAmount ?? order.amount;
      order.totalAmount = buildOrderAmountSummary(subtotal ?? undefined, estimate.deliveryFee);
      order.amount = order.totalAmount;
    } else if (productMeta?.deliveryFee?.trim()) {
      order.deliveryFee = productMeta.deliveryFee.trim();
    }
  }

  async maybeUpdateOrderFromAiTurn(opts: {
    clientId: string;
    conversationId: string;
    structured: { collectedAddress?: string };
  }): Promise<void> {
    const order = await CatalogSalesOrder.findOne({
      clientId: new mongoose.Types.ObjectId(opts.clientId),
      conversationId: new mongoose.Types.ObjectId(opts.conversationId),
      status: 'aguardando_endereco',
    }).sort({ updatedAt: -1 });
    if (!order) return;
    const cfg = await this.loadCompanyConfig(opts.clientId);
    await this.maybeAttachAddressToOrder(order, opts.structured.collectedAddress, cfg);
  }

  private async resolveProductForOrder(clientId: string, productId: string) {
    if (!mongoose.Types.ObjectId.isValid(productId)) return null;
    return AiKnowledgeBase.findOne({
      _id: new mongoose.Types.ObjectId(productId),
      clientId: new mongoose.Types.ObjectId(clientId),
      active: true,
    }).lean();
  }

  private async resolveProductByName(clientId: string, name: string) {
    const title = name.trim();
    if (!title) return null;
    return AiKnowledgeBase.findOne({
      clientId: new mongoose.Types.ObjectId(clientId),
      active: true,
      title: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    }).lean();
  }

  private async guessProductFromText(clientId: string, text: string) {
    const rows = await AiKnowledgeBase.find({
      clientId: new mongoose.Types.ObjectId(clientId),
      active: true,
      category: 'Produtos e estoque',
    })
      .select('title content salesMeta')
      .limit(50)
      .lean();
    const lower = text.toLowerCase();
    const hit = rows.find(r => lower.includes(r.title.toLowerCase()));
    return hit ?? null;
  }

  async createOrder(opts: {
    clientId: string;
    conversation: CatalogSalesConversationRef;
    productId?: string;
    productName: string;
    sku?: string;
    amount?: string;
    subtotalAmount?: string;
    deliveryFee?: string;
    totalAmount?: string;
    deliveryAddress?: string;
    stockSnapshot?: string;
    aiSummary?: string;
    status?: CatalogSalesOrderStatus;
  }): Promise<ICatalogSalesOrder> {
    const order = await CatalogSalesOrder.create({
      clientId: new mongoose.Types.ObjectId(opts.clientId),
      conversationId: new mongoose.Types.ObjectId(opts.conversation.conversationId),
      channel: opts.conversation.channel,
      destinationId: opts.conversation.destinationId
        ? new mongoose.Types.ObjectId(opts.conversation.destinationId)
        : undefined,
      contactIdentifier: opts.conversation.contactIdentifier,
      contactName: opts.conversation.contactName,
      productId: opts.productId ? new mongoose.Types.ObjectId(opts.productId) : undefined,
      productName: opts.productName,
      sku: opts.sku,
      amount: opts.amount,
      subtotalAmount: opts.subtotalAmount,
      deliveryFee: opts.deliveryFee,
      totalAmount: opts.totalAmount ?? opts.amount,
      deliveryAddress: opts.deliveryAddress,
      stockSnapshot: opts.stockSnapshot,
      paymentMethod: 'pix',
      status: opts.status ?? 'aguardando_pagamento',
      aiSummary: opts.aiSummary,
      history: [
        {
          at: new Date(),
          action: 'order_created',
          status: opts.status ?? 'aguardando_pagamento',
        },
      ],
    });

    if (opts.deliveryAddress?.trim()) {
      const cfg = await this.loadCompanyConfig(opts.clientId);
      await this.applyDeliveryEstimateToOrder(order, cfg);
      await order.save();
    }

    await this.markConversationOrder(opts.clientId, opts.conversation, order._id as mongoose.Types.ObjectId, false);

    await AttendanceEvent.create({
      clientId: new mongoose.Types.ObjectId(opts.clientId),
      kind: 'catalog_sales.order_created',
      conversationId: order.conversationId,
      meta: {
        orderId: String(order._id),
        productName: order.productName,
        status: order.status,
      },
    });

    return order;
  }

  async handleInboundProof(opts: {
    clientId: string;
    conversation: CatalogSalesConversationRef;
    media: CatalogSalesInboundMedia;
    aiSummary?: string;
  }): Promise<{ order: ICatalogSalesOrder | null; handled: boolean }> {
    if (!opts.media.mediaUrl) return { order: null, handled: false };
    const mediaType = opts.media.mediaType ?? 'image';
    if (!PROOF_MEDIA_TYPES.has(mediaType)) return { order: null, handled: false };

    const cfg = await this.loadCompanyConfig(opts.clientId);
    const contentHash = this.hashProof(opts.media.mediaUrl, opts.media.messageId);

    let order = await this.findActiveOrderForConversation(
      opts.clientId,
      opts.conversation.conversationId,
    );

    if (!order) {
      const orphan = await this.createOrphanProofOrder(opts, contentHash);
      return { order: orphan, handled: true };
    }

    if (order.proofs.some(p => p.contentHash === contentHash)) {
      logger.debug('Comprovante duplicado ignorado', {
        clientId: opts.clientId,
        orderId: order._id,
      });
      return { order, handled: true };
    }

    order.proofs.push({
      mediaUrl: opts.media.mediaUrl,
      mediaMime: opts.media.mediaMime,
      mediaType: opts.media.mediaType,
      messageId: opts.media.messageId,
      receivedAt: new Date(),
      contentHash,
    });
    order.status = 'comprovante_recebido';
    if (opts.aiSummary) order.aiSummary = opts.aiSummary;
    order.history.push({
      at: new Date(),
      action: 'proof_received',
      status: 'comprovante_recebido',
    });
    await order.save();

    await this.markConversationOrder(
      opts.clientId,
      opts.conversation,
      order._id as mongoose.Types.ObjectId,
      true,
    );

    await AttendanceEvent.create({
      clientId: new mongoose.Types.ObjectId(opts.clientId),
      kind: 'catalog_sales.proof_received',
      conversationId: order.conversationId,
      meta: { orderId: String(order._id), proofCount: order.proofs.length },
    });

    if (cfg.enabled && cfg.notifyWhatsapp) {
      await this.notifyInternalWhatsapp(opts.clientId, order, cfg, { manual: false });
    }

    if (cfg.enabled && cfg.escalateOnProof) {
      await this.escalateConversationToHuman(opts.clientId, opts.conversation);
    }

    return { order, handled: true };
  }

  private async createOrphanProofOrder(
    opts: {
      clientId: string;
      conversation: CatalogSalesConversationRef;
      media: CatalogSalesInboundMedia;
      aiSummary?: string;
    },
    contentHash: string,
  ): Promise<ICatalogSalesOrder> {
    const order = await CatalogSalesOrder.create({
      clientId: new mongoose.Types.ObjectId(opts.clientId),
      conversationId: new mongoose.Types.ObjectId(opts.conversation.conversationId),
      channel: opts.conversation.channel,
      destinationId: opts.conversation.destinationId
        ? new mongoose.Types.ObjectId(opts.conversation.destinationId)
        : undefined,
      contactIdentifier: opts.conversation.contactIdentifier,
      contactName: opts.conversation.contactName,
      productName: 'Comprovante sem pedido vinculado',
      paymentMethod: 'pix',
      status: 'comprovante_sem_pedido',
      proofs: [
        {
          mediaUrl: opts.media.mediaUrl,
          mediaMime: opts.media.mediaMime,
          mediaType: opts.media.mediaType,
          messageId: opts.media.messageId,
          receivedAt: new Date(),
          contentHash,
        },
      ],
      aiSummary: opts.aiSummary,
      history: [{ at: new Date(), action: 'proof_without_order', status: 'comprovante_sem_pedido' }],
    });

    await this.markConversationOrder(
      opts.clientId,
      opts.conversation,
      order._id as mongoose.Types.ObjectId,
      true,
    );

    await AttendanceEvent.create({
      clientId: new mongoose.Types.ObjectId(opts.clientId),
      kind: 'catalog_sales.proof_without_order',
      conversationId: order.conversationId,
      meta: { orderId: String(order._id) },
    });

    return order;
  }

  async notifyInternalWhatsapp(
    clientId: string,
    order: ICatalogSalesOrder,
    cfg?: CatalogSalesCompanyConfig,
    opts?: { manual?: boolean },
  ): Promise<{ ok: boolean; status: string; error?: string }> {
    const configResolved = cfg ?? (await this.loadCompanyConfig(clientId));
    if (!configResolved.enabled || !configResolved.notifyWhatsapp) {
      order.lastNotificationStatus = 'skipped';
      await order.save();
      return { ok: false, status: 'skipped' };
    }

    const targetPhone = await this.resolveNotificationPhone(clientId, order, configResolved);
    if (!targetPhone) {
      order.status =
        order.status === 'comprovante_sem_pedido'
          ? order.status
          : 'pendente_configuracao_whatsapp';
      order.lastNotificationStatus = 'pending_config';
      order.lastNotificationAt = new Date();
      await order.save();
      return { ok: false, status: 'pending_config' };
    }

    const dedupKey = `proof:${String(order._id)}:${order.proofs.length}`;
    if (!opts?.manual && order.notificationDedupKey === dedupKey) {
      return { ok: true, status: 'dedup' };
    }

    const org = await Organization.findById(clientId).select('name').lean();
    const text = this.buildNotificationMessage(order, org?.name ?? 'Empresa', configResolved);

    try {
      const wa = WhatsAppService.getInstance();
      const result = await wa.sendInternalAlert(clientId, targetPhone, text);
      order.lastNotificationAt = new Date();
      order.lastNotificationStatus = 'sent';
      order.notificationDedupKey = dedupKey;
      order.lastNotificationError = undefined;
      if (
        order.status === 'comprovante_recebido' ||
        order.status === 'pendente_configuracao_whatsapp' ||
        order.status === 'falha_notificacao_whatsapp'
      ) {
        order.status = 'em_conferencia';
      }
      order.history.push({
        at: new Date(),
        action: opts?.manual ? 'notification_resent' : 'notification_sent',
        status: order.status,
      });
      await order.save();

      await AttendanceEvent.create({
        clientId: new mongoose.Types.ObjectId(clientId),
        kind: 'catalog_sales.notification_sent',
        conversationId: order.conversationId,
        meta: { orderId: String(order._id), queued: result.queued },
      });

      return { ok: true, status: 'sent' };
    } catch (err) {
      const msg = (err as Error).message?.slice(0, 280) ?? 'erro';
      order.lastNotificationAt = new Date();
      order.lastNotificationStatus = 'failed';
      order.lastNotificationError = msg;
      if (order.status !== 'comprovante_sem_pedido') {
        order.status = 'falha_notificacao_whatsapp';
      }
      order.history.push({
        at: new Date(),
        action: 'notification_failed',
        status: order.status,
        note: msg,
      });
      await order.save();

      await AttendanceEvent.create({
        clientId: new mongoose.Types.ObjectId(clientId),
        kind: 'catalog_sales.notification_failed',
        conversationId: order.conversationId,
        meta: { orderId: String(order._id), error: msg },
      });

      logger.warn('Falha notificação WA interna PIX', { clientId, orderId: order._id, error: msg });
      return { ok: false, status: 'failed', error: msg };
    }
  }

  private async resolveNotificationPhone(
    clientId: string,
    order: ICatalogSalesOrder,
    cfg: CatalogSalesCompanyConfig,
  ): Promise<string | null> {
    if (order.productId) {
      const product = await AiKnowledgeBase.findById(order.productId).select('salesMeta').lean();
      const meta = normalizeProductSalesMeta(product?.salesMeta);
      if (!meta.useCompanyWhatsapp && meta.productWhatsapp && isValidCatalogSalesPhone(meta.productWhatsapp)) {
        return meta.productWhatsapp;
      }
    }
    const companyPhone = cfg.internalWhatsapp?.replace(/\D/g, '') ?? '';
    if (companyPhone && isValidCatalogSalesPhone(companyPhone)) return companyPhone;
    return null;
  }

  private buildNotificationMessage(
    order: ICatalogSalesOrder,
    companyName: string,
    cfg: CatalogSalesCompanyConfig,
  ): string {
    const base = cfg.internalMessageTemplate?.trim();
    const proof = order.proofs[order.proofs.length - 1];
    const proofLink = proof ? this.secureProofPath(String(order._id), proof.mediaUrl) : 'não informado';
    const convLink = this.conversationDashboardLink(order);
    const orderLink = `${config.DASHBOARD.FRONTEND_URL}/platform/inbox?catalogOrder=${String(order._id)}`;

    const lines = [
      base || '🧾 Novo comprovante PIX recebido',
      '',
      `Empresa: ${companyName}`,
      `Cliente: ${order.contactName || 'não informado'}`,
      `Telefone: ${order.contactIdentifier || 'não informado'}`,
      `Canal: ${order.channel}`,
      '',
      `Produto: ${order.productName}`,
      `SKU: ${order.sku || 'não informado'}`,
      `Valor produto: ${order.subtotalAmount || order.amount || 'não informado'}`,
      `Taxa de entrega: ${order.deliveryFee || 'não informado'}`,
      `Total informado: ${order.totalAmount || order.amount || 'não informado'}`,
      `Endereço de entrega: ${order.deliveryAddress || 'não informado'}`,
      `Estoque no momento do pedido: ${order.stockSnapshot || 'não informado'}`,
      '',
      'Status: Aguardando conferência humana',
      '',
      `Comprovante: ${proofLink}`,
      `Conversa: ${convLink}`,
      `Pedido: ${orderLink}`,
      '',
      `Resumo da IA: ${order.aiSummary?.trim() || 'não informado'}`,
    ];
    return lines.join('\n').slice(0, 3500);
  }

  secureProofPath(orderId: string, mediaUrl: string): string {
    const token = this.signProofToken(orderId, mediaUrl);
    return `${config.DASHBOARD.FRONTEND_URL}/api/platform/catalog-sales/orders/${orderId}/proof?token=${token}`;
  }

  signProofToken(orderId: string, mediaUrl: string): string {
    const payload = `${orderId}:${mediaUrl}`;
    return crypto.createHmac('sha256', config.SECURITY.JWT_SECRET).update(payload).digest('hex');
  }

  verifyProofToken(orderId: string, mediaUrl: string, token: string): boolean {
    const expected = this.signProofToken(orderId, mediaUrl);
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
    } catch {
      return false;
    }
  }

  private conversationDashboardLink(order: ICatalogSalesOrder): string {
    const base = config.DASHBOARD.FRONTEND_URL;
    if (order.channel === 'webchat') {
      return `${base}/platform/inbox?channel=all&conversation=wc:${String(order.conversationId)}`;
    }
    return `${base}/platform/inbox?conversation=${String(order.conversationId)}`;
  }

  private hashProof(mediaUrl: string, messageId?: string): string {
    return crypto
      .createHash('sha256')
      .update(`${mediaUrl}:${messageId ?? ''}`)
      .digest('hex')
      .slice(0, 32);
  }

  private async markConversationOrder(
    clientId: string,
    conversation: CatalogSalesConversationRef,
    orderId: mongoose.Types.ObjectId,
    pixPending: boolean,
  ): Promise<void> {
    const patch = {
      activeCatalogOrderId: orderId,
      catalogSalesPixPending: pixPending,
    };
    if (conversation.channel === 'webchat') {
      await WebChatConversation.updateOne(
        { _id: conversation.conversationId, clientId: new mongoose.Types.ObjectId(clientId) },
        { $set: patch },
      );
    } else {
      await InboxConversation.updateOne(
        { _id: conversation.conversationId, clientId: new mongoose.Types.ObjectId(clientId) },
        { $set: patch },
      );
    }
  }

  private async escalateConversationToHuman(
    clientId: string,
    conversation: CatalogSalesConversationRef,
  ): Promise<void> {
    if (conversation.channel === 'webchat') {
      await WebChatConversation.updateOne(
        { _id: conversation.conversationId, clientId: new mongoose.Types.ObjectId(clientId) },
        {
          $set: {
            queueStatus: 'waiting_human',
            queueEnteredAt: new Date(),
          },
        },
      );
      return;
    }
    const { InboxConversationStatus } = await import('@/types/inbox');
    await InboxConversation.updateOne(
      { _id: conversation.conversationId, clientId: new mongoose.Types.ObjectId(clientId) },
      {
        $set: {
          status: InboxConversationStatus.WAITING_QUEUE,
          queueEnteredAt: new Date(),
          aiStatus: 'ai_escalated',
        },
      },
    );
  }

  async approvePayment(
    clientId: string,
    orderId: string,
    actorUserId: string,
  ): Promise<ICatalogSalesOrder> {
    const order = await this.getOrderForClient(clientId, orderId);
    if (['pagamento_aprovado', 'pedido_confirmado', 'cancelado'].includes(order.status)) {
      throw new Error('Pedido já finalizado ou cancelado');
    }
    order.status = 'pagamento_aprovado';
    order.approvedByUserId = new mongoose.Types.ObjectId(actorUserId);
    order.approvedAt = new Date();
    order.history.push({
      at: new Date(),
      action: 'payment_approved',
      status: 'pagamento_aprovado',
      actorUserId,
    });
    await order.save();
    await this.clearConversationPixPending(clientId, order);
    const cfg = await this.loadCompanyConfig(clientId);
    await this.notifyCustomerPaymentUpdate(clientId, order, 'approve', cfg);
    await AttendanceEvent.create({
      clientId: new mongoose.Types.ObjectId(clientId),
      kind: 'catalog_sales.payment_approved',
      conversationId: order.conversationId,
      actorUserId: new mongoose.Types.ObjectId(actorUserId),
      meta: { orderId },
    });
    return order;
  }

  async rejectPayment(
    clientId: string,
    orderId: string,
    actorUserId: string,
    reason?: string,
  ): Promise<ICatalogSalesOrder> {
    const order = await this.getOrderForClient(clientId, orderId);
    order.status = 'pagamento_recusado';
    order.rejectedByUserId = new mongoose.Types.ObjectId(actorUserId);
    order.rejectedAt = new Date();
    order.rejectionReason = reason?.trim().slice(0, 500);
    order.history.push({
      at: new Date(),
      action: 'payment_rejected',
      status: 'pagamento_recusado',
      actorUserId,
      note: reason,
    });
    await order.save();
    const cfg = await this.loadCompanyConfig(clientId);
    await this.notifyCustomerPaymentUpdate(clientId, order, 'reject', cfg, reason);
    await AttendanceEvent.create({
      clientId: new mongoose.Types.ObjectId(clientId),
      kind: 'catalog_sales.payment_rejected',
      conversationId: order.conversationId,
      actorUserId: new mongoose.Types.ObjectId(actorUserId),
      meta: { orderId, reason: reason?.slice(0, 120) },
    });
    return order;
  }

  async requestNewProof(
    clientId: string,
    orderId: string,
    actorUserId: string,
  ): Promise<ICatalogSalesOrder> {
    const order = await this.getOrderForClient(clientId, orderId);
    order.status = 'aguardando_pagamento';
    order.history.push({
      at: new Date(),
      action: 'new_proof_requested',
      status: 'aguardando_pagamento',
      actorUserId,
    });
    await order.save();
    const cfg = await this.loadCompanyConfig(clientId);
    await this.notifyCustomerPaymentUpdate(clientId, order, 'request_new_proof', cfg);
    return order;
  }

  private async notifyCustomerPaymentUpdate(
    clientId: string,
    order: ICatalogSalesOrder,
    kind: 'approve' | 'reject' | 'request_new_proof',
    cfg: CatalogSalesCompanyConfig,
    reason?: string,
  ): Promise<void> {
    const enabled =
      (kind === 'approve' && cfg.notifyCustomerOnApprove !== false) ||
      (kind === 'reject' && cfg.notifyCustomerOnReject !== false) ||
      (kind === 'request_new_proof' && cfg.notifyCustomerOnRequestNewProof !== false);
    if (!enabled) return;

    const templateByKind = {
      approve:
        cfg.customerApproveMessage?.trim() || DEFAULT_CATALOG_CUSTOMER_APPROVE_MESSAGE,
      reject: cfg.customerRejectMessage?.trim() || DEFAULT_CATALOG_CUSTOMER_REJECT_MESSAGE,
      request_new_proof:
        cfg.customerRequestNewProofMessage?.trim() ||
        DEFAULT_CATALOG_CUSTOMER_NEW_PROOF_MESSAGE,
    };
    const text = renderCatalogCustomerMessage(templateByKind[kind], {
      productName: order.productName,
      reason: reason?.trim() ? `${reason.trim()}.` : '',
      deliveryFee: order.deliveryFee ?? '',
      amount: order.amount ?? order.totalAmount ?? '',
    });
    if (!text) return;

    try {
      if (order.channel === 'whatsapp' && order.contactIdentifier?.trim()) {
        await WhatsAppService.getInstance().sendManualMessage(
          clientId,
          order.contactIdentifier.trim(),
          text,
          undefined,
          {
            skipConsentCheck: true,
            consentOrigin: 'catalog-sales-customer',
            sendKind: 'conversation',
          },
        );
        return;
      }
      if (order.channel === 'webchat') {
        const { WebChatService } = await import('@/services/webchat/WebChatService');
        await WebChatService.getInstance().sendCatalogAutomatedReply(
          clientId,
          String(order.conversationId),
          text,
        );
      }
    } catch (err) {
      logger.warn('Falha ao enviar mensagem automática de pedido ao cliente', {
        clientId,
        orderId: String(order._id),
        kind,
        err,
      });
    }
  }

  async addInternalNote(
    clientId: string,
    orderId: string,
    actorUserId: string,
    body: string,
  ): Promise<ICatalogSalesOrder> {
    const order = await this.getOrderForClient(clientId, orderId);
    order.internalNotes.push({
      at: new Date(),
      userId: actorUserId,
      body: body.trim().slice(0, 2000),
    });
    await order.save();
    return order;
  }

  async listOrders(
    clientId: string,
    opts?: { status?: string; conversationId?: string; limit?: number },
  ): Promise<ICatalogSalesOrder[]> {
    const filter: Record<string, unknown> = {
      clientId: new mongoose.Types.ObjectId(clientId),
    };
    if (opts?.status) filter.status = opts.status;
    if (opts?.conversationId) {
      filter.conversationId = new mongoose.Types.ObjectId(opts.conversationId);
    }
    return CatalogSalesOrder.find(filter).sort({ updatedAt: -1 }).limit(opts?.limit ?? 50);
  }

  async getOrderForClient(clientId: string, orderId: string): Promise<ICatalogSalesOrder> {
    if (!mongoose.Types.ObjectId.isValid(orderId)) throw new Error('Pedido inválido');
    const order = await CatalogSalesOrder.findOne({
      _id: new mongoose.Types.ObjectId(orderId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!order) throw new Error('Pedido não encontrado');
    return order;
  }

  private async clearConversationPixPending(
    clientId: string,
    order: ICatalogSalesOrder,
  ): Promise<void> {
    const patch = { catalogSalesPixPending: false };
    if (order.channel === 'webchat') {
      await WebChatConversation.updateOne(
        { _id: order.conversationId, clientId: new mongoose.Types.ObjectId(clientId) },
        { $set: patch },
      );
    } else {
      await InboxConversation.updateOne(
        { _id: order.conversationId, clientId: new mongoose.Types.ObjectId(clientId) },
        { $set: patch },
      );
    }
  }

  orderToPayload(order: ICatalogSalesOrder) {
    return {
      id: String(order._id),
      conversationId: String(order.conversationId),
      channel: order.channel,
      contactName: order.contactName,
      contactIdentifier: order.contactIdentifier,
      productId: order.productId ? String(order.productId) : null,
      productName: order.productName,
      sku: order.sku,
      amount: order.amount,
      subtotalAmount: order.subtotalAmount,
      deliveryFee: order.deliveryFee,
      totalAmount: order.totalAmount,
      deliveryAddress: order.deliveryAddress,
      deliveryDistanceKm: order.deliveryDistanceKm,
      deliveryTierKm: order.deliveryTierKm,
      stockSnapshot: order.stockSnapshot,
      status: order.status,
      proofs: order.proofs.map(p => ({
        mediaUrl: p.mediaUrl,
        mediaMime: p.mediaMime,
        mediaType: p.mediaType,
        receivedAt: p.receivedAt,
      })),
      lastNotificationStatus: order.lastNotificationStatus,
      lastNotificationError: order.lastNotificationError,
      aiSummary: order.aiSummary,
      approvedAt: order.approvedAt,
      rejectedAt: order.rejectedAt,
      rejectionReason: order.rejectionReason,
      internalNotes: order.internalNotes,
      history: order.history,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
