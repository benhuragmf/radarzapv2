/**
 * Perfis e aliases de colunas para importação/exportação CSV de contatos.
 * Spec: docs/CONTATOS-CSV-IMPORTACAO.md
 */

export type ContactCsvProfile = 'radarchat' | 'google' | 'apple' | 'generic';

export const MAX_CSV_IMPORT_ROWS = 5000;

/** Chaves do modelo canônico interno */
export type CanonicalContactField =
  | 'nome'
  | 'telefone'
  | 'aniversario'
  | 'grupos'
  | 'email'
  | 'notas'
  | 'empresa'
  | 'telefoneSecundario'
  | 'tipoTelefone';

/** Aliases globais (qualquer perfil) → campo canônico */
export const GLOBAL_COLUMN_ALIASES: Record<string, CanonicalContactField> = {
  nome: 'nome',
  name: 'nome',
  'full name': 'nome',
  'display name': 'nome',
  telefone: 'telefone',
  phone: 'telefone',
  mobile: 'telefone',
  celular: 'telefone',
  aniversario: 'aniversario',
  aniversário: 'aniversario',
  birthday: 'aniversario',
  grupos: 'grupos',
  groups: 'grupos',
  group: 'grupos',
  tags: 'grupos',
  category: 'grupos',
  email: 'email',
  'e-mail': 'email',
  notas: 'notas',
  notes: 'notas',
  note: 'notas',
  empresa: 'empresa',
  organization: 'empresa',
  organizacao: 'empresa',
  organização: 'empresa',
  org: 'empresa',
  company: 'empresa',
  telefone_secundario: 'telefoneSecundario',
  'telefone secundario': 'telefoneSecundario',
  'telefone secundário': 'telefoneSecundario',
  secondary_phone: 'telefoneSecundario',
  'phone 2': 'telefoneSecundario',
  'phone 2 - value': 'telefoneSecundario',
  tipo_telefone: 'tipoTelefone',
  'tipo telefone': 'tipoTelefone',
  phone_type: 'tipoTelefone',
  'phone 1 - type': 'tipoTelefone',
};

/** Colunas específicas por perfil (header normalizado → campo canônico) */
export const PROFILE_COLUMN_MAP: Record<ContactCsvProfile, Record<string, CanonicalContactField>> = {
  radarchat: {
    ...GLOBAL_COLUMN_ALIASES,
  },
  google: {
    name: 'nome',
    'given name': 'nome',
    'family name': 'nome',
    'phone 1 - value': 'telefone',
    'phone 2 - value': 'telefoneSecundario',
    'phone 3 - value': 'telefone',
    'phone 4 - value': 'telefone',
    birthday: 'aniversario',
    'group membership': 'grupos',
    'e-mail 1 - value': 'email',
    'e-mail 2 - value': 'email',
    notes: 'notas',
  },
  apple: {
    'first name': 'nome',
    'middle name': 'nome',
    'last name': 'nome',
    'full name': 'nome',
    name: 'nome',
    'mobile phone': 'telefone',
    iphone: 'telefone',
    'home phone': 'telefone',
    'work phone': 'telefone',
    phone: 'telefone',
    birthday: 'aniversario',
    'email address': 'email',
    email: 'email',
    notes: 'notas',
    groups: 'grupos',
    group: 'grupos',
    category: 'grupos',
  },
  generic: {
    ...GLOBAL_COLUMN_ALIASES,
    'first name': 'nome',
    'last name': 'nome',
    firstname: 'nome',
    lastname: 'nome',
    'mobile phone': 'telefone',
    telefone: 'telefone',
  },
};

/** Fingerprint: header normalizado presente no arquivo */
export const PROFILE_FINGERPRINTS: Record<ContactCsvProfile, string[][]> = {
  radarchat: [
    ['nome', 'telefone'],
    ['name', 'phone'],
  ],
  google: [
    ['phone 1 - value'],
    ['group membership', 'given name'],
    ['group membership', 'name'],
  ],
  apple: [
    ['first name', 'mobile phone'],
    ['first name', 'home phone'],
    ['first name', 'phone'],
  ],
  generic: [],
};

/** Ordem de detecção automática */
export const PROFILE_DETECTION_ORDER: ContactCsvProfile[] = [
  'radarchat',
  'google',
  'apple',
  'generic',
];

/** Cabeçalhos CSV nativo Radar Chat (export) */
export const RADARCHAT_NATIVE_HEADERS = [
  'nome',
  'telefone',
  'aniversario',
  'grupos',
  'email',
  'notas',
  'status_consent',
] as const;

/** Perfis de exportação (§10 CONTATOS-CSV-IMPORTACAO.md) */
export type ContactCsvExportProfile =
  | 'radarchat-native'
  | 'google-compatible'
  | 'apple-compatible';

export const CONTACT_CSV_EXPORT_PROFILES: ContactCsvExportProfile[] = [
  'radarchat-native',
  'google-compatible',
  'apple-compatible',
];

export const EXPORT_PROFILE_LABELS: Record<ContactCsvExportProfile, string> = {
  'radarchat-native': 'Radar Chat (nativo)',
  'google-compatible': 'Google / Android',
  'apple-compatible': 'Apple / iOS',
};
