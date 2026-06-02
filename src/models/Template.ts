import mongoose, { Schema, Document, Model } from 'mongoose';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('TemplateModel');

/**
 * Template interface
 */
export interface ITemplate extends Document {
  clientId: mongoose.Types.ObjectId | null; // null for global templates
  name: string;
  content: string;
  variables: string[];
  isDefault: boolean;
  usage: {
    timesUsed: number;
    lastUsed: Date;
  };
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  render(variables: Record<string, any>): string;
  incrementUsage(): Promise<void>;
  validateVariables(variables: Record<string, any>): { valid: boolean; missing: string[] };
  clone(newName: string, clientId: mongoose.Types.ObjectId): Promise<ITemplate>;
}

/**
 * Template schema
 */
const TemplateSchema = new Schema<ITemplate>({
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null, // null for global templates
    index: true
  },
  
  name: {
    type: String,
    required: [true, 'Template name is required'],
    minlength: [1, 'Template name cannot be empty'],
    maxlength: [100, 'Template name cannot exceed 100 characters'],
    validate: {
      validator: function(v: string) {
        // Allow alphanumeric, spaces, hyphens, and underscores
        return /^[a-zA-Z0-9\s\-_]+$/.test(v);
      },
      message: 'Template name can only contain letters, numbers, spaces, hyphens, and underscores'
    }
  },
  
  content: {
    type: String,
    required: [true, 'Template content is required'],
    minlength: [1, 'Template content cannot be empty'],
    maxlength: [4096, 'Template content cannot exceed 4096 characters']
  },
  
  variables: {
    type: [String],
    default: [],
    validate: {
      validator: function(variables: string[]) {
        // Check for valid variable names
        return variables.every(variable => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(variable));
      },
      message: 'Variable names must start with a letter and contain only letters, numbers, and underscores'
    }
  },
  
  isDefault: {
    type: Boolean,
    default: false,
    index: true
  },
  
  usage: {
    timesUsed: {
      type: Number,
      default: 0,
      min: [0, 'Times used cannot be negative']
    },
    lastUsed: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true,
  collection: 'templates'
});

/**
 * Instance Methods
 */
TemplateSchema.methods.render = function(this: ITemplate, variables: Record<string, any>): string {
  let rendered = this.content;
  
  // Replace variables in the format {variableName}
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    rendered = rendered.replace(regex, String(value || ''));
  }
  
  // Remove any unreplaced variables (optional)
  rendered = rendered.replace(/\{[^}]+\}/g, '');
  
  return rendered;
};

TemplateSchema.methods.incrementUsage = async function(this: ITemplate): Promise<void> {
  this.usage.timesUsed += 1;
  this.usage.lastUsed = new Date();
  await this.save();
  
  logger.debug('Template usage incremented', {
    templateId: this._id,
    name: this.name,
    timesUsed: this.usage.timesUsed
  });
};

TemplateSchema.methods.validateVariables = function(this: ITemplate, variables: Record<string, any>): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  for (const requiredVar of this.variables) {
    if (!(requiredVar in variables) || variables[requiredVar] === undefined || variables[requiredVar] === null) {
      missing.push(requiredVar);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
};

TemplateSchema.methods.clone = async function(this: ITemplate, newName: string, clientId: mongoose.Types.ObjectId): Promise<ITemplate> {
  const Template = this.constructor as ITemplateModel;
  
  const clonedTemplate = new Template({
    clientId,
    name: newName,
    content: this.content,
    variables: [...this.variables],
    isDefault: false,
    usage: {
      timesUsed: 0,
      lastUsed: new Date()
    }
  });
  
  await clonedTemplate.save();
  
  logger.info('Template cloned', {
    originalId: this._id,
    clonedId: clonedTemplate._id,
    newName,
    clientId
  });
  
  return clonedTemplate;
};

/**
 * Static Methods
 */
TemplateSchema.statics.findByName = function(name: string, clientId?: mongoose.Types.ObjectId) {
  const query: any = { name };
  if (clientId) {
    query.$or = [
      { clientId },
      { clientId: null, isDefault: true } // Include global default templates
    ];
  } else {
    query.clientId = null;
  }
  
  return this.findOne(query);
};

TemplateSchema.statics.findByClientId = function(clientId: mongoose.Types.ObjectId, includeDefaults: boolean = true) {
  const query: any = {};
  
  if (includeDefaults) {
    query.$or = [
      { clientId },
      { clientId: null, isDefault: true }
    ];
  } else {
    query.clientId = clientId;
  }
  
  return this.find(query).sort({ isDefault: -1, name: 1 });
};

TemplateSchema.statics.createTemplate = async function(
  name: string,
  content: string,
  clientId?: mongoose.Types.ObjectId,
  isDefault: boolean = false
) {
  // Extract variables from content
  const variableMatches = content.match(/\{([^}]+)\}/g) || [];
  const variables = [...new Set(variableMatches.map(match => match.slice(1, -1)))];
  
  const template = new this({
    clientId: clientId || null,
    name,
    content,
    variables,
    isDefault,
    usage: {
      timesUsed: 0,
      lastUsed: new Date()
    }
  });
  
  await template.save();
  
  logger.info('New template created', {
    templateId: template._id,
    name,
    clientId,
    variables: variables.length,
    isDefault
  });
  
  return template;
};

TemplateSchema.statics.getDefaultTemplates = function() {
  return this.find({ isDefault: true, clientId: null }).sort({ name: 1 });
};

TemplateSchema.statics.getTemplateStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: {
          isDefault: '$isDefault',
          hasClientId: { $ne: ['$clientId', null] }
        },
        count: { $sum: 1 },
        avgUsage: { $avg: '$usage.timesUsed' },
        totalUsage: { $sum: '$usage.timesUsed' }
      }
    }
  ]);
  
  const mostUsed = await this.find({})
    .sort({ 'usage.timesUsed': -1 })
    .limit(5)
    .select('name usage.timesUsed clientId');
  
  return {
    byType: stats,
    mostUsed
  };
};

TemplateSchema.statics.findUnusedTemplates = function(daysUnused: number = 30) {
  const cutoffDate = new Date(Date.now() - daysUnused * 24 * 60 * 60 * 1000);
  
  return this.find({
    'usage.lastUsed': { $lt: cutoffDate },
    'usage.timesUsed': 0,
    isDefault: false
  });
};

TemplateSchema.statics.searchTemplates = function(query: string, clientId?: mongoose.Types.ObjectId) {
  const searchRegex = new RegExp(query, 'i');
  const searchQuery: any = {
    $or: [
      { name: searchRegex },
      { content: searchRegex }
    ]
  };
  
  if (clientId) {
    searchQuery.$and = [
      {
        $or: [
          { clientId },
          { clientId: null, isDefault: true }
        ]
      }
    ];
  }
  
  return this.find(searchQuery).sort({ isDefault: -1, 'usage.timesUsed': -1 });
};

/**
 * Middleware
 */
TemplateSchema.pre('save', function(this: ITemplate, next) {
  // Auto-extract variables from content if not provided
  if (this.isModified('content')) {
    const variableMatches = this.content.match(/\{([^}]+)\}/g) || [];
    const extractedVariables = [...new Set(variableMatches.map(match => match.slice(1, -1)))];
    
    // Merge with existing variables, removing duplicates
    this.variables = [...new Set([...this.variables, ...extractedVariables])];
  }
  
  // Ensure name is unique per client
  if (this.isModified('name') || this.isNew) {
    const Template = this.constructor as ITemplateModel;
    Template.findOne({
      name: this.name,
      clientId: this.clientId,
      _id: { $ne: this._id }
    }).then(existing => {
      if (existing) {
        return next(new Error(`Template with name "${this.name}" already exists for this client`));
      }
      next();
    }).catch(next);
  } else {
    next();
  }
});

TemplateSchema.post('save', function(this: ITemplate) {
  logger.debug('Template saved', {
    templateId: this._id,
    name: this.name,
    clientId: this.clientId,
    variables: this.variables.length,
    isDefault: this.isDefault
  });
});

/**
 * Indexes
 */
TemplateSchema.index({ name: 1, clientId: 1 }, { unique: true });
TemplateSchema.index({ 'usage.timesUsed': -1 });
TemplateSchema.index({ 'usage.lastUsed': 1 });

// Text index for search functionality
TemplateSchema.index({ name: 'text', content: 'text' });

/**
 * Model interface for static methods
 */
interface ITemplateModel extends Model<ITemplate> {
  findByName(name: string, clientId?: mongoose.Types.ObjectId): Promise<ITemplate | null>;
  findByClientId(clientId: mongoose.Types.ObjectId, includeDefaults?: boolean): Promise<ITemplate[]>;
  createTemplate(
    name: string,
    content: string,
    clientId?: mongoose.Types.ObjectId,
    isDefault?: boolean
  ): Promise<ITemplate>;
  getDefaultTemplates(): Promise<ITemplate[]>;
  getTemplateStats(): Promise<any>;
  findUnusedTemplates(daysUnused?: number): Promise<ITemplate[]>;
  searchTemplates(query: string, clientId?: mongoose.Types.ObjectId): Promise<ITemplate[]>;
}

/**
 * Export the Template model
 */
export const Template = mongoose.model<ITemplate, ITemplateModel>('Template', TemplateSchema);