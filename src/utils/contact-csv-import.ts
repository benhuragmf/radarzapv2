import {
  ContactCsvProfile,
  CanonicalContactField,
  GLOBAL_COLUMN_ALIASES,
  MAX_CSV_IMPORT_ROWS,
  PROFILE_COLUMN_MAP,
  PROFILE_DETECTION_ORDER,
  PROFILE_FINGERPRINTS,
} from '@/constants/contact-csv-formats';
import {
  brazilPhoneLookupVariants,
  normalizeBrazilPhoneDigits,
} from '@/utils/whatsapp-phone';
import {
  normalizeContactPhoneType,
  type ContactPhoneType,
} from '@/types/contact-fields';

export interface CanonicalContactRow {
  nome: string;
  telefone: string;
  aniversario?: string;
  grupos?: string[];
  email?: string;
  notas?: string;
  empresa?: string;
  telefoneSecundario?: string;
  tipoTelefone?: ContactPhoneType;
  lineNumber: number;
}

export interface CsvRowError {
  linha: number;
  motivo: string;
}

export interface ParseContactCsvResult {
  profile: ContactCsvProfile;
  headers: string[];
  rows: CanonicalContactRow[];
  erros: CsvRowError[];
  totalLinhasDados: number;
}

export interface DedupeResult {
  rows: CanonicalContactRow[];
  ignorados: number;
}

/** Remove BOM UTF-8 e normaliza cabeçalho */
export function normalizeCsvHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase();
}

/** Parse simples RFC4180 (campos entre aspas, vírgula separador) */
export function parseCsvText(csvText: string): { headers: string[]; dataRows: string[][] } {
  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], dataRows: [] };
  }
  const headers = parseCsvLine(lines[0]).map(normalizeCsvHeader);
  const dataRows = lines.slice(1).map(parseCsvLine);
  return { headers, dataRows };
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur.trim());
  return fields;
}

function headerSet(headers: string[]): Set<string> {
  return new Set(headers.map(normalizeCsvHeader));
}

export function detectCsvProfile(headers: string[]): ContactCsvProfile {
  const h = headerSet(headers);
  const has = (...cols: string[]) => cols.every((c) => h.has(c));
  const hasAny = (...cols: string[]) => cols.some((c) => h.has(c));

  for (const profile of PROFILE_DETECTION_ORDER) {
    if (profile === 'generic') continue;
    const fingerprints = PROFILE_FINGERPRINTS[profile];
    for (const fp of fingerprints) {
      if (has(...fp)) return profile;
    }
    if (profile === 'google' && hasAny('phone 1 - value')) return 'google';
    if (profile === 'apple' && has('first name') && !h.has('phone 1 - value')) {
      if (hasAny('mobile phone', 'home phone', 'phone', 'iphone')) return 'apple';
    }
  }

  const nameCol = findHeaderForField(headers, 'nome');
  const phoneCol = findHeaderForField(headers, 'telefone');
  if (nameCol && phoneCol) return 'generic';

  throw new Error(
    'Cabeçalho inválido: é necessário pelo menos uma coluna de nome e uma de telefone mapeáveis.',
  );
}

function findHeaderForField(headers: string[], field: CanonicalContactField): string | undefined {
  for (const h of headers) {
    const map = { ...GLOBAL_COLUMN_ALIASES, ...PROFILE_COLUMN_MAP.generic };
    if (map[h] === field) return h;
  }
  return undefined;
}

function getCell(row: string[], headers: string[], columnKey: string): string {
  const idx = headers.indexOf(columnKey);
  if (idx < 0) return '';
  return (row[idx] ?? '').trim();
}

function pickFirstNonEmpty(headers: string[], row: string[], keys: string[]): string {
  for (const k of keys) {
    const v = getCell(row, headers, k);
    if (v) return v;
  }
  return '';
}

function buildName(profile: ContactCsvProfile, headers: string[], row: string[]): string {
  const h = headers;
  if (profile === 'google') {
    const display = pickFirstNonEmpty(h, row, ['name']);
    if (display) return display.slice(0, 100);
    const given = pickFirstNonEmpty(h, row, ['given name']);
    const family = pickFirstNonEmpty(h, row, ['family name']);
    const composed = [given, family].filter(Boolean).join(' ').trim();
    if (composed) return composed.slice(0, 100);
  }
  if (profile === 'apple' || profile === 'generic') {
    const full = pickFirstNonEmpty(h, row, ['full name', 'name', 'nome']);
    if (full) return full.slice(0, 100);
    const first = pickFirstNonEmpty(h, row, ['first name', 'firstname']);
    const middle = pickFirstNonEmpty(h, row, ['middle name']);
    const last = pickFirstNonEmpty(h, row, ['last name', 'lastname']);
    const composed = [first, middle, last].filter(Boolean).join(' ').trim();
    if (composed) return composed.slice(0, 100);
  }
  return pickFirstNonEmpty(h, row, ['nome', 'name']).slice(0, 100);
}

function buildPhone(profile: ContactCsvProfile, headers: string[], row: string[]): string {
  if (profile === 'google') {
    const types = ['phone 1 - type', 'phone 2 - type', 'phone 3 - type', 'phone 4 - type'];
    const values = ['phone 1 - value', 'phone 2 - value', 'phone 3 - value', 'phone 4 - value'];
    let mobile = '';
    let fallback = '';
    for (let i = 0; i < values.length; i++) {
      const val = getCell(row, headers, values[i]);
      if (!val) continue;
      const type = getCell(row, headers, types[i]).toLowerCase();
      if (!fallback) fallback = val;
      if (type.includes('mobile') || type.includes('celular') || type.includes('cell')) {
        mobile = val;
        break;
      }
    }
    return mobile || fallback || pickFirstNonEmpty(headers, row, ['telefone', 'phone']);
  }
  if (profile === 'apple') {
    const order = [
      'mobile phone',
      'iphone',
      'home phone',
      'work phone',
      'phone',
      'telefone',
    ];
    return pickFirstNonEmpty(headers, row, order);
  }
  return pickFirstNonEmpty(headers, row, [
    'telefone',
    'phone',
    'mobile phone',
    'mobile',
    'celular',
  ]);
}

function buildGroups(profile: ContactCsvProfile, headers: string[], row: string[]): string[] | undefined {
  const raw =
    profile === 'google'
      ? pickFirstNonEmpty(headers, row, ['group membership'])
      : pickFirstNonEmpty(headers, row, ['grupos', 'groups', 'group', 'tags', 'category']);
  if (!raw) return undefined;
  if (profile === 'google') return parseGoogleGroups(raw);
  if (raw.includes(',')) return splitGroups(raw, ',');
  return splitGroups(raw, ';');
}

function parseGoogleGroups(raw: string): string[] {
  const ignored = new Set([
    '* mycontacts',
    '* starred',
    '* friends',
    '* family',
    '* coworkers',
  ]);
  const parts = raw.split(':::').map((p) => p.trim());
  const labels: string[] = [];
  for (const part of parts) {
    const label = part.trim();
    if (!label || label.startsWith('*')) continue;
    const lower = label.toLowerCase();
    if (ignored.has(lower)) continue;
    labels.push(label);
  }
  return [...new Set(labels)].filter(Boolean);
}

function splitGroups(raw: string, sep: string): string[] {
  return [...new Set(raw.split(sep).map((s) => s.trim()).filter(Boolean))];
}

export function parseBirthday(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  if (/^--(\d{2})-(\d{2})$/.test(s)) {
    const m = s.match(/^--(\d{2})-(\d{2})$/);
    if (m) return `0000-${m[1]}-${m[2]}`;
  }

  const br = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (br) {
    const d = br[1].padStart(2, '0');
    const mo = br[2].padStart(2, '0');
    const y = br[3] ? normalizeYear(br[3]) : '0000';
    return `${y}-${mo}-${d}`;
  }

  const us = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})?$/);
  if (us) {
    const months: Record<string, string> = {
      january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
      july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
      jan: '01', feb: '02', mar: '03', apr: '04', jun: '06', jul: '07', aug: '08',
      sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const mo = months[us[1].toLowerCase()];
    if (mo) {
      const d = us[2].padStart(2, '0');
      const y = us[3] ? normalizeYear(us[3]) : '0000';
      return `${y}-${mo}-${d}`;
    }
  }

  const appleShort = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (appleShort) {
    const mo = appleShort[1].padStart(2, '0');
    const d = appleShort[2].padStart(2, '0');
    return `${appleShort[3]}-${mo}-${d}`;
  }

  return undefined;
}

function normalizeYear(y: string): string {
  if (y.length === 2) return y.length === 2 ? (Number(y) > 50 ? `19${y}` : `20${y}`) : y;
  return y.padStart(4, '0').slice(-4);
}

/** Normaliza telefone de contato para E.164 (+digits) */
export function normalizeContactPhoneE164(raw: string): string | null {
  if (!raw?.trim()) return null;
  let digits = raw.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  digits = digits.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
    digits = `55${digits}`;
  }
  digits = normalizeBrazilPhoneDigits(digits);
  if (digits.length < 10 || digits.length > 15) return null;
  if (!/^[1-9]\d{9,14}$/.test(digits)) return null;
  return `+${digits}`;
}

export function dedupeCanonicalRows(rows: CanonicalContactRow[]): DedupeResult {
  const seen = new Map<string, CanonicalContactRow>();
  let ignorados = 0;
  for (const row of rows) {
    const keys = phoneDedupeKeys(row.telefone);
    const existingKey = keys.find((k) => seen.has(k));
    if (existingKey) {
      ignorados++;
      continue;
    }
    for (const k of keys) seen.set(k, row);
  }
  const unique = [...new Set(seen.values())];
  return { rows: unique, ignorados };
}

function phoneDedupeKeys(e164: string): string[] {
  const digits = e164.replace(/\D/g, '');
  const variants = brazilPhoneLookupVariants(digits);
  return variants.map((d) => `+${d}`);
}

function mapRow(
  profile: ContactCsvProfile,
  headers: string[],
  row: string[],
  lineNumber: number,
): CanonicalContactRow | CsvRowError {
  const nome = buildName(profile, headers, row).trim();
  const telefoneRaw = buildPhone(profile, headers, row).trim();
  const telefone = normalizeContactPhoneE164(telefoneRaw);

  if (!nome) {
    return { linha: lineNumber, motivo: 'Nome ausente' };
  }
  if (!telefone) {
    return { linha: lineNumber, motivo: 'Telefone ausente ou inválido' };
  }

  const aniversario = parseBirthday(
    pickFirstNonEmpty(headers, row, ['aniversario', 'aniversário', 'birthday']),
  );
  const grupos = buildGroups(profile, headers, row);
  const email = pickFirstNonEmpty(headers, row, [
    'email',
    'e-mail',
    'e-mail 1 - value',
    'email address',
  ]);
  const notas = pickFirstNonEmpty(headers, row, ['notas', 'notes', 'note']);
  const empresa = pickFirstNonEmpty(headers, row, [
    'empresa',
    'organization',
    'organizacao',
    'organização',
    'org',
    'company',
  ]);
  const telefoneSecundarioRaw = pickFirstNonEmpty(headers, row, [
    'telefone_secundario',
    'telefone secundario',
    'telefone secundário',
    'secondary_phone',
    'phone 2',
    'phone 2 - value',
  ]);
  const telefoneSecundario = telefoneSecundarioRaw
    ? normalizeContactPhoneE164(telefoneSecundarioRaw)
    : undefined;
  const tipoRaw = pickFirstNonEmpty(headers, row, [
    'tipo_telefone',
    'tipo telefone',
    'phone_type',
    'phone 1 - type',
  ]);
  const tipoTelefone = normalizeContactPhoneType(tipoRaw);

  const out: CanonicalContactRow = { nome, telefone, lineNumber };
  if (aniversario) out.aniversario = aniversario;
  if (grupos?.length) out.grupos = grupos;
  if (email) out.email = email.slice(0, 254);
  if (notas) out.notas = notas.slice(0, 2000);
  if (empresa) out.empresa = empresa.slice(0, 200);
  if (telefoneSecundario && telefoneSecundario !== telefone) {
    out.telefoneSecundario = telefoneSecundario;
  }
  if (tipoTelefone) out.tipoTelefone = tipoTelefone;
  return out;
}

export function parseContactCsv(csvText: string): ParseContactCsvResult {
  const { headers, dataRows } = parseCsvText(csvText);
  if (headers.length === 0) {
    throw new Error('Arquivo CSV vazio ou sem cabeçalho.');
  }
  const profile = detectCsvProfile(headers);
  const rows: CanonicalContactRow[] = [];
  const erros: CsvRowError[] = [];

  if (dataRows.length > MAX_CSV_IMPORT_ROWS) {
    throw new Error(`Limite de ${MAX_CSV_IMPORT_ROWS} linhas por importação excedido.`);
  }

  let lineNumber = 1;
  for (const row of dataRows) {
    lineNumber++;
    if (row.every((c) => !c.trim())) continue;
    const mapped = mapRow(profile, headers, row, lineNumber);
    if ('motivo' in mapped) {
      erros.push(mapped);
    } else {
      rows.push(mapped);
    }
  }

  const { rows: deduped, ignorados } = dedupeCanonicalRows(rows);
  if (ignorados > 0) {
    erros.push({
      linha: 0,
      motivo: `${ignorados} linha(s) duplicada(s) no arquivo (mesmo telefone)`,
    });
  }

  return {
    profile,
    headers,
    rows: deduped,
    erros,
    totalLinhasDados: dataRows.length,
  };
}

export interface ImportCsvReport {
  criados: number;
  atualizados: number;
  ignorados: number;
  erros: CsvRowError[];
}
