import mongoose from 'mongoose';
import { InboxTicket } from '@/models/InboxTicket';
import type { AiTicketMenuItem } from '@/utils/ticket-ref';

/** Soft delete — inclui `deletedAt: null` e campo ausente. */
export const TICKET_NOT_DELETED_FILTER = {
  $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
};

/**
 * Chamados visíveis ao cliente no WhatsApp (menu IA / bot fixo).
 * Inclui abertos, em andamento, client_replied e fechados (com ou sem janela 12h).
 */
export async function listClientFacingTickets(
  clientId: string,
  destinationId: mongoose.Types.ObjectId,
  limit = 5,
): Promise<AiTicketMenuItem[]> {
  const rows = await InboxTicket.find({
    clientId: new mongoose.Types.ObjectId(clientId),
    destinationId,
    ...TICKET_NOT_DELETED_FILTER,
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('ticketRef subject status')
    .lean();

  return rows.map(t => ({
    ref: t.ticketRef,
    subject: t.subject,
    status: t.status,
  }));
}
