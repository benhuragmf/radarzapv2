import {
  contactBirthdayMatchesToday,
  contactBirthdayDayOfMonth,
  parseBirthday,
  wasBirthdaySentThisYear,
  intervalMonthsElapsed,
  isSendTimeDue,
  isScheduledAtDue,
} from '@/utils/birthday-match';

describe('birthday-match', () => {
  it('contato 1992-03-20 corresponde a 20 de março', () => {
    const ref = new Date(2026, 2, 20, 12, 0, 0);
    expect(contactBirthdayMatchesToday('1992-03-20', ref)).toBe(true);
    expect(contactBirthdayMatchesToday('1992-03-21', ref)).toBe(false);
  });

  it('parseia MM-DD e YYYY-MM-DD', () => {
    expect(parseBirthday('03-20')).toEqual({ month: 3, day: 20 });
    expect(parseBirthday('1992-03-20')).toEqual({ year: 1992, month: 3, day: 20 });
  });

  it('day_of_month: contatos nascidos no dia 10', () => {
    expect(contactBirthdayDayOfMonth('1988-05-10', 10)).toBe(true);
    expect(contactBirthdayDayOfMonth('1988-05-11', 10)).toBe(false);
  });

  it('dedup anual por birthdayLastSentAt', () => {
    const ref = new Date(2026, 5, 4);
    expect(wasBirthdaySentThisYear(new Date(2026, 0, 15), ref)).toBe(true);
    expect(wasBirthdaySentThisYear(new Date(2025, 11, 31), ref)).toBe(false);
  });

  it('intervalo de 6 meses', () => {
    const ref = new Date(2026, 5, 4);
    const fiveMonthsAgo = new Date(2026, 0, 4);
    expect(intervalMonthsElapsed(fiveMonthsAgo, 6, ref)).toBe(false);
    const sevenMonthsAgo = new Date(2025, 10, 4);
    expect(intervalMonthsElapsed(sevenMonthsAgo, 6, ref)).toBe(true);
  });

  it('isSendTimeDue só no minuto exato', () => {
    expect(isSendTimeDue('09:00', new Date(2026, 5, 4, 9, 0, 30))).toBe(true);
    expect(isSendTimeDue('09:00', new Date(2026, 5, 4, 9, 1, 0))).toBe(false);
    expect(isSendTimeDue('09:00', new Date(2026, 5, 4, 8, 59, 59))).toBe(false);
  });

  it('isScheduledAtDue no minuto da data/hora agendada', () => {
    const sched = new Date(2026, 5, 10, 14, 30, 0);
    expect(isScheduledAtDue(sched, new Date(2026, 5, 10, 14, 30, 45))).toBe(true);
    expect(isScheduledAtDue(sched, new Date(2026, 5, 10, 14, 31, 0))).toBe(false);
    expect(isScheduledAtDue(sched, new Date(2026, 5, 10, 14, 29, 59))).toBe(false);
  });
});
