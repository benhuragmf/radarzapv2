/** Tipo da linha telefônica principal (VCF TYPE / import CSV) */
export type ContactPhoneType = 'whatsapp' | 'cell' | 'home' | 'work' | 'other';

export const CONTACT_PHONE_TYPES: ContactPhoneType[] = [
  'whatsapp',
  'cell',
  'home',
  'work',
  'other',
];

export const CONTACT_PHONE_TYPE_LABELS: Record<ContactPhoneType, string> = {
  whatsapp: 'WhatsApp',
  cell: 'Celular',
  home: 'Residencial',
  work: 'Trabalho',
  other: 'Outro',
};

export function normalizeContactPhoneType(raw: string | undefined): ContactPhoneType | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim().toLowerCase().replace(/\s+/g, '_');
  if (s.includes('whatsapp') || s === 'wa') return 'whatsapp';
  if (s.includes('cell') || s.includes('mobile') || s.includes('celular') || s === 'iphone') {
    return 'cell';
  }
  if (s.includes('home') || s.includes('resid')) return 'home';
  if (s.includes('work') || s.includes('trabalho')) return 'work';
  if (CONTACT_PHONE_TYPES.includes(s as ContactPhoneType)) return s as ContactPhoneType;
  return 'other';
}

export function phoneTypeFromVcfTypes(types: string[]): ContactPhoneType {
  const t = types.join(' ').toLowerCase();
  if (t.includes('whatsapp') || t.includes('x-whatsapp')) return 'whatsapp';
  if (t.includes('cell') || t.includes('mobile') || t.includes('iphone')) return 'cell';
  if (t.includes('home')) return 'home';
  if (t.includes('work')) return 'work';
  return 'other';
}
