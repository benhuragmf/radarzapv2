import mongoose, { Schema, Document, Model } from 'mongoose';
import type { PlatformAutomationTriggerType } from '@/constants/platform-automation-triggers';

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
  /** 1=seg … 7=dom — weekly */
  weekday?: number;
  sendTime: string;
  active: boolean;
  /** Tags do contato — vazio = todos com birthday */
  destinationFilterTags?: string[];
  mensagemExtra?: string;
  /** YYYY-MM-DD — última execução do lote diário */
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
      maxlength: 10,
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
