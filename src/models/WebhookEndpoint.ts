import mongoose, { Schema, Document } from 'mongoose';

export const WEBHOOK_EVENTS = [
  'campaign.sent',
  'campaign.failed',
  'consent.updated',
  'session.connected',
  'session.disconnected',
  'inbox.conversation.created',
  'inbox.message.received',
  'inbox.conversation.resolved',
  'inbox.conversation.closed',
  'inbox.csat.rated',
  'ticket.created',
  'ticket.client_replied',
  'ticket.closed',
  'webchat.message.received',
  'webchat.conversation.escalated',
  'webchat.conversation.closed',
  'webchat.bridge.started',
  'webchat.bridge.closed',
  'lead.created',
  'lead.status_changed',
  'lead.converted_to_contact',
  'lead.sent_to_inbox',
  'lead.added_to_list',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface IWebhookEndpoint extends Document {
  organizationId: mongoose.Types.ObjectId;
  url: string;
  events: WebhookEvent[];
  secret: string;
  active: boolean;
  description?: string;
  lastDeliveryAt?: Date;
  lastDeliveryStatus?: number;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookEndpointSchema = new Schema<IWebhookEndpoint>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Organization',
      index: true,
    },
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    events: {
      type: [String],
      enum: WEBHOOK_EVENTS,
      default: ['campaign.sent', 'campaign.failed'],
    },
    secret: { type: String, required: true },
    active: { type: Boolean, default: true },
    description: { type: String, trim: true, maxlength: 240 },
    lastDeliveryAt: { type: Date },
    lastDeliveryStatus: { type: Number },
  },
  { timestamps: true, collection: 'webhookEndpoints' },
);

WebhookEndpointSchema.index({ organizationId: 1, active: 1 });

export const WebhookEndpoint = mongoose.model<IWebhookEndpoint>(
  'WebhookEndpoint',
  WebhookEndpointSchema,
);
