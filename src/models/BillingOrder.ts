import mongoose, { Schema, Document } from 'mongoose';
export type BillingOrderStatus = 'pending' | 'paid' | 'cancelled';
export type BillingOrderKind = 'subscription' | 'ai_credit_pack';

export interface IBillingOrder extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  status: BillingOrderStatus;
  orderKind: BillingOrderKind;
  planId: string;
  amountCents: number;
  currency: string;
  stripeSessionId?: string;
  stripeEventId?: string;
  creditPackId?: string;
  creditsGranted?: number;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BillingOrderSchema = new Schema<IBillingOrder>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Organization' },
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled'],
      default: 'pending',
      index: true,
    },
    orderKind: {
      type: String,
      enum: ['subscription', 'ai_credit_pack'],
      default: 'subscription',
      index: true,
    },
    planId: {
      type: String,
      required: true,
    },
    amountCents: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'BRL', maxlength: 8 },
    stripeSessionId: { type: String, index: true, sparse: true },
    stripeEventId: { type: String, index: true, sparse: true },
    creditPackId: { type: String, maxlength: 32 },
    creditsGranted: { type: Number, min: 0 },
    paidAt: Date,
  },
  { timestamps: true, collection: 'billingOrders' },
);

BillingOrderSchema.index({ organizationId: 1, createdAt: -1 });

export const BillingOrder = mongoose.model<IBillingOrder>('BillingOrder', BillingOrderSchema);
