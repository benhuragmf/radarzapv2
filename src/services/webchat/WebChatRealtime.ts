import { Server as SocketIOServer } from 'socket.io';
import type {
  WebChatConversationDto,
  WebChatLiveVisitorDto,
  WebChatMessageDto,
  WebChatTypingPayload,
} from '../../types/webchat';

export type WebChatRealtimeEvent =
  | 'webchat:message'
  | 'webchat:conversation'
  | 'webchat:presence'
  | 'webchat:agent-engage'
  | 'webchat:typing'
  | 'webchat:message-receipt';

export interface WebChatRealtimePayload {
  clientId: string;
  conversationId: string;
  conversation?: WebChatConversationDto;
  message?: WebChatMessageDto;
}

let io: SocketIOServer | null = null;

export function setWebChatSocketServer(server: SocketIOServer): void {
  io = server;
}

export async function hasVisitorSocketInConversation(conversationId: string): Promise<boolean> {
  if (!io || !conversationId) return false;
  try {
    const sockets = await io.in(`webchat:conv:${conversationId}`).fetchSockets();
    return sockets.length > 0;
  } catch {
    return false;
  }
}

export function emitWebChatToTenant(
  clientId: string,
  event: WebChatRealtimeEvent,
  payload: WebChatRealtimePayload,
): void {
  if (!io) return;
  io.to(`tenant:${clientId}`).emit(event, payload);
}

export function emitWebChatToVisitor(
  conversationId: string,
  event: WebChatRealtimeEvent,
  payload: WebChatRealtimePayload,
): void {
  if (!io) return;
  io.to(`webchat:conv:${conversationId}`).emit(event, payload);
}

export function emitWebChatPresenceToTenant(clientId: string, visitor: WebChatLiveVisitorDto): void {
  if (!io) return;
  io.to(`tenant:${clientId}`).emit('webchat:presence', { clientId, visitor });
}

export function emitWebChatAgentEngage(
  presenceId: string,
  payload: {
    visitorToken?: string;
    conversationId: string;
    openChat?: boolean;
    skipPrechat?: boolean;
  },
): void {
  if (!io) return;
  io.to(`webchat:presence:${presenceId}`).emit('webchat:agent-engage', payload);
  if (payload.conversationId) {
    io.to(`webchat:conv:${payload.conversationId}`).emit('webchat:agent-engage', payload);
  }
}

export function emitWebChatTypingToTenant(clientId: string, payload: WebChatTypingPayload): void {
  if (!io) return;
  io.to(`tenant:${clientId}`).emit('webchat:typing', payload);
}

export function emitWebChatTypingToVisitor(conversationId: string, payload: WebChatTypingPayload): void {
  if (!io) return;
  io.to(`webchat:conv:${conversationId}`).emit('webchat:typing', payload);
}

export function emitWebChatMessageReceiptToTenant(
  clientId: string,
  conversationId: string,
  messageIds: string[],
  opts: { deliveredAt?: Date; readAt?: Date; inboundBatch?: boolean; readThrough?: boolean },
): void {
  if (!io) return;
  io.to(`tenant:${clientId}`).emit('webchat:message-receipt', {
    clientId,
    conversationId,
    messageIds,
    deliveredAt: opts.deliveredAt?.toISOString(),
    readAt: opts.readAt?.toISOString(),
    inboundBatch: opts.inboundBatch,
    readThrough: opts.readThrough,
  });
}

export function emitWebChatMessageReceiptToVisitor(
  conversationId: string,
  opts: {
    messageIds?: string[];
    deliveredAt?: Date;
    readAt?: Date;
    inboundBatch?: boolean;
    readThrough?: boolean;
  },
): void {
  if (!io) return;
  io.to(`webchat:conv:${conversationId}`).emit('webchat:message-receipt', {
    conversationId,
    messageIds: opts.messageIds ?? [],
    deliveredAt: opts.deliveredAt?.toISOString(),
    readAt: opts.readAt?.toISOString(),
    inboundBatch: opts.inboundBatch,
    readThrough: opts.readThrough,
  });
}
