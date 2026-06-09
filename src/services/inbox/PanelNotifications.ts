import { Server as SocketIOServer } from 'socket.io';

export type PanelEventType =
  | 'inbox:new_chat'
  | 'inbox:new_message'
  | 'inbox:priority'
  | 'inbox:queue_sla'
  | 'whatsapp:disconnected'
  | 'whatsapp:connected';

export interface PanelEventPayload {
  id: string;
  type: PanelEventType;
  title: string;
  body: string;
  href?: string;
  conversationId?: string;
  createdAt: string;
}

let io: SocketIOServer | null = null;

export function setPanelSocketServer(server: SocketIOServer): void {
  io = server;
}

export function emitPanelEvent(clientId: string, event: PanelEventPayload): void {
  if (!io) return;
  io.to(`inbox:${clientId}`).emit('panel:event', event);
}
