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
import { emptyAiStructuredReply } from '@/types/ai-assistant';
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
  productStockAllowsPixPurchase,
  renderCatalogCustomerMessage,
  resolveProductSaleMode,
  resolveCatalogFulfillmentMode,
  deliveryFulfillmentNeedsAddress,
  shouldOpenPixOrderFlow,
  detectDeliveryFulfillmentChoice,
  detectPickupFulfillmentChoice,
  detectDeliveryFeeOrAddressQuestion,
  detectPixResendRequest,
  detectPurchaseConfirmation,
  extractProductNameFromCatalogOffer,
  extractCatalogProductQueryToken,
  catalogTitleSimilarity,
  normalizeCatalogCompareText,
  CATALOG_FUZZY_SUGGEST_MIN_SCORE,
  CATALOG_DELIVERY_CEP_REQUEST_MESSAGE,
  buildEmptyCatalogReply,
  formatCatalogProductSuggestionLine,
  buildCatalogPurchaseOfferReply as buildCatalogPurchaseOfferText,
  buildDeliveryAddressStartReply,
  buildDeliveryInquiryReply,
  isCatalogPurchaseOfferMessage,
  buildFulfillmentReminderReply,
  formatProductPriceOfferPhrase,
  resolveConfiguredPickupAddress,
  buildPickupWithoutAddressReply,
  buildPickupWithAddressReply,
  buildCatalogContextualRecoveryReply,
  buildCatalogCepOfferReply,
  buildCatalogHumanEscalationReply,
  buildCatalogCancelReply,
  buildCatalogExitReply,
  buildCatalogAddressRetryReply,
  buildCatalogMediaInFlowReply,
  detectCatalogHumanEscalationRequest,
  detectCatalogCancelRequest,
  detectCatalogExitRequest,
  detectCatalogCepOfferQuestion,
  isStaleCatalogOrder,
  shouldIgnoreStaleCatalogRecovery,
  isCatalogGreetingOnly,
  isAwaitingCatalogFulfillmentChoice,
} from '@/types/catalog-sales';
import {
  generateCatalogOrderCodeCandidate,
  isValidCatalogOrderCode,
  normalizeCatalogOrderCode,
} from '@/utils/catalog-order-code.util';
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
  buildDeliveryAddressFromCepAndNumber,
  parseStreetNumberReply,
} from '@/utils/catalog-delivery.util';
import {
  storedValueIsCepOnly,
  textIsCepOnly,
  textLooksLikeStreetNumber,
  textLooksLikeDeliveryAddressInput,
  isGeocodableCustomerAddress,
} from '@/types/catalog-delivery-address';
import { formatCepDisplay, normalizeCepDigits } from '@/utils/br-cep.util';
import { resolveClientFirstName } from '@/utils/ai-kb-client.util';
import type { WaInboundLocation } from '@/utils/wa-location.util';
import { isValidWaCoordinates } from '@/utils/wa-location.util';
import { deliveryAddressValidationError, isCompleteDeliveryAddress } from '@/types/catalog-delivery-address';
import { sanitizeKnowledgeBaseContentForClient } from '@/utils/ai-kb-client.util';
import {
  catalogDeliveryAddressService,
} from '@/services/catalog/CatalogDeliveryAddressService';
import { deliveryAddressV1Label } from '@/types/catalog-delivery-address-v1';

const logger = createServiceLogger('CatalogSalesService');

const ACTIVE_ORDER_STATUSES: CatalogSalesOrderStatus[] = [
  'aguardando_endereco',
  'pendente_humano_endereco',
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
      catalogFlowPaused: { $ne: true },
    };
    if (productId) filter.productId = new mongoose.Types.ObjectId(productId);
    return CatalogSalesOrder.findOne(filter).sort({ updatedAt: -1 });
  }

  /** Pedido ativo ignorando contexto stale (saudação nova sem intenção de retomar). */
  async findResolvableActiveOrderForConversation(
    clientId: string,
    conversationId: string,
    clientText?: string,
  ): Promise<ICatalogSalesOrder | null> {
    const order = await this.findActiveOrderForConversation(clientId, conversationId);
    if (!order) return null;
    if (shouldIgnoreStaleCatalogRecovery(clientText ?? '', order)) return null;
    return order;
  }

  async hasActiveCatalogFlow(opts: {
    clientId: string;
    conversationId: string;
    lastAssistantReply?: string;
    clientText?: string;
  }): Promise<{
    active: boolean;
    order: ICatalogSalesOrder | null;
    awaitingFulfillment?: boolean;
  }> {
    const order = await this.findResolvableActiveOrderForConversation(
      opts.clientId,
      opts.conversationId,
      opts.clientText,
    );
    if (order) {
      return { active: true, order };
    }
    if (isAwaitingCatalogFulfillmentChoice(opts.lastAssistantReply)) {
      return { active: true, order: null, awaitingFulfillment: true };
    }
    const conv = await InboxConversation.findOne({
      _id: new mongoose.Types.ObjectId(opts.conversationId),
      clientId: new mongoose.Types.ObjectId(opts.clientId),
    })
      .select('activeCatalogOrderId catalogSalesPixPending')
      .lean();
    if (conv?.activeCatalogOrderId || conv?.catalogSalesPixPending) {
      return { active: true, order: null };
    }
    return { active: false, order: null };
  }

  private async ensureOrderCode(order: ICatalogSalesOrder): Promise<string> {
    if (order.orderCode?.trim()) return order.orderCode.trim();
    for (let i = 0; i < 12; i++) {
      const candidate = generateCatalogOrderCodeCandidate();
      const exists = await CatalogSalesOrder.exists({
        clientId: order.clientId,
        orderCode: candidate,
      });
      if (exists) continue;
      order.orderCode = candidate;
      await order.save();
      return candidate;
    }
    const fallback = `DX-${String(order._id).slice(-4).toUpperCase()}`;
    order.orderCode = fallback;
    await order.save();
    return fallback;
  }

  async backfillOrderCodeIfMissing(order: ICatalogSalesOrder): Promise<string> {
    return this.ensureOrderCode(order);
  }

  async getOrderByCode(clientId: string, orderCode: string): Promise<ICatalogSalesOrder | null> {
    const code = normalizeCatalogOrderCode(orderCode);
    if (!isValidCatalogOrderCode(code)) return null;
    return CatalogSalesOrder.findOne({
      clientId: new mongoose.Types.ObjectId(clientId),
      orderCode: code,
    });
  }

  async tryProcessCatalogFlowCommand(opts: {
    clientId: string;
    conversation: CatalogSalesConversationRef;
    clientText: string;
    contactFirstName?: string;
    lastAssistantReply?: string;
  }): Promise<{
    handled: boolean;
    reply?: string;
    escalate?: boolean;
    cancelled?: boolean;
  }> {
    const text = opts.clientText.trim();
    if (!text) return { handled: false };

    const order = await this.findActiveOrderForConversation(
      opts.clientId,
      opts.conversation.conversationId,
    );
    const flow = await this.hasActiveCatalogFlow({
      clientId: opts.clientId,
      conversationId: opts.conversation.conversationId,
      lastAssistantReply: opts.lastAssistantReply,
      clientText: text,
    });
    if (!flow.active && !order) return { handled: false };
    if (order?.catalogFlowPaused) return { handled: false };

    if (detectCatalogCepOfferQuestion(text)) {
      if (order?.status === 'aguardando_endereco' || flow.awaitingFulfillment) {
        return {
          handled: true,
          reply: buildCatalogCepOfferReply(opts.contactFirstName),
        };
      }
    }

    if (detectCatalogHumanEscalationRequest(text)) {
      if (order) {
        order.catalogFlowPaused = true;
        order.history.push({
          at: new Date(),
          action: 'flow_escalated_human',
          status: order.status,
        });
        await order.save();
      }
      return {
        handled: true,
        reply: buildCatalogHumanEscalationReply(opts.contactFirstName),
        escalate: true,
      };
    }

    if (detectCatalogCancelRequest(text)) {
      if (order) {
        order.status = 'cancelado';
        order.catalogFlowPaused = true;
        order.history.push({
          at: new Date(),
          action: 'flow_cancelled',
          status: 'cancelado',
        });
        await order.save();
        await this.clearConversationPixPending(opts.clientId, order);
      }
      return {
        handled: true,
        reply: buildCatalogCancelReply(opts.contactFirstName),
        cancelled: true,
      };
    }

    if (detectCatalogExitRequest(text)) {
      if (order) {
        order.catalogFlowPaused = true;
        order.history.push({
          at: new Date(),
          action: 'flow_exited',
          status: order.status,
        });
        await order.save();
      }
      return {
        handled: true,
        reply: buildCatalogExitReply(opts.contactFirstName),
        cancelled: true,
      };
    }

    return { handled: false };
  }

  buildCatalogMediaReply(opts: {
    productName?: string;
    awaitingAddress?: boolean;
    awaitingFulfillment?: boolean;
    locationPendingConfirm?: boolean;
    mediaKind?: 'audio' | 'image' | 'video' | 'document';
  }): string {
    return buildCatalogMediaInFlowReply(opts);
  }

  /** Pós-turno IA: pedido + cotação de frete pelo servidor (não pela IA). */
  async processAiCatalogTurn(opts: {
    clientId: string;
    conversation: CatalogSalesConversationRef;
    clientText: string;
    structured: AiStructuredReply;
    aiSummary?: string;
    threadContext?: string;
  }): Promise<CatalogAiTurnResult> {
    const cfg = await this.loadCompanyConfig(opts.clientId);

    const incremental = await this.processIncrementalAddressInput({
      clientId: opts.clientId,
      conversationId: opts.conversation.conversationId,
      clientText: opts.clientText,
      cfg,
    });
    if (incremental.handled) {
      return incremental.result;
    }

    const order = await this.maybeCreateOrderFromAiTurn(opts);

    const quoteResult = await this.maybeUpdateOrderFromAiTurn({
      clientId: opts.clientId,
      conversationId: opts.conversation.conversationId,
      structured: { collectedAddress: opts.structured.collectedAddress },
      clientText: opts.clientText,
    });

    return {
      serverQuoteSent: quoteResult.quoteSent,
      quoteFailed: quoteResult.quoteFailed,
      useDistanceBasedDelivery: Boolean(cfg.useDistanceBasedDelivery),
    };
  }

  /** Oferta padronizada de compra — delega para helper tipado (perfil retirada/entrega). */
  buildCatalogPurchaseOfferReply(opts: {
    productName: string;
    price?: string | null;
    stock?: string | null;
    contactFirstName?: string;
    fulfillmentMode?: ReturnType<typeof resolveCatalogFulfillmentMode>;
  }): string {
    return buildCatalogPurchaseOfferText({
      productName: opts.productName,
      price: opts.price,
      stock: opts.stock,
      contactFirstName: opts.contactFirstName,
      fulfillmentMode: opts.fulfillmentMode,
    });
  }

  async buildPurchaseOfferForInquiry(opts: {
    clientId: string;
    clientText: string;
    threadContext?: string;
    contactFirstName?: string;
    lastAssistantReply?: string;
  }): Promise<string | null> {
    const cfg = await this.loadCompanyConfig(opts.clientId);
    if (!cfg.enabled) return null;
    const product = await this.resolveProductForPurchaseContext({
      clientId: opts.clientId,
      clientText: opts.clientText,
      threadContext: opts.threadContext,
      lastAssistantReply: opts.lastAssistantReply,
    });
    if (!product) return null;

    const price = parseProductPriceFromContent(product.content ?? '');
    const stock = parseProductStockFromContent(product.content ?? '');
    const salesMeta = normalizeProductSalesMeta(product.salesMeta);
    const fulfillmentMode = resolveCatalogFulfillmentMode(cfg);

    if (productStockIsZero(stock) && !salesMeta.madeToOrder) {
      return this.buildOutOfStockReply({
        clientId: opts.clientId,
        productName: product.title,
        clientText: opts.clientText,
        contactFirstName: opts.contactFirstName,
      });
    }

    if (!productStockAllowsPixPurchase(stock, salesMeta.madeToOrder)) {
      const prefix = opts.contactFirstName?.trim() ? `${opts.contactFirstName.trim()}, ` : '';
      return (
        `${prefix}encontrei o produto *${product.title}* por ${formatProductPriceOfferPhrase(price)}, ` +
        'mas preciso confirmar a disponibilidade antes de gerar o pagamento. ' +
        'Vou chamar um atendente para confirmar o estoque.'
      );
    }

    if (!productHasClearPrice(price) && !salesMeta.madeToOrder) {
      const prefix = opts.contactFirstName?.trim() ? `${opts.contactFirstName.trim()}, ` : '';
      return (
        `${prefix}encontrei o produto *${product.title}*, mas o preço precisa ser confirmado por um atendente.`
      );
    }

    return this.buildCatalogPurchaseOfferReply({
      productName: product.title,
      price,
      stock,
      contactFirstName: opts.contactFirstName,
      fulfillmentMode,
    });
  }

  private async buildOutOfStockReply(opts: {
    clientId: string;
    productName: string;
    clientText: string;
    contactFirstName?: string;
  }): Promise<string> {
    const prefix = opts.contactFirstName?.trim() ? `${opts.contactFirstName.trim()}, ` : '';
    const similar = await this.findSimilarCatalogProducts(opts.clientId, opts.clientText, 3, {
      excludeTitle: opts.productName,
    });
    if (similar.length > 0) {
      const lines = similar
        .map(r =>
          `• ${formatCatalogProductSuggestionLine(
            r.title,
            parseProductPriceFromContent(r.content ?? ''),
            parseProductStockFromContent(r.content ?? ''),
          )}`,
        )
        .join('\n');
      return (
        `${prefix}o produto *${opts.productName}* está sem estoque no momento. ` +
        `Encontrei opções parecidas:\n${lines}\n\nQual você prefere?`
      );
    }
    const rows = await this.loadCatalogProductRows(opts.clientId);
    if (rows.length === 0) {
      return (
        `${prefix}o produto *${opts.productName}* está sem estoque no momento. ` +
        'Digite *atendente* se quiser falar com nossa equipe.'
      );
    }
    return (
      `${prefix}o produto *${opts.productName}* está sem estoque no momento. ` +
      'Posso te ajudar com outro item do catálogo — qual produto você procura?'
    );
  }

  /** Resolve produto a partir do texto, contexto e última oferta do assistente. */
  async resolveProductForPurchaseContext(opts: {
    clientId: string;
    clientText: string;
    threadContext?: string;
    lastAssistantReply?: string;
  }) {
    const combined = [opts.threadContext, opts.clientText, opts.lastAssistantReply]
      .filter(Boolean)
      .join(' ');
    let product = await this.guessProductFromText(opts.clientId, combined);
    if (!product && opts.lastAssistantReply) {
      const fromOffer = extractProductNameFromCatalogOffer(opts.lastAssistantReply);
      if (fromOffer) {
        product = await this.resolveProductByName(opts.clientId, fromOffer);
      }
    }
    return product;
  }

  async buildCatalogProductListReply(
    clientId: string,
    contactFirstName?: string,
  ): Promise<string> {
    const rows = await this.loadCatalogProductRows(clientId);
    if (rows.length === 0) return buildEmptyCatalogReply(contactFirstName);
    const prefix = contactFirstName?.trim() ? `${contactFirstName.trim()}, ` : '';
    const lines = rows.slice(0, 8).map(r =>
      `• ${formatCatalogProductSuggestionLine(
        r.title,
        parseProductPriceFromContent(r.content ?? ''),
        parseProductStockFromContent(r.content ?? ''),
      )}`,
    ).join('\n');
    return (
      `${prefix}não encontrei esse produto no cadastro. Temos estes disponíveis:\n${lines}\n\n` +
      'Qual você gostaria de adquirir?'
    );
  }

  async buildProductNotFoundReply(opts: {
    clientId: string;
    clientText: string;
    contactFirstName?: string;
  }): Promise<string> {
    const rows = await this.loadCatalogProductRows(opts.clientId);
    if (rows.length === 0) return buildEmptyCatalogReply(opts.contactFirstName);

    const token = extractCatalogProductQueryToken(opts.clientText) ?? opts.clientText.trim();
    const similar = await this.findSimilarCatalogProducts(opts.clientId, token, 3);
    const prefix = opts.contactFirstName?.trim() ? `${opts.contactFirstName.trim()}, ` : '';
    if (similar.length > 0) {
      const lines = similar
        .map(r =>
          `• ${formatCatalogProductSuggestionLine(
            r.title,
            parseProductPriceFromContent(r.content ?? ''),
            parseProductStockFromContent(r.content ?? ''),
          )}`,
        )
        .join('\n');
      return (
        `${prefix}não encontrei exatamente *${token}*, mas encontrei produtos parecidos:\n${lines}\n\n` +
        'Deseja comprar algum deles?'
      );
    }
    return this.buildCatalogProductListReply(opts.clientId, opts.contactFirstName);
  }

  /** Processa escolha retirar/entregue sem depender do LLM. */
  async processFulfillmentChoice(opts: {
    clientId: string;
    conversation: CatalogSalesConversationRef;
    clientText: string;
    threadContext?: string;
    lastAssistantReply?: string;
    contactFirstName?: string;
  }): Promise<{ handled: boolean; customerReply?: string }> {
    const isPickup = detectPickupFulfillmentChoice(opts.clientText);
    const isDelivery = detectDeliveryFulfillmentChoice(opts.clientText);
    if (!isPickup && !isDelivery) return { handled: false };

    const cfg = await this.loadCompanyConfig(opts.clientId);
    if (!cfg.enabled) return { handled: false };

    const fulfillmentMode = resolveCatalogFulfillmentMode(cfg);
    if (isDelivery && fulfillmentMode === 'pickup_only') {
      return {
        handled: true,
        customerReply:
          'No momento este produto está disponível apenas para *retirada*. Deseja continuar com retirada?',
      };
    }
    if (isPickup && fulfillmentMode === 'delivery_only') {
      return {
        handled: true,
        customerReply:
          'Esse produto está disponível apenas para *entrega*. Me envie seu CEP para calcular o frete antes do pagamento.',
      };
    }

    const product = await this.resolveProductForPurchaseContext({
      clientId: opts.clientId,
      clientText: opts.clientText,
      threadContext: opts.threadContext,
      lastAssistantReply: opts.lastAssistantReply,
    });
    if (!product) {
      return {
        handled: true,
        customerReply: await this.buildProductNotFoundReply({
          clientId: opts.clientId,
          clientText: opts.clientText,
          contactFirstName: opts.contactFirstName,
        }),
      };
    }

    const structured: AiStructuredReply = {
      ...emptyAiStructuredReply(),
      shouldCreateCatalogOrder: true,
      catalogProductName: product.title,
      catalogProductId: String(product._id),
    };

    const turn = await this.processAiCatalogTurn({
      clientId: opts.clientId,
      conversation: opts.conversation,
      clientText: opts.clientText,
      structured,
      threadContext: [opts.threadContext, opts.lastAssistantReply].filter(Boolean).join(' '),
    });

    const order = await this.findActiveOrderForConversation(
      opts.clientId,
      opts.conversation.conversationId,
    );

    if (isPickup) {
      if (order) {
        const reply = await this.preparePickupFulfillmentReply(order, cfg, opts.clientText);
        return { handled: true, customerReply: reply };
      }
      return { handled: turn.handled ?? false };
    }

    if (isDelivery) {
      const salesMeta = normalizeProductSalesMeta(product.salesMeta);
      const needsAddress = deliveryFulfillmentNeedsAddress(cfg, salesMeta);

      if (needsAddress) {
        if (
          order &&
          order.status === 'aguardando_pagamento' &&
          !this.orderHasCompleteDeliveryAddress(order)
        ) {
          order.status = 'aguardando_endereco';
          order.history.push({
            at: new Date(),
            action: 'delivery_needs_address',
            status: 'aguardando_endereco',
          });
          await order.save();
        }
        if (order?.status === 'aguardando_endereco' || (order && needsAddress)) {
          return {
            handled: true,
            customerReply: buildDeliveryAddressStartReply(order.productName, cfg),
          };
        }
      }

      if (
        order?.status === 'aguardando_pagamento' &&
        this.orderHasCompleteDeliveryAddress(order) &&
        !needsAddress
      ) {
        const reply = this.buildDeliveryPaymentReply(order, cfg);
        return { handled: true, customerReply: reply };
      }

      if (order) {
        return {
          handled: true,
          customerReply: buildDeliveryAddressStartReply(order.productName, cfg),
        };
      }
      return {
        handled: true,
        customerReply:
          'Recebi sua escolha de *entrega*. Para continuar, confirme o produto ou digite *atendente*.',
      };
    }

    return { handled: turn.handled ?? false };
  }

  /** Cliente confirmou compra (“sim”) após oferta padronizada. */
  async processPurchaseOfferConfirmation(opts: {
    clientId: string;
    conversation: CatalogSalesConversationRef;
    clientText: string;
    threadContext?: string;
    lastAssistantReply?: string;
    contactFirstName?: string;
  }): Promise<{ handled: boolean; customerReply?: string }> {
    if (!isCatalogPurchaseOfferMessage(opts.lastAssistantReply)) return { handled: false };
    if (!detectPurchaseConfirmation(opts.clientText)) return { handled: false };

    const cfg = await this.loadCompanyConfig(opts.clientId);
    if (!cfg.enabled) return { handled: false };

    const mode = resolveCatalogFulfillmentMode(cfg);
    const productName = extractProductNameFromCatalogOffer(opts.lastAssistantReply);

    if (mode === 'delivery_only') {
      return this.processFulfillmentChoice({
        ...opts,
        clientText: 'entrega',
      });
    }
    if (mode === 'pickup_only') {
      return this.processFulfillmentChoice({
        ...opts,
        clientText: 'retirada',
      });
    }
    if (productName) {
      return {
        handled: true,
        customerReply: buildFulfillmentReminderReply(productName, opts.contactFirstName),
      };
    }
    return { handled: false };
  }

  private orderHasCompleteDeliveryAddress(order: ICatalogSalesOrder): boolean {
    const addr = order.deliveryAddress?.trim() ?? '';
    if (!addr) return false;
    if (/^\d{5}-?\d{3}$/.test(addr.replace(/\s/g, ''))) return false;
    return addr.length >= 12;
  }

  catalogOrderPixAlreadySent(order: ICatalogSalesOrder): boolean {
    return order.history.some(
      h =>
        h.action === 'pix_instructions_sent' ||
        h.action === 'pickup_selected' ||
        h.action === 'delivery_quote_sent',
    );
  }

  private buildDeliveryPaymentReply(order: ICatalogSalesOrder, cfg: CatalogSalesCompanyConfig): string {
    const pix = cfg.pixEnabled && cfg.pixInstructions?.trim()
      ? `\n\n*Pagamento PIX:*\n${cfg.pixInstructions.trim()}`
      : '';
    return (
      `Perfeito! *Entrega* do produto *${order.productName}*.${pix}\n\n` +
      'Envie o comprovante aqui após o pagamento para nossa equipe conferir.'
    );
  }

  async recordPixInstructionsSent(order: ICatalogSalesOrder): Promise<void> {
    if (this.catalogOrderPixAlreadySent(order)) return;
    order.history.push({
      at: new Date(),
      action: 'pix_instructions_sent',
      status: order.status,
    });
    await order.save();
  }

  async buildCatalogDeliveryQuestionReply(opts: {
    clientId: string;
    conversationId: string;
    clientText: string;
    contactFirstName?: string;
  }): Promise<string | null> {
    const cfg = await this.loadCompanyConfig(opts.clientId);
    if (!cfg.enabled) return null;
    if (!detectDeliveryFeeOrAddressQuestion(opts.clientText)) return null;

    const active = await this.findActiveOrderForConversation(opts.clientId, opts.conversationId);
    if (!active) return null;
    if (active.status !== 'aguardando_endereco' && active.status !== 'aguardando_pagamento') {
      return null;
    }

    const partial =
      Boolean(active.deliveryAddress?.trim()) && !this.orderHasCompleteDeliveryAddress(active);
    return buildDeliveryInquiryReply({
      productName: active.productName,
      hasPartialAddress: partial,
      contactFirstName: opts.contactFirstName,
    });
  }

  private async preparePickupFulfillmentReply(
    order: ICatalogSalesOrder,
    cfg: CatalogSalesCompanyConfig,
    clientText?: string,
  ): Promise<string> {
    if (
      this.catalogOrderPixAlreadySent(order) &&
      !detectPixResendRequest(clientText ?? '')
    ) {
      return (
        `Seu pedido de *${order.productName}* já está aguardando pagamento. ` +
        'Se precisar das instruções PIX novamente, digite *manda o pix*.'
      );
    }

    const org = await Organization.findById(order.clientId).select('address').lean();
    const pickupAddress = resolveConfiguredPickupAddress(cfg, org?.address);

    if (!pickupAddress) {
      order.status = 'pendente_configuracao_whatsapp';
      order.history.push({
        at: new Date(),
        action: 'pickup_address_missing',
        status: 'pendente_configuracao_whatsapp',
      });
      await order.save();
      await this.escalateConversationToHuman(String(order.clientId), {
        conversationId: String(order.conversationId),
        channel: order.channel,
        destinationId: order.destinationId ? String(order.destinationId) : undefined,
        contactIdentifier: order.contactIdentifier,
        contactName: order.contactName,
      });
      return buildPickupWithoutAddressReply(order.productName, order.contactName);
    }

    if (order.status !== 'aguardando_pagamento') {
      order.status = 'aguardando_pagamento';
      order.history.push({
        at: new Date(),
        action: 'pickup_selected',
        status: 'aguardando_pagamento',
      });
      await order.save();
    }

    const pixBlock =
      cfg.pixEnabled && cfg.pixInstructions?.trim() ? cfg.pixInstructions.trim() : undefined;
    if (pixBlock) {
      await this.recordPixInstructionsSent(order);
    }
    return buildPickupWithAddressReply(order.productName, pickupAddress, pixBlock);
  }

  /** @deprecated Resposta via short-circuit — não enviar mensagem automática duplicada. */
  private buildPickupFulfillmentReply(
    order: ICatalogSalesOrder,
    cfg: CatalogSalesCompanyConfig,
    orgAddress?: string | null,
  ): string {
    const pickupAddress = resolveConfiguredPickupAddress(cfg, orgAddress);
    if (!pickupAddress) {
      return buildPickupWithoutAddressReply(order.productName, order.contactName);
    }
    const pix =
      cfg.pixEnabled && cfg.pixInstructions?.trim() ? cfg.pixInstructions.trim() : undefined;
    return buildPickupWithAddressReply(order.productName, pickupAddress, pix);
  }

  private async sendDeliveryAddressRequestToCustomer(order: ICatalogSalesOrder): Promise<void> {
    const cfg = await this.loadCompanyConfig(String(order.clientId));
    await this.sendCatalogAutomatedCustomerMessage(
      order,
      buildDeliveryAddressStartReply(order.productName, cfg),
      'catalog-sales-delivery-cep-request',
    );
  }

  private async processIncrementalAddressInput(opts: {
    clientId: string;
    conversationId: string;
    clientText: string;
    cfg: CatalogSalesCompanyConfig & ReturnType<typeof normalizeCatalogSalesConfig>;
  }): Promise<{ handled: boolean; result: CatalogAiTurnResult }> {
    const noop: CatalogAiTurnResult = {
      serverQuoteSent: false,
      quoteFailed: false,
      useDistanceBasedDelivery: Boolean(opts.cfg.useDistanceBasedDelivery),
      handled: false,
    };
    const order = await this.findActiveOrderForConversation(opts.clientId, opts.conversationId);
    if (!order || (order.status !== 'aguardando_endereco' && order.status !== 'pendente_humano_endereco')) {
      return { handled: false, result: noop };
    }

    const text = opts.clientText.trim();
    const v1Result = await catalogDeliveryAddressService.processClientInput(order, {
      clientText: text,
      contactFirstName: resolveClientFirstName(order.contactName),
    });

    if (v1Result.handled) {
      if (v1Result.action === 'confirmed') {
        order.history.push({
          at: new Date(),
          action: 'delivery_address_confirmed',
          status: 'aguardando_endereco',
        });
        await order.save();
        const quoteResult = await this.proceedToFreightAfterConfirmedAddress(order, opts.cfg);
        return {
          handled: true,
          result: {
            serverQuoteSent: quoteResult.quoteSent,
            quoteFailed: quoteResult.quoteFailed,
            useDistanceBasedDelivery: Boolean(opts.cfg.useDistanceBasedDelivery),
            handled: true,
          },
        };
      }

      if (v1Result.action === 'escalate_human') {
        order.status = 'pendente_humano_endereco';
        order.history.push({
          at: new Date(),
          action: 'delivery_address_needs_human',
          status: 'pendente_humano_endereco',
        });
        await order.save();
        if (v1Result.reply) {
          await this.sendCatalogAutomatedCustomerMessage(
            order,
            v1Result.reply,
            'catalog-sales-address-human',
          );
        }
        return { handled: true, result: { ...noop, handled: true, quoteFailed: true } };
      }

      const historyAction =
        v1Result.action === 'needs_confirmation'
          ? 'delivery_address_needs_confirmation'
          : 'delivery_address_received';
      order.history.push({
        at: new Date(),
        action: historyAction,
        status: 'aguardando_endereco',
      });
      await order.save();

      if (v1Result.reply) {
        await this.sendCatalogAutomatedCustomerMessage(
          order,
          v1Result.reply,
          'catalog-sales-address-v1',
        );
      }

      return {
        handled: true,
        result: {
          ...noop,
          handled: true,
          needsAddressConfirmation: v1Result.action === 'needs_confirmation',
        },
      };
    }

    const flowCmd = await this.tryProcessCatalogFlowCommand({
      clientId: opts.clientId,
      conversation: {
        conversationId: opts.conversationId,
        channel: order.channel,
        destinationId: order.destinationId ? String(order.destinationId) : undefined,
        contactIdentifier: order.contactIdentifier,
        contactName: order.contactName,
      },
      clientText: text,
      contactFirstName: resolveClientFirstName(order.contactName),
    });
    if (flowCmd.handled && flowCmd.reply) {
      await this.sendCatalogAutomatedCustomerMessage(order, flowCmd.reply, 'catalog-sales-flow-command');
      return { handled: true, result: { ...noop, handled: true } };
    }

    return { handled: false, result: noop };
  }

  /** Processa CEP, endereço completo ou rua/número após pin — uma resposta por inbound. */
  async tryProcessCatalogAddressInput(opts: {
    clientId: string;
    conversation: CatalogSalesConversationRef;
    clientText: string;
  }): Promise<CatalogAiTurnResult & { handled: boolean }> {
    const cfg = await this.loadCompanyConfig(opts.clientId);
    const incremental = await this.processIncrementalAddressInput({
      clientId: opts.clientId,
      conversationId: opts.conversation.conversationId,
      clientText: opts.clientText,
      cfg,
    });
    if (incremental.handled) {
      return { ...incremental.result, handled: true };
    }
    return {
      handled: false,
      serverQuoteSent: false,
      quoteFailed: false,
      useDistanceBasedDelivery: Boolean(cfg.useDistanceBasedDelivery),
    };
  }

  async buildContextualRecoveryReply(opts: {
    clientId: string;
    conversationId: string;
    contactFirstName?: string;
    clientText?: string;
  }): Promise<string | null> {
    const active = await this.findResolvableActiveOrderForConversation(
      opts.clientId,
      opts.conversationId,
      opts.clientText,
    );
    if (!active) return null;
    return buildCatalogContextualRecoveryReply({
      orderStatus: active.status,
      productName: active.productName,
      deliveryLocationPendingConfirm: Boolean(active.deliveryLocationPendingConfirm),
      contactFirstName: opts.contactFirstName,
    });
  }

  private async sendPickupFulfillmentToCustomer(
    order: ICatalogSalesOrder,
    cfg: CatalogSalesCompanyConfig,
  ): Promise<void> {
    const text = await this.preparePickupFulfillmentReply(order, cfg);
    await this.sendCatalogAutomatedCustomerMessage(order, text, 'catalog-sales-pickup');
  }

  /** Quando o LLM falha em intenção de compra, orienta o cliente sem mensagem genérica de instabilidade. */
  async buildPurchaseRecoveryReply(opts: {
    clientId: string;
    conversationId: string;
    clientText: string;
    threadContext?: string;
    contactFirstName?: string;
    lastAssistantReply?: string;
  }): Promise<string | null> {
    const cfg = await this.loadCompanyConfig(opts.clientId);
    if (!cfg.enabled) return null;

    const prefix = opts.contactFirstName ? `${opts.contactFirstName}, ` : '';
    const active = await this.findResolvableActiveOrderForConversation(
      opts.clientId,
      opts.conversationId,
      opts.clientText,
    );
    const contextual = active
      ? buildCatalogContextualRecoveryReply({
          orderStatus: active.status,
          productName: active.productName,
          deliveryLocationPendingConfirm: Boolean(active.deliveryLocationPendingConfirm),
          contactFirstName: opts.contactFirstName,
        })
      : null;
    if (contextual && !detectPixResendRequest(opts.clientText)) {
      return contextual;
    }
    if (active?.status === 'aguardando_endereco') {
      return (
        `${prefix}para continuar sua compra do *${active.productName}*, envie o *CEP* ` +
        'ou o endereço completo para calcular a entrega antes do pagamento.'
      );
    }
    if (active?.status === 'aguardando_pagamento') {
      if (detectDeliveryFeeOrAddressQuestion(opts.clientText)) {
        return buildDeliveryInquiryReply({
          productName: active.productName,
          hasPartialAddress:
            Boolean(active.deliveryAddress?.trim()) &&
            !this.orderHasCompleteDeliveryAddress(active),
          contactFirstName: opts.contactFirstName,
        });
      }
      if (!detectPixResendRequest(opts.clientText)) {
        if (this.catalogOrderPixAlreadySent(active)) {
          return (
            `${prefix}seu pedido de *${active.productName}* segue aguardando pagamento. ` +
            'Se precisar das instruções PIX novamente, digite *manda o pix*.'
          );
        }
      }
      const pix = cfg.pixInstructions?.trim();
      if (pix) {
        await this.recordPixInstructionsSent(active);
        return (
          `${prefix}seu pedido de *${active.productName}* está aguardando pagamento.\n\n*PIX:*\n${pix}`
        );
      }
      return (
        `${prefix}seu pedido de *${active.productName}* está aguardando pagamento. ` +
        'Envie o comprovante aqui quando concluir o PIX.'
      );
    }

    const product = await this.resolveProductForPurchaseContext({
      clientId: opts.clientId,
      clientText: opts.clientText,
      threadContext: opts.threadContext,
      lastAssistantReply: opts.lastAssistantReply,
    });
    if (!product) {
      return this.buildProductNotFoundReply({
        clientId: opts.clientId,
        clientText: opts.clientText,
        contactFirstName: opts.contactFirstName,
      });
    }

    const salesMeta = normalizeProductSalesMeta(product.salesMeta);
    const needsAddress = orderRequiresDeliveryAddress(cfg, salesMeta);
    if (!needsAddress) {
      return this.buildCatalogPurchaseOfferReply({
        productName: product.title,
        price: parseProductPriceFromContent(product.content ?? ''),
        stock: parseProductStockFromContent(product.content ?? ''),
        contactFirstName: opts.contactFirstName,
      });
    }

    const offer = this.buildCatalogPurchaseOfferReply({
      productName: product.title,
      price: parseProductPriceFromContent(product.content ?? ''),
      stock: parseProductStockFromContent(product.content ?? ''),
      contactFirstName: opts.contactFirstName,
    });
    return offer;
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
    threadContext?: string;
  }): Promise<ICatalogSalesOrder | null> {
    const cfg = await this.loadCompanyConfig(opts.clientId);
    if (!cfg.enabled) return null;
    const forceFulfillmentOrder =
      opts.structured.shouldCreateCatalogOrder &&
      (detectDeliveryFulfillmentChoice(opts.clientText) ||
        detectPickupFulfillmentChoice(opts.clientText));
    if (!cfg.autoCreateOrderOnPurchase && !forceFulfillmentOrder) return null;

    const combinedText = [opts.threadContext, opts.aiSummary, opts.clientText]
      .filter(Boolean)
      .join(' ');

    const offerProductName = extractProductNameFromCatalogOffer(opts.threadContext);

    let product = null as Awaited<ReturnType<typeof this.resolveProductForOrder>>;
    if (opts.structured.catalogProductId) {
      product = await this.resolveProductForOrder(opts.clientId, opts.structured.catalogProductId);
    }
    if (!product && opts.structured.catalogProductName) {
      product = await this.resolveProductByName(opts.clientId, opts.structured.catalogProductName);
    }
    if (!product) {
      product = await this.guessProductFromText(opts.clientId, combinedText);
    }
    if (!product && offerProductName) {
      product = await this.resolveProductByName(opts.clientId, offerProductName);
    }
    if (!product) return null;

    const salesMeta = normalizeProductSalesMeta(product.salesMeta);
    if (salesMeta.aiSellable === false) return null;

    const hasLink = Boolean((product.links ?? []).some(l => l.url?.trim()));
    const saleMode = resolveProductSaleMode(salesMeta, hasLink);
    const openPix = shouldOpenPixOrderFlow({
      saleMode,
      clientText: opts.clientText,
      threadContext: combinedText,
      structuredWantsOrder: opts.structured.shouldCreateCatalogOrder,
      companyPixEnabled: cfg.pixEnabled,
      catalogOfferProductName:
        opts.structured.catalogProductName ?? offerProductName ?? undefined,
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
    if (!productStockAllowsPixPurchase(stock, salesMeta.madeToOrder)) return null;

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
    const isPickup = detectPickupFulfillmentChoice(opts.clientText);
    const isDelivery = detectDeliveryFulfillmentChoice(opts.clientText);
    const needsAddress = isDelivery
      ? deliveryFulfillmentNeedsAddress(cfg, salesMeta)
      : !isPickup && orderRequiresDeliveryAddress(cfg, salesMeta);
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

  /** Atualiza endereço em pedido pendente; calcula frete no servidor após confirmação v1. */
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

    const v1 = catalogDeliveryAddressService.ensureV1(order);
    if (!catalogDeliveryAddressService.canProceedToFreight(v1)) {
      const normalized = await catalogDeliveryAddressService.processClientInput(order, {
        clientText: addr,
        contactFirstName: resolveClientFirstName(order.contactName),
      });
      if (normalized.handled && normalized.reply) {
        order.history.push({
          at: new Date(),
          action: 'delivery_address_normalized',
          status: 'aguardando_endereco',
        });
        await order.save();
        await this.sendCatalogAutomatedCustomerMessage(
          order,
          normalized.reply,
          'catalog-sales-address-v1',
        );
      } else {
        await order.save();
      }
      if (normalized.action === 'confirmed') {
        const cfg =
          companyCfg ?? (await this.loadCompanyConfig(String(order.clientId)));
        return this.proceedToFreightAfterConfirmedAddress(order, cfg, productMeta);
      }
      if (normalized.action === 'escalate_human') {
        order.status = 'pendente_humano_endereco';
        await order.save();
      }
      return { quoteSent: false, quoteFailed: false };
    }

    order.deliveryAddress = (v1.formattedAddress ?? addr).slice(0, 500);
    const cfg =
      companyCfg ?? (await this.loadCompanyConfig(String(order.clientId)));
    return this.proceedToFreightAfterConfirmedAddress(order, cfg, productMeta);
  }

  /** Frete + PIX somente após endereço confirmado (Endereço v1). */
  private async proceedToFreightAfterConfirmedAddress(
    order: ICatalogSalesOrder,
    cfg: CatalogSalesCompanyConfig,
    productMeta?: ReturnType<typeof normalizeProductSalesMeta>,
  ): Promise<{ quoteSent: boolean; quoteFailed: boolean }> {
    const v1 = catalogDeliveryAddressService.ensureV1(order);
    if (!catalogDeliveryAddressService.canProceedToFreight(v1)) {
      return { quoteSent: false, quoteFailed: false };
    }

    if (order.deliveryLocationPendingConfirm) {
      order.deliveryLocationPendingConfirm = false;
    }

    const resolvedAddr = v1.formattedAddress?.trim() ?? order.deliveryAddress?.trim() ?? '';
    if (resolvedAddr) order.deliveryAddress = resolvedAddr.slice(0, 500);

    v1.status = 'freight_pending';
    catalogDeliveryAddressService.applyV1ToOrder(order, v1);

    let quoteOk = true;
    if (cfg.useDistanceBasedDelivery) {
      quoteOk = await this.applyDeliveryEstimateToOrder(order, cfg, productMeta);
      if (!quoteOk) {
        v1.status = 'needs_human_review';
        v1.needsHumanReview = true;
        catalogDeliveryAddressService.applyV1ToOrder(order, v1);
        order.status = 'pendente_humano_endereco';
        order.history.push({
          at: new Date(),
          action: 'delivery_quote_failed',
          status: 'pendente_humano_endereco',
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

    catalogDeliveryAddressService.markFreightConfirmed(order);
    order.status = 'aguardando_pagamento';
    order.history.push({
      at: new Date(),
      action: 'address_confirmed_freight',
      status: 'aguardando_pagamento',
      note: deliveryAddressV1Label(order.deliveryAddressV1 as typeof v1),
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
    const addressComplete = Boolean(
      dest && (deliveryAddressValidationError(dest) === null || isGeocodableCustomerAddress(dest)),
    );
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

    const pinResult = await catalogDeliveryAddressService.processPinLocation(
      order,
      lat,
      lng,
      opts.location.address,
      opts.location.isLive,
    );

    order.history.push({
      at: new Date(),
      action: 'location_received',
      status: 'aguardando_endereco',
      note: locationAreaHint(reverse) || 'pin',
    });
    await order.save();

    if (pinResult.reply) {
      await this.sendCatalogAutomatedCustomerMessage(
        order,
        pinResult.reply,
        'catalog-sales-pin-v1',
      );
    }

    return {
      serverQuoteSent: false,
      quoteFailed: false,
      useDistanceBasedDelivery: useDistance,
      needsAddressConfirmation: pinResult.action === 'needs_confirmation',
      handled: true,
    };
  }

  /** Resposta em texto após pedido de confirmação de rua/número (pin impreciso). */
  async handleInboundLocationStreetConfirm(opts: {
    clientId: string;
    conversation: CatalogSalesConversationRef;
    text: string;
  }): Promise<CatalogAiTurnResult> {
    const cfg = await this.loadCompanyConfig(opts.clientId);
    const incremental = await this.processIncrementalAddressInput({
      clientId: opts.clientId,
      conversationId: opts.conversation.conversationId,
      clientText: opts.text,
      cfg,
    });
    return {
      serverQuoteSent: incremental.result.serverQuoteSent,
      quoteFailed: incremental.result.quoteFailed,
      useDistanceBasedDelivery: incremental.result.useDistanceBasedDelivery,
      needsAddressConfirmation: incremental.result.needsAddressConfirmation,
      handled: incremental.handled,
    };
  }

  async maybeUpdateOrderFromAiTurn(opts: {
    clientId: string;
    conversationId: string;
    structured: { collectedAddress?: string };
    clientText?: string;
  }): Promise<{ quoteSent: boolean; quoteFailed: boolean }> {
    const order = await CatalogSalesOrder.findOne({
      clientId: new mongoose.Types.ObjectId(opts.clientId),
      conversationId: new mongoose.Types.ObjectId(opts.conversationId),
      status: 'aguardando_endereco',
    }).sort({ updatedAt: -1 });
    if (!order) return { quoteSent: false, quoteFailed: false };

    if (opts.clientText?.trim()) {
      const incremental = await this.processIncrementalAddressInput({
        clientId: opts.clientId,
        conversationId: opts.conversationId,
        clientText: opts.clientText,
        cfg: await this.loadCompanyConfig(opts.clientId),
      });
      if (incremental.handled) {
        return {
          quoteSent: incremental.result.serverQuoteSent,
          quoteFailed: incremental.result.quoteFailed,
        };
      }
    }

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

  private async loadCatalogProductRows(clientId: string) {
    return AiKnowledgeBase.find({
      clientId: new mongoose.Types.ObjectId(clientId),
      active: true,
      category: 'Produtos e estoque',
    })
      .select('title content salesMeta')
      .sort({ title: 1 })
      .limit(50)
      .lean();
  }

  private async findSimilarCatalogProducts(
    clientId: string,
    query: string,
    limit = 3,
    opts?: { excludeTitle?: string; minScore?: number },
  ) {
    const token = extractCatalogProductQueryToken(query) ?? query.trim().toLowerCase();
    if (!token || token.length < 2) return [];
    const rows = await this.loadCatalogProductRows(clientId);
    const minScore = opts?.minScore ?? CATALOG_FUZZY_SUGGEST_MIN_SCORE;
    const exclude = opts?.excludeTitle?.trim().toLowerCase();
    return rows
      .filter(r => r.title.trim().toLowerCase() !== exclude)
      .map(r => ({ row: r, score: catalogTitleSimilarity(token, r.title) }))
      .filter(x => x.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(x => x.row);
  }

  private async guessProductFromText(clientId: string, text: string) {
    const rows = await this.loadCatalogProductRows(clientId);
    const lower = normalizeCatalogCompareText(text);

    const substringHit = rows.find(r => {
      const title = normalizeCatalogCompareText(r.title);
      return title.length >= 2 && lower.includes(title);
    });
    if (substringHit) return substringHit;

    const token = extractCatalogProductQueryToken(text);
    if (!token || token.length < 2) return null;

    const tokenNorm = normalizeCatalogCompareText(token);
    const exact = rows.find(r => normalizeCatalogCompareText(r.title) === tokenNorm);
    if (exact) return exact;

    return null;
  }

  private async generateUniqueOrderCode(clientId: string): Promise<string> {
    for (let i = 0; i < 12; i++) {
      const candidate = generateCatalogOrderCodeCandidate();
      const exists = await CatalogSalesOrder.exists({
        clientId: new mongoose.Types.ObjectId(clientId),
        orderCode: candidate,
      });
      if (!exists) return candidate;
    }
    return `DX-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
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
    const orderCode = await this.generateUniqueOrderCode(opts.clientId);
    const order = await CatalogSalesOrder.create({
      clientId: new mongoose.Types.ObjectId(opts.clientId),
      conversationId: new mongoose.Types.ObjectId(opts.conversation.conversationId),
      channel: opts.conversation.channel,
      destinationId: opts.conversation.destinationId
        ? new mongoose.Types.ObjectId(opts.conversation.destinationId)
        : undefined,
      contactIdentifier: opts.conversation.contactIdentifier,
      contactName: opts.conversation.contactName,
      orderCode,
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
    const orderLink = order.orderCode
      ? `${config.DASHBOARD.FRONTEND_URL}/platform/produtos#pedidos?order=${encodeURIComponent(order.orderCode)}`
      : `${config.DASHBOARD.FRONTEND_URL}/platform/inbox?catalogOrder=${String(order._id)}`;

    const lines = [
      base || '🧾 Novo comprovante PIX recebido',
      '',
      `Pedido: ${order.orderCode || String(order._id)}`,
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
    order.addressConfirmAttempts = (order.addressConfirmAttempts ?? 0) + 1;
    const attempt = order.addressConfirmAttempts;
    order.history.push({
      at: new Date(),
      action: 'address_confirm_retry',
      status: order.status,
      note: `attempt:${attempt}`,
    });

    if (attempt >= 3) {
      order.catalogFlowPaused = true;
      await order.save();
      const text = buildCatalogAddressRetryReply({
        attempt,
        contactFirstName: resolveClientFirstName(order.contactName),
      });
      await this.sendCatalogAutomatedCustomerMessage(order, text, 'catalog-sales-location-escalate');
      return;
    }

    await order.save();
    const text = buildCatalogAddressRetryReply({
      attempt,
      contactFirstName: resolveClientFirstName(order.contactName),
    });
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

    if (kind === 'success') {
      order.history.push({
        at: new Date(),
        action: 'delivery_quote_sent',
        status: order.status,
      });
      await this.recordPixInstructionsSent(order);
    }

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
    opts?: { status?: string; conversationId?: string; orderCode?: string; limit?: number },
  ): Promise<ICatalogSalesOrder[]> {
    const filter: Record<string, unknown> = {
      clientId: new mongoose.Types.ObjectId(clientId),
    };
    if (opts?.status) filter.status = opts.status;
    if (opts?.conversationId) {
      filter.conversationId = new mongoose.Types.ObjectId(opts.conversationId);
    }
    if (opts?.orderCode) {
      filter.orderCode = normalizeCatalogOrderCode(opts.orderCode);
    }
    const orders = await CatalogSalesOrder.find(filter).sort({ updatedAt: -1 }).limit(opts?.limit ?? 50);
    await Promise.all(orders.filter(o => !o.orderCode?.trim()).map(o => this.ensureOrderCode(o)));
    return orders;
  }

  async getOrderForClient(clientId: string, orderIdOrCode: string): Promise<ICatalogSalesOrder> {
    let order: ICatalogSalesOrder | null = null;
    if (isValidCatalogOrderCode(orderIdOrCode)) {
      order = await this.getOrderByCode(clientId, orderIdOrCode);
    } else if (mongoose.Types.ObjectId.isValid(orderIdOrCode)) {
      order = await CatalogSalesOrder.findOne({
        _id: new mongoose.Types.ObjectId(orderIdOrCode),
        clientId: new mongoose.Types.ObjectId(clientId),
      });
    }
    if (!order) throw new Error('Pedido não encontrado');
    if (!order.orderCode) await this.ensureOrderCode(order);
    catalogDeliveryAddressService.ensureV1(order);
    return order;
  }

  async updateOrderDeliveryAddress(
    clientId: string,
    orderId: string,
    payload: Record<string, unknown>,
    actorUserId?: string,
  ): Promise<ICatalogSalesOrder> {
    const order = await this.getOrderForClient(clientId, orderId);
    if (['pagamento_aprovado', 'pedido_confirmado', 'cancelado'].includes(order.status)) {
      throw new Error('Pedido não permite alteração de endereço neste status');
    }
    catalogDeliveryAddressService.applyOperatorCorrection(
      order,
      payload as import('@/types/catalog-delivery-address-v1').DeliveryAddressV1,
      actorUserId,
    );
    await order.save();
    return order;
  }

  async confirmOrderDeliveryAddressByOperator(
    clientId: string,
    orderId: string,
    actorUserId?: string,
  ): Promise<ICatalogSalesOrder> {
    const order = await this.getOrderForClient(clientId, orderId);
    const v1 = catalogDeliveryAddressService.ensureV1(order);
    v1.status = 'confirmed';
    v1.confirmedBy = 'operator';
    v1.confirmedAt = new Date();
    catalogDeliveryAddressService.applyV1ToOrder(order, v1);
    order.history.push({
      at: new Date(),
      action: 'delivery_address_confirmed_operator',
      actorUserId,
    });
    await order.save();
    return order;
  }

  async requestDeliveryAddressCorrection(
    clientId: string,
    orderId: string,
    actorUserId?: string,
  ): Promise<ICatalogSalesOrder> {
    const order = await this.getOrderForClient(clientId, orderId);
    order.status = 'aguardando_endereco';
    const v1 = catalogDeliveryAddressService.ensureV1(order);
    v1.status = 'partial';
    catalogDeliveryAddressService.applyV1ToOrder(order, v1);
    order.history.push({
      at: new Date(),
      action: 'delivery_address_correction_requested',
      actorUserId,
      status: 'aguardando_endereco',
    });
    await order.save();
    await this.sendCatalogAutomatedCustomerMessage(
      order,
      'Precisamos confirmar seu endereço de entrega. Por favor, envie rua, número, bairro e cidade.',
      'catalog-sales-address-correction-request',
    );
    return order;
  }

  async recalculateOrderFreight(
    clientId: string,
    orderId: string,
    actorUserId?: string,
  ): Promise<{ order: ICatalogSalesOrder; quoteSent: boolean; quoteFailed: boolean }> {
    const order = await this.getOrderForClient(clientId, orderId);
    if (!catalogDeliveryAddressService.canProceedToFreight(order.deliveryAddressV1)) {
      throw new Error('Endereço precisa estar confirmado antes de recalcular frete');
    }
    if (['pagamento_aprovado', 'pedido_confirmado'].includes(order.status)) {
      throw new Error('Pedido pago não permite recálculo automático de frete');
    }
    order.status = 'aguardando_endereco';
    await order.save();
    const cfg = await this.loadCompanyConfig(clientId);
    const result = await this.proceedToFreightAfterConfirmedAddress(order, cfg);
    order.history.push({
      at: new Date(),
      action: 'delivery_freight_recalculated',
      actorUserId,
    });
    await order.save();
    return { order, ...result };
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
    catalogDeliveryAddressService.ensureV1(order);
    return {
      id: String(order._id),
      orderCode: order.orderCode ?? null,
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
      deliveryLocationLat: order.deliveryLocationLat,
      deliveryLocationLng: order.deliveryLocationLng,
      deliveryLocationPendingConfirm: order.deliveryLocationPendingConfirm,
      deliveryAddressV1: order.deliveryAddressV1 ?? null,
      deliveryAddressSnapshot: order.deliveryAddressSnapshot ?? null,
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
