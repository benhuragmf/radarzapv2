/** Política de cadastro inbound — canais com conversa (WhatsApp / WebChat). */
export type InboundChannelRegistrationMode =
  | 'contact'
  | 'lead'
  | 'both'
  | 'pending'
  | 'conversation_only';

/** Política de cadastro para formulários públicos. */
export type InboundFormRegistrationMode = 'lead' | 'contact' | 'both' | 'pending';

/** Retorno de cliente já conhecido (nova conversa / nova sessão). */
export type InboundReturnRegistrationMode =
  | 'return_lead'
  | 'existing_contact'
  | 'conversation_only';

export type CrmRegistrationStatus = 'approved' | 'pending' | 'inbox_only';

export interface InboundRegistrationPolicy {
  whatsapp: InboundChannelRegistrationMode;
  webchat: InboundChannelRegistrationMode;
  form: InboundFormRegistrationMode;
  returnCustomer: InboundReturnRegistrationMode;
}

export interface InboundRegistrationActions {
  /** Cria ou atualiza registro técnico em Destination (Inbox / envio WA). */
  createTechnicalContact: boolean;
  /** Contato visível na base CRM (/contact). */
  createCrmContact: boolean;
  crmStatus: CrmRegistrationStatus;
  /** LeadCapture automático (quando elegível). */
  createLead: boolean;
  /** Segmento sistema Atendimento (WhatsApp). */
  tagAtendimento: boolean;
}

export const INBOUND_CHANNEL_MODES: InboundChannelRegistrationMode[] = [
  'contact',
  'lead',
  'both',
  'pending',
  'conversation_only',
];

export const INBOUND_FORM_MODES: InboundFormRegistrationMode[] = [
  'lead',
  'contact',
  'both',
  'pending',
];

export const INBOUND_RETURN_MODES: InboundReturnRegistrationMode[] = [
  'return_lead',
  'existing_contact',
  'conversation_only',
];

/** Espelha o comportamento pré-2.14.0 por padrão. */
export const DEFAULT_INBOUND_REGISTRATION_POLICY: InboundRegistrationPolicy = {
  whatsapp: 'both',
  webchat: 'lead',
  form: 'both',
  returnCustomer: 'return_lead',
};

export function normalizeInboundRegistrationPolicy(
  raw?: Partial<InboundRegistrationPolicy> | null,
): InboundRegistrationPolicy {
  const pickChannel = (v: unknown): InboundChannelRegistrationMode =>
    INBOUND_CHANNEL_MODES.includes(v as InboundChannelRegistrationMode)
      ? (v as InboundChannelRegistrationMode)
      : DEFAULT_INBOUND_REGISTRATION_POLICY.whatsapp;

  const pickForm = (v: unknown): InboundFormRegistrationMode =>
    INBOUND_FORM_MODES.includes(v as InboundFormRegistrationMode)
      ? (v as InboundFormRegistrationMode)
      : DEFAULT_INBOUND_REGISTRATION_POLICY.form;

  const pickReturn = (v: unknown): InboundReturnRegistrationMode =>
    INBOUND_RETURN_MODES.includes(v as InboundReturnRegistrationMode)
      ? (v as InboundReturnRegistrationMode)
      : DEFAULT_INBOUND_REGISTRATION_POLICY.returnCustomer;

  return {
    whatsapp: pickChannel(raw?.whatsapp ?? DEFAULT_INBOUND_REGISTRATION_POLICY.whatsapp),
    webchat: pickChannel(raw?.webchat ?? DEFAULT_INBOUND_REGISTRATION_POLICY.webchat),
    form: pickForm(raw?.form ?? DEFAULT_INBOUND_REGISTRATION_POLICY.form),
    returnCustomer: pickReturn(
      raw?.returnCustomer ?? DEFAULT_INBOUND_REGISTRATION_POLICY.returnCustomer,
    ),
  };
}

function channelModeToActions(mode: InboundChannelRegistrationMode): InboundRegistrationActions {
  switch (mode) {
    case 'contact':
      return {
        createTechnicalContact: true,
        createCrmContact: true,
        crmStatus: 'approved',
        createLead: false,
        tagAtendimento: true,
      };
    case 'lead':
      return {
        createTechnicalContact: true,
        createCrmContact: false,
        crmStatus: 'inbox_only',
        createLead: true,
        tagAtendimento: false,
      };
    case 'both':
      return {
        createTechnicalContact: true,
        createCrmContact: true,
        crmStatus: 'approved',
        createLead: true,
        tagAtendimento: true,
      };
    case 'pending':
      return {
        createTechnicalContact: true,
        createCrmContact: true,
        crmStatus: 'pending',
        createLead: false,
        tagAtendimento: false,
      };
    case 'conversation_only':
      return {
        createTechnicalContact: true,
        createCrmContact: false,
        crmStatus: 'inbox_only',
        createLead: false,
        tagAtendimento: false,
      };
    default:
      return channelModeToActions('both');
  }
}

export function resolveChannelRegistration(
  policy: InboundRegistrationPolicy,
  channel: 'whatsapp' | 'webchat',
  ctx: { isReturn: boolean },
): InboundRegistrationActions {
  if (ctx.isReturn) {
    switch (policy.returnCustomer) {
      case 'return_lead':
        return {
          createTechnicalContact: true,
          createCrmContact: false,
          crmStatus: 'inbox_only',
          createLead: true,
          tagAtendimento: false,
        };
      case 'existing_contact':
        return {
          createTechnicalContact: true,
          createCrmContact: false,
          crmStatus: 'inbox_only',
          createLead: false,
          tagAtendimento: false,
        };
      case 'conversation_only':
        return {
          createTechnicalContact: true,
          createCrmContact: false,
          crmStatus: 'inbox_only',
          createLead: false,
          tagAtendimento: false,
        };
      default:
        return channelModeToActions(policy[channel]);
    }
  }
  return channelModeToActions(policy[channel]);
}

export function resolveFormRegistration(
  policy: InboundRegistrationPolicy,
): Pick<InboundRegistrationActions, 'createCrmContact' | 'crmStatus' | 'createLead'> {
  switch (policy.form) {
    case 'lead':
      return { createCrmContact: false, crmStatus: 'inbox_only', createLead: true };
    case 'contact':
      return { createCrmContact: true, crmStatus: 'approved', createLead: false };
    case 'both':
      return { createCrmContact: true, crmStatus: 'approved', createLead: true };
    case 'pending':
      return { createCrmContact: true, crmStatus: 'pending', createLead: true };
    default:
      return { createCrmContact: true, crmStatus: 'approved', createLead: true };
  }
}

/** Atendimento manual / captura pelo operador — contato aprovado direto. */
export function resolveManualRegistration(): InboundRegistrationActions {
  return {
    createTechnicalContact: true,
    createCrmContact: true,
    crmStatus: 'approved',
    createLead: true,
    tagAtendimento: false,
  };
}
