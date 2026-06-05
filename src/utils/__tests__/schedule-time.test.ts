import {
  validateFutureSchedule,
  validateFutureTimeToday,
  validateOptionalCampaignSendAt,
  minFutureDate,
} from '@/utils/schedule-time';

describe('schedule-time', () => {
  const now = new Date(2026, 5, 4, 10, 0, 0);

  it('rejeita agendamento no passado', () => {
    const past = new Date(2026, 5, 4, 9, 0, 0);
    const r = validateFutureSchedule(past, now);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error).toMatch(/futuro/i);
  });

  it('aceita agendamento após minFutureDate', () => {
    const future = minFutureDate(now);
    const r = validateFutureSchedule(future, now);
    expect(r.ok).toBe(true);
  });

  it('validateOptionalCampaignSendAt sem sendAt', () => {
    const r = validateOptionalCampaignSendAt(undefined, now);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.date).toBeUndefined();
  });

  it('validateFutureTimeToday rejeita horário passado', () => {
    expect(validateFutureTimeToday('09:00', now)).toMatch(/passou|futuro/i);
    expect(validateFutureTimeToday('11:00', now)).toBeNull();
  });
});
