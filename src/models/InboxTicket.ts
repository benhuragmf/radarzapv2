import mongoose, { Schema, Document } from 'mongoose';
import { InboxTicketStatus, type TicketInboundMode } from '@/types/inbox-ticket';

export interface IInboxTicketComment {
  _id?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  body: string;
  mentionedUserIds?: mongoose.Types.ObjectId[];
  createdAt: Date;
}

export interface IInboxTicketInternalNote {
  _id?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  body: string;
  createdAt: Date;
}

export interface IInboxTicketClientReply {
  _id?: mongoose.Types.ObjectId;
  body: string;
  createdAt: Date;
  mediaType?: string;
  mediaUrl?: string;
}

export interface IInboxTicket extends Document {
  clientId: mongoose.Types.ObjectId;
  ticketRef: string;
  conversationId: mongoose.Types.ObjectId;
  destinationId: mongoose.Types.ObjectId;
  contactName: string;
  contactIdentifier: string;
  departmentId?: mongoose.Types.ObjectId;
  assignedUserId?: mongoose.Types.ObjectId;
  status: InboxTicketStatus;
  subject?: string;
  /** @deprecated — migrado para internalNotesList */
  internalNotes?: string;
  internalNotesList: IInboxTicketInternalNote[];
  comments: IInboxTicketComment[];
  clientReplies: IInboxTicketClientReply[];
  /** Equipe já enviou ao menos uma mensagem visível ao cliente */
  teamHasMessagedClient: boolean;
  /** Cliente enviou "sair" — pausa respostas até nova interação da equipe */
  clientReplyPaused: boolean;
  /** Após fechamento ou envio da equipe: prazo para o cliente responder (12h) */
  clientReplyExpiresAt?: Date;
  /** Início da janela de 12h (fechamento ou último envio da equipe) */
  clientReplyWindowStartedAt?: Date;
  /** Fluxo WhatsApp após pausa: menu 2h, ticket ativo ou novo atendimento */
  ticketInboundMode?: TicketInboundMode;
  /** Prazo para o cliente enviar complementos após responder (30 min) */
  clientReplyGraceUntil?: Date;
  unreadClientReply: boolean;
  lastClientReplyAt?: Date;
  /** Última mensagem da equipe visível ao cliente no WhatsApp */
  lastTeamMessageAt?: Date;
  openedByUserId: mongoose.Types.ObjectId;
  closedByUserId?: mongoose.Types.ObjectId;
  closedAt?: Date;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  deleteReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TicketCommentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 4000 },
    mentionedUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: { createdAt: true, updatedAt: false }, _id: true },
);

const ClientReplySchema = new Schema(
  {
    body: { type: String, required: true, maxlength: 4000 },
    mediaType: String,
    mediaUrl: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, _id: true },
);

const InternalNoteSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 4000 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, _id: true },
);

const InboxTicketSchema = new Schema<IInboxTicket>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, index: true },
    ticketRef: { type: String, required: true, maxlength: 32, index: true },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'InboxConversation',
      required: true,
      index: true,
    },
    destinationId: { type: Schema.Types.ObjectId, ref: 'Destination', required: true, index: true },
    contactName: { type: String, required: true, maxlength: 120 },
    contactIdentifier: { type: String, required: true, maxlength: 64 },
    departmentId: { type: Schema.Types.ObjectId, ref: 'InboxDepartment', index: true },
    assignedUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'client_replied', 'closed'],
      default: 'open',
      index: true,
    },
    subject: { type: String, maxlength: 200 },
    internalNotes: { type: String, maxlength: 8000 },
    internalNotesList: { type: [InternalNoteSchema], default: [] },
    comments: { type: [TicketCommentSchema], default: [] },
    clientReplies: { type: [ClientReplySchema], default: [] },
    teamHasMessagedClient: { type: Boolean, default: false },
    clientReplyPaused: { type: Boolean, default: false },
    clientReplyExpiresAt: Date,
    clientReplyWindowStartedAt: Date,
    ticketInboundMode: {
      type: String,
      enum: ['awaiting_follow_up', 'ticket', 'new_service'],
    },
    clientReplyGraceUntil: Date,
    unreadClientReply: { type: Boolean, default: false },
    lastClientReplyAt: Date,
    lastTeamMessageAt: Date,
    openedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    closedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    closedAt: Date,
    deletedAt: Date,
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deleteReason: { type: String, maxlength: 500 },
  },
  { timestamps: true, collection: 'inboxTickets' },
);

InboxTicketSchema.index({ clientId: 1, ticketRef: 1 }, { unique: true });
InboxTicketSchema.index({ clientId: 1, status: 1, updatedAt: -1 });

InboxTicketSchema.index({ clientId: 1, destinationId: 1, updatedAt: -1 });

export const InboxTicket = mongoose.model<IInboxTicket>('InboxTicket', InboxTicketSchema);
