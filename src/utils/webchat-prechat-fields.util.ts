import {
  DEFAULT_WEBCHAT_CONTACT_REASON_OPTIONS,
  type WebChatPrechatField,
  type WebChatWidgetAppearance,
} from '../types/webchat';

export function defaultPrechatFields(): WebChatPrechatField[] {
  return [
    {
      id: 'name',
      label: 'Nome',
      type: 'text',
      enabled: true,
      required: true,
      placeholder: 'Seu nome',
      preset: 'name',
    },
    {
      id: 'phone',
      label: 'WhatsApp',
      type: 'phone',
      enabled: true,
      required: true,
      placeholder: '(11) 99999-9999',
      preset: 'phone',
    },
    {
      id: 'contact_reason',
      label: 'Motivo do contato',
      type: 'select',
      enabled: true,
      required: true,
      options: [...DEFAULT_WEBCHAT_CONTACT_REASON_OPTIONS],
      preset: 'contact_reason',
    },
    {
      id: 'email',
      label: 'E-mail',
      type: 'email',
      enabled: false,
      required: false,
      placeholder: 'seu@email.com',
      preset: 'email',
    },
  ];
}

/** Converte flags legadas (askName, askPhone…) em lista de campos. */
export function prechatFieldsFromLegacyAppearance(
  appearance: Partial<WebChatWidgetAppearance>,
): WebChatPrechatField[] {
  const defaults = defaultPrechatFields();
  return defaults.map(field => {
    if (field.preset === 'name') {
      return { ...field, enabled: appearance.askName !== false };
    }
    if (field.preset === 'phone') {
      return { ...field, enabled: appearance.askPhone !== false };
    }
    if (field.preset === 'contact_reason') {
      return {
        ...field,
        enabled: appearance.askContactReason !== false,
        options:
          appearance.contactReasonOptions?.length
            ? appearance.contactReasonOptions
            : field.options,
      };
    }
    if (field.preset === 'email') {
      return { ...field, enabled: Boolean(appearance.askEmail), required: false };
    }
    return field;
  });
}

export function resolvePrechatFields(
  appearance?: Partial<WebChatWidgetAppearance> | null,
): WebChatPrechatField[] {
  if (!appearance) return defaultPrechatFields();
  if (appearance.prechatFields?.length) {
    return appearance.prechatFields.map(normalizePrechatField);
  }
  return prechatFieldsFromLegacyAppearance(appearance);
}

export function enabledPrechatFields(
  appearance?: Partial<WebChatWidgetAppearance> | null,
): WebChatPrechatField[] {
  return resolvePrechatFields(appearance).filter(f => f.enabled);
}

export function normalizePrechatField(field: WebChatPrechatField): WebChatPrechatField {
  const id = slugifyPrechatFieldId(field.id || field.label);
  const maxLength =
    field.maxLength && field.maxLength > 0
      ? Math.min(500, Math.round(field.maxLength))
      : undefined;
  return {
    id,
    label: (field.label || id).trim().slice(0, 80),
    type: field.type || 'text',
    enabled: field.enabled !== false,
    required: Boolean(field.required),
    placeholder: field.placeholder?.trim().slice(0, 120),
    maxLength:
      field.type === 'text' || field.type === 'textarea' ? maxLength : undefined,
    options:
      field.type === 'select'
        ? (field.options ?? []).map(o => o.trim()).filter(Boolean).slice(0, 20)
        : undefined,
    preset: field.preset,
  };
}

/** Formulário clássico: Nome + Telefone + Motivo (texto até 150 caracteres). */
export function classicPrechatFormAppearance(
  appearance: Partial<WebChatWidgetAppearance>,
): WebChatWidgetAppearance {
  const base = syncLegacyAppearanceFlags({
    ...(appearance as WebChatWidgetAppearance),
    prechatMode: 'form',
    prechatFields: [
      normalizePrechatField({
        id: 'name',
        label: 'Nome',
        type: 'text',
        enabled: true,
        required: true,
        placeholder: 'Seu nome completo',
        preset: 'name',
      }),
      normalizePrechatField({
        id: 'phone',
        label: 'Telefone',
        type: 'phone',
        enabled: true,
        required: true,
        placeholder: '(11) 99999-9999',
        preset: 'phone',
      }),
      normalizePrechatField({
        id: 'contact_reason',
        label: 'Motivo do contato',
        type: 'textarea',
        enabled: true,
        required: true,
        placeholder: 'Descreva brevemente o que você precisa',
        maxLength: 150,
        preset: 'contact_reason',
      }),
    ],
  });
  return base;
}

export function resolvePrechatMode(
  appearance?: Partial<WebChatWidgetAppearance> | null,
): 'steps' | 'form' {
  return appearance?.prechatMode === 'form' ? 'form' : 'steps';
}

export function slugifyPrechatFieldId(raw: string): string {
  const base = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return base || `campo_${Date.now().toString(36)}`;
}

export function syncLegacyAppearanceFlags(
  appearance: WebChatWidgetAppearance,
): WebChatWidgetAppearance {
  const fields = resolvePrechatFields(appearance);
  const byPreset = (preset: WebChatPrechatField['preset']) =>
    fields.find(f => f.preset === preset);

  const name = byPreset('name');
  const phone = byPreset('phone');
  const reason = byPreset('contact_reason');
  const email = byPreset('email');

  return {
    ...appearance,
    prechatFields: fields,
    prechatMode: resolvePrechatMode(appearance),
    askName: name?.enabled !== false,
    askPhone: phone?.enabled !== false,
    askContactReason: reason?.enabled !== false,
    askEmail: Boolean(email?.enabled),
    contactReasonOptions: reason?.options?.length
      ? reason.options
      : [...DEFAULT_WEBCHAT_CONTACT_REASON_OPTIONS],
  };
}

export type VisitorIntakePatch = {
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
  contactReason?: string;
  visitorIntake: Record<string, string>;
};

export function applyVisitorIntake(
  intake: Record<string, string | undefined>,
  appearance?: Partial<WebChatWidgetAppearance> | null,
): VisitorIntakePatch {
  const fields = resolvePrechatFields(appearance);
  const visitorIntake: Record<string, string> = {};

  for (const field of fields) {
    const raw = intake[field.id];
    if (raw?.trim()) visitorIntake[field.id] = raw.trim();
  }

  return {
    visitorName: visitorIntake.name,
    visitorEmail: visitorIntake.email,
    visitorPhone: visitorIntake.phone,
    contactReason: visitorIntake.contact_reason,
    visitorIntake,
  };
}

export function buildIntakeSystemNote(
  intake: Record<string, string | undefined>,
  appearance?: Partial<WebChatWidgetAppearance> | null,
  page?: { url?: string; title?: string },
): string | null {
  const fields = enabledPrechatFields(appearance);
  const lines: string[] = [];

  for (const field of fields) {
    const val = intake[field.id]?.trim();
    if (val) lines.push(`${field.label}: ${val}`);
  }

  if (page?.url?.trim()) {
    const pageLine = page.title?.trim()
      ? `${page.title.trim()} (${page.url.trim()})`
      : page.url.trim();
    lines.push(`Página: ${pageLine}`);
  }

  if (!lines.length) return null;
  return `📋 Dados do visitante\n${lines.join('\n')}`;
}

export function intakeForAiContext(
  intake: Record<string, string | undefined>,
  appearance?: Partial<WebChatWidgetAppearance> | null,
  page?: { url?: string; title?: string },
): {
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
  contactReason?: string;
  pageUrl?: string;
  pageTitle?: string;
  intakeSummary: string;
} {
  const patch = applyVisitorIntake(intake, appearance);
  const fields = enabledPrechatFields(appearance);
  const extra = fields
    .filter(f => !f.preset && intake[f.id]?.trim())
    .map(f => `${f.label}: ${intake[f.id]!.trim()}`);

  return {
    visitorName: patch.visitorName,
    visitorEmail: patch.visitorEmail,
    visitorPhone: patch.visitorPhone,
    contactReason: patch.contactReason,
    pageUrl: page?.url,
    pageTitle: page?.title,
    intakeSummary: extra.join('; '),
  };
}

export const WEBCHAT_PRECHAT_FIELD_TEMPLATES: Array<{
  label: string;
  type: WebChatPrechatField['type'];
  placeholder?: string;
  options?: string[];
}> = [
  { label: 'Número do pedido', type: 'text', placeholder: 'Ex.: 12345' },
  { label: 'Nota fiscal', type: 'text', placeholder: 'Ex.: 000123456' },
  { label: 'CPF / CNPJ', type: 'text', placeholder: 'Somente números' },
  { label: 'Empresa', type: 'text', placeholder: 'Nome da empresa' },
  { label: 'Cidade', type: 'text', placeholder: 'Sua cidade' },
  {
    label: 'Tipo de atendimento',
    type: 'select',
    options: ['Vendas', 'Suporte', 'Financeiro', 'Outro'],
  },
];
