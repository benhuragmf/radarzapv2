import mongoose, { Schema, Document } from 'mongoose';

export interface IApiKey extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  keyPrefix: string;
  keyHash: string;
  active: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Organization',
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    keyPrefix: { type: String, required: true, index: true },
    keyHash: { type: String, required: true, unique: true },
    active: { type: Boolean, default: true, index: true },
    lastUsedAt: { type: Date },
  },
  { timestamps: true, collection: 'apiKeys' },
);

ApiKeySchema.index({ organizationId: 1, active: 1 });

export const ApiKey = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
