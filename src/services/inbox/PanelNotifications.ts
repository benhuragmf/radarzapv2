import { Server as SocketIOServer } from 'socket.io';
import type { PanelEventPayload, PanelEventType } from '@/types/panel-events';
import {
  resolvePanelEventOwnerOnly,
  resolvePanelEventUrgency,
} from '@/types/panel-events';

export type { PanelEventPayload, PanelEventType };

let io: SocketIOServer | null = null;

export function setPanelSocketServer(server: SocketIOServer): void {
  io = server;
}

export function emitPanelEvent(clientId: string, event: PanelEventPayload): void {
  if (!io) return;
  const normalized: PanelEventPayload = {
    ...event,
    urgent: resolvePanelEventUrgency(event.type, event.urgent),
    ownerOnly: resolvePanelEventOwnerOnly(event.type, event.ownerOnly),
  };
  io.to(`inbox:${clientId}`).emit('panel:event', normalized);
}
