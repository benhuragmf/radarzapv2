import mongoose, { Schema, Document, Model } from 'mongoose';
import { createServiceLogger } from '@/utils/logger';
import { ConsentStatus } from '@/types/consent';
import { canSendToContact, canSendPendingAttempt } from '@/types/consent';
import { CONTACT_PHONE_TYPES, type ContactPhoneType } from '@/types/contact-fields';
import type { InboxMenuContext } from '@/types/inbox-menu-context';
import type {
  CommercialStatus,
  ContactKind,
  ContactOrigin,
  ContactTemperature,
  PhoneQuality,
} from '@/types/contact-classification';

const logger = createServiceLogger('DestinationModel');

/**
 * Destination interface
 */
export interface IDestination extends Document {
  clientId: mongoose.Types.ObjectId;
  type: 'group' | 'contact';
  identifier: string; // phone number or group ID
  name: string;
  consent: {
    granted: boolean;
    grantedAt?: Date;
    source?: string;
    ipAddress?: string;
  };
  /** Fluxo opt-in WhatsApp (somente contatos) */
  consentStatus: ConsentStatus;
  pendingOutboundCount: number;
  /** Quantas vezes o dono/admin aprovou novo aceite (máx. 2 — na 3ª recusa é definitivo) */
  consentRenewalApprovals: number;
  lastConsentPromptAt?: Date;
  /** Mensagens enfileiradas até o contato aceitar (1) o consentimento LGPD */
  pendingOutboundDeliveries?: Record<string, unknown>[];
  /** Aguardando 2ª mensagem para confirmar opt-out (sair) */
  optOutConfirmPendingAt?: Date;
  /** Último menu enviado ao contato (roteamento 1/2 inbox vs ticket). */
  lastMenuContext?: InboxMenuContext;
  lastMenuSentAt?: Date;
  /** Menu bot: refs TK aguardando escolha numerada (sem IA). */
  pendingTicketMenuChoices?: string[];
  /** Ticket selecionado no fluxo bot aguardando complemento. */
  pendingTicketTargetRef?: string;
  isActive: boolean;
  lastMessageSent?: Date;
  /** YYYY-MM-DD — import CSV / campanhas aniversário */
  birthday?: string;
  /** Último envio automático de aniversário (dedup anual / intervalo) */
  birthdayLastSentAt?: Date;
  tags?: string[];
  /** Grupos de contato (listas / segmentos) */
  contactGroupIds?: mongoose.Types.ObjectId[];
  email?: string;
  notes?: string;
  /** Empresa / ORG do VCF ou coluna CSV */
  organization?: string;
  /** Segunda linha TEL (VCF / phone 2) */
  secondaryPhone?: string;
  /** Tipo da linha principal: whatsapp, cell, home, work, other */
  phoneType?: ContactPhoneType;
  /** Foto de perfil WhatsApp persistida (binário) */
  profilePictureData?: Buffer;
  profilePictureMime?: string;
  profilePictureUpdatedAt?: Date;
  /** Tipo principal: lead, cliente, prospect, etc. */
  contactKind?: ContactKind;
  /** Origem do cadastro */
  contactOrigin?: ContactOrigin;
  /** Status comercial / funil */
  commercialStatus?: CommercialStatus;
  /** Temperatura comercial */
  temperature?: ContactTemperature;
  /** Qualidade do número (override manual; senão inferido) */
  phoneQuality?: PhoneQuality;
  createdAt: Date;
  
  // Instance methods
  grantConsent(source: string, ipAddress: string): Promise<void>;
  revokeConsent(): Promise<void>;
  hasValidConsent(): boolean;
  updateLastMessageSent(): Promise<void>;
  deactivate(): Promise<void>;
  activate(): Promise<void>;
}

/**
 * Destination schema
 */
const DestinationSchema = new Schema<IDestination>({
  clientId: {
    type: Schema.Types.ObjectId,
    required: [true, 'Client ID is required'],
    ref: 'User',
    index: true
  },
  
  type: {
    type: String,
    enum: {
      values: ['group', 'contact'],
      message: 'Type must be either group or contact'
    },
    required: [true, 'Destination type is required'],
    index: true
  },
  
  identifier: {
    type: String,
    required: [true, 'Destination identifier is required'],
    validate: {
      validator: function(this: IDestination, v: string) {
        if (this.type === 'contact') {
          // Validate phone number format (international format)
          return /^\+?[1-9]\d{1,14}$/.test(v.replace(/[\s\-()]/g, ''));
        } else if (this.type === 'group') {
          // Validate group ID format (WhatsApp group format)
          return /^[\w\-@.]+$/.test(v);
        }
        return false;
      },
      message: 'Invalid identifier format for the specified type'
    },
    index: true
  },
  
  name: {
    type: String,
    required: [true, 'Destination name is required'],
    minlength: [1, 'Name cannot be empty'],
    maxlength: [100, 'Name cannot exceed 100 characters'],
    trim: true
  },
  
  consent: {
    granted: {
      type: Boolean,
      required: true,
      default: false,
      index: true
    },
    
    grantedAt: {
      type: Date,
      required: function(this: IDestination) {
        return this.consent.granted;
      }
    },
    
    source: {
      type: String,
      required: function(this: IDestination) {
        return this.consent.granted;
      },
      enum: {
        values: ['manual', 'opt-in', 'import', 'api', 'discord-command', 'owner-reset'],
        message: 'Invalid consent source'
      }
    },
    
    ipAddress: {
      type: String,
      validate: {
        validator: function(v: string) {
          if (!v) return true;
          const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
          const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
          return ipv4Regex.test(v) || ipv6Regex.test(v) || v === '0.0.0.0';
        },
        message: 'Invalid IP address format'
      }
    }
  },

  consentStatus: {
    type: String,
    enum: Object.values(ConsentStatus),
    default: ConsentStatus.PENDING,
    index: true,
  },

  pendingOutboundCount: {
    type: Number,
    default: 0,
    min: 0,
  },

  consentRenewalApprovals: {
    type: Number,
    default: 0,
    min: 0,
    max: 2,
  },

  lastConsentPromptAt: Date,

  pendingOutboundDeliveries: [Schema.Types.Mixed],

  optOutConfirmPendingAt: Date,

  lastMenuContext: {
    type: String,
    enum: ['inbox_triage', 'ticket_followup', 'ticket_grace_expired', 'ticket_pick', 'consent', 'none'],
  },
  lastMenuSentAt: Date,
  pendingTicketMenuChoices: [{ type: String, maxlength: 32 }],
  pendingTicketTargetRef: { type: String, maxlength: 32 },
  
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  lastMessageSent: {
    type: Date,
    index: true
  },

  birthday: {
    type: String,
    trim: true,
    maxlength: 10,
  },

  birthdayLastSentAt: {
    type: Date,
    index: true,
  },

  tags: {
    type: [String],
    default: undefined,
  },

  contactGroupIds: {
    type: [{ type: Schema.Types.ObjectId, ref: 'ContactGroup' }],
    default: undefined,
  },

  email: {
    type: String,
    trim: true,
    maxlength: 254,
    lowercase: true,
  },

  notes: {
    type: String,
    maxlength: 2000,
    trim: true,
  },

  organization: {
    type: String,
    maxlength: 200,
    trim: true,
  },

  secondaryPhone: {
    type: String,
    trim: true,
    validate: {
      validator(v: string) {
        if (!v) return true;
        return /^\+?[1-9]\d{1,14}$/.test(v.replace(/[\s\-()]/g, ''));
      },
      message: 'Formato inválido para telefone secundário',
    },
  },

  profilePictureData: {
    type: Buffer,
  },

  profilePictureMime: {
    type: String,
    maxlength: 64,
  },

  profilePictureUpdatedAt: Date,

  phoneType: {
    type: String,
    enum: {
      values: CONTACT_PHONE_TYPES,
      message: 'Tipo de telefone inválido',
    },
  },

  contactKind: {
    type: String,
    enum: ['lead', 'client', 'prospect', 'partner', 'internal', 'blocked'],
  },
  contactOrigin: {
    type: String,
    enum: ['whatsapp', 'webchat', 'form', 'manual', 'csv', 'wa_group', 'api', 'campaign'],
  },
  commercialStatus: {
    type: String,
    enum: [
      'new',
      'in_service',
      'waiting_client',
      'waiting_agent',
      'qualified',
      'opportunity',
      'converted',
      'after_sale',
      'inactive',
      'lost',
    ],
  },
  temperature: {
    type: String,
    enum: ['cold', 'warm', 'hot', 'vip', 'risk'],
  },
  phoneQuality: {
    type: String,
    enum: ['verified', 'attention', 'invalid', 'no_whatsapp', 'duplicate', 'incomplete', 'international', 'suspicious'],
  },
}, {
  timestamps: true,
  collection: 'destinations'
});

/**
 * Instance Methods
 */
DestinationSchema.methods.grantConsent = async function(this: IDestination, source: string, ipAddress: string): Promise<void> {
  this.consent.granted = true;
  this.consent.grantedAt = new Date();
  this.consent.source = source;
  this.consent.ipAddress = ipAddress;
  this.consentStatus = ConsentStatus.ACCEPTED;
  this.pendingOutboundCount = 0;
  this.isActive = true;
  
  await this.save();
  
  logger.info('Consent granted for destination', {
    destinationId: this._id,
    clientId: this.clientId,
    type: this.type,
    identifier: this.identifier,
    source,
    ipAddress
  });
};

DestinationSchema.methods.revokeConsent = async function(this: IDestination): Promise<void> {
  this.consent.granted = false;
  this.isActive = false;
  
  await this.save();
  
  logger.info('Consent revoked for destination', {
    destinationId: this._id,
    clientId: this.clientId,
    type: this.type,
    identifier: this.identifier
  });
};

DestinationSchema.methods.hasValidConsent = function(this: IDestination): boolean {
  // Grupos: só precisam estar ativos (sem fluxo LGPD de contato)
  if (this.type === 'group') {
    return this.isActive;
  }
  const st = this.consentStatus ?? (this.consent.granted ? ConsentStatus.ACCEPTED : ConsentStatus.PENDING);
  if (st === ConsentStatus.MANUALLY_BLOCKED || st === ConsentStatus.REFUSED_THREE) {
    return false;
  }
  if (canSendToContact(st)) return this.isActive;
  // PENDING: permitir envio de solicitação de consentimento mesmo se cleanup marcou inativo
  if (canSendPendingAttempt(st, this.pendingOutboundCount ?? 0)) return true;
  return false;
};

DestinationSchema.methods.updateLastMessageSent = async function(this: IDestination): Promise<void> {
  this.lastMessageSent = new Date();
  await this.save();
  
  logger.debug('Last message sent updated', {
    destinationId: this._id,
    lastMessageSent: this.lastMessageSent
  });
};

DestinationSchema.methods.deactivate = async function(this: IDestination): Promise<void> {
  this.isActive = false;
  await this.save();
  
  logger.info('Destination deactivated', {
    destinationId: this._id,
    clientId: this.clientId,
    identifier: this.identifier
  });
};

DestinationSchema.methods.activate = async function(this: IDestination): Promise<void> {
  if (!this.consent.granted) {
    throw new Error('Cannot activate destination without valid consent');
  }
  
  this.isActive = true;
  await this.save();
  
  logger.info('Destination activated', {
    destinationId: this._id,
    clientId: this.clientId,
    identifier: this.identifier
  });
};

/**
 * Static Methods
 */
DestinationSchema.statics.findByClientId = function(clientId: mongoose.Types.ObjectId, activeOnly: boolean = true) {
  const query: any = { clientId };
  if (activeOnly) {
    query.isActive = true;
  }
  return this.find(query).sort({ name: 1 });
};

DestinationSchema.statics.findByIdentifier = function(identifier: string, clientId?: mongoose.Types.ObjectId) {
  // Normalize: try exact match first, then with/without leading +
  const withPlus = identifier.startsWith('+') ? identifier : `+${identifier}`;
  const withoutPlus = identifier.startsWith('+') ? identifier.slice(1) : identifier;

  const query: any = { identifier: { $in: [identifier, withPlus, withoutPlus] } };
  if (clientId) {
    query.clientId = clientId;
  }

  return this.findOne(query);
};

DestinationSchema.statics.createDestination = async function(
  clientId: mongoose.Types.ObjectId,
  type: 'group' | 'contact',
  identifier: string,
  name: string,
  consentSource: string = 'manual',
  ipAddress: string = '127.0.0.1'
) {
  // Check if destination already exists
  const existing = await this.findOne({ clientId, identifier });
  if (existing) {
    throw new Error('Destination with this identifier already exists for this client');
  }
  
  const isGroup = type === 'group';
  const destination = new this({
    clientId,
    type,
    identifier,
    name,
    consent: isGroup
      ? { granted: true, grantedAt: new Date(), source: consentSource, ipAddress }
      : { granted: false },
    consentStatus: isGroup ? ConsentStatus.ACCEPTED : ConsentStatus.PENDING,
    pendingOutboundCount: 0,
    isActive: true,
  });
  
  await destination.save();
  
  logger.info('New destination created', {
    destinationId: destination._id,
    clientId,
    type,
    identifier,
    name,
    consentSource
  });
  
  return destination;
};

DestinationSchema.statics.getDestinationStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: {
          type: '$type',
          isActive: '$isActive',
          hasConsent: '$consent.granted'
        },
        count: { $sum: 1 }
      }
    }
  ]);
  
  const recentActivity = await this.aggregate([
    {
      $match: {
        lastMessageSent: { $exists: true }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$lastMessageSent'
          }
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: -1 }
    },
    {
      $limit: 7
    }
  ]);
  
  return {
    byTypeAndStatus: stats,
    recentActivity
  };
};

DestinationSchema.statics.findInactiveDestinations = function(daysInactive: number = 30) {
  const cutoffDate = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000);
  
  return this.find({
    $or: [
      { lastMessageSent: { $lt: cutoffDate } },
      { lastMessageSent: { $exists: false }, createdAt: { $lt: cutoffDate } }
    ],
    isActive: true
  });
};

DestinationSchema.statics.bulkUpdateConsent = async function(
  clientId: mongoose.Types.ObjectId,
  identifiers: string[],
  granted: boolean,
  source: string = 'bulk-update',
  ipAddress: string = '127.0.0.1'
) {
  const updateData: any = {
    'consent.granted': granted,
    isActive: granted
  };
  
  if (granted) {
    updateData['consent.grantedAt'] = new Date();
    updateData['consent.source'] = source;
    updateData['consent.ipAddress'] = ipAddress;
  }
  
  const result = await this.updateMany(
    {
      clientId,
      identifier: { $in: identifiers }
    },
    updateData
  );
  
  logger.info('Bulk consent update completed', {
    clientId,
    identifiersCount: identifiers.length,
    modifiedCount: result.modifiedCount,
    granted,
    source
  });
  
  return result.modifiedCount;
};

DestinationSchema.statics.findByType = function(type: 'group' | 'contact', clientId?: mongoose.Types.ObjectId) {
  const query: any = { type, isActive: true, 'consent.granted': true };
  if (clientId) {
    query.clientId = clientId;
  }
  
  return this.find(query).sort({ name: 1 });
};

/**
 * Middleware
 */
DestinationSchema.pre('save', function(this: IDestination, next) {
  // Normalize identifier
  if (this.type === 'contact') {
    // Remove spaces, hyphens, and parentheses from phone numbers
    this.identifier = this.identifier.replace(/[\s\-()]/g, '');
    
    // Ensure international format
    if (!this.identifier.startsWith('+')) {
      // This is a basic assumption - in production, you'd want more sophisticated logic
      this.identifier = '+' + this.identifier;
    }
  }
  
  if (this.consent.source === 'whatsapp-inbound') {
    this.consent.source = 'opt-in';
  }

  // Ensure consent data consistency
  if (!this.consent.granted) {
    this.consent.grantedAt = undefined;
    this.consent.source = undefined;
    this.consent.ipAddress = undefined;
    // Contatos PENDING/recusa parcial permanecem ativos para o fluxo LGPD
    if (this.type === 'contact' && this.consentStatus) {
      if (
        this.consentStatus === ConsentStatus.REFUSED_THREE ||
        this.consentStatus === ConsentStatus.MANUALLY_BLOCKED
      ) {
        this.isActive = false;
      }
    } else {
      this.isActive = false;
    }
  }
  
  next();
});

DestinationSchema.post('save', function(this: IDestination) {
  logger.debug('Destination saved', {
    destinationId: this._id,
    clientId: this.clientId,
    type: this.type,
    identifier: this.identifier,
    isActive: this.isActive,
    hasConsent: this.consent.granted
  });
});

/**
 * Indexes
 */
DestinationSchema.index({ clientId: 1, identifier: 1 }, { unique: true });
DestinationSchema.index({ clientId: 1, isActive: 1 });
DestinationSchema.index({ type: 1, isActive: 1 });
DestinationSchema.index({ 'consent.granted': 1, isActive: 1 });
DestinationSchema.index({ createdAt: 1 });

// Compound index for active destinations with consent
DestinationSchema.index({ 
  clientId: 1, 
  isActive: 1, 
  'consent.granted': 1 
}, { name: 'active_destinations_idx' });

/**
 * Model interface for static methods
 */
interface IDestinationModel extends Model<IDestination> {
  findByClientId(clientId: mongoose.Types.ObjectId, activeOnly?: boolean): Promise<IDestination[]>;
  findByIdentifier(identifier: string, clientId?: mongoose.Types.ObjectId): Promise<IDestination | null>;
  createDestination(
    clientId: mongoose.Types.ObjectId,
    type: 'group' | 'contact',
    identifier: string,
    name: string,
    consentSource?: string,
    ipAddress?: string
  ): Promise<IDestination>;
  getDestinationStats(): Promise<any>;
  findInactiveDestinations(daysInactive?: number): Promise<IDestination[]>;
  bulkUpdateConsent(
    clientId: mongoose.Types.ObjectId,
    identifiers: string[],
    granted: boolean,
    source?: string,
    ipAddress?: string
  ): Promise<number>;
  findByType(type: 'group' | 'contact', clientId?: mongoose.Types.ObjectId): Promise<IDestination[]>;
}

/**
 * Export the Destination model
 */
export const Destination = mongoose.model<IDestination, IDestinationModel>('Destination', DestinationSchema);