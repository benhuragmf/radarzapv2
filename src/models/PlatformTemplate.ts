import mongoose, { Schema, Document, Model } from 'mongoose';

export type PlatformTemplateCategory =
  | 'birthday'
  | 'informative'
  | 'promo'
  | 'reminder'
  | 'custom';

export interface IPlatformTemplate extends Document {
  organizationId?: mongoose.Types.ObjectId | null;
  clientId: mongoose.Types.ObjectId | null;
  name: string;
  category: PlatformTemplateCategory;
  content: string;
  description?: string;
  variables: string[];
  isDefault: boolean;
  usage: {
    timesUsed: number;
    lastUsed: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PlatformTemplateSchema = new Schema<IPlatformTemplate>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    category: {
      type: String,
      enum: ['birthday', 'informative', 'promo', 'reminder', 'custom'],
      default: 'custom',
      index: true,
    },
    description: {
      type: String,
      maxlength: 500,
      default: undefined,
    },
    content: {
      type: String,
      required: true,
      maxlength: 4096,
    },
    variables: {
      type: [String],
      default: [],
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    usage: {
      timesUsed: { type: Number, default: 0, min: 0 },
      lastUsed: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
    collection: 'platformTemplates',
  },
);

PlatformTemplateSchema.index({ name: 1, clientId: 1 }, { unique: true });

/** Extrai variáveis no formato {nome} (igual Discord dw-*). */
export function extractTemplateVariables(content: string): string[] {
  const found = new Set<string>();
  const re = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    found.add(m[1]);
  }
  return [...found];
}

PlatformTemplateSchema.pre('save', function (next) {
  if (this.isModified('content')) {
    const extracted = extractTemplateVariables(this.content);
    this.variables = [...new Set([...this.variables, ...extracted])];
  }
  next();
});

interface IPlatformTemplateModel extends Model<IPlatformTemplate> {
  findByName(
    name: string,
    clientId?: mongoose.Types.ObjectId,
  ): Promise<IPlatformTemplate | null>;
}

PlatformTemplateSchema.statics.findByName = function (
  name: string,
  clientId?: mongoose.Types.ObjectId,
) {
  const isCatalog = name.startsWith('pw-');
  if (isCatalog) {
    return this.findOne({ name, clientId: null, isDefault: true });
  }
  const query: Record<string, unknown> = { name };
  if (clientId) {
    return this.findOne({
      name,
      $or: [
        { clientId },
        { clientId: null, isDefault: true },
      ],
    });
  }
  query.clientId = null;
  return this.findOne(query);
};

export const PlatformTemplate = mongoose.model<IPlatformTemplate, IPlatformTemplateModel>(
  'PlatformTemplate',
  PlatformTemplateSchema,
);
