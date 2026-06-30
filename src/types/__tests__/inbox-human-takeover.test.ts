import {
  clampWhatsappPausarAutoResumeHours,
  humanTakeoverUntilFromHours,
  isHumanTakeoverActive,
} from '@/types/inbox-human-takeover';

describe('inbox-human-takeover', () => {
  it('clampWhatsappPausarAutoResumeHours limita 1–72', () => {
    expect(clampWhatsappPausarAutoResumeHours(2)).toBe(2);
    expect(clampWhatsappPausarAutoResumeHours(0)).toBe(1);
    expect(clampWhatsappPausarAutoResumeHours(100)).toBe(72);
    expect(clampWhatsappPausarAutoResumeHours('x')).toBe(2);
  });

  it('isHumanTakeoverActive respeita humanTakeoverUntil', () => {
    const now = Date.parse('2026-06-30T12:00:00.000Z');
    const future = new Date(now + 60 * 60 * 1000);
    const past = new Date(now - 1000);
    expect(isHumanTakeoverActive({ humanTakeoverUntil: future }, now)).toBe(true);
    expect(isHumanTakeoverActive({ humanTakeoverUntil: past }, now)).toBe(false);
    expect(isHumanTakeoverActive({}, now)).toBe(false);
  });

  it('humanTakeoverUntilFromHours soma horas', () => {
    const now = Date.parse('2026-06-30T10:00:00.000Z');
    expect(humanTakeoverUntilFromHours(2, now).toISOString()).toBe('2026-06-30T12:00:00.000Z');
  });
});
