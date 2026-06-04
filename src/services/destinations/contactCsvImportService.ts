import mongoose from 'mongoose';
import { Destination } from '@/models/Destination';
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
  dest: InstanceType<typeof Destination>,
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
        report.atualizados++;
        continue;
      }

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
      report.criados++;
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('already exists')) {
        report.ignorados++;
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
  options: {
    dryRun?: boolean;
    ipAddress?: string;
    format?: ContactImportFormat;
  } = {},
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
