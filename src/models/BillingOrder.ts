import mongoose, { Schema, Document } from 'mongoose';
import type { OrgPlanId } from '@/services/billing/plan-config';

export type BillingOrderStatus = 'pending' | 'paid' | 'cancelled';

export interface IBillingOrder extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  status: BillingOrderStatus;
  planId: OrgPlanId;
  amountCents: number;
  currency: string;
  stripeSessionId?: string;
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
    planId: {
      type: String,
      enum: ['starter', 'pro'],
      required: true,
    },
    amountCents: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'BRL', maxlength: 8 },
    stripeSessionId: { type: String, index: true, sparse: true },
    paidAt: Date,
  },
  { timestamps: true, collection: 'billingOrders' },
);

BillingOrderSchema.index({ organizationId: 1, createdAt: -1 });

export const BillingOrder = mongoose.model<IBillingOrder>('BillingOrder', BillingOrderSchema);
