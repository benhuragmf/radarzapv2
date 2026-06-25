import mongoose from 'mongoose';
import { Destination, type IDestination } from '@/models/Destination';
import { ContactGroup } from '@/models/ContactGroup';
import {
  CanonicalContactRow,
  CsvRowError,
  ImportCsvReport,
  parseContactCsv,
} from '@/utils/contact-csv-import';
import {
  detectContactImportFormat,
  parseContactVcf,
} from '@/utils/contact-vcf-import';
import { brazilPhoneLookupVariants as waVariants } from '@/utils/whatsapp-phone';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('ContactCsvImport');

export type ContactImportFormat = 'csv' | 'vcf' | 'auto';

export interface ContactImportOptions {
  dryRun?: boolean;
  ipAddress?: string;
  format?: ContactImportFormat;
  /** Segmentos fixos — todos os contatos importados entram nestas listas */
  contactGroupIds?: string[];
  /** Coluna grupos/tags do arquivo vira segmento (cria se não existir) */
  mapGruposToSegments?: boolean;
}

async function resolveSegmentIds(
  clientOid: mongoose.Types.ObjectId,
  groupIds: string[],
): Promise<mongoose.Types.ObjectId[]> {
  if (!groupIds.length) return [];
  const groups = await ContactGroup.find({
    clientId: clientOid,
    _id: { $in: groupIds.filter(Boolean) },
  });
  return groups.map(g => g._id as mongoose.Types.ObjectId);
}

async function resolveOrCreateSegmentsByName(
  clientOid: mongoose.Types.ObjectId,
  names: string[],
): Promise<mongoose.Types.ObjectId[]> {
  const result: mongoose.Types.ObjectId[] = [];
  for (const raw of names) {
    const name = raw.trim().slice(0, 80);
    if (!name) continue;
    let group = await ContactGroup.findOne({ clientId: clientOid, name });
    if (!group) {
      group = await ContactGroup.create({ clientId: clientOid, name });
    }
    result.push(group._id as mongoose.Types.ObjectId);
  }
  return result;
}

async function applySegmentMembership(
  dest: IDestination,
  clientOid: mongoose.Types.ObjectId,
  row: CanonicalContactRow,
  importOpts: Pick<ContactImportOptions, 'contactGroupIds' | 'mapGruposToSegments'>,
): Promise<void> {
  const ids = new Set<string>((dest.contactGroupIds ?? []).map(String));

  if (importOpts.contactGroupIds?.length) {
    const fixed = await resolveSegmentIds(clientOid, importOpts.contactGroupIds);
    for (const oid of fixed) ids.add(String(oid));
  }

  if (importOpts.mapGruposToSegments && row.grupos?.length) {
    const fromNames = await resolveOrCreateSegmentsByName(clientOid, row.grupos);
    for (const oid of fromNames) ids.add(String(oid));
  }

  if (ids.size === 0) return;

  dest.contactGroupIds = [...ids].map(id => new mongoose.Types.ObjectId(id));
  await dest.save();
}

function identifierCandidates(e164: string): string[] {
  const digits = e164.replace(/\D/g, '');
  const variants = waVariants(digits);
  const ids = new Set<string>();
  for (const d of variants) {
    ids.add(`+${d}`);
    ids.add(d);
  }
  ids.add(e164);
  return [...ids];
}

async function findExistingContact(
  clientId: mongoose.Types.ObjectId,
  telefone: string,
) {
  const ids = identifierCandidates(telefone);
  return Destination.findOne({
    clientId,
    type: 'contact',
    identifier: { $in: ids },
  });
}

function applyOptionalFields(
  dest: IDestination,
  row: CanonicalContactRow,
): void {
  if (row.aniversario) dest.set('birthday', row.aniversario);
  if (row.grupos?.length) dest.set('tags', row.grupos);
  if (row.email) dest.set('email', row.email);
  if (row.notas) dest.set('notes', row.notas);
  if (row.empresa) dest.set('organization', row.empresa);
  if (row.telefoneSecundario) dest.set('secondaryPhone', row.telefoneSecundario);
  if (row.tipoTelefone) dest.set('phoneType', row.tipoTelefone);
  dest.name = row.nome;
}

export async function importCanonicalContacts(
  clientId: string,
  rows: CanonicalContactRow[],
  ipAddress: string = '127.0.0.1',
  segmentOpts: Pick<ContactImportOptions, 'contactGroupIds' | 'mapGruposToSegments'> = {},
): Promise<ImportCsvReport> {
  const clientOid = new mongoose.Types.ObjectId(clientId);
  const report: ImportCsvReport = {
    criados: 0,
    atualizados: 0,
    ignorados: 0,
    erros: [],
  };

  for (const row of rows) {
    try {
      const existing = await findExistingContact(clientOid, row.telefone);
      if (existing) {
        applyOptionalFields(existing, row);
        if (existing.identifier !== row.telefone) {
          existing.identifier = row.telefone;
        }
        await existing.save();
        await applySegmentMembership(existing, clientOid, row, segmentOpts);
        report.atualizados++;
        continue;
      }

      const { assertCanCreateContact } = await import('@/services/billing/plan-limit-enforcement');
      await assertCanCreateContact(clientId);

      const dest = await Destination.createDestination(
        clientOid,
        'contact',
        row.telefone,
        row.nome,
        'import',
        ipAddress,
      );
      applyOptionalFields(dest, row);
      await dest.save();
      await applySegmentMembership(dest, clientOid, row, segmentOpts);
      report.criados++;
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('already exists')) {
        report.ignorados++;
      } else if (msg.includes('Limite de contatos')) {
        report.erros.push({ linha: row.lineNumber, motivo: msg });
        break;
      } else {
        report.erros.push({ linha: row.lineNumber, motivo: msg });
      }
    }
  }

  logger.info('CSV contact import finished', {
    clientId,
    criados: report.criados,
    atualizados: report.atualizados,
    erros: report.erros.length,
  });

  return report;
}

export async function processContactImport(
  clientId: string,
  fileText: string,
  options: ContactImportOptions = {},
): Promise<{
  profile: string;
  format: 'csv' | 'vcf';
  preview: CanonicalContactRow[];
  report: ImportCsvReport;
  parseErrors: CsvRowError[];
  totalLinhasDados: number;
}> {
  const formatOpt = options.format ?? 'auto';
  const format =
    formatOpt === 'auto' ? detectContactImportFormat(fileText) : formatOpt;

  const parsed =
    format === 'vcf' ? parseContactVcf(fileText) : parseContactCsv(fileText);
  const preview = parsed.rows.slice(0, 5);

  if (options.dryRun) {
    return {
      profile: parsed.profile,
      format,
      preview,
      report: {
        criados: 0,
        atualizados: 0,
        ignorados: 0,
        erros: parsed.erros,
      },
      parseErrors: parsed.erros,
      totalLinhasDados: parsed.totalLinhasDados,
    };
  }

  const report = await importCanonicalContacts(
    clientId,
    parsed.rows,
    options.ipAddress ?? '127.0.0.1',
    {
      contactGroupIds: options.contactGroupIds,
      mapGruposToSegments: options.mapGruposToSegments,
    },
  );
  report.erros = [...parsed.erros, ...report.erros];

  logger.info('Contact import finished', {
    clientId,
    format,
    profile: parsed.profile,
    criados: report.criados,
    atualizados: report.atualizados,
    erros: report.erros.length,
  });

  return {
    profile: parsed.profile,
    format,
    preview,
    report,
    parseErrors: parsed.erros,
    totalLinhasDados: parsed.totalLinhasDados,
  };
}

/** @deprecated Use processContactImport — mantido para chamadas legadas */
export async function processContactCsvImport(
  clientId: string,
  csvText: string,
  options: { dryRun?: boolean; ipAddress?: string } = {},
): Promise<{
  profile: string;
  preview: CanonicalContactRow[];
  report: ImportCsvReport;
  parseErrors: CsvRowError[];
  totalLinhasDados: number;
}> {
  const result = await processContactImport(clientId, csvText, {
    ...options,
    format: 'csv',
  });
  return {
    profile: result.profile,
    preview: result.preview,
    report: result.report,
    parseErrors: result.parseErrors,
    totalLinhasDados: result.totalLinhasDados,
  };
}
