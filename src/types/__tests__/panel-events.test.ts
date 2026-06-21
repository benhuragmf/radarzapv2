import {
  isOwnerOnlyPanelEventType,
  isUrgentPanelEventType,
  resolvePanelEventUrgency,
} from '@/types/panel-events';

describe('panel-events priority', () => {
  it('marks critical operational types as urgent', () => {
    expect(isUrgentPanelEventType('whatsapp:disconnected')).toBe(true);
    expect(isUrgentPanelEventType('ai:quota_exceeded')).toBe(true);
    expect(isUrgentPanelEventType('inbox:new_chat')).toBe(false);
  });

  it('marks billing and ai alerts as owner-only by default', () => {
    expect(isOwnerOnlyPanelEventType('billing:plan_expiring')).toBe(true);
    expect(isOwnerOnlyPanelEventType('webchat:fallback_missed')).toBe(false);
  });

  it('respects explicit urgent override', () => {
    expect(resolvePanelEventUrgency('inbox:new_chat', true)).toBe(true);
    expect(resolvePanelEventUrgency('ai:quota_exceeded', false)).toBe(false);
  });
});
