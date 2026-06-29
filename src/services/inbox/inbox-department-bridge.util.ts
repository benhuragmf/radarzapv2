import type { IInboxSettings } from '@/models/InboxSettings';
import type { IInboxDepartment } from '@/models/InboxDepartment';
import {
  DEFAULT_DEPARTMENT_MEMBER_BRIDGE,
  type InboxDepartmentMemberConfig,
} from '@/types/inbox-department';
import { isWithinBusinessHours } from '@/services/inbox/inbox-business-hours';

function memberConfigForUser(
  dept: Pick<IInboxDepartment, 'memberConfigs'>,
  userId: string,
): InboxDepartmentMemberConfig | null {
  const row = (dept.memberConfigs ?? []).find(c => String(c.userId) === String(userId));
  if (!row) return null;
  return {
    userId: String(row.userId),
    whatsappBridgeEnabled: row.whatsappBridgeEnabled !== false,
    bridgeHoursMode:
      row.bridgeHoursMode === 'never' ||
      row.bridgeHoursMode === 'business_hours' ||
      row.bridgeHoursMode === 'always'
        ? row.bridgeHoursMode
        : DEFAULT_DEPARTMENT_MEMBER_BRIDGE.bridgeHoursMode,
  };
}

/** Atendente elegível para alerta bridge deste setor no momento atual. */
export function isAgentBridgeEligibleNow(
  userId: string,
  dept: Pick<IInboxDepartment, 'memberConfigs'>,
  inboxSettings: Pick<IInboxSettings, 'businessHoursEnabled' | 'timezone' | 'schedule'>,
): boolean {
  const config = memberConfigForUser(dept, userId);
  if (config) {
    if (!config.whatsappBridgeEnabled || config.bridgeHoursMode === 'never') return false;
    if (config.bridgeHoursMode === 'business_hours') {
      return isWithinBusinessHours(
        inboxSettings.businessHoursEnabled,
        inboxSettings.timezone,
        inboxSettings.schedule,
      );
    }
    return true;
  }
  return true;
}

export function filterAgentsForDepartmentBridge<T extends { userId: string }>(
  agents: T[],
  dept: Pick<IInboxDepartment, 'memberConfigs'>,
  inboxSettings: Pick<IInboxSettings, 'businessHoursEnabled' | 'timezone' | 'schedule'>,
): T[] {
  return agents.filter(a => isAgentBridgeEligibleNow(a.userId, dept, inboxSettings));
}
