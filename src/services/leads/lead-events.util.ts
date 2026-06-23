import type { LeadHistoryEntry, LeadHistoryKind } from '@/types/lead-form';
import { WebhookDispatcherService } from '@/services/integrations/WebhookDispatcherService';
import type { WebhookEvent } from '@/models/WebhookEndpoint';

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
