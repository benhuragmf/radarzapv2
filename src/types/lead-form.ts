export type LeadCaptureStatus =
  | 'new'
  | 'in_review'
  | 'in_progress'
  | 'qualified'
  | 'converted'
  | 'lost'
  | 'spam';

export const LEAD_CAPTURE_STATUSES: LeadCaptureStatus[] = [
  'new',
  'in_review',
  'in_progress',
  'qualified',
  'converted',
  'lost',
  'spam',
];

export const LEAD_CAPTURE_STATUS_LABEL: Record<LeadCaptureStatus, string> = {
  new: 'Novo',
  in_review: 'Em análise',
  in_progress: 'Em atendimento',
  qualified: 'Qualificado',
  converted: 'Convertido',
  lost: 'Perdido',
  spam: 'Spam',
};

export const LEAD_CAPTURE_STATUS_VARIANT: Record<
  LeadCaptureStatus,
  'gray' | 'blue' | 'yellow' | 'green' | 'red' | 'purple'
> = {
  new: 'blue',
  in_review: 'yellow',
  in_progress: 'purple',
  qualified: 'green',
  converted: 'green',
  lost: 'gray',
  spam: 'red',
};

export type LeadCaptureOrigin =
  | 'site'
  | 'widget'
  | 'wordpress'
  | 'api'
  | 'whatsapp'
  | 'webchat'
  | 'manual'
  | 'import'
  | 'campaign';

export const LEAD_CAPTURE_ORIGINS: LeadCaptureOrigin[] = [
  'site',
  'widget',
  'wordpress',
  'api',
  'whatsapp',
  'webchat',
  'manual',
  'import',
  'campaign',
];

export const LEAD_CAPTURE_ORIGIN_LABEL: Record<LeadCaptureOrigin, string> = {
  site: 'Site',
  widget: 'Widget embed',
  wordpress: 'WordPress',
  api: 'API',
  whatsapp: 'WhatsApp',
  webchat: 'Chat do site',
  manual: 'Manual',
  import: 'Importação',
  campaign: 'Campanha',
};

export type LeadFormCustomFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'select'
  | 'checkbox'
  | 'hidden';

export interface LeadFormCustomField {
  id: string;
  label: string;
  type: LeadFormCustomFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export type LeadFormTheme = 'auto' | 'light' | 'dark';
export type LeadFormSize = 'compact' | 'default' | 'wide';

export type LeadContactMode = 'always' | 'qualify' | 'never';

export interface LeadFormAppearance {
  title: string;
  description: string;
  buttonText: string;
  successMessage: string;
  primaryColor: string;
  theme: LeadFormTheme;
  size: LeadFormSize;
  borderRadius: number;
  showLogo: boolean;
  askEmail: boolean;
  requireEmail: boolean;
  askMessage: boolean;
  requireMessage: boolean;
  customFields?: LeadFormCustomField[];
  requireConsent: boolean;
  consentText: string;
  consentPolicyUrl?: string;
  honeypot: boolean;
}

export interface LeadFormRouting {
  initialStatus: LeadCaptureStatus;
  defaultContactGroupIds: string[];
  defaultTags: string[];
  defaultAssigneeId?: string;
  contactMode: LeadContactMode;
  autoOpenInbox: boolean;
  autoOpenInboxWhenOnline: boolean;
}

export const DEFAULT_LEAD_FORM_ROUTING: LeadFormRouting = {
  initialStatus: 'new',
  defaultContactGroupIds: [],
  defaultTags: [],
  contactMode: 'always',
  autoOpenInbox: false,
  autoOpenInboxWhenOnline: false,
};

export const DEFAULT_LEAD_FORM_APPEARANCE: LeadFormAppearance = {
  title: 'Fale conosco',
  description: 'Preencha seus dados e entraremos em contato.',
  buttonText: 'Enviar',
  successMessage: 'Obrigado! Recebemos seus dados. Em breve entraremos em contato.',
  primaryColor: '#25D366',
  theme: 'auto',
  size: 'default',
  borderRadius: 8,
  showLogo: false,
  askEmail: true,
  requireEmail: false,
  askMessage: true,
  requireMessage: false,
  customFields: [],
  requireConsent: false,
  consentText: 'Concordo em ser contatado e com o tratamento dos meus dados conforme a política de privacidade.',
  honeypot: true,
};

export interface LeadFormPublicConfig {
  publicKey: string;
  title: string;
  description: string;
  buttonText: string;
  successMessage: string;
  primaryColor: string;
  theme: LeadFormTheme;
  size: LeadFormSize;
  borderRadius: number;
  showLogo: boolean;
  askEmail: boolean;
  requireEmail: boolean;
  askMessage: boolean;
  requireMessage: boolean;
  customFields?: LeadFormCustomField[];
  requireConsent: boolean;
  consentText: string;
  consentPolicyUrl?: string;
  honeypot: boolean;
  redirectUrl?: string;
}

export interface LeadUtm {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

export type LeadHistoryKind =
  | 'captured'
  | 'status_changed'
  | 'linked_contact'
  | 'converted'
  | 'sent_to_inbox'
  | 'added_to_list'
  | 'note';

export interface LeadHistoryEntry {
  at: string;
  kind: LeadHistoryKind;
  message: string;
  userId?: string;
  meta?: Record<string, string>;
}

export interface LeadDuplicateHint {
  kind: 'contact' | 'lead';
  id: string;
  name?: string;
  phone?: string;
  email?: string;
}

export interface LeadCaptureListItem {
  id: string;
  formId: string;
  formName: string;
  name: string;
  phone: string;
  email?: string;
  message?: string;
  sourceUrl?: string;
  pageTitle?: string;
  origin: LeadCaptureOrigin;
  status: LeadCaptureStatus;
  internalNotes?: string;
  destinationId?: string;
  inboxConversationId?: string;
  contactGroupIds?: string[];
  contactGroupNames?: string[];
  assignedUserId?: string;
  assignedUserName?: string;
  metadata?: Record<string, string>;
  utm?: LeadUtm;
  consentAccepted?: boolean;
  consentAcceptedAt?: string;
  possibleDuplicate?: boolean;
  duplicateHints?: LeadDuplicateHint[];
  history?: LeadHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface LeadStats {
  total: number;
  newToday: number;
  inProgress: number;
  converted: number;
  lost: number;
  topOrigin: LeadCaptureOrigin | null;
  topOriginCount: number;
  byStatus: Record<LeadCaptureStatus, number>;
  funnel: { status: LeadCaptureStatus; count: number; label: string }[];
}

export interface LeadFormListItem {
  id: string;
  name: string;
  publicKey: string;
  active: boolean;
  allowedDomains: string[];
  appearance: LeadFormAppearance;
  routing: LeadFormRouting;
  redirectUrl?: string;
  captureCount: number;
  captureCount7d: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeadSegmentSummary {
  id: string;
  name: string;
  leadCount: number;
  convertedCount: number;
  conversionRate: number;
}
