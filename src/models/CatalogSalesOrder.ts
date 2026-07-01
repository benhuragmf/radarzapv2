import mongoose, { Schema, Document } from 'mongoose';
import type {
  CatalogSalesChannel,
  CatalogSalesOrderHistoryEntry,
  CatalogSalesOrderStatus,
  CatalogSalesProofRecord,
} from '@/types/catalog-sales';
import type {
  DeliveryAddressSnapshot,
  DeliveryAddressV1,
} from '@/types/catalog-delivery-address-v1';

export interface ICatalogSalesOrder extends Document {
  clientId: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  channel: CatalogSalesChannel;
  destinationId?: mongoose.Types.ObjectId;
  contactIdentifier?: string;
  contactName?: string;
  /** Código curto legível do pedido (ex.: DX-1045) — único por tenant */
  orderCode?: string;
  productId?: mongoose.Types.ObjectId;
  productName: string;
  sku?: string;
  amount?: string;
  subtotalAmount?: string;
  deliveryFee?: string;
  totalAmount?: string;
    deliveryAddress?: string;
    deliveryDistanceKm?: number;
    deliveryTierKm?: number;
    deliveryDistanceMethod?: 'road' | 'haversine';
    deliveryLocationLat?: number;
    deliveryLocationLng?: number;
    deliveryLocationPendingConfirm?: boolean;
    addressConfirmAttempts?: number;
    /** Endereço de Entrega v1 — objeto estrutural */
    deliveryAddressV1?: DeliveryAddressV1;
    /** Snapshot imutável após confirmação + frete */
    deliveryAddressSnapshot?: DeliveryAddressSnapshot;
    catalogFlowPaused?: boolean;
    stockSnapshot?: string;
  paymentMethod: 'pix';
  status: CatalogSalesOrderStatus;
  proofs: CatalogSalesProofRecord[];
  /** Última notificação WA interna */
  lastNotificationAt?: Date;
  lastNotificationStatus?: 'sent' | 'failed' | 'skipped' | 'pending_config';
  lastNotificationError?: string;
  notificationDedupKey?: string;
  aiSummary?: string;
  approvedByUserId?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectedByUserId?: mongoose.Types.ObjectId;
  rejectedAt?: Date;
  rejectionReason?: string;
  internalNotes: Array<{ at: Date; userId?: string; body: string }>;
  history: CatalogSalesOrderHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryAddressV1Schema = new Schema(
  {
    rawText: String,
    street: String,
    number: String,
    complement: String,
    reference: String,
    neighborhood: String,
    city: String,
    state: String,
    uf: String,
    zipCode: String,
    country: String,
    latitude: Number,
    longitude: Number,
    source: String,
    confidence: String,
    status: String,
    confirmedBy: String,
    confirmedAt: Date,
    normalizedAt: Date,
    needsHumanReview: Boolean,
    missingFields: [String],
    geocodeProvider: String,
    geocodeStatus: String,
    reverseGeocodeStatus: String,
    mapsUrl: String,
    formattedAddress: { type: String, maxlength: 500 },
    notes: { type: String, maxlength: 500 },
    freightRuleVersion: String,
  },
  { _id: false },
);

const DeliveryAddressSnapshotSchema = new Schema(
  {
    formattedAddress: { type: String, maxlength: 500 },
    street: String,
    number: String,
    neighborhood: String,
    city: String,
    uf: String,
    zipCode: String,
    latitude: Number,
    longitude: Number,
    source: String,
    confirmedAt: Date,
    confirmedBy: String,
    deliveryDistanceKm: Number,
    deliveryTierKm: Number,
    deliveryFee: String,
    subtotalAmount: String,
    totalAmount: String,
    freightRuleVersion: String,
    capturedAt: { type: Date, required: true },
  },
  { _id: false },
);

const ProofSchema = new Schema<CatalogSalesProofRecord>(
  {
    mediaUrl: { type: String, required: true },
    mediaMime: String,
    mediaType: String,
    messageId: String,
    receivedAt: { type: Date, required: true },
    contentHash: String,
  },
  { _id: false },
);

const HistorySchema = new Schema<CatalogSalesOrderHistoryEntry>(
  {
    at: { type: Date, required: true },
    action: { type: String, required: true, maxlength: 80 },
    status: { type: String, maxlength: 40 },
    actorUserId: String,
    note: { type: String, maxlength: 500 },
  },
  { _id: false },
);

const CatalogSalesOrderSchema = new Schema<ICatalogSalesOrder>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, required: true, index: true },
    channel: { type: String, enum: ['whatsapp', 'webchat'], required: true, index: true },
    destinationId: { type: Schema.Types.ObjectId, ref: 'Destination', index: true },
    contactIdentifier: { type: String, maxlength: 120 },
    contactName: { type: String, maxlength: 120 },
    orderCode: { type: String, maxlength: 16, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'AiKnowledgeBase', index: true },
    productName: { type: String, required: true, maxlength: 200 },
    sku: { type: String, maxlength: 80 },
    amount: { type: String, maxlength: 40 },
    subtotalAmount: { type: String, maxlength: 40 },
    deliveryFee: { type: String, maxlength: 80 },
    totalAmount: { type: String, maxlength: 80 },
    deliveryAddress: { type: String, maxlength: 500 },
    deliveryDistanceKm: { type: Number },
    deliveryTierKm: { type: Number, min: 1, max: 8 },
    deliveryDistanceMethod: { type: String, enum: ['road', 'haversine'] },
    deliveryLocationLat: { type: Number },
    deliveryLocationLng: { type: Number },
    deliveryLocationPendingConfirm: { type: Boolean, default: false },
    addressConfirmAttempts: { type: Number, default: 0, min: 0 },
    deliveryAddressV1: { type: DeliveryAddressV1Schema, default: undefined },
    deliveryAddressSnapshot: { type: DeliveryAddressSnapshotSchema, default: undefined },
    catalogFlowPaused: { type: Boolean, default: false },
    stockSnapshot: { type: String, maxlength: 120 },
    paymentMethod: { type: String, enum: ['pix'], default: 'pix' },
    status: {
      type: String,
      enum: [
        'rascunho',
        'aguardando_endereco',
        'pendente_humano_endereco',
        'aguardando_pagamento',
        'comprovante_recebido',
        'em_conferencia',
        'pagamento_aprovado',
        'pagamento_recusado',
        'pedido_confirmado',
        'cancelado',
        'falha_notificacao_whatsapp',
        'pendente_configuracao_whatsapp',
        'comprovante_sem_pedido',
      ],
      default: 'aguardando_pagamento',
      index: true,
    },
    proofs: { type: [ProofSchema], default: [] },
    lastNotificationAt: Date,
    lastNotificationStatus: { type: String, enum: ['sent', 'failed', 'skipped', 'pending_config'] },
    lastNotificationError: { type: String, maxlength: 300 },
    notificationDedupKey: { type: String, maxlength: 64, index: true },
    aiSummary: { type: String, maxlength: 2000 },
    approvedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    rejectedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: Date,
    rejectionReason: { type: String, maxlength: 500 },
    internalNotes: {
      type: [
        {
          at: { type: Date, required: true },
          userId: String,
          body: { type: String, maxlength: 2000 },
        },
      ],
      default: [],
    },
    history: { type: [HistorySchema], default: [] },
  },
  { timestamps: true, collection: 'catalogSalesOrders' },
);

CatalogSalesOrderSchema.index({ clientId: 1, status: 1, updatedAt: -1 });
CatalogSalesOrderSchema.index(
  { clientId: 1, orderCode: 1 },
  { unique: true, partialFilterExpression: { orderCode: { $type: 'string', $gt: '' } } },
);
CatalogSalesOrderSchema.index(
  { clientId: 1, conversationId: 1, productId: 1, status: 1 },
  { name: 'catalog_sales_active_product' },
);

export const CatalogSalesOrder = mongoose.model<ICatalogSalesOrder>(
  'CatalogSalesOrder',
  CatalogSalesOrderSchema,
);
