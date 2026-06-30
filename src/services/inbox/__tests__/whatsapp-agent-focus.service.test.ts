import {
  formatNumberedPicklist,
  looksLikeTicketRefToken,
  resolvePicklistIndex,
} from '@/services/inbox/whatsapp-agent-focus.service';

describe('whatsapp-agent-focus.service', () => {
  it('detects ticket ref tokens', () => {
    expect(looksLikeTicketRefToken('TK-ABC12')).toBe(true);
    expect(looksLikeTicketRefToken('ABC12')).toBe(true);
    expect(looksLikeTicketRefToken('Cliente VIP')).toBe(false);
  });

  it('resolves picklist index', () => {
    const entries = [
      { ticketRef: 'TK-A', label: 'Ana' },
      { ticketRef: 'TK-B', label: 'Bob' },
    ];
    expect(resolvePicklistIndex(entries, 1)).toBe('TK-A');
    expect(resolvePicklistIndex(entries, 2)).toBe('TK-B');
    expect(resolvePicklistIndex(entries, 3)).toBeNull();
  });

  it('formats numbered picklist', () => {
    const text = formatNumberedPicklist(
      'Abertos (2):',
      [
        { ticketRef: 'TK-1', label: 'Maria' },
        { ticketRef: 'TK-2', label: 'João' },
      ],
      '!assumir 1',
    );
    expect(text).toContain('1) TK-1 · Maria');
    expect(text).toContain('2) TK-2 · João');
    expect(text).toContain('!assumir 1');
  });
});
