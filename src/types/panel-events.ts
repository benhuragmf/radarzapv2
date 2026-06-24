/** Tipos de evento do sino de notificações do painel. */
export type PanelEventType =
  | 'inbox:new_chat'
  | 'inbox:new_message'
  | 'inbox:priority'
  | 'inbox:priority_expired'
  | 'inbox:supervisor_help'
  | 'inbox:queue_sla'
  | 'inbox:ticket_sla'
  | 'webchat:escalated'
  | 'webchat:fallback_missed'
  | 'whatsapp:disconnected'
  | 'whatsapp:connected'
  | 'billing:plan_expiring'
  | 'billing:plan_expired'
  | 'billing:messages_quota_exceeded'
  | 'ai:quota_exceeded'
  | 'ai:quota_low'
  | 'system:critical_config'
  | 'lead:new_entry'
  | 'lead:updated';

export interface PanelEventPayload {
  id: string;
  type: PanelEventType;
  title: string;
  body: string;
  href?: string;
  conversationId?: string;
  /** Quando definido, só o atendente alvo deve ver a notificação no painel. */
  targetUserId?: string;
  /** Só dono/gestão com billing:view (OWNER/ADMIN). */
  ownerOnly?: boolean;
  /** Destaque vermelho no sino e som urgente. */
  urgent?: boolean;
  createdAt: string;
}

/** Badge vermelho + som urgente — problemas críticos operacionais e de conta. */
export const URGENT_PANEL_EVENT_TYPES: ReadonlySet<string> = new Set([
  'whatsapp:disconnected',
  'inbox:queue_sla',
  'inbox:ticket_sla',
  'webchat:fallback_missed',
  'billing:plan_expiring',
  'billing:plan_expired',
  'billing:messages_quota_exceeded',
  'ai:quota_exceeded',
  'ai:quota_low',
  'system:critical_config',
]);

/** Visível apenas para quem tem billing:view (dono da empresa / admin). */
export const OWNER_ONLY_PANEL_EVENT_TYPES: ReadonlySet<string> = new Set([
  'billing:plan_expiring',
  'billing:plan_expired',
  'billing:messages_quota_exceeded',
  'ai:quota_exceeded',
  'ai:quota_low',
  'system:critical_config',
]);

export function isUrgentPanelEventType(type: string): boolean {
  return URGENT_PANEL_EVENT_TYPES.has(type);
}

export function isOwnerOnlyPanelEventType(type: string): boolean {
  return OWNER_ONLY_PANEL_EVENT_TYPES.has(type);
}

export function resolvePanelEventUrgency(type: string, explicit?: boolean): boolean {
  if (explicit === true) return true;
  if (explicit === false) return false;
  return isUrgentPanelEventType(type);
}

export function resolvePanelEventOwnerOnly(type: string, explicit?: boolean): boolean {
  if (explicit === true) return true;
  if (explicit === false) return false;
  return isOwnerOnlyPanelEventType(type);
}
