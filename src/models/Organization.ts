import mongoose, { Schema, Document, Model } from 'mongoose';
import { createServiceLogger } from '@/utils/logger';
import type { CatalogSalesCompanyConfig } from '@/types/catalog-sales';
import { User } from './User';

const logger = createServiceLogger('OrganizationModel');

export interface IOrganization extends Document {
  ownerUserId: mongoose.Types.ObjectId;
  name: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  limits: {
    messagesPerDay: number;
    groupsMax: number;
    templatesMax: number;
  };
  usage: {
    messagesUsed: number;
    lastReset: Date;
  };
  planActivatedAt?: Date;
  planExpiresAt?: Date;
  stripeSubscriptionId?: string;
  /** Espelho opcional do status Stripe (past_due, unpaid, …). */
  stripeSubscriptionStatus?: string;
  stripePastDueAt?: Date;
  linkedGuildIds: string[];
  /** Permissões por papel definidas pelo dono (sobrescreve presets globais) */
  roleCapabilities?: Partial<Record<string, string[]>>;
  /** Papéis personalizados nomeados (quantos o cliente quiser) */
  customRoles?: Array<{
    id: string;
    name: string;
    description?: string;
    capabilities: string[];
  }>;
  phone?: string;
  email?: string;
  website?: string;
  taxId?: string;
  address?: string;
  /** Limites de envio WA por tipo (chat ao vivo, marketing, alertas) */
  whatsappSendPolicy?: {
    limitsDisabled?: boolean;
    humanizeEnabled?: boolean;
    composingEnabled?: boolean;
    allowMembersDisableCampaignProtection?: boolean;
    conversation?: { enabled?: boolean; maxPerMinute?: number };
    marketing?: { enabled?: boolean; maxPerMinute?: number };
    alert?: { enabled?: boolean; maxPerMinute?: number };
  };
  /** Políticas da equipe (perfil, confirmações) */
  teamSettings?: {
    /** Se true, atendentes podem editar nome/e-mail/WhatsApp no painel (sempre com OTP) */
    allowMembersEditOwnProfile?: boolean;
    /** Política do nome fantasia no WebChat — ver chat-display-name.service */
    chatDisplayNamePolicy?: 'owner_only' | 'self_service' | 'approval_required';
  };
  /** Carteira IA — créditos comprados e uso de aprendizagem no ciclo mensal. */
  aiWallet?: {
    purchasedCredits: number;
    learningOpsUsed: number;
    periodStart: Date;
  };
  /** Pedidos via IA/catálogo com PIX e conferência humana */
  catalogSales?: CatalogSalesCompanyConfig;
  /** Tipo de comércio — preset onboarding */
  businessVertical?: import('@/types/business-vertical').BusinessVerticalId;
  businessVerticalAppliedAt?: Date;
  /** Integração Discord → WhatsApp */
  discordSettings?: {
    /** Simulação: avalia regras e grava histórico sem enviar ao WhatsApp */
    dryRun?: boolean;
    /** Aplica até 5 regras que batem; padrão só a de maior prioridade */
    multiRulePerMessage?: boolean;
    /** Aceita POST /api/integrations/discord/inbound/* com X-API-Key */
    inboundEnabled?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;

  canSendMessage(): boolean;
  incrementUsage(): Promise<void>;
  resetDailyUsage(): Promise<void>;
  upgradePlan(newPlan: IOrganization['plan']): Promise<void>;
  linkGuild(guildId: string): Promise<void>;
}

const OrganizationSchema = new Schema<IOrganization>({
  ownerUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  plan: {
    type: String,
    enum: ['free', 'starter', 'pro', 'enterprise'],
    default: 'free',
    index: true,
  },
  limits: {
    messagesPerDay: { type: Number, required: true, default: 10 },
    groupsMax: { type: Number, required: true, default: 2 },
    templatesMax: { type: Number, required: true, default: 2 },
  },
  usage: {
    messagesUsed: { type: Number, default: 0, min: 0 },
    lastReset: { type: Date, default: Date.now },
  },
  planActivatedAt: Date,
  planExpiresAt: { type: Date, index: true },
  stripeSubscriptionId: { type: String, index: true, sparse: true },
  stripeSubscriptionStatus: { type: String, maxlength: 32 },
  stripePastDueAt: Date,
  linkedGuildIds: { type: [String], default: [], index: true },
  roleCapabilities: { type: Schema.Types.Mixed, default: {} },
  customRoles: {
    type: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true, maxlength: 80 },
        description: { type: String, maxlength: 300 },
        capabilities: { type: [String], default: [] },
      },
    ],
    default: [],
  },
  phone: { type: String, trim: true, maxlength: 32 },
  email: { type: String, trim: true, maxlength: 120 },
  website: { type: String, trim: true, maxlength: 200 },
  taxId: { type: String, trim: true, maxlength: 20 },
  address: { type: String, trim: true, maxlength: 240 },
  whatsappSendPolicy: {
    type: Schema.Types.Mixed,
    default: undefined,
  },
  teamSettings: {
    type: {
      allowMembersEditOwnProfile: { type: Boolean, default: false },
      chatDisplayNamePolicy: {
        type: String,
        enum: ['owner_only', 'self_service', 'approval_required'],
        default: 'self_service',
      },
    },
    default: () => ({ allowMembersEditOwnProfile: false, chatDisplayNamePolicy: 'self_service' }),
  },
  aiWallet: {
    type: {
      purchasedCredits: { type: Number, default: 0, min: 0 },
      learningOpsUsed: { type: Number, default: 0, min: 0 },
      periodStart: { type: Date, default: Date.now },
    },
    default: () => ({
      purchasedCredits: 0,
      learningOpsUsed: 0,
      periodStart: new Date(),
    }),
  },
  discordSettings: {
    type: {
      dryRun: { type: Boolean, default: false },
      multiRulePerMessage: { type: Boolean, default: false },
      inboundEnabled: { type: Boolean, default: false },
    },
    default: () => ({ dryRun: false, multiRulePerMessage: false, inboundEnabled: false }),
  },
  catalogSales: { type: Schema.Types.Mixed, default: undefined },
  businessVertical: {
    type: String,
    enum: [
      'varejo_fisico',
      'ecommerce',
      'restaurante',
      'clinica',
      'escritorio',
      'imobiliaria',
      'beleza',
      'auto_center',
      'educacao',
      'servicos',
      'outro',
    ],
    index: true,
    sparse: true,
  },
  businessVerticalAppliedAt: { type: Date },
}, {
  timestamps: true,
  collection: 'organizations',
});

OrganizationSchema.methods.canSendMessage = function(this: IOrganization): boolean {
  const now = new Date();
  if (
    this.plan !== 'free' &&
    this.planExpiresAt &&
    this.planExpiresAt.getTime() <= now.getTime()
  ) {
    return false;
  }
  const lastReset = new Date(this.usage.lastReset);
  const daysSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceReset >= 1) {
    this.usage.messagesUsed = 0;
    this.usage.lastReset = now;
    this.save().catch(err => logger.error('Failed to reset org usage', err));
  }
  return this.limits.messagesPerDay === -1 || this.usage.messagesUsed < this.limits.messagesPerDay;
};

OrganizationSchema.methods.incrementUsage = async function(this: IOrganization): Promise<void> {
  if (this.limits.messagesPerDay === -1) return;
  this.usage.messagesUsed += 1;
  await this.save();
};

OrganizationSchema.methods.resetDailyUsage = async function(this: IOrganization): Promise<void> {
  this.usage.messagesUsed = 0;
  this.usage.lastReset = new Date();
  await this.save();
};

OrganizationSchema.methods.upgradePlan = async function(this: IOrganization, newPlan: IOrganization['plan']): Promise<void> {
  this.plan = newPlan;
  const limits = User.getPlanLimits(newPlan);
  this.limits.messagesPerDay = limits.messagesPerDay;
  this.limits.groupsMax = limits.groupsMax;
  this.limits.templatesMax = limits.templatesMax;
  await this.save();
};

OrganizationSchema.methods.linkGuild = async function(this: IOrganization, guildId: string): Promise<void> {
  if (!this.linkedGuildIds.includes(guildId)) {
    this.linkedGuildIds.push(guildId);
    await this.save();
  }
};

OrganizationSchema.pre('save', function(this: IOrganization, next) {
  if (this.isModified('plan')) {
    const limits = User.getPlanLimits(this.plan);
    this.limits.messagesPerDay = limits.messagesPerDay;
    this.limits.groupsMax = limits.groupsMax;
    this.limits.templatesMax = limits.templatesMax;
  }
  next();
});

interface IOrganizationModel extends Model<IOrganization> {
  findByOwner(userId: mongoose.Types.ObjectId | string): Promise<IOrganization | null>;
}

OrganizationSchema.statics.findByOwner = function(userId: mongoose.Types.ObjectId | string) {
  return this.findOne({ ownerUserId: userId });
};

export const Organization = mongoose.model<IOrganization, IOrganizationModel>(
  'Organization',
  OrganizationSchema,
);
