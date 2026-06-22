import { mentionsSupervisor } from '@/utils/internal-chat-supervisor-mention';

describe('mentionsSupervisor', () => {
  it('detects @supervisor case-insensitively', () => {
    expect(mentionsSupervisor('oi @supervisor pode ajudar?')).toBe(true);
    expect(mentionsSupervisor('@SUPERVISOR')).toBe(true);
    expect(mentionsSupervisor('@supervisor_')).toBe(false);
    expect(mentionsSupervisor('oi supervisor')).toBe(false);
    expect(mentionsSupervisor('')).toBe(false);
  });
});
