import mongoose, { Schema, Document, Model } from 'mongoose';

/** Enquete de consentimento enviada — persiste messageSecret para decifrar votos após restart */
export interface IConsentPoll extends Document {
  clientId: mongoose.Types.ObjectId;
  pollMsgId: string;
  remoteJid: string;
  messageSecretB64: string;
  optionNames: string[];
  /** JID do criador da enquete no momento do envio (para decifrar voto) */
  creatorJid?: string;
  createdAt: Date;
}

const ConsentPollSchema = new Schema<IConsentPoll>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, index: true },
    pollMsgId: { type: String, required: true, index: true },
    remoteJid: { type: String, required: true },
    messageSecretB64: { type: String, required: true },
    optionNames: { type: [String], required: true },
    creatorJid: { type: String },
  },
  { timestamps: true, collection: 'consentPolls' },
);

ConsentPollSchema.index({ clientId: 1, pollMsgId: 1 }, { unique: true });

/** Busca por ID da mensagem — remoteJid varia (@lid vs @s.whatsapp.net) entre envio e voto */
ConsentPollSchema.statics.findByPollId = function (clientId: string, pollMsgId: string) {
  return this.findOne({
    clientId: new mongoose.Types.ObjectId(clientId),
    pollMsgId,
  });
};

interface ConsentPollModel extends Model<IConsentPoll> {
  findByPollId(clientId: string, pollMsgId: string): Promise<IConsentPoll | null>;
}

export const ConsentPoll = mongoose.model<IConsentPoll, ConsentPollModel>('ConsentPoll', ConsentPollSchema);
