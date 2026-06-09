/**
 * Inspeciona ticket por ref.
 * Uso: npx ts-node -r dotenv/config -r tsconfig-paths/register scripts/inspect-ticket.ts TK-5NP8CT
 */
import mongoose from 'mongoose';
import { config } from '@/config/environment';
import { InboxTicket } from '@/models/InboxTicket';
import { InboxConversation } from '@/models/InboxConversation';
import { Destination } from '@/models/Destination';
import { AiConversationState } from '@/models/AiConversationState';
import { InboxConversationStatus } from '@/types/inbox';

const REF = process.argv[2]?.trim() || 'TK-5NP8CT';

async function main() {
  await mongoose.connect(config.DATABASE.MONGODB_URL);
  const ticket = await InboxTicket.findOne({ ticketRef: REF }).lean();
  if (!ticket) {
    console.log('Ticket não encontrado:', REF);
    await mongoose.disconnect();
    return;
  }

  const conv = ticket.conversationId
    ? await InboxConversation.findById(ticket.conversationId).lean()
    : null;
  const dest = ticket.destinationId
    ? await Destination.findById(ticket.destinationId).lean()
    : null;
  const ai = conv
    ? await AiConversationState.findOne({ conversationId: conv._id }).lean()
    : null;

  const terminal = new Set([
    InboxConversationStatus.RESOLVED,
    InboxConversationStatus.CLOSED,
  ]);
  const openConvs = dest
    ? await InboxConversation.find({
        destinationId: dest._id,
        status: { $nin: [...terminal] },
      })
        .sort({ lastMessageAt: -1 })
        .lean()
    : [];

  console.log(
    JSON.stringify(
      {
        ticketRef: ticket.ticketRef,
        ticketStatus: ticket.status,
        ticketInboundMode: ticket.ticketInboundMode,
        clientReplyPaused: ticket.clientReplyPaused,
        clientReplyExpiresAt: ticket.clientReplyExpiresAt,
        closedAt: ticket.closedAt,
        conversation: conv
          ? { id: conv._id, status: conv.status, lastMessageAt: conv.lastMessageAt }
          : null,
        contact: dest
          ? { identifier: dest.identifier, name: dest.name }
          : null,
        aiOnTicketConversation: ai
          ? {
              status: ai.status,
              aiTurnCount: ai.aiTurnCount,
              escalationReason: ai.escalationReason,
            }
          : null,
        otherOpenConversations: openConvs.map(c => ({
          id: c._id,
          status: c.status,
          lastMessageAt: c.lastMessageAt,
        })),
      },
      null,
      2,
    ),
  );
  await mongoose.disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
