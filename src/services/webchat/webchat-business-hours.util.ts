import { loadInboxSettings } from '@/constants/inbox-triage';
import {
  formatScheduleSummary,
  isWithinBusinessHours,
} from '@/services/inbox/inbox-business-hours';
import {
  DEFAULT_INBOX_BOT_TEXTS,
  DEFAULT_INBOX_WEEKLY_SCHEDULE,
  type InboxWeeklySchedule,
} from '@/types/inbox-settings';
import type { IWebChatWidget } from '@/models/WebChatWidget';

export interface WebChatBusinessHoursState {
  isOnline: boolean;
  outsideHoursMessage: string;
  scheduleSummary: string;
  businessHoursEnabled: boolean;
}

type WidgetHoursFields = Pick<
  IWebChatWidget,
  | 'useInboxBusinessHours'
  | 'businessHoursEnabled'
  | 'timezone'
  | 'schedule'
  | 'outsideHoursMessage'
>;

export async function resolveWebChatBusinessHours(
  clientId: string,
  widget: WidgetHoursFields,
): Promise<WebChatBusinessHoursState> {
  if (widget.useInboxBusinessHours !== false) {
    const inbox = await loadInboxSettings(clientId);
    const schedule = inbox.schedule as InboxWeeklySchedule;
    return {
      isOnline: isWithinBusinessHours(inbox.businessHoursEnabled, inbox.timezone, schedule),
      outsideHoursMessage: inbox.outsideHoursMessage,
      scheduleSummary: formatScheduleSummary(schedule),
      businessHoursEnabled: inbox.businessHoursEnabled,
    };
  }

  const schedule = (widget.schedule ?? DEFAULT_INBOX_WEEKLY_SCHEDULE) as InboxWeeklySchedule;
  const enabled = Boolean(widget.businessHoursEnabled);
  const timezone = widget.timezone?.trim() || 'America/Sao_Paulo';

  return {
    isOnline: isWithinBusinessHours(enabled, timezone, schedule),
    outsideHoursMessage:
      widget.outsideHoursMessage?.trim() || DEFAULT_INBOX_BOT_TEXTS.outsideHoursMessage,
    scheduleSummary: formatScheduleSummary(schedule),
    businessHoursEnabled: enabled,
  };
}
