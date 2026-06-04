import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IContactGroup extends Document {
  clientId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContactGroupSchema = new Schema<IContactGroup>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 240,
    },
  },
  { timestamps: true },
);

ContactGroupSchema.index({ clientId: 1, name: 1 }, { unique: true });

export const ContactGroup: Model<IContactGroup> =
  mongoose.models.ContactGroup ??
  mongoose.model<IContactGroup>('ContactGroup', ContactGroupSchema);
