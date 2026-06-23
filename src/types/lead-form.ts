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
  createdAt: string;
  updatedAt: string;
}
