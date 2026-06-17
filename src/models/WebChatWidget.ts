import mongoose, { Schema, Document } from 'mongoose';
import type { WebChatWidgetAppearance } from '../types/webchat';
import { DEFAULT_WEBCHAT_APPEARANCE, DEFAULT_WEBCHAT_AUTO_REPLY_MESSAGE } from '../types/webchat';

export interface IWebChatWidget extends Document {
  clientId: mongoose.Types.ObjectId;
  name: string;
  publicKey: string;
  active: boolean;
  allowedDomains: string[];
  appearance: WebChatWidgetAppearance;
  autoReplyEnabled: boolean;
  autoReplyMessage: string;
  autoReplySenderName: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppearanceSchema = new Schema<WebChatWidgetAppearance>(
  {
    primaryColor: { type: String, default: DEFAULT_WEBCHAT_APPEARANCE.primaryColor },
    position: { type: String, enum: ['left', 'right'], default: DEFAULT_WEBCHAT_APPEARANCE.position },
    title: { type: String, default: DEFAULT_WEBCHAT_APPEARANCE.title, maxlength: 80 },
    subtitle: { type: String, default: DEFAULT_WEBCHAT_APPEARANCE.subtitle, maxlength: 120 },
    greeting: { type: String, default: DEFAULT_WEBCHAT_APPEARANCE.greeting, maxlength: 500 },
    askName: { type: Boolean, default: DEFAULT_WEBCHAT_APPEARANCE.askName },
    askEmail: { type: Boolean, default: DEFAULT_WEBCHAT_APPEARANCE.askEmail },
  },
  { _id: false },
);

const WebChatWidgetSchema = new Schema<IWebChatWidget>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, ref: 'Organization', index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    publicKey: { type: String, required: true, unique: true, index: true },
    active: { type: Boolean, default: true, index: true },
    allowedDomains: { type: [String], default: [] },
    appearance: { type: AppearanceSchema, default: () => ({ ...DEFAULT_WEBCHAT_APPEARANCE }) },
    autoReplyEnabled: { type: Boolean, default: true },
    autoReplyMessage: { type: String, default: DEFAULT_WEBCHAT_AUTO_REPLY_MESSAGE, maxlength: 500 },
    autoReplySenderName: { type: String, default: 'Assistente virtual', maxlength: 80 },
  },
  { timestamps: true, collection: 'webChatWidgets' },
);

WebChatWidgetSchema.index({ clientId: 1, active: 1 });

export const WebChatWidget = mongoose.model<IWebChatWidget>('WebChatWidget', WebChatWidgetSchema);
