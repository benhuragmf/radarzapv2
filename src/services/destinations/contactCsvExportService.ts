import mongoose from 'mongoose';
import { Destination } from '@/models/Destination';
import { ConsentStatus } from '@/types/consent';
import {
  buildContactCsvExport,
  ExportContactRow,
  parseExportProfile,
} from '@/utils/contact-csv-export';
import type { ContactCsvExportProfile } from '@/constants/contact-csv-formats';

export async function exportContactsCsv(
  clientId: string,
  profileRaw: string | undefined,
): Promise<{ csv: string; filename: string; count: number; profile: ContactCsvExportProfile }> {
  const profile = parseExportProfile(profileRaw);
  const clientOid = new mongoose.Types.ObjectId(clientId);

  const destinations = await Destination.find({
    clientId: clientOid,
    type: 'contact',
    isActive: true,
  })
    .sort({ name: 1 })
    .lean();

  const rows: ExportContactRow[] = destinations.map((d) => ({
    nome: d.name,
    telefone: d.identifier,
    aniversario: d.birthday,
    grupos: d.tags,
    email: d.email,
    notas: d.notes,
    empresa: d.organization,
    telefoneSecundario: d.secondaryPhone,
    tipoTelefone: d.phoneType,
    consentStatus: (d.consentStatus as ConsentStatus) ?? undefined,
    consentGranted: d.consent?.granted,
  }));

  const csv = buildContactCsvExport(profile, rows);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `contatos-${profile}-${stamp}.csv`;

  return { csv, filename, count: rows.length, profile };
}
