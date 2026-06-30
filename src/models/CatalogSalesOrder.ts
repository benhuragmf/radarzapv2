import mongoose, { Schema, Document } from 'mongoose';
import type {
  CatalogSalesChannel,
  CatalogSalesOrderHistoryEntry,
  CatalogSalesOrderStatus,
  CatalogSalesProofRecord,
} from '@/types/catalog-sales';

export interface ICatalogSalesOrder extends Document {
  clientId: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  channel: CatalogSalesChannel;
  destinationId?: mongoose.Types.ObjectId;
  contactIdentifier?: string;
  contactName?: string;
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
    stockSnapshot: { type: String, maxlength: 120 },
    paymentMethod: { type: String, enum: ['pix'], default: 'pix' },
    status: {
      type: String,
      enum: [
        'rascunho',
        'aguardando_endereco',
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
  { clientId: 1, conversationId: 1, productId: 1, status: 1 },
  { name: 'catalog_sales_active_product' },
);

export const CatalogSalesOrder = mongoose.model<ICatalogSalesOrder>(
  'CatalogSalesOrder',
  CatalogSalesOrderSchema,
);
