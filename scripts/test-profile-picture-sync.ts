/**
 * Diagnóstico rápido: fotos de perfil nos destinos.
 * Uso: npx ts-node -r dotenv/config -r tsconfig-paths/register scripts/test-profile-picture-sync.ts
 */
import mongoose from 'mongoose';
import { Destination } from '../src/models/Destination';
import { WhatsAppService } from '../src/services/whatsapp/WhatsAppService';

async function main() {
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/radarzap';
  await mongoose.connect(uri);

  const withMime = await Destination.countDocuments({
    profilePictureMime: { $exists: true, $nin: [null, ''] },
  });
  const total = await Destination.countDocuments({ type: 'contact', isActive: true });
  const sample = await Destination.find({ type: 'contact', isActive: true })
    .select('name identifier profilePictureMime profilePictureUpdatedAt')
    .limit(5)
    .lean();

  console.log('Contatos ativos:', total);
  console.log('Com foto salva (profilePictureMime):', withMime);
  console.log('Amostra:', sample);

  const wa = WhatsAppService.getInstance();
  const clientId = process.env.TEST_CLIENT_ID ?? sample[0]?.clientId?.toString();
  if (!clientId) {
    console.log('Sem clientId para testar sync.');
    await mongoose.disconnect();
    return;
  }

  console.log('WA conectado?', wa.isClientConnected(clientId));
  if (!wa.isClientConnected(clientId)) {
    console.log('Inicie npm run dev e aguarde WA conectar.');
    await mongoose.disconnect();
    return;
  }

  const result = await wa.syncDestinationProfilePictures(clientId, { limit: 3 });
  console.log('Sync resultado:', result);

  const after = await Destination.countDocuments({
    profilePictureMime: { $exists: true, $nin: [null, ''] },
  });
  console.log('Com foto após sync:', after);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
