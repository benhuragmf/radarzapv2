import { Server as SocketIOServer } from 'socket.io';
import type { PanelEventPayload, PanelEventType } from '@/types/panel-events';
import {
  resolvePanelEventOwnerOnly,
  resolvePanelEventUrgency,
} from '@/types/panel-events';
import { persistPanelEvent } from '@/services/inbox/panel-notifications-store.service';

export type { PanelEventPayload, PanelEventType };

let io: SocketIOServer | null = null;

export function setPanelSocketServer(server: SocketIOServer): void {
  io = server;
}

export function emitPanelEvent(clientId: string, event: PanelEventPayload): void {
  const normalized: PanelEventPayload = {
    ...event,
    urgent: resolvePanelEventUrgency(event.type, event.urgent),
    ownerOnly: resolvePanelEventOwnerOnly(event.type, event.ownerOnly),
  };

  void persistPanelEvent(clientId, normalized);

  if (!io) return;
  io.to(`inbox:${clientId}`).emit('panel:event', normalized);
}

/** Socket apenas — não persiste no sino (refresh silencioso de telas). */
export function emitPanelSocketOnly(clientId: string, event: PanelEventPayload): void {
  if (!io) return;
  io.to(`inbox:${clientId}`).emit('panel:event', {
    ...event,
    urgent: false,
    ownerOnly: false,
  });
}
