export type LeadCaptureStatus =
  | 'new'
  | 'in_review'
  | 'in_progress'
  | 'converted'
  | 'lost';

export const LEAD_CAPTURE_STATUSES: LeadCaptureStatus[] = [
  'new',
  'in_review',
  'in_progress',
  'converted',
  'lost',
];

export const LEAD_CAPTURE_STATUS_LABEL: Record<LeadCaptureStatus, string> = {
  new: 'Novo',
  in_review: 'Em análise',
  in_progress: 'Em atendimento',
  converted: 'Convertido',
  lost: 'Perdido',
};

export interface LeadFormCustomField {
  id: string;
  label: string;
  type: 'text' | 'textarea';
  required: boolean;
  placeholder?: string;
}

export interface LeadFormAppearance {
  title: string;
  description: string;
  buttonText: string;
  successMessage: string;
  primaryColor: string;
  askEmail: boolean;
  requireEmail: boolean;
  askMessage: boolean;
  requireMessage: boolean;
  customFields?: LeadFormCustomField[];
}

export const DEFAULT_LEAD_FORM_APPEARANCE: LeadFormAppearance = {
  title: 'Fale conosco',
  description: 'Preencha seus dados e entraremos em contato.',
  buttonText: 'Enviar',
  successMessage: 'Obrigado! Recebemos seus dados. Em breve entraremos em contato.',
  primaryColor: '#25D366',
  askEmail: true,
  requireEmail: false,
  askMessage: true,
  requireMessage: false,
  customFields: [],
};

export interface LeadFormPublicConfig {
  publicKey: string;
  title: string;
  description: string;
  buttonText: string;
  successMessage: string;
  primaryColor: string;
  askEmail: boolean;
  requireEmail: boolean;
  askMessage: boolean;
  requireMessage: boolean;
  customFields?: LeadFormCustomField[];
  redirectUrl?: string;
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
  status: LeadCaptureStatus;
  internalNotes?: string;
  destinationId?: string;
  inboxConversationId?: string;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}
