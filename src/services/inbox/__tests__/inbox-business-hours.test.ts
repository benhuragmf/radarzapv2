import { isWithinBusinessHours } from '../inbox-business-hours';
import { DEFAULT_INBOX_WEEKLY_SCHEDULE } from '@/types/inbox-settings';

describe('isWithinBusinessHours', () => {
  it('returns true when business hours disabled', () => {
    expect(
      isWithinBusinessHours(false, 'America/Sao_Paulo', DEFAULT_INBOX_WEEKLY_SCHEDULE),
    ).toBe(true);
  });

  it('returns false when day is disabled in schedule', () => {
    const schedule = {
      ...DEFAULT_INBOX_WEEKLY_SCHEDULE,
      sunday: { enabled: false, start: '09:00', end: '18:00' },
    };
    const sunday = new Date('2026-06-07T15:00:00.000Z');
    jest.useFakeTimers().setSystemTime(sunday);
    expect(isWithinBusinessHours(true, 'America/Sao_Paulo', schedule)).toBe(false);
    jest.useRealTimers();
  });
});
