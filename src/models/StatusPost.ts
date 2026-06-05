import mongoose, { Schema, Document, Model } from 'mongoose';

export type StatusPostType = 'text' | 'image';
export type StatusPostAudience = 'whatsapp' | 'all_contacts' | 'consented';
export type StatusPostStatus = 'pending' | 'processing' | 'sent' | 'failed';

export interface IStatusViewEvent {
  jid: string;
  phone?: string;
  name?: string;
  viewedAt: Date;
}

export interface IStatusPost extends Document {
  clientId: mongoose.Types.ObjectId;
  title: string;
  type: StatusPostType;
  text?: string;
  /** Legado: data URL completa — preferir imageData + imageMime */
  image?: string;
  imageData?: Buffer;
  imageMime?: string;
  caption?: string;
  backgroundColor?: string;
  font?: number;
  audience: StatusPostAudience;
  status: StatusPostStatus;
  scheduledFor: Date;
  processedAt?: Date;
  lastError?: string;
  statusJidCount?: number;
  whatsappMessageId?: string;
  viewEvents?: IStatusViewEvent[];
  viewCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const StatusPostSchema = new Schema<IStatusPost>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 120,
      trim: true,
    },
    type: {
      type: String,
      enum: ['text', 'image'],
      required: true,
    },
    text: {
      type: String,
      maxlength: 700,
    },
    image: {
      type: String,
      validate: {
        validator(v: string) {
          if (!v) return true;
          return /^data:image\/(jpeg|png|webp);base64,/.test(v);
        },
        message: 'Imagem deve ser data URL JPEG, PNG ou WebP',
      },
    },
    imageData: { type: Buffer },
    imageMime: { type: String, maxlength: 32 },
    caption: {
      type: String,
      maxlength: 700,
    },
    backgroundColor: {
      type: String,
      maxlength: 16,
    },
    font: {
      type: Number,
      min: 0,
      max: 4,
    },
    audience: {
      type: String,
      enum: ['whatsapp', 'all_contacts', 'consented'],
      default: 'whatsapp',
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'failed'],
      default: 'pending',
      index: true,
    },
    scheduledFor: {
      type: Date,
      required: true,
      index: true,
    },
    processedAt: Date,
    lastError: String,
    statusJidCount: Number,
    whatsappMessageId: String,
    viewEvents: [
      {
        jid: { type: String, required: true },
        phone: String,
        name: String,
        viewedAt: { type: Date, required: true },
      },
    ],
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

StatusPostSchema.index({ clientId: 1, status: 1, scheduledFor: 1 });

export const StatusPost: Model<IStatusPost> =
  mongoose.models.StatusPost ?? mongoose.model<IStatusPost>('StatusPost', StatusPostSchema);
