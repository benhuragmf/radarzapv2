import {
  triggerMatchesCalendarToday,
  validateAutomationScheduleTimes,
} from '@/constants/platform-automation-triggers';

describe('validateAutomationScheduleTimes', () => {
  it('rejeita once_at no passado', () => {
    const now = new Date(2026, 5, 4, 10, 0, 0);
    const past = new Date(2026, 5, 4, 9, 0, 0).toISOString();
    expect(validateAutomationScheduleTimes({ triggerType: 'once_at', scheduledAt: past }, now)).toMatch(
      /futuro/i,
    );
  });

  it('aceita once_at no futuro', () => {
    const now = new Date(2026, 5, 4, 10, 0, 0);
    const future = new Date(2026, 5, 4, 11, 0, 0).toISOString();
    expect(validateAutomationScheduleTimes({ triggerType: 'once_at', scheduledAt: future }, now)).toBeNull();
  });

  it('rejeita sendTime passado quando gatilho é hoje', () => {
    const now = new Date(2026, 5, 4, 15, 0, 0);
    expect(
      validateAutomationScheduleTimes(
        { triggerType: 'on_contact_birthday', sendTime: '09:00' },
        now,
      ),
    ).toMatch(/passou/i);
  });

  it('aceita sendTime futuro no mesmo dia', () => {
    const now = new Date(2026, 5, 4, 10, 0, 0);
    expect(
      validateAutomationScheduleTimes(
        { triggerType: 'weekly', sendTime: '14:00', weekdays: [3] },
        now,
      ),
    ).toBeNull();
  });

  it('weekly só valida horário se hoje é dia marcado', () => {
    const wed = new Date(2026, 5, 3, 15, 0, 0);
    expect(triggerMatchesCalendarToday({ triggerType: 'weekly', weekdays: [3] }, wed)).toBe(true);
    const thu = new Date(2026, 5, 4, 15, 0, 0);
    expect(triggerMatchesCalendarToday({ triggerType: 'weekly', weekdays: [3] }, thu)).toBe(false);
    expect(
      validateAutomationScheduleTimes(
        { triggerType: 'weekly', sendTime: '16:00', weekdays: [3] },
        thu,
      ),
    ).toBeNull();
  });
});
