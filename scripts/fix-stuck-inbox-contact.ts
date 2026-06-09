/**
 * Destrava contato preso em opt-out LGPD pendente e reativa IA Gemini.
 * Uso: npx ts-node -r dotenv/config -r tsconfig-paths/register scripts/fix-stuck-inbox-contact.ts [phone]
 */
import mongoose from 'mongoose';
import { config } from '@/config/environment';
import { Destination } from '@/models/Destination';
import { AiSettingsService } from '@/services/ai/AiSettingsService';

const CLIENT_ID = process.env.TEST_CLIENT_ID?.trim() || '6a18bdc5ee126fd553a2c56b';
const PHONE = process.argv[2]?.trim() || '+5566996819456';

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

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    await AiSettingsService.getInstance().upsertSettings(CLIENT_ID, {
      settings: {
        enabled: true,
        mode: 'company',
        provider: 'gemini',
        model: 'gemini-flash-latest',
        apiKey: geminiKey,
      },
    });
    console.log('IA Gemini reativada para tenant', CLIENT_ID);
  }

  await mongoose.disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
