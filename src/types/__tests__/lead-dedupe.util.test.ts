import {
  OPEN_LEAD_STATUSES,
  canCreateNewLeadAfterClosed,
  emailsMatchForLeadDedupe,
  isOpenLeadStatus,
  normalizeLeadEmail,
  normalizeLeadPhone,
  phonesMatchForLeadDedupe,
} from '@/types/lead-dedupe.util';

describe('lead-dedupe.util', () => {
  it('define status abertos e fechados', () => {
    expect(OPEN_LEAD_STATUSES).toContain('new');
    expect(isOpenLeadStatus('in_progress')).toBe(true);
    expect(isOpenLeadStatus('converted')).toBe(false);
    expect(canCreateNewLeadAfterClosed('converted')).toBe(true);
    expect(canCreateNewLeadAfterClosed('new')).toBe(false);
  });

  it('normaliza telefone para deduplicação', () => {
    expect(normalizeLeadPhone('11999887766')).toBeTruthy();
    expect(phonesMatchForLeadDedupe('11999887766', '5511999887766')).toBe(true);
    expect(phonesMatchForLeadDedupe('11999887766', '21999887766')).toBe(false);
  });

  it('normaliza e-mail para deduplicação', () => {
    expect(normalizeLeadEmail(' A@B.COM ')).toBe('a@b.com');
    expect(emailsMatchForLeadDedupe('A@B.COM', 'a@b.com')).toBe(true);
    expect(emailsMatchForLeadDedupe('invalid', 'a@b.com')).toBe(false);
  });
});
