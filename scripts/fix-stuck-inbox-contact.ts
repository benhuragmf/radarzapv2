/**
 * Destrava contato preso em opt-out LGPD, ticket na janela 12h ou triagem inbox.
 * Uso: npx ts-node -r dotenv/config -r tsconfig-paths/register scripts/fix-stuck-inbox-contact.ts [phone]
 * Flags: --ai-off (desativa IA do tenant) | --ai-on (reativa Gemini com GEMINI_API_KEY)
 */
import mongoose from 'mongoose';
import { config } from '@/config/environment';
import { Destination } from '@/models/Destination';
import { InboxTicket } from '@/models/InboxTicket';
import { InboxConversation } from '@/models/InboxConversation';
import { InboxConversationStatus } from '@/types/inbox';
import { AiSettingsService } from '@/services/ai/AiSettingsService';
import { AiConversationState } from '@/models/AiConversationState';

const CLIENT_ID = process.env.TEST_CLIENT_ID?.trim() || '6a18bdc5ee126fd553a2c56b';
const args = process.argv.slice(2);
const PHONE = args.find(a => !a.startsWith('--'))?.trim() || '+5566996819456';
const aiOff = args.includes('--ai-off');
const aiOn = args.includes('--ai-on');

async function main() {
  await mongoose.connect(config.DATABASE.MONGODB_URL);
  const clientOid = new mongoose.Types.ObjectId(CLIENT_ID);

  const dest = await Destination.findOne({
    clientId: clientOid,
    type: 'contact',
    identifier: PHONE,
  });
  if (!dest) throw new Error(`Contato ${PHONE} não encontrado`);

  if (dest.optOutConfirmPendingAt) {
    dest.optOutConfirmPendingAt = undefined;
    await dest.save();
    console.log('optOutConfirmPendingAt limpo para', PHONE);
  } else {
    console.log('Sem opt-out pendente em', PHONE);
  }

  const now = new Date();
  const ticketResult = await InboxTicket.updateMany(
    {
      clientId: clientOid,
      destinationId: dest._id,
      $or: [
        { status: { $in: ['open', 'in_progress', 'client_replied'] } },
        { status: 'closed', clientReplyExpiresAt: { $gt: now } },
      ],
    },
    {
      $set: { ticketInboundMode: 'new_service', clientReplyPaused: false },
      $unset: { clientReplyGraceUntil: '' },
    },
  );
  console.log('Tickets liberados para inbox (new_service):', ticketResult.modifiedCount);

  const openConvs = await InboxConversation.find({
    clientId: clientOid,
    destinationId: dest._id,
    status: { $nin: [InboxConversationStatus.RESOLVED, InboxConversationStatus.CLOSED] },
  }).select('_id status');

  for (const conv of openConvs) {
    await InboxConversation.updateOne(
      { _id: conv._id },
      {
        $set: { status: InboxConversationStatus.BOT_TRIAGE },
        $unset: {
          departmentId: '',
          assignedUserId: '',
          suggestedUserId: '',
          suggestedAt: '',
          queueEnteredAt: '',
          queueSlaNotifiedAt: '',
          aiStatus: '',
          aiFallbackUntil: '',
        },
      },
    );
    await AiConversationState.deleteOne({ conversationId: conv._id });
  }
  console.log('Conversas abertas resetadas para BOT_TRIAGE:', openConvs.length);

  if (aiOff) {
    await AiSettingsService.getInstance().upsertSettings(CLIENT_ID, {
      settings: { enabled: false, mode: 'disabled' },
    });
    console.log('IA desativada para tenant', CLIENT_ID);
  } else if (aiOn) {
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (!geminiKey) throw new Error('GEMINI_API_KEY ausente no .env');
    await AiSettingsService.getInstance().upsertSettings(CLIENT_ID, {
      settings: {
        enabled: true,
        mode: 'company',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        maxTokens: 600,
        apiKey: geminiKey,
      },
    });
    console.log('IA Gemini reativada para tenant', CLIENT_ID);
  } else {
    const active = await AiSettingsService.getInstance().isAiActive(CLIENT_ID);
    console.log('IA tenant:', active ? 'ativa' : 'desativada', '(use --ai-off ou --ai-on para alterar)');
  }

  await mongoose.disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
