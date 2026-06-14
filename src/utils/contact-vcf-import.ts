import { MAX_CSV_IMPORT_ROWS } from '@/constants/contact-csv-formats';
import {
  CanonicalContactRow,
  CsvRowError,
  dedupeCanonicalRows,
  normalizeContactPhoneE164,
  parseBirthday,
} from '@/utils/contact-csv-import';
import { phoneTypeFromVcfTypes, type ContactPhoneType } from '@/types/contact-fields';

export type ContactVcfProfile = 'vcf';

export interface ParseContactVcfResult {
  profile: ContactVcfProfile;
  /** VERSION da primeira vCard com valor, se houver */
  vcardVersion?: string;
  rows: CanonicalContactRow[];
  erros: CsvRowError[];
  /** Número de vCards no arquivo (antes de dedupe interno) */
  totalLinhasDados: number;
}

interface VcfProperty {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** Detecta VCF pelo marcador BEGIN:VCARD */
export function detectContactImportFormat(text: string): 'vcf' | 'csv' {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (/BEGIN:VCARD/i.test(trimmed)) return 'vcf';
  return 'csv';
}

/** Desdobra linhas de continuação (RFC 2426 + quebras soft do quoted-printable) */
export function unfoldVcfLines(text: string): string[] {
  const raw = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const out: string[] = [];
  for (const line of raw) {
    if (out.length > 0) {
      if (line.startsWith(' ') || line.startsWith('\t')) {
        out[out.length - 1] += line.slice(1);
        continue;
      }
      if (/^=[0-9A-Fa-f]{2}/i.test(line)) {
        let prev = out[out.length - 1]!;
        if (prev.endsWith('=')) prev = prev.slice(0, -1);
        out[out.length - 1] = prev + line;
        continue;
      }
    }
    if (line.trim().length > 0) out.push(line);
  }
  return out;
}

function parseParamSegment(seg: string): { key: string; value?: string } {
  const eq = seg.indexOf('=');
  if (eq < 0) return { key: seg.trim().toUpperCase() };
  return {
    key: seg.slice(0, eq).trim().toUpperCase(),
    value: seg.slice(eq + 1).trim(),
  };
}

function parsePropertyLine(line: string): VcfProperty | null {
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const left = line.slice(0, colon);
  let value = line.slice(colon + 1);
  const semi = left.split(';');
  const nameRaw = semi[0] ?? '';
  const name = (nameRaw.includes('.') ? nameRaw.split('.').pop()! : nameRaw).toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < semi.length; i++) {
    const { key, value: pv } = parseParamSegment(semi[i]!);
    if (key) params[key] = pv ?? 'true';
  }
  if (params.ENCODING?.toUpperCase() === 'QUOTED-PRINTABLE') {
    value = decodeQuotedPrintable(value);
  }
  return { name, params, value };
}

export function decodeQuotedPrintable(input: string): string {
  const merged = input.replace(/=\r?\n/g, '').replace(/=\n/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < merged.length; i++) {
    if (
      merged[i] === '=' &&
      i + 2 < merged.length &&
      /^[0-9A-Fa-f]{2}$/.test(merged.slice(i + 1, i + 3))
    ) {
      bytes.push(parseInt(merged.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(merged.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

function splitVcards(lines: string[]): string[][] {
  const cards: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    const upper = line.trim().toUpperCase();
    if (upper === 'BEGIN:VCARD') {
      current = [];
      continue;
    }
    if (upper === 'END:VCARD') {
      if (current) cards.push(current);
      current = null;
      continue;
    }
    if (current) current.push(line);
  }
  return cards;
}

function paramTypes(params: Record<string, string>): string[] {
  const types: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (k === 'TYPE') {
      if (v && v !== 'true') types.push(...v.split(',').map((t) => t.trim()));
    } else if (k !== 'ENCODING' && k !== 'CHARSET' && k !== 'PREF' && v === 'true') {
      types.push(k);
    } else if (k !== 'ENCODING' && k !== 'CHARSET') {
      types.push(k);
    }
  }
  return types.map((t) => t.toLowerCase());
}

function isPref(params: Record<string, string>): boolean {
  return 'PREF' in params;
}

function buildName(props: VcfProperty[]): string {
  const fn = props.find((p) => p.name === 'FN');
  if (fn?.value.trim()) return fn.value.trim().slice(0, 100);

  const n = props.find((p) => p.name === 'N');
  if (n?.value) {
    const parts = n.value.split(';');
    const family = (parts[0] ?? '').trim();
    const given = (parts[1] ?? '').trim();
    const middle = (parts[2] ?? '').trim();
    const composed = [given, middle, family].filter(Boolean).join(' ').trim();
    if (composed) return composed.slice(0, 100);
  }
  return '';
}

interface TelEntry {
  value: string;
  types: string[];
  pref: boolean;
  score: number;
}

function scoreTel(types: string[], pref: boolean): number {
  let score = pref ? 10 : 0;
  const t = types.join(' ');
  if (t.includes('cell') || t.includes('mobile')) score += 20;
  if (t.includes('whatsapp') || t.includes('x-whatsapp')) score += 25;
  if (t.includes('iphone')) score += 22;
  if (t.includes('home')) score += 5;
  if (t.includes('work')) score += 3;
  return score;
}

interface PhonePickResult {
  primaryRaw: string;
  secondaryRaw?: string;
  tipoTelefone: ContactPhoneType;
}

function inferDominantBrazilDdd(blocks: string[][]): string | undefined {
  const counts = new Map<string, number>();
  for (const block of blocks) {
    for (const line of block) {
      const p = parsePropertyLine(line);
      if (p?.name !== 'TEL') continue;
      const e164 = normalizeContactPhoneE164(p.value.trim());
      if (!e164?.startsWith('+55') || e164.length < 6) continue;
      const ddd = e164.slice(3, 5);
      counts.set(ddd, (counts.get(ddd) ?? 0) + 1);
    }
  }
  let best: string | undefined;
  let max = 0;
  for (const [ddd, n] of counts) {
    if (n > max) {
      max = n;
      best = ddd;
    }
  }
  return best;
}

function normalizeVcfPhone(raw: string, fallbackDdd?: string): string | null {
  const direct = normalizeContactPhoneE164(raw);
  if (direct) return direct;

  let digits = raw.replace(/[\s\-().+]/g, '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');

  if (fallbackDdd && digits.length === 9 && digits.startsWith('9')) {
    const withDdd = normalizeContactPhoneE164(`55${fallbackDdd}${digits}`);
    if (withDdd) return withDdd;
  }

  if (digits.length === 11) {
    const withCountry = normalizeContactPhoneE164(`55${digits}`);
    if (withCountry) return withCountry;
  }

  if (digits.length > 11) {
    const match = digits.match(/([1-9][1-9]9\d{8})$/);
    if (match?.[1]) {
      const withCountry = normalizeContactPhoneE164(`55${match[1]}`);
      if (withCountry) return withCountry;
    }
    if (fallbackDdd) {
      const idx = digits.indexOf(fallbackDdd);
      if (idx >= 0 && idx <= 3) {
        const rest = digits.slice(idx);
        if (rest.length === 11) {
          const withCountry = normalizeContactPhoneE164(`55${rest}`);
          if (withCountry) return withCountry;
        }
      }
    }
  }

  return null;
}

function pickPhones(props: VcfProperty[], fallbackDdd?: string): PhonePickResult | null {
  const tels = props.filter((p) => p.name === 'TEL');
  if (!tels.length) return null;

  const entries: TelEntry[] = tels.map((p) => {
    const types = paramTypes(p.params);
    const pref = isPref(p.params);
    return {
      value: p.value.trim(),
      types,
      pref,
      score: scoreTel(types, pref),
    };
  });

  entries.sort((a, b) => b.score - a.score);
  const primary = entries[0];
  if (!primary?.value) return null;

  const primaryE164 = normalizeVcfPhone(primary.value, fallbackDdd);
  let secondaryRaw: string | undefined;
  for (let i = 1; i < entries.length; i++) {
    const cand = entries[i]!;
    const candE164 = normalizeVcfPhone(cand.value, fallbackDdd);
    if (candE164 && candE164 !== primaryE164) {
      secondaryRaw = cand.value;
      break;
    }
  }

  return {
    primaryRaw: primary.value,
    secondaryRaw,
    tipoTelefone: phoneTypeFromVcfTypes(primary.types),
  };
}

function pickOrganization(props: VcfProperty[]): string | undefined {
  const org = props.find((p) => p.name === 'ORG');
  const v = org?.value.trim();
  return v ? v.slice(0, 200) : undefined;
}

function pickEmail(props: VcfProperty[]): string | undefined {
  const emails = props.filter((p) => p.name === 'EMAIL');
  if (!emails.length) return undefined;
  const preferred = emails.find((p) => isPref(p.params)) ?? emails[0];
  const v = preferred?.value.trim();
  return v ? v.slice(0, 254) : undefined;
}

function pickBirthday(props: VcfProperty[]): string | undefined {
  const bday = props.find((p) => p.name === 'BDAY');
  if (!bday?.value.trim()) return undefined;
  let raw = bday.value.trim();
  if (/^\d{8}$/.test(raw)) {
    raw = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return parseBirthday(raw);
}

function pickCategories(props: VcfProperty[]): string[] | undefined {
  const cat = props.find((p) => p.name === 'CATEGORIES');
  if (!cat?.value.trim()) return undefined;
  const sep = cat.value.includes(';') ? ';' : ',';
  const labels = [...new Set(cat.value.split(sep).map((s) => s.trim()).filter(Boolean))];
  return labels.length ? labels : undefined;
}

function pickNotes(props: VcfProperty[]): string | undefined {
  const notes = props
    .filter((p) => p.name === 'NOTE')
    .map((p) => p.value.trim())
    .filter(Boolean);
  if (!notes.length) return undefined;
  return notes.join('\n').slice(0, 2000);
}

function parseVcardBlock(
  lines: string[],
  lineNumber: number,
  fallbackDdd?: string,
): CanonicalContactRow | CsvRowError {
  const props: VcfProperty[] = [];
  for (const line of lines) {
    const p = parsePropertyLine(line);
    if (p && p.name !== 'VERSION' && p.name !== 'PRODID') props.push(p);
  }

  const nome = buildName(props);
  const phones = pickPhones(props, fallbackDdd);
  const telefone = phones ? normalizeVcfPhone(phones.primaryRaw, fallbackDdd) : null;

  if (!nome) {
    return { linha: lineNumber, motivo: 'Nome ausente (FN/N)' };
  }
  if (!telefone) {
    return { linha: lineNumber, motivo: 'Telefone ausente ou inválido' };
  }

  const row: CanonicalContactRow = { nome, telefone, lineNumber };
  const aniversario = pickBirthday(props);
  if (aniversario) row.aniversario = aniversario;
  const grupos = pickCategories(props);
  if (grupos?.length) row.grupos = grupos;
  const email = pickEmail(props);
  if (email) row.email = email;
  const notas = pickNotes(props);
  if (notas) row.notas = notas;
  const empresa = pickOrganization(props);
  if (empresa) row.empresa = empresa;
  if (phones) {
    row.tipoTelefone = phones.tipoTelefone;
    if (phones.secondaryRaw) {
      const sec = normalizeVcfPhone(phones.secondaryRaw, fallbackDdd);
      if (sec && sec !== telefone) row.telefoneSecundario = sec;
    }
  }
  return row;
}

export function parseContactVcf(vcfText: string): ParseContactVcfResult {
  const lines = unfoldVcfLines(vcfText);
  const blocks = splitVcards(lines);
  if (blocks.length === 0) {
    throw new Error('Arquivo VCF vazio ou sem vCards (BEGIN:VCARD … END:VCARD).');
  }
  if (blocks.length > MAX_CSV_IMPORT_ROWS) {
    throw new Error(`Limite de ${MAX_CSV_IMPORT_ROWS} contatos por importação excedido.`);
  }

  let vcardVersion: string | undefined;
  for (const block of blocks) {
    for (const line of block) {
      const p = parsePropertyLine(line);
      if (p?.name === 'VERSION' && p.value) {
        vcardVersion = p.value;
        break;
      }
    }
    if (vcardVersion) break;
  }

  const fallbackDdd = inferDominantBrazilDdd(blocks);
  const rows: CanonicalContactRow[] = [];
  const erros: CsvRowError[] = [];
  let lineNumber = 0;

  for (const block of blocks) {
    lineNumber++;
    const mapped = parseVcardBlock(block, lineNumber, fallbackDdd);
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
      motivo: `${ignorados} contato(s) duplicado(s) no arquivo (mesmo telefone)`,
    });
  }

  return {
    profile: 'vcf',
    vcardVersion,
    rows: deduped,
    erros,
    totalLinhasDados: blocks.length,
  };
}
