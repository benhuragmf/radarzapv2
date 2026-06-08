import { Server as SocketIOServer } from 'socket.io';

export type InboxRealtimeEvent =
  | 'inbox:conversation'
  | 'inbox:message';

export interface InboxRealtimePayload {
  conversationId: string;
  clientId: string;
  status?: string;
  departmentId?: string;
  assignedUserId?: string;
  suggestedUserId?: string;
}

let io: SocketIOServer | null = null;

export function setInboxSocketServer(server: SocketIOServer): void {
  io = server;
}

export function emitInboxEvent(
  clientId: string,
  event: InboxRealtimeEvent,
  payload: InboxRealtimePayload,
): void {
  if (!io) return;
  io.to(`inbox:${clientId}`).emit(event, payload);
}
