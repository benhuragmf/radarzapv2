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
  DEFAULT_CATALOG_CUSTOMER_DELIVERY_QUOTE_FAILED_MESSAGE,
  DEFAULT_CATALOG_CUSTOMER_DELIVERY_QUOTE_MESSAGE,
  DEFAULT_CATALOG_CUSTOMER_NEW_PROOF_MESSAGE,
  DEFAULT_CATALOG_CUSTOMER_LOCATION_CONFIRM_MESSAGE,
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
  estimateDeliveryToCoordinates,
  buildAddressLabelFromLocation,
  reverseGeocodeCoords,
  locationAddressNeedsConfirmation,
  mergeLocationConfirmReply,
  locationAreaHint,
  normalizeKmRates,
  sanitizeAiReplyWhenServerQuotedDelivery,
} from '@/utils/catalog-delivery.util';
import type { WaInboundLocation } from '@/utils/wa-location.util';
import { isValidWaCoordinates } from '@/utils/wa-location.util';
import { deliveryAddressValidationError, isCompleteDeliveryAddress } from '@/types/catalog-delivery-address';
import { sanitizeKnowledgeBaseContentForClient } from '@/utils/ai-kb-client.util';

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

export interface CatalogAiTurnResult {
  serverQuoteSent: boolean;
  quoteFailed: boolean;
  useDistanceBasedDelivery: boolean;
  needsAddressConfirmation?: boolean;
  handled?: boolean;
  geocodedAddress?: string;
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
      if (!normalized.requireDeliveryAddress) {
        throw new Error(
          'Ative "Requisito de entrega" em Dados a coletar antes de usar frete por distância.',
        );
      }
      const originErr = deliveryAddressValidationError(normalized.deliveryOriginAddress);
      if (originErr) {
        throw new Error(
          `Entrega por distância: ${originErr} Exemplo: 01001-000, Praça da Sé, 100, Sé, São Paulo, SP, Brasil`,
        );
      }
    }
    if (!normalized.requireDeliveryAddress) {
      normalized.useDistanceBasedDelivery = false;
    }

    await Organization.findByIdAndUpdate(clientId, { $set: { catalogSales: normalized } });

    const shouldSyncAddressCollect = normalized.requireDeliveryAddress === true;
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

  /** Pós-turno IA: pedido + cotação de frete pelo servidor (não pela IA). */
  async processAiCatalogTurn(opts: {
    clientId: string;
    conversation: CatalogSalesConversationRef;
    clientText: string;
    structured: AiStructuredReply;
    aiSummary?: string;
  }): Promise<CatalogAiTurnResult> {
    const cfg = await this.loadCompanyConfig(opts.clientId);
    await this.maybeCreateOrderFromAiTurn(opts);

    const quoteResult = await this.maybeUpdateOrderFromAiTurn({
      clientId: opts.clientId,
      conversationId: opts.conversation.conversationId,
      structured: { collectedAddress: opts.structured.collectedAddress },
    });

    return {
      serverQuoteSent: quoteResult.quoteSent,
      quoteFailed: quoteResult.quoteFailed,
      useDistanceBasedDelivery: Boolean(cfg.useDistanceBasedDelivery),
    };
  }

  /** Quando o LLM falha em intenção de compra, orienta o cliente sem mensagem genérica de instabilidade. */
  async buildPurchaseRecoveryReply(opts: {
    clientId: string;
    conversationId: string;
    clientText: string;
    threadContext?: string;
    contactFirstName?: string;
  }): Promise<string | null> {
    const cfg = await this.loadCompanyConfig(opts.clientId);
    if (!cfg.enabled) return null;

    const prefix = opts.contactFirstName ? `${opts.contactFirstName}, ` : '';
    const active = await this.findActiveOrderForConversation(opts.clientId, opts.conversationId);
    if (active?.status === 'aguardando_endereco') {
      return (
        `${prefix}para continuar sua compra do *${active.productName}*, envie o *endereço completo* ` +
        'para entrega (rua, número, bairro e cidade).'
      );
    }
    if (active?.status === 'aguardando_pagamento') {
      const pix = cfg.pixInstructions?.trim();
      if (pix) {
        return (
          `${prefix}seu pedido de *${active.productName}* está aguardando pagamento.\n\n*PIX:*\n${pix}`
        );
      }
      return (
        `${prefix}seu pedido de *${active.productName}* está aguardando pagamento. ` +
        'Envie o comprovante aqui quando concluir o PIX.'
      );
    }

    const combined = [opts.threadContext, opts.clientText].filter(Boolean).join(' ');
    const product = await this.guessProductFromText(opts.clientId, combined);
    if (!product) {
      return `${prefix}posso te ajudar com a compra! Qual produto você gostaria de adquirir?`;
    }

    const body = sanitizeKnowledgeBaseContentForClient(product.content ?? '');
    const salesMeta = normalizeProductSalesMeta(product.salesMeta);
    const needsAddress = orderRequiresDeliveryAddress(cfg, salesMeta);
    const nextStep = needsAddress
      ? 'Para seguir com a compra, envie seu *endereço completo* para entrega.'
      : cfg.pixEnabled && cfg.pixInstructions?.trim()
        ? `Para pagar via PIX:\n${cfg.pixInstructions.trim()}`
        : 'Confirme que deseja comprar para eu registrar seu pedido.';

    return `${prefix}${body ? `${body}\n\n` : ''}${nextStep}`.trim();
  }

  sanitizeAiReplyForCatalogQuote(
    reply: string,
    catalogTurn: CatalogAiTurnResult,
  ): string {
    return sanitizeAiReplyWhenServerQuotedDelivery(reply, {
      serverQuoteSent: catalogTurn.serverQuoteSent,
      quoteFailed: catalogTurn.quoteFailed,
      useDistanceBasedDelivery: catalogTurn.useDistanceBasedDelivery,
    });
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

  /** Atualiza endereço em pedido pendente; calcula frete no servidor e envia cotação ao cliente. */
  async maybeAttachAddressToOrder(
    order: ICatalogSalesOrder,
    collectedAddress?: string,
    companyCfg?: CatalogSalesCompanyConfig,
    productMeta?: ReturnType<typeof normalizeProductSalesMeta>,
  ): Promise<{ quoteSent: boolean; quoteFailed: boolean }> {
    const addr = collectedAddress?.trim();
    if (!addr || order.status !== 'aguardando_endereco') {
      return { quoteSent: false, quoteFailed: false };
    }

    let resolvedAddr = addr;
    if (order.deliveryLocationPendingConfirm) {
      const lat = order.deliveryLocationLat;
      const lng = order.deliveryLocationLng;
      const reverse =
        lat != null && lng != null && isValidWaCoordinates(lat, lng)
          ? await reverseGeocodeCoords(lat, lng)
          : null;
      const merged = mergeLocationConfirmReply(addr, reverse);
      if (!merged) {
        return { quoteSent: false, quoteFailed: false };
      }
      resolvedAddr = merged;
      order.deliveryLocationPendingConfirm = false;
    }

    order.deliveryAddress = resolvedAddr.slice(0, 500);
    const cfg =
      companyCfg ?? (await this.loadCompanyConfig(String(order.clientId)));

    let quoteOk = true;
    if (cfg.useDistanceBasedDelivery) {
      quoteOk = await this.applyDeliveryEstimateToOrder(order, cfg, productMeta);
      if (!quoteOk) {
        order.status = 'aguardando_endereco';
        order.history.push({
          at: new Date(),
          action: 'delivery_quote_failed',
          status: 'aguardando_endereco',
        });
        await order.save();
        await this.sendDeliveryQuoteToCustomer(order, cfg, 'failed');
        void import('@/services/contacts/contact-collected-data.service').then(({ persistContactCollectedData }) =>
          persistContactCollectedData({
            clientId: String(order.clientId),
            destinationId: order.destinationId ? String(order.destinationId) : undefined,
            contactPhone: order.channel === 'whatsapp' ? order.contactIdentifier : undefined,
            visitorPhone: order.channel === 'webchat' ? order.contactIdentifier : undefined,
            visitorName: order.contactName,
            fields: { address: order.deliveryAddress },
          }),
        );
        return { quoteSent: false, quoteFailed: true };
      }
    } else {
      await this.applyDeliveryEstimateToOrder(order, cfg, productMeta);
    }

    order.status = 'aguardando_pagamento';
    order.history.push({
      at: new Date(),
      action: 'address_collected',
      status: 'aguardando_pagamento',
    });
    await order.save();

    void import('@/services/contacts/contact-collected-data.service').then(({ persistContactCollectedData }) =>
      persistContactCollectedData({
        clientId: String(order.clientId),
        destinationId: order.destinationId ? String(order.destinationId) : undefined,
        contactPhone: order.channel === 'whatsapp' ? order.contactIdentifier : undefined,
        visitorPhone: order.channel === 'webchat' ? order.contactIdentifier : undefined,
        visitorName: order.contactName,
        fields: { address: order.deliveryAddress },
      }),
    );

    if (cfg.useDistanceBasedDelivery) {
      await this.sendDeliveryQuoteToCustomer(order, cfg, 'success');
      return { quoteSent: true, quoteFailed: false };
    }
    return { quoteSent: false, quoteFailed: false };
  }

  private async applyDeliveryEstimateToOrder(
    order: ICatalogSalesOrder,
    cfg: CatalogSalesCompanyConfig,
    _productMeta?: ReturnType<typeof normalizeProductSalesMeta>,
  ): Promise<boolean> {
    if (!cfg.useDistanceBasedDelivery) return true;
    const origin = cfg.deliveryOriginAddress?.trim();
    if (!origin || deliveryAddressValidationError(origin)) {
      logger.warn('Origem da empresa inválida — cálculo de entrega ignorado', {
        clientId: String(order.clientId),
        orderId: String(order._id),
      });
      return false;
    }

    const rates = normalizeKmRates(cfg.deliveryKmRates);
    const dest = order.deliveryAddress?.trim();
    const addressComplete = Boolean(dest && !deliveryAddressValidationError(dest));
    const destLat = order.deliveryLocationLat;
    const destLng = order.deliveryLocationLng;
    const hasCoords =
      destLat != null &&
      destLng != null &&
      isValidWaCoordinates(destLat, destLng) &&
      !order.deliveryLocationPendingConfirm;

    let estimate = addressComplete
      ? await estimateDeliveryFromAddresses({
          originAddress: origin,
          destinationAddress: dest!,
          rates,
          countryCode: 'Brasil',
        })
      : null;

    if (!estimate && hasCoords) {
      estimate = await estimateDeliveryToCoordinates({
        originAddress: origin,
        destLat,
        destLng: destLng!,
        rates,
        countryCode: 'Brasil',
      });
    }

    if (!estimate && !addressComplete) {
      const fallbackDest = order.deliveryAddress?.trim();
      if (fallbackDest && !deliveryAddressValidationError(fallbackDest)) {
        estimate = await estimateDeliveryFromAddresses({
          originAddress: origin,
          destinationAddress: fallbackDest,
          rates,
          countryCode: 'Brasil',
        });
      }
    }

    if (!estimate || !estimate.deliveryFee?.trim()) {
      logger.warn('Cotação de entrega indisponível — geocoding, rota ou faixa sem taxa', {
        clientId: String(order.clientId),
        orderId: String(order._id),
        hasEstimate: Boolean(estimate),
        tierKm: estimate?.tierKm,
        usedCoords: destLat != null && destLng != null,
      });
      return false;
    }

    order.deliveryDistanceKm = estimate.distanceKm;
    order.deliveryTierKm = estimate.tierKm;
    order.deliveryDistanceMethod = estimate.distanceMethod;
    order.deliveryFee = estimate.deliveryFee;
    const subtotal = order.subtotalAmount ?? order.amount;
    order.totalAmount = buildOrderAmountSummary(subtotal ?? undefined, estimate.deliveryFee);
    order.amount = order.totalAmount;

    void AttendanceEvent.create({
      clientId: order.clientId,
      kind: 'catalog_sales.delivery_quoted',
      conversationId: order.conversationId,
      meta: {
        orderId: String(order._id),
        distanceKm: estimate.distanceKm,
        tierKm: estimate.tierKm,
        deliveryFee: estimate.deliveryFee,
        distanceMethod: estimate.distanceMethod,
        usedGps: destLat != null && destLng != null,
      },
    }).catch(() => undefined);

    return true;
  }

  /** Pin de localização WhatsApp → endereço + frete calculado pelo servidor. */
  async handleInboundLocation(opts: {
    clientId: string;
    conversation: CatalogSalesConversationRef;
    location: WaInboundLocation;
  }): Promise<CatalogAiTurnResult> {
    const cfg = await this.loadCompanyConfig(opts.clientId);
    const useDistance = Boolean(cfg.useDistanceBasedDelivery);
    const { lat, lng } = opts.location;

    if (!isValidWaCoordinates(lat, lng)) {
      return { serverQuoteSent: false, quoteFailed: false, useDistanceBasedDelivery: useDistance };
    }

    const reverse = await reverseGeocodeCoords(lat, lng);
    const addressLabel = buildAddressLabelFromLocation({
      reverseDisplayName: reverse?.displayName,
      waName: opts.location.name,
      waAddress: opts.location.address,
      lat,
      lng,
    });

    void import('@/services/contacts/contact-collected-data.service').then(({ persistContactCollectedData }) =>
      persistContactCollectedData({
        clientId: opts.clientId,
        destinationId: opts.conversation.destinationId,
        contactPhone: opts.conversation.channel === 'whatsapp' ? opts.conversation.contactIdentifier : undefined,
        visitorPhone: opts.conversation.channel === 'webchat' ? opts.conversation.contactIdentifier : undefined,
        visitorName: opts.conversation.contactName,
        fields: {
          address: addressLabel,
          locationLat: lat,
          locationLng: lng,
        },
      }),
    );

    const needsFreightFlow = Boolean(cfg.requireDeliveryAddress || useDistance);
    if (!needsFreightFlow) {
      return {
        serverQuoteSent: false,
        quoteFailed: false,
        useDistanceBasedDelivery: useDistance,
        handled: true,
        geocodedAddress: addressLabel,
      };
    }

    const order = await this.findActiveOrderForConversation(
      opts.clientId,
      opts.conversation.conversationId,
    );

    if (!order || order.status !== 'aguardando_endereco') {
      return {
        serverQuoteSent: false,
        quoteFailed: false,
        useDistanceBasedDelivery: useDistance,
        geocodedAddress: addressLabel,
      };
    }

    order.deliveryLocationLat = lat;
    order.deliveryLocationLng = lng;
    order.deliveryAddress = addressLabel.slice(0, 500);

    const needsConfirm = locationAddressNeedsConfirmation({
      reverse,
      waAddress: opts.location.address,
      addressLabel,
      isLive: opts.location.isLive,
    });

    if (needsConfirm) {
      order.deliveryLocationPendingConfirm = true;
      order.status = 'aguardando_endereco';
      order.history.push({
        at: new Date(),
        action: 'location_pending_confirm',
        status: 'aguardando_endereco',
        note: locationAreaHint(reverse) || 'pin',
      });
      await order.save();
      await this.sendLocationConfirmRequestToCustomer(order, cfg, reverse);
      return {
        serverQuoteSent: false,
        quoteFailed: false,
        useDistanceBasedDelivery: useDistance,
        needsAddressConfirmation: true,
        handled: true,
      };
    }

    order.deliveryLocationPendingConfirm = false;

    const quoteOk = await this.applyDeliveryEstimateToOrder(order, cfg);
    if (!quoteOk) {
      order.status = 'aguardando_endereco';
      order.history.push({
        at: new Date(),
        action: 'delivery_quote_failed',
        status: 'aguardando_endereco',
        note: 'localização',
      });
      await order.save();
      await this.sendDeliveryQuoteToCustomer(order, cfg, 'failed');
      return { serverQuoteSent: false, quoteFailed: true, useDistanceBasedDelivery: useDistance };
    }

    order.status = 'aguardando_pagamento';
    order.history.push({
      at: new Date(),
      action: 'location_collected',
      status: 'aguardando_pagamento',
    });
    await order.save();
    await this.sendDeliveryQuoteToCustomer(order, cfg, 'success');
    return { serverQuoteSent: true, quoteFailed: false, useDistanceBasedDelivery: useDistance };
  }

  /** Resposta em texto após pedido de confirmação de rua/número (pin impreciso). */
  async handleInboundLocationStreetConfirm(opts: {
    clientId: string;
    conversation: CatalogSalesConversationRef;
    text: string;
  }): Promise<CatalogAiTurnResult> {
    const cfg = await this.loadCompanyConfig(opts.clientId);
    const useDistance = Boolean(cfg.useDistanceBasedDelivery);
    const text = opts.text.trim();
    if (!text) {
      return { serverQuoteSent: false, quoteFailed: false, useDistanceBasedDelivery: useDistance, handled: false };
    }

    const order = await CatalogSalesOrder.findOne({
      clientId: new mongoose.Types.ObjectId(opts.clientId),
      conversationId: new mongoose.Types.ObjectId(opts.conversation.conversationId),
      status: 'aguardando_endereco',
      deliveryLocationPendingConfirm: true,
    }).sort({ updatedAt: -1 });

    if (!order) {
      return { serverQuoteSent: false, quoteFailed: false, useDistanceBasedDelivery: useDistance, handled: false };
    }

    const wasPending = Boolean(order.deliveryLocationPendingConfirm);
    const quoteResult = await this.maybeAttachAddressToOrder(order, text, cfg);

    if (wasPending && order.deliveryLocationPendingConfirm) {
      await this.sendLocationConfirmRetryToCustomer(order, cfg);
      return {
        serverQuoteSent: false,
        quoteFailed: false,
        useDistanceBasedDelivery: useDistance,
        needsAddressConfirmation: true,
        handled: true,
      };
    }

    return {
      serverQuoteSent: quoteResult.quoteSent,
      quoteFailed: quoteResult.quoteFailed,
      useDistanceBasedDelivery: useDistance,
      handled: true,
    };
  }

  async maybeUpdateOrderFromAiTurn(opts: {
    clientId: string;
    conversationId: string;
    structured: { collectedAddress?: string };
  }): Promise<{ quoteSent: boolean; quoteFailed: boolean }> {
    const order = await CatalogSalesOrder.findOne({
      clientId: new mongoose.Types.ObjectId(opts.clientId),
      conversationId: new mongoose.Types.ObjectId(opts.conversationId),
      status: 'aguardando_endereco',
    }).sort({ updatedAt: -1 });
    if (!order) return { quoteSent: false, quoteFailed: false };
    const cfg = await this.loadCompanyConfig(opts.clientId);
    return this.maybeAttachAddressToOrder(order, opts.structured.collectedAddress, cfg);
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
      if (cfg.useDistanceBasedDelivery) {
        const quoteOk = await this.applyDeliveryEstimateToOrder(order, cfg);
        if (quoteOk) {
          order.status = 'aguardando_pagamento';
          await order.save();
          await this.sendDeliveryQuoteToCustomer(order, cfg, 'success');
        } else {
          order.status = 'aguardando_endereco';
          await order.save();
          await this.sendDeliveryQuoteToCustomer(order, cfg, 'failed');
        }
      } else {
        await this.applyDeliveryEstimateToOrder(order, cfg);
        await order.save();
      }
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

    if (cfg.enabled && cfg.escalateOnProof && cfg.requireHumanApproval !== false) {
      await this.escalateConversationToHuman(opts.clientId, opts.conversation);
    }

    if (!cfg.requireHumanApproval) {
      order.status = 'pagamento_aprovado';
      order.approvedAt = new Date();
      order.history.push({
        at: new Date(),
        action: 'payment_auto_approved',
        status: 'pagamento_aprovado',
        note: 'Aprovação automática (requireHumanApproval=false)',
      });
      await order.save();
      await this.clearConversationPixPending(opts.clientId, order);
      await this.notifyCustomerPaymentUpdate(opts.clientId, order, 'approve', cfg);
      await AttendanceEvent.create({
        clientId: new mongoose.Types.ObjectId(opts.clientId),
        kind: 'catalog_sales.payment_auto_approved',
        conversationId: order.conversationId,
        meta: { orderId: String(order._id) },
      });
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

  private async sendLocationConfirmRequestToCustomer(
    order: ICatalogSalesOrder,
    cfg: CatalogSalesCompanyConfig,
    reverse: Awaited<ReturnType<typeof reverseGeocodeCoords>>,
  ): Promise<void> {
    const area = locationAreaHint(reverse);
    const areaHint = area ? `Região detectada: *${area}*.\n\n` : '';
    const text = renderCatalogCustomerMessage(
      cfg.customerLocationConfirmMessage?.trim() || DEFAULT_CATALOG_CUSTOMER_LOCATION_CONFIRM_MESSAGE,
      { areaHint },
    );
    await this.sendCatalogAutomatedCustomerMessage(order, text, 'catalog-sales-location-confirm');
  }

  private async sendLocationConfirmRetryToCustomer(
    order: ICatalogSalesOrder,
    cfg: CatalogSalesCompanyConfig,
  ): Promise<void> {
    const text =
      'Não consegui identificar a rua e o número. Envie no formato: *Rua das Flores, 123* (ou o endereço completo com CEP).';
    await this.sendCatalogAutomatedCustomerMessage(order, text, 'catalog-sales-location-retry');
  }

  private async sendCatalogAutomatedCustomerMessage(
    order: ICatalogSalesOrder,
    text: string,
    consentOrigin: string,
  ): Promise<void> {
    if (!text.trim()) return;
    try {
      if (order.channel === 'whatsapp' && order.contactIdentifier?.trim()) {
        await WhatsAppService.getInstance().sendManualMessage(
          String(order.clientId),
          order.contactIdentifier.trim(),
          text,
          undefined,
          {
            skipConsentCheck: true,
            consentOrigin,
            sendKind: 'conversation',
          },
        );
        return;
      }
      if (order.channel === 'webchat') {
        const { WebChatService } = await import('@/services/webchat/WebChatService');
        await WebChatService.getInstance().sendCatalogAutomatedReply(
          String(order.clientId),
          String(order.conversationId),
          text,
        );
      }
    } catch (err) {
      logger.warn('Falha ao enviar mensagem automática catálogo ao cliente', {
        clientId: String(order.clientId),
        orderId: String(order._id),
        consentOrigin,
        err,
      });
    }
  }

  private async sendDeliveryQuoteToCustomer(
    order: ICatalogSalesOrder,
    cfg: CatalogSalesCompanyConfig,
    kind: 'success' | 'failed',
  ): Promise<void> {
    const text =
      kind === 'failed'
        ? renderCatalogCustomerMessage(
            cfg.customerDeliveryQuoteFailedMessage?.trim() ||
              DEFAULT_CATALOG_CUSTOMER_DELIVERY_QUOTE_FAILED_MESSAGE,
            {},
          )
        : this.buildDeliveryQuoteMessage(order, cfg);
    if (!text) return;

    try {
      if (order.channel === 'whatsapp' && order.contactIdentifier?.trim()) {
        await WhatsAppService.getInstance().sendManualMessage(
          String(order.clientId),
          order.contactIdentifier.trim(),
          text,
          undefined,
          {
            skipConsentCheck: true,
            consentOrigin: 'catalog-sales-delivery-quote',
            sendKind: 'conversation',
          },
        );
        return;
      }
      if (order.channel === 'webchat') {
        const { WebChatService } = await import('@/services/webchat/WebChatService');
        await WebChatService.getInstance().sendCatalogAutomatedReply(
          String(order.clientId),
          String(order.conversationId),
          text,
        );
      }
    } catch (err) {
      logger.warn('Falha ao enviar cotação de entrega ao cliente', {
        clientId: String(order.clientId),
        orderId: String(order._id),
        kind,
        err,
      });
    }
  }

  private buildDeliveryQuoteMessage(
    order: ICatalogSalesOrder,
    cfg: CatalogSalesCompanyConfig,
  ): string {
    const template =
      cfg.customerDeliveryQuoteMessage?.trim() ||
      DEFAULT_CATALOG_CUSTOMER_DELIVERY_QUOTE_MESSAGE;
    const pixBlock = cfg.pixInstructions?.trim()
      ? `*Pagamento PIX:*\n${cfg.pixInstructions.trim()}`
      : '';
    const distanceMethodLabel =
      order.deliveryDistanceMethod === 'road'
        ? ' pela rota'
        : order.deliveryDistanceMethod === 'haversine'
          ? ' (estimativa)'
          : '';
    return renderCatalogCustomerMessage(template, {
      productName: order.productName,
      subtotalAmount: order.subtotalAmount ?? order.amount ?? '—',
      deliveryFee: order.deliveryFee ?? '—',
      deliveryDistanceKm:
        order.deliveryDistanceKm != null ? String(order.deliveryDistanceKm) : '—',
      deliveryTierKm: order.deliveryTierKm != null ? String(order.deliveryTierKm) : '—',
      totalAmount: order.totalAmount ?? order.amount ?? '—',
      distanceMethodLabel,
      pixInstructions: pixBlock,
    });
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
