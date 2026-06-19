import mongoose from 'mongoose';
import { Destination } from '@/models/Destination';
import type { VisitorIntakePatch } from '@/utils/webchat-prechat-fields.util';

export function phoneLookupIdentifiers(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return [];
  const ids = new Set<string>([digits, `+${digits}`]);
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    ids.add(`55${digits}`);
    ids.add(`+55${digits}`);
  }
  if (digits.startsWith('55') && digits.length > 11) {
    const local = digits.slice(2);
    ids.add(local);
    ids.add(`+${local}`);
    ids.add(`+${digits}`);
  }
  return [...ids];
}

function buildWebChatDestinationNote(
  patch: VisitorIntakePatch,
  meta?: { pageUrl?: string; pageTitle?: string },
): string | null {
  const parts: string[] = [];
  if (patch.contactReason?.trim()) parts.push(`Motivo: ${patch.contactReason.trim()}`);
  if (meta?.pageTitle?.trim() || meta?.pageUrl?.trim()) {
    parts.push(`Página: ${meta.pageTitle?.trim() || meta.pageUrl?.trim()}`);
  }
  for (const [id, val] of Object.entries(patch.visitorIntake)) {
    if (['name', 'phone', 'email', 'contact_reason'].includes(id)) continue;
    if (val?.trim()) parts.push(`${id}: ${val.trim()}`);
  }
  if (!parts.length) return null;
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return `[WebChat ${stamp}] ${parts.join(' · ')}`;
}

/** Vincula visitante ao contato (Destination) pelo telefone e atualiza o perfil. */
export async function linkWebChatVisitorToDestination(
  clientId: string,
  patch: VisitorIntakePatch,
  meta?: { pageUrl?: string; pageTitle?: string },
): Promise<mongoose.Types.ObjectId | undefined> {
  const phone = patch.visitorPhone?.trim();
  if (!phone) return undefined;

  const clientOid = new mongoose.Types.ObjectId(clientId);
  const identifiers = phoneLookupIdentifiers(phone);
  const dest = await Destination.findOne({
    clientId: clientOid,
    type: 'contact',
    identifier: { $in: identifiers },
  });
  if (!dest) return undefined;

  let changed = false;
  const intakeName = patch.visitorName?.trim();
  if (intakeName) {
    const current = dest.name?.trim() ?? '';
    const idNorm = dest.identifier.replace(/\D/g, '');
    const nameIsPlaceholder = !current || current.replace(/\D/g, '') === idNorm;
    if (nameIsPlaceholder && intakeName !== current) {
      dest.name = intakeName.slice(0, 100);
      changed = true;
    }
  }
  if (patch.visitorEmail?.trim() && !dest.email?.trim()) {
    dest.email = patch.visitorEmail.trim().toLowerCase();
    changed = true;
  }

  const noteLine = buildWebChatDestinationNote(patch, meta);
  if (noteLine) {
    const prev = dest.notes?.trim() ?? '';
    if (!prev.includes(noteLine)) {
      dest.notes = prev ? `${prev}\n${noteLine}` : noteLine;
      changed = true;
    }
  }

  if (changed) await dest.save();
  return dest._id as mongoose.Types.ObjectId;
}
