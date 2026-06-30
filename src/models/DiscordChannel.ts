import mongoose, { Schema, Document, Model } from 'mongoose';
import { createServiceLogger } from '../utils/logger';
import type { DiscordMonitorType } from '@/types/discord-monitor';

const logger = createServiceLogger('DiscordChannelModel');

/**
 * Discord Channel interface
 */
export interface IDiscordChannel extends Document {
  guildId: string;
  channelId: string;
  channelName: string;
  guildName: string;
  clientId: mongoose.Types.ObjectId;
  isActive: boolean;
  /** text = mensagens; voice = chamada de voz; guild = eventos de membros */
  monitorType: DiscordMonitorType;
  /** Cooldown por usuário/evento (segundos); null = padrão do sistema */
  eventCooldownSec?: number | null;
  filters: {
    keywords: string[];
    excludeKeywords: string[];
    allowBots: boolean;
    allowedBotIds: string[];
    allowedUserIds: string[];
    requireLink: boolean;
    requireImage: boolean;
    requireEmbed: boolean;
    // mantido para compatibilidade, mas não é mais o foco
    minPrice?: number;
    maxPrice?: number;
  };
  destinationIds: mongoose.Types.ObjectId[];
  templateName: string;
  rulePriority: 'high' | 'medium' | 'low';
  createdAt: Date;

  // Instance methods
  addKeyword(keyword: string): Promise<void>;
  removeKeyword(keyword: string): Promise<void>;
  addExcludeKeyword(keyword: string): Promise<void>;
  removeExcludeKeyword(keyword: string): Promise<void>;
  setPriceRange(min?: number, max?: number): Promise<void>;
  toggleActive(): Promise<void>;
  matchesFilters(content: string, price?: number): boolean;
  matchesMessageFilters(isBot: boolean, hasLink: boolean, hasImage: boolean, hasEmbed: boolean): boolean;
}

/**
 * Discord Channel schema
 */
const DiscordChannelSchema = new Schema<IDiscordChannel>({
  guildId: {
    type: String,
    required: [true, 'Guild ID is required'],
    validate: {
      validator: (v: string) => /^\d{17,19}$/.test(v),
      message: 'Invalid Discord Guild ID format'
    },
    index: true
  },
  
  channelId: {
    type: String,
    required: [true, 'Channel ID is required'],
    validate: {
      validator: (v: string) => /^\d{17,19}$/.test(v),
      message: 'Invalid Discord Channel ID format'
    },
    index: true
  },

  channelName: { type: String, default: '' },
  guildName:   { type: String, default: '' },

  clientId: {
    type: Schema.Types.ObjectId,
    required: [true, 'Client ID is required'],
    ref: 'User',
  },
  
  isActive: {
    type: Boolean,
    default: true,
  },

  monitorType: {
    type: String,
    enum: ['text', 'voice', 'guild'],
    default: 'text',
    index: true,
  },

  eventCooldownSec: {
    type: Number,
    min: 0,
    default: null,
  },
  
  filters: {
    keywords: {
      type: [String],
      default: [],
      validate: {
        validator: function(keywords: string[]) {
          return keywords.every(keyword => keyword.length > 0 && keyword.length <= 50);
        },
        message: 'Keywords must be between 1 and 50 characters'
      }
    },
    
    excludeKeywords: {
      type: [String],
      default: [],
      validate: {
        validator: function(keywords: string[]) {
          return keywords.every(keyword => keyword.length > 0 && keyword.length <= 50);
        },
        message: 'Exclude keywords must be between 1 and 50 characters'
      }
    },

    allowBots: { type: Boolean, default: true },
    allowedBotIds: { type: [String], default: [] },
    allowedUserIds: { type: [String], default: [] },
    requireLink: { type: Boolean, default: false },
    requireImage: { type: Boolean, default: false },
    requireEmbed: { type: Boolean, default: false },
    
    minPrice: {
      type: Number,
      min: [0, 'Minimum price cannot be negative'],
    },
    
    maxPrice: {
      type: Number,
      min: [0, 'Maximum price cannot be negative'],
    }
  },

  destinationIds: {
    type: [Schema.Types.ObjectId],
    ref: 'Destination',
    default: [],
  },

  templateName: {
    type: String,
    default: 'radarzap-padrao',
  },

  rulePriority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium',
  },
}, {
  timestamps: true,
  collection: 'discordChannels'
});

/**
 * Instance Methods
 */
DiscordChannelSchema.methods.addKeyword = async function(this: IDiscordChannel, keyword: string): Promise<void> {
  const normalizedKeyword = keyword.toLowerCase().trim();
  
  if (!this.filters.keywords.includes(normalizedKeyword)) {
    this.filters.keywords.push(normalizedKeyword);
    await this.save();
    
    logger.info('Keyword added to channel filter', {
      channelId: this.channelId,
      guildId: this.guildId,
      keyword: normalizedKeyword
    });
  }
};

DiscordChannelSchema.methods.removeKeyword = async function(this: IDiscordChannel, keyword: string): Promise<void> {
  const normalizedKeyword = keyword.toLowerCase().trim();
  const index = this.filters.keywords.indexOf(normalizedKeyword);
  
  if (index > -1) {
    this.filters.keywords.splice(index, 1);
    await this.save();
    
    logger.info('Keyword removed from channel filter', {
      channelId: this.channelId,
      guildId: this.guildId,
      keyword: normalizedKeyword
    });
  }
};

DiscordChannelSchema.methods.addExcludeKeyword = async function(this: IDiscordChannel, keyword: string): Promise<void> {
  const normalizedKeyword = keyword.toLowerCase().trim();
  
  if (!this.filters.excludeKeywords.includes(normalizedKeyword)) {
    this.filters.excludeKeywords.push(normalizedKeyword);
    await this.save();
    
    logger.info('Exclude keyword added to channel filter', {
      channelId: this.channelId,
      guildId: this.guildId,
      keyword: normalizedKeyword
    });
  }
};

DiscordChannelSchema.methods.removeExcludeKeyword = async function(this: IDiscordChannel, keyword: string): Promise<void> {
  const normalizedKeyword = keyword.toLowerCase().trim();
  const index = this.filters.excludeKeywords.indexOf(normalizedKeyword);
  
  if (index > -1) {
    this.filters.excludeKeywords.splice(index, 1);
    await this.save();
    
    logger.info('Exclude keyword removed from channel filter', {
      channelId: this.channelId,
      guildId: this.guildId,
      keyword: normalizedKeyword
    });
  }
};

DiscordChannelSchema.methods.setPriceRange = async function(this: IDiscordChannel, min?: number, max?: number): Promise<void> {
  if (min !== undefined) {
    this.filters.minPrice = min;
  }
  if (max !== undefined) {
    this.filters.maxPrice = max;
  }
  
  await this.save();
  
  logger.info('Price range updated for channel filter', {
    channelId: this.channelId,
    guildId: this.guildId,
    minPrice: this.filters.minPrice,
    maxPrice: this.filters.maxPrice
  });
};

DiscordChannelSchema.methods.toggleActive = async function(this: IDiscordChannel): Promise<void> {
  this.isActive = !this.isActive;
  await this.save();
  
  logger.info('Channel active status toggled', {
    channelId: this.channelId,
    guildId: this.guildId,
    isActive: this.isActive
  });
};

DiscordChannelSchema.methods.matchesFilters = function(this: IDiscordChannel, content: string, price?: number): boolean {
  const normalizedContent = content.toLowerCase();
  
  // Check exclude keywords first
  if (this.filters.excludeKeywords.length > 0) {
    const hasExcludedKeyword = this.filters.excludeKeywords.some(keyword => 
      normalizedContent.includes(keyword.toLowerCase())
    );
    if (hasExcludedKeyword) {
      return false;
    }
  }
  
  // Check include keywords
  if (this.filters.keywords.length > 0) {
    const hasIncludedKeyword = this.filters.keywords.some(keyword => 
      normalizedContent.includes(keyword.toLowerCase())
    );
    if (!hasIncludedKeyword) {
      return false;
    }
  }
  
  // Check price range
  if (price !== undefined) {
    if (this.filters.minPrice !== undefined && price < this.filters.minPrice) {
      return false;
    }
    if (this.filters.maxPrice !== undefined && price > this.filters.maxPrice) {
      return false;
    }
  }
  
  return true;
};

/**
 * Verifica filtros de tipo de mensagem (bot, link, imagem, embed)
 */
DiscordChannelSchema.methods.matchesMessageFilters = function(
  this: IDiscordChannel,
  isBot: boolean,
  hasLink: boolean,
  hasImage: boolean,
  hasEmbed: boolean
): boolean {
  // Se não permite bots e a mensagem é de bot
  if (!this.filters.allowBots && isBot) return false;

  // Se tem lista de bots permitidos, só aceita esses
  if (isBot && this.filters.allowedBotIds.length > 0) {
    // A verificação por ID do autor é feita no DiscordBotService
    // aqui apenas sinalizamos que há restrição
    return true;
  }

  // Requer link
  if (this.filters.requireLink && !hasLink) return false;

  // Requer imagem
  if (this.filters.requireImage && !hasImage) return false;

  // Requer embed
  if (this.filters.requireEmbed && !hasEmbed) return false;

  return true;
};

/**
 * Static Methods
 */
DiscordChannelSchema.statics.findByChannelId = function(channelId: string) {
  return this.findOne({
    channelId,
    isActive: true,
    $or: [{ monitorType: 'text' }, { monitorType: { $exists: false } }],
  });
};

DiscordChannelSchema.statics.findVoiceMonitor = function(channelId: string) {
  return this.findOne({ channelId, isActive: true, monitorType: 'voice' });
};

DiscordChannelSchema.statics.findGuildMonitor = function(guildId: string) {
  return this.findOne({ guildId, isActive: true, monitorType: 'guild' });
};

DiscordChannelSchema.statics.findByGuildId = function(guildId: string) {
  return this.find({ guildId, isActive: true });
};

DiscordChannelSchema.statics.findByClientId = function(clientId: mongoose.Types.ObjectId) {
  return this.find({ clientId, isActive: true });
};

DiscordChannelSchema.statics.createChannel = async function(
  guildId: string,
  channelId: string,
  clientId: mongoose.Types.ObjectId,
  options?: { monitorType?: DiscordMonitorType; channelName?: string; guildName?: string }
) {
  const monitorType = options?.monitorType ?? 'text';
  const existing = await this.findOne({ guildId, channelId, monitorType });
  if (existing) {
    throw new Error('Channel already exists for this guild');
  }
  
  const channel = new this({
    guildId,
    channelId,
    channelName: options?.channelName ?? '',
    guildName: options?.guildName ?? '',
    clientId,
    isActive: true,
    monitorType,
    filters: {
      keywords: [],
      excludeKeywords: []
    }
  });
  
  await channel.save();
  
  logger.info('New Discord channel created', {
    channelId,
    guildId,
    clientId
  });
  
  return channel;
};

DiscordChannelSchema.statics.getChannelStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$isActive',
        count: { $sum: 1 },
        avgKeywords: { $avg: { $size: '$filters.keywords' } },
        avgExcludeKeywords: { $avg: { $size: '$filters.excludeKeywords' } }
      }
    }
  ]);
  
  return stats;
};

DiscordChannelSchema.statics.findChannelsWithFilters = function() {
  return this.find({
    isActive: true,
    $or: [
      { 'filters.keywords.0': { $exists: true } },
      { 'filters.excludeKeywords.0': { $exists: true } },
      { 'filters.minPrice': { $exists: true } },
      { 'filters.maxPrice': { $exists: true } }
    ]
  });
};

/**
 * Middleware
 */
DiscordChannelSchema.pre('save', function(this: IDiscordChannel, next) {
  // Normalize keywords to lowercase
  this.filters.keywords = this.filters.keywords.map(keyword => keyword.toLowerCase().trim());
  this.filters.excludeKeywords = this.filters.excludeKeywords.map(keyword => keyword.toLowerCase().trim());
  
  // Remove duplicates
  this.filters.keywords = [...new Set(this.filters.keywords)];
  this.filters.excludeKeywords = [...new Set(this.filters.excludeKeywords)];
  
  next();
});

DiscordChannelSchema.post('save', function(this: IDiscordChannel) {
  logger.debug('Discord channel saved', {
    channelId: this.channelId,
    guildId: this.guildId,
    isActive: this.isActive,
    filtersCount: {
      keywords: this.filters.keywords.length,
      excludeKeywords: this.filters.excludeKeywords.length
    }
  });
});

/**
 * Indexes
 */
DiscordChannelSchema.index({ guildId: 1, channelId: 1 }, { unique: true });
DiscordChannelSchema.index({ clientId: 1 });
DiscordChannelSchema.index({ isActive: 1 });
DiscordChannelSchema.index({ guildId: 1, isActive: 1 });
DiscordChannelSchema.index({ channelId: 1, isActive: 1 });

/**
 * Model interface for static methods
 */
interface IDiscordChannelModel extends Model<IDiscordChannel> {
  findByChannelId(channelId: string): Promise<IDiscordChannel | null>;
  findVoiceMonitor(channelId: string): Promise<IDiscordChannel | null>;
  findGuildMonitor(guildId: string): Promise<IDiscordChannel | null>;
  findByGuildId(guildId: string): Promise<IDiscordChannel[]>;
  findByClientId(clientId: mongoose.Types.ObjectId): Promise<IDiscordChannel[]>;
  createChannel(
    guildId: string,
    channelId: string,
    clientId: mongoose.Types.ObjectId,
    options?: { monitorType?: DiscordMonitorType; channelName?: string; guildName?: string }
  ): Promise<IDiscordChannel>;
  getChannelStats(): Promise<any[]>;
  findChannelsWithFilters(): Promise<IDiscordChannel[]>;
}

/**
 * Export the DiscordChannel model
 */
export const DiscordChannel = mongoose.model<IDiscordChannel, IDiscordChannelModel>('DiscordChannel', DiscordChannelSchema);