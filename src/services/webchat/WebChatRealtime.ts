import { Server as SocketIOServer } from 'socket.io';
import type {
  WebChatConversationDto,
  WebChatMessageDto,
} from '../../types/webchat';

export type WebChatRealtimeEvent = 'webchat:message' | 'webchat:conversation';

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
