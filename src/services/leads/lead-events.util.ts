import type { LeadCaptureOrigin, LeadHistoryEntry, LeadHistoryKind } from '@/types/lead-form';
import { LEAD_CAPTURE_ORIGIN_LABEL } from '@/types/lead-form';
import { WebhookDispatcherService } from '@/services/integrations/WebhookDispatcherService';
import type { WebhookEvent } from '@/models/WebhookEndpoint';
import { emitPanelEvent, emitPanelSocketOnly } from '@/services/inbox/PanelNotifications';

export function appendLeadHistory(
  history: LeadHistoryEntry[] | undefined,
  kind: LeadHistoryKind,
  message: string,
  opts?: { userId?: string; meta?: Record<string, string> },
): LeadHistoryEntry[] {
  const entry: LeadHistoryEntry = {
    at: new Date().toISOString(),
    kind,
    message,
    userId: opts?.userId,
    meta: opts?.meta,
  };
  return [...(history ?? []), entry].slice(-50);
}

const LEAD_WEBHOOK_MAP: Partial<Record<LeadHistoryKind, WebhookEvent>> = {
  captured: 'lead.created',
  status_changed: 'lead.status_changed',
  converted: 'lead.converted_to_contact',
  sent_to_inbox: 'lead.sent_to_inbox',
  added_to_list: 'lead.added_to_list',
};

export function emitLeadWebhook(
  clientId: string,
  kind: LeadHistoryKind,
  data: Record<string, unknown>,
): void {
  const event = LEAD_WEBHOOK_MAP[kind];
  if (!event) return;
  void WebhookDispatcherService.getInstance().emit(clientId, event, data);
}

/** Sino do painel — nova entrada na Central de Leads. */
export function notifyNewLeadPanelEvent(
  clientId: string,
  capture: { id: string; name: string; origin: LeadCaptureOrigin; phone?: string },
): void {
  const originLabel = LEAD_CAPTURE_ORIGIN_LABEL[capture.origin] ?? capture.origin;
  emitPanelEvent(clientId, {
    id: `lead-${capture.id}-${Date.now()}`,
    type: 'lead:new_entry',
    title: 'Nova entrada comercial',
    body: `${capture.name} · ${originLabel}`,
    href: '/platform/leads',
    createdAt: new Date().toISOString(),
  });
}

/** Refresh silencioso da página Leads (Kanban/lista) via socket. */
export function notifyLeadPanelRefresh(clientId: string, captureId: string): void {
  emitPanelSocketOnly(clientId, {
    id: `lead-upd-${captureId}-${Date.now()}`,
    type: 'lead:updated',
    title: '',
    body: '',
    href: '/platform/leads',
    createdAt: new Date().toISOString(),
  });
}
