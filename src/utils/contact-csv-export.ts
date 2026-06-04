import {
  ContactCsvExportProfile,
  CONTACT_CSV_EXPORT_PROFILES,
} from '@/constants/contact-csv-formats';
import { ConsentStatus } from '@/types/consent';

export interface ExportContactRow {
  nome: string;
  telefone: string;
  aniversario?: string;
  grupos?: string[];
  email?: string;
  notas?: string;
  empresa?: string;
  telefoneSecundario?: string;
  tipoTelefone?: string;
  consentStatus?: ConsentStatus;
  consentGranted?: boolean;
}

const UTF8_BOM = '\uFEFF';

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowToLine(fields: string[]): string {
  return fields.map(escapeCsvField).join(',');
}

export function consentStatusForExport(
  consentStatus?: ConsentStatus,
  consentGranted?: boolean,
): 'granted' | 'pending' | 'revoked' {
  const st =
    consentStatus ??
    (consentGranted ? ConsentStatus.ACCEPTED : ConsentStatus.PENDING);
  if (st === ConsentStatus.ACCEPTED) return 'granted';
  if (
    st === ConsentStatus.REFUSED_THREE ||
    st === ConsentStatus.MANUALLY_BLOCKED ||
    st === ConsentStatus.REFUSED_FIRST ||
    st === ConsentStatus.REFUSED_SECOND
  ) {
    return 'revoked';
  }
  return 'pending';
}

function splitName(nome: string): { first: string; last: string } {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function formatBirthdayGoogle(iso?: string): string {
  if (!iso) return '';
  if (iso.startsWith('0000-')) return `--${iso.slice(5)}`;
  return iso;
}

function formatBirthdayApple(iso?: string): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const year = m[1] === '0000' ? '' : m[1];
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const label = `${months[month - 1] ?? m[2]} ${day}, ${year || m[1]}`;
  return label.trim();
}

function groupsToGoogle(grupos?: string[]): string {
  if (!grupos?.length) return '';
  return grupos.map((g) => `${g} ::: * myContacts`).join(' ::: ');
}

export function parseExportProfile(
  raw: string | undefined,
): ContactCsvExportProfile {
  const p = (raw ?? 'radarzap-native').trim() as ContactCsvExportProfile;
  if (CONTACT_CSV_EXPORT_PROFILES.includes(p)) return p;
  throw new Error(
    `Perfil de export inválido. Use: ${CONTACT_CSV_EXPORT_PROFILES.join(', ')}`,
  );
}

export function buildContactCsvExport(
  profile: ContactCsvExportProfile,
  rows: ExportContactRow[],
): string {
  const lines: string[] = [];

  if (profile === 'radarzap-native') {
    lines.push(
      rowToLine([
        'nome',
        'telefone',
        'aniversario',
        'grupos',
        'email',
        'notas',
        'empresa',
        'telefone_secundario',
        'tipo_telefone',
        'status_consent',
      ]),
    );
    for (const r of rows) {
      lines.push(
        rowToLine([
          r.nome,
          r.telefone,
          r.aniversario ?? '',
          (r.grupos ?? []).join('; '),
          r.email ?? '',
          r.notas ?? '',
          r.empresa ?? '',
          r.telefoneSecundario ?? '',
          r.tipoTelefone ?? '',
          consentStatusForExport(r.consentStatus, r.consentGranted),
        ]),
      );
    }
  } else if (profile === 'google-compatible') {
    lines.push(
      rowToLine([
        'Name',
        'Given Name',
        'Family Name',
        'Phone 1 - Type',
        'Phone 1 - Value',
        'Birthday',
        'Group Membership',
        'E-mail 1 - Value',
        'Notes',
      ]),
    );
    for (const r of rows) {
      const { first, last } = splitName(r.nome);
      lines.push(
        rowToLine([
          r.nome,
          first,
          last,
          'Mobile',
          r.telefone,
          formatBirthdayGoogle(r.aniversario),
          groupsToGoogle(r.grupos),
          r.email ?? '',
          r.notas ?? '',
        ]),
      );
    }
  } else {
    lines.push(
      rowToLine([
        'First Name',
        'Last Name',
        'Mobile Phone',
        'Birthday',
        'Email Address',
        'Notes',
        'Groups',
      ]),
    );
    for (const r of rows) {
      const { first, last } = splitName(r.nome);
      lines.push(
        rowToLine([
          first,
          last,
          r.telefone,
          formatBirthdayApple(r.aniversario),
          r.email ?? '',
          r.notas ?? '',
          (r.grupos ?? []).join(', '),
        ]),
      );
    }
  }

  return UTF8_BOM + lines.join('\r\n') + '\r\n';
}
