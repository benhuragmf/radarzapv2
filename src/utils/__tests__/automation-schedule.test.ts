import {
  isCalendarDayOfMonth,
  isNthBusinessDayOfMonth,
  weekdayMatches,
} from '../automation-schedule';

describe('automation-schedule', () => {
  it('calendar day of month', () => {
    const ref = new Date(2026, 5, 10, 12, 0, 0);
    expect(isCalendarDayOfMonth(ref, 10)).toBe(true);
    expect(isCalendarDayOfMonth(ref, 11)).toBe(false);
  });

  it('5º dia útil de junho/2026', () => {
    // Jun 2026: 1 Mon, 2 Tue, 3 Wed, 4 Thu, 5 Fri = 5th business day
    const fifth = new Date(2026, 5, 5, 10, 0, 0);
    expect(isNthBusinessDayOfMonth(fifth, 5)).toBe(true);
    const fourth = new Date(2026, 5, 4, 10, 0, 0);
    expect(isNthBusinessDayOfMonth(fourth, 5)).toBe(false);
  });

  it('weekday ISO 1=segunda', () => {
    const mon = new Date(2026, 5, 1, 9, 0, 0);
    expect(weekdayMatches(mon, 1)).toBe(true);
    expect(weekdayMatches(mon, 2)).toBe(false);
  });
});
