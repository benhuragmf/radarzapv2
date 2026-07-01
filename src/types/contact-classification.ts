/** Classificação unificada de contatos — envio, atendimento, funil e LGPD. */

export const CONTACT_KINDS = [
  'lead',
  'client',
  'prospect',
  'partner',
  'internal',
  'blocked',
] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export const CONTACT_ORIGINS = [
  'whatsapp',
  'webchat',
  'form',
  'manual',
  'csv',
  'wa_group',
  'api',
  'campaign',
] as const;
export type ContactOrigin = (typeof CONTACT_ORIGINS)[number];

/** Permissão de envio (LGPD / opt-in) — derivada de consentStatus + contexto. */
export const SEND_PERMISSIONS = [
  'opt_in_accepted',
  'pending',
  'no_consent',
  'opt_out',
  'blocked',
] as const;
export type SendPermission = (typeof SEND_PERMISSIONS)[number];

export const COMMERCIAL_STATUSES = [
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
] as const;
export type CommercialStatus = (typeof COMMERCIAL_STATUSES)[number];

export const CONTACT_TEMPERATURES = [
  'cold',
  'warm',
  'hot',
  'vip',
  'risk',
] as const;
export type ContactTemperature = (typeof CONTACT_TEMPERATURES)[number];

export const PHONE_QUALITIES = [
  'verified',
  'attention',
  'invalid',
  'no_whatsapp',
  'duplicate',
  'incomplete',
  'international',
  'suspicious',
] as const;
export type PhoneQuality = (typeof PHONE_QUALITIES)[number];

export interface ContactClassification {
  kind: ContactKind;
  origin: ContactOrigin;
  permission: SendPermission;
  commercialStatus: CommercialStatus;
  temperature: ContactTemperature;
  phoneQuality: PhoneQuality;
  /** Motivo legível quando não pode enviar campanha. */
  sendBlockReason?: string;
  /** Pode aparecer na seleção de campanha (regra atual + classificação). */
  campaignSelectable: boolean;
}

export interface DestinationClassificationInput {
  _id: string;
  type: 'contact' | 'group';
  identifier: string;
  name: string;
  consentStatus?: string;
  consent?: { granted?: boolean; source?: string };
  pendingOutboundCount?: number;
  tags?: string[];
  phoneType?: string;
  hasProfilePicture?: boolean;
  lastMessageSent?: Date | string;
  createdAt?: Date | string;
  contactKind?: ContactKind;
  contactOrigin?: ContactOrigin;
  commercialStatus?: CommercialStatus;
  temperature?: ContactTemperature;
  phoneQuality?: PhoneQuality;
  waRegistrationStatus?: string;
}

export interface LeadClassificationHint {
  status?: string;
  temperature?: string;
  origin?: string;
  converted?: boolean;
}

/** Totais agregados para relatório e dashboard de classificação CRM. */
export interface DestinationClassificationStats {
  totalContacts: number;
  campaignSelectable: number;
  campaignBlocked: number;
  backfillPending: number;
  smartSegments: Array<{
    id: string;
    label: string;
    description: string;
    count: number;
  }>;
  byKind: Record<string, number>;
  byPermission: Record<string, number>;
  byOrigin: Record<string, number>;
  byTemperature: Record<string, number>;
  byCommercialStatus: Record<string, number>;
  byPhoneQuality: Record<string, number>;
}
