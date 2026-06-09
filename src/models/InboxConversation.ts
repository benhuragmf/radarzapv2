import mongoose, { Schema, Document } from 'mongoose';
import { InboxChannel, InboxConversationStatus } from '@/types/inbox';
import type { ConversationAiStatus } from '@/types/inbox-conversation-ai';

export interface IInboxConversation extends Document {
  clientId: mongoose.Types.ObjectId;
  destinationId: mongoose.Types.ObjectId;
  contactIdentifier: string;
  contactName: string;
  departmentId?: mongoose.Types.ObjectId;
  assignedUserId?: mongoose.Types.ObjectId;
  /** Indicado pelo round-robin — aguardando aceite voluntário */
  suggestedUserId?: mongoose.Types.ObjectId;
  suggestedAt?: Date;
  status: InboxConversationStatus;
  /** Camada IA — nunca misturar com status da conversa. */
  aiStatus?: ConversationAiStatus | null;
  /** Expira ai_fallback_standard (TTL 24h). */
  aiFallbackUntil?: Date;
  channel: InboxChannel;
  lastMessageAt: Date;
  lastInboundAt?: Date;
  /** Última mensagem enviada pelo atendente — base do SLA de inatividade. */
  lastOutboundAt?: Date;
  /** Aviso automático `/aus` já enviado neste ciclo de espera. */
  inactivityWarnedAt?: Date;
  queueEnteredAt?: Date;
  /** Alerta de fila parada já emitido para esta entrada na fila. */
  queueSlaNotifiedAt?: Date;
  /** Aguardando nota CSAT 1–5 após encerramento. */
  csatPending?: boolean;
  csatScore?: number;
  csatRatedAt?: Date;
  csatAssignedUserId?: mongoose.Types.ObjectId;
  acceptedAt?: Date;
  resolvedAt?: Date;
  /** Referência exibida ao converter em ticket */
  ticketRef?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InboxConversationSchema = new Schema<IInboxConversation>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, index: true },
    destinationId: { type: Schema.Types.ObjectId, required: true, ref: 'Destination', index: true },
    contactIdentifier: { type: String, required: true, index: true },
    contactName: { type: String, required: true, maxlength: 120 },
    departmentId: { type: Schema.Types.ObjectId, ref: 'InboxDepartment', index: true },
    assignedUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    suggestedUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    suggestedAt: { type: Date, index: true },
    status: {
      type: String,
      enum: Object.values(InboxConversationStatus),
      default: InboxConversationStatus.BOT_TRIAGE,
      index: true,
    },
    aiStatus: {
      type: String,
      enum: [
        'ai_collecting',
        'ai_waiting_client',
        'ai_completed',
        'ai_escalated',
        'ai_fallback_standard',
        'human_assigned',
      ],
      default: null,
    },
    aiFallbackUntil: Date,
    channel: {
      type: String,
      enum: ['whatsapp_qr', 'whatsapp_cloud'],
      default: 'whatsapp_qr',
    },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastInboundAt: Date,
    lastOutboundAt: Date,
    inactivityWarnedAt: Date,
    queueEnteredAt: Date,
    queueSlaNotifiedAt: Date,
    csatPending: { type: Boolean, default: false, index: true },
    csatScore: { type: Number, min: 1, max: 5 },
    csatRatedAt: Date,
    csatAssignedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    acceptedAt: Date,
    resolvedAt: Date,
    ticketRef: { type: String, maxlength: 32, index: true },
  },
  { timestamps: true, collection: 'inboxConversations' },
);

InboxConversationSchema.index({ clientId: 1, status: 1, lastMessageAt: -1 });
InboxConversationSchema.index({ clientId: 1, departmentId: 1, status: 1 });
InboxConversationSchema.index({ clientId: 1, status: 1, lastOutboundAt: 1 });

export const InboxConversation = mongoose.model<IInboxConversation>(
  'InboxConversation',
  InboxConversationSchema,
);
