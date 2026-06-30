import mongoose from 'mongoose';
import { Destination, type IDestination } from '@/models/Destination';
import {
  formatDeliveryAddress,
  parseDeliveryAddress,
} from '@/types/catalog-delivery-address';
import { ensureDestinationForWebChatVisitor } from '@/services/webchat/webchat-destination-link.util';
import { resolveContactAddress } from '@/utils/contact-address.util';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('ContactCollectedDataService');

export interface ContactCollectedFields {
  name?: string;
  email?: string;
  address?: string;
  phone?: string;
  organization?: string;
  deliveryNotes?: string;
  preferredSchedule?: string;
  locationLat?: number;
  locationLng?: number;
  taxDocument?: string;
}

function normalizeStoredAddress(raw?: string): string | undefined {
  const t = raw?.trim();
  if (!t || t.length < 8) return undefined;
  const structured = parseDeliveryAddress(t);
  if (structured) return formatDeliveryAddress(structured).slice(0, 500);
  return t.slice(0, 500);
}

function nameIsPlaceholder(dest: IDestination, name: string): boolean {
  const current = name.trim();
  if (!current) return true;
  const idNorm = dest.identifier.replace(/\D/g, '');
  return current.replace(/\D/g, '') === idNorm;
}

async function findDestinationByPhone(
  clientId: string,
  phone: string,
): Promise<IDestination | null> {
  const { phoneLookupIdentifiers } = await import('@/services/webchat/webchat-destination-link.util');
  const identifiers = phoneLookupIdentifiers(phone);
  if (!identifiers.length) return null;
  return Destination.findOne({
    clientId: new mongoose.Types.ObjectId(clientId),
    type: 'contact',
    identifier: { $in: identifiers },
  });
}

export async function resolveDestinationForCollectedData(opts: {
  clientId: string;
  destinationId?: string;
  contactPhone?: string;
  visitorPhone?: string;
  visitorName?: string;
  visitorEmail?: string;
}): Promise<IDestination | null> {
  const clientOid = new mongoose.Types.ObjectId(opts.clientId);
  if (opts.destinationId && mongoose.Types.ObjectId.isValid(opts.destinationId)) {
    const byId = await Destination.findOne({
      _id: new mongoose.Types.ObjectId(opts.destinationId),
      clientId: clientOid,
      type: 'contact',
    });
    if (byId) return byId;
  }

  const phone = opts.contactPhone?.trim() || opts.visitorPhone?.trim();
  if (!phone) return null;

  const linked = await findDestinationByPhone(opts.clientId, phone);
  if (linked) return linked;

  const createdId = await ensureDestinationForWebChatVisitor(
    opts.clientId,
    phone,
    opts.visitorName?.trim() || phone,
    { email: opts.visitorEmail?.trim() },
  );
  if (!createdId) return null;
  return Destination.findById(createdId);
}

/** Grava na base de contatos (Destination) dados coletados pela IA ou pedidos PIX. */
export async function persistContactCollectedData(opts: {
  clientId: string;
  destinationId?: string;
  contactPhone?: string;
  visitorPhone?: string;
  visitorName?: string;
  visitorEmail?: string;
  fields: ContactCollectedFields;
}): Promise<string | null> {
  try {
    const dest = await resolveDestinationForCollectedData(opts);
    if (!dest) return null;

    let changed = false;
    const { fields } = opts;

    const name = fields.name?.trim();
    if (name && !nameIsPlaceholder(dest, name) && name !== dest.name?.trim()) {
      dest.name = name.slice(0, 100);
      changed = true;
    } else if (name && nameIsPlaceholder(dest, dest.name) && name !== dest.name) {
      dest.name = name.slice(0, 100);
      changed = true;
    }

    const email = fields.email?.trim().toLowerCase();
    if (email?.includes('@') && email !== dest.email?.trim().toLowerCase()) {
      dest.email = email.slice(0, 254);
      changed = true;
    }

    const address = normalizeStoredAddress(fields.address);
    if (address && address !== resolveContactAddress(dest)) {
      dest.address = address;
      changed = true;
    }

    if (
      fields.locationLat != null &&
      fields.locationLng != null &&
      Number.isFinite(fields.locationLat) &&
      Number.isFinite(fields.locationLng)
    ) {
      if (dest.locationLat !== fields.locationLat || dest.locationLng !== fields.locationLng) {
        dest.locationLat = fields.locationLat;
        dest.locationLng = fields.locationLng;
        dest.locationUpdatedAt = new Date();
        changed = true;
      }
    }

    const taxRaw = fields.taxDocument?.trim();
    if (taxRaw) {
      const digits = taxRaw.replace(/\D/g, '');
      if (digits.length >= 11) {
        const stored = taxRaw.slice(0, 20);
        if (stored !== dest.taxDocument?.trim()) {
          dest.taxDocument = stored;
          changed = true;
        }
      }
    }

    const org = fields.organization?.trim();
    if (org && org !== dest.organization?.trim()) {
      dest.organization = org.slice(0, 120);
      changed = true;
    }

    const phone = fields.phone?.trim();
    if (phone) {
      const phoneNorm = phone.replace(/\D/g, '');
      const idNorm = dest.identifier.replace(/\D/g, '');
      if (phoneNorm.length >= 10 && phoneNorm !== idNorm && phone !== dest.secondaryPhone?.trim()) {
        dest.secondaryPhone = phone.slice(0, 40);
        changed = true;
      }
    }

    const noteLines: string[] = [];
    if (fields.deliveryNotes?.trim()) {
      noteLines.push(`Ref. entrega: ${fields.deliveryNotes.trim().slice(0, 200)}`);
    }
    if (fields.preferredSchedule?.trim()) {
      noteLines.push(`Horário preferido: ${fields.preferredSchedule.trim().slice(0, 80)}`);
    }
    if (noteLines.length) {
      const block = noteLines.join(' | ');
      const current = dest.notes?.trim() ?? '';
      if (!current.includes(block)) {
        dest.notes = [current, block].filter(Boolean).join('\n').slice(0, 2000);
        changed = true;
      }
    }

    if (!changed) return String(dest._id);
    await dest.save();
    logger.debug('Dados do contato atualizados a partir da coleta', {
      clientId: opts.clientId,
      destinationId: String(dest._id),
      hasAddress: Boolean(address),
      hasTax: Boolean(taxRaw),
    });
    return String(dest._id);
  } catch (err) {
    logger.warn('Falha ao persistir dados coletados no contato', {
      clientId: opts.clientId,
      err,
    });
    return null;
  }
}
