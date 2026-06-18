import { Server as SocketIOServer } from 'socket.io';
import type {
  WebChatConversationDto,
  WebChatLiveVisitorDto,
  WebChatMessageDto,
} from '../../types/webchat';

export type WebChatRealtimeEvent =
  | 'webchat:message'
  | 'webchat:conversation'
  | 'webchat:presence'
  | 'webchat:agent-engage';

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
