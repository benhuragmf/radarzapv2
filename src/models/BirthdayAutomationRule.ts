import mongoose, { Schema, Document, Model } from 'mongoose';
import type {
  PlatformAutomationDestinationScope,
  PlatformAutomationMessageMode,
  PlatformAutomationTriggerType,
} from '@/constants/platform-automation-triggers';

/** @deprecated use PlatformAutomationTriggerType */
export type BirthdayTriggerType = PlatformAutomationTriggerType;

export interface IBirthdayAutomationRule extends Document {
  organizationId: mongoose.Types.ObjectId;
  /** Nome exibido no painel */
  name: string;
  templateName: string;
  triggerType: PlatformAutomationTriggerType;
  /** 1–31 — aniversariantes do dia N OU dia fixo do calendário (calendar_day_of_month) */
  dayOfMonth?: number;
  /** Ex.: 6 = reenviar só se passaram ≥6 meses desde birthdayLastSentAt */
  intervalMonths?: number;
  /** 1–23 — nth_business_day_of_month (ex.: 5 = 5º dia útil) */
  nthBusinessDay?: number;
  /** 1=seg … 7=dom — weekly (legado, um dia) */
  weekday?: number;
  /** 1=seg … 7=dom — weekly (vários dias) */
  weekdays?: number[];
  /** Envio único — once_at */
  scheduledAt?: Date;
  sendTime: string;
  active: boolean;
  /** contacts | whatsapp_groups | both */
  destinationScope?: PlatformAutomationDestinationScope;
  /** Grupos de contato (Destination.contactGroupIds) */
  contactGroupIds?: mongoose.Types.ObjectId[];
  /** Destinos type=group (grupos WhatsApp) */
  whatsappDestinationIds?: mongoose.Types.ObjectId[];
  /** platform_template | plain */
  messageMode?: PlatformAutomationMessageMode;
  /** Texto completo quando messageMode=plain */
  customMessage?: string;
  /** Tags do contato — vazio = todos (legado) */
  destinationFilterTags?: string[];
  mensagemExtra?: string;
  /** Chave da última ocorrência enfileirada (rec:YYYY-MM-DD ou once:ISO-minuto) */
  lastRunDate?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BirthdayAutomationRuleSchema = new Schema<IBirthdayAutomationRule>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Organization',
      index: true,
    },
    name: {
      type: String,
      required: true,
      default: 'Automação',
      trim: true,
      maxlength: 120,
    },
    templateName: {
      type: String,
      required: true,
      default: 'pw-aniversario',
      trim: true,
    },
    triggerType: {
      type: String,
      enum: [
        'on_contact_birthday',
        'day_of_month',
        'interval_months',
        'calendar_day_of_month',
        'nth_business_day_of_month',
        'weekly',
        'once_at',
      ],
      default: 'on_contact_birthday',
      required: true,
    },
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 31,
    },
    intervalMonths: {
      type: Number,
      min: 1,
      max: 120,
    },
    nthBusinessDay: {
      type: Number,
      min: 1,
      max: 23,
    },
    weekday: {
      type: Number,
      min: 1,
      max: 7,
    },
    weekdays: {
      type: [Number],
      default: undefined,
    },
    scheduledAt: {
      type: Date,
    },
    sendTime: {
      type: String,
      required: true,
      default: '09:00',
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    destinationScope: {
      type: String,
      enum: ['contacts', 'whatsapp_groups', 'both'],
      default: 'contacts',
    },
    contactGroupIds: {
      type: [Schema.Types.ObjectId],
      default: undefined,
    },
    whatsappDestinationIds: {
      type: [Schema.Types.ObjectId],
      default: undefined,
    },
    messageMode: {
      type: String,
      enum: ['platform_template', 'plain'],
      default: 'platform_template',
    },
    customMessage: {
      type: String,
      maxlength: 4000,
      trim: true,
    },
    destinationFilterTags: {
      type: [String],
      default: undefined,
    },
    mensagemExtra: {
      type: String,
      maxlength: 2000,
      trim: true,
    },
    lastRunDate: {
      type: String,
      trim: true,
      maxlength: 32,
    },
  },
  {
    timestamps: true,
    collection: 'birthdayAutomationRules',
  },
);

BirthdayAutomationRuleSchema.index(
  { organizationId: 1, active: 1 },
  { name: 'org_active_birthday_rules' },
);

export const BirthdayAutomationRule = mongoose.model<IBirthdayAutomationRule>(
  'BirthdayAutomationRule',
  BirthdayAutomationRuleSchema,
);
