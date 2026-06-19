import {
  generateTicketPublicAccessToken,
  hashTicketPublicAccessToken,
  normalizeTicketPublicAccessToken,
  normalizeTicketRefForLookup,
  publicAccessTokenHint,
  verifyTicketPublicAccessToken,
} from '@/utils/ticket-public-access.util';

describe('ticket-public-access.util', () => {
  it('generates token in XXXX-XXXX format', () => {
    const token = generateTicketPublicAccessToken();
    expect(token).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it('normalizes ticket ref with optional hash prefix', () => {
    expect(normalizeTicketRefForLookup('tk-abc123')).toBe('TK-ABC123');
    expect(normalizeTicketRefForLookup('#TK-ABC123')).toBe('TK-ABC123');
  });

  it('verifies token against hash', () => {
    const raw = generateTicketPublicAccessToken();
    const hash = hashTicketPublicAccessToken(raw);
    expect(verifyTicketPublicAccessToken(raw, hash)).toBe(true);
    expect(verifyTicketPublicAccessToken('WRONG-TOK1', hash)).toBe(false);
    expect(verifyTicketPublicAccessToken(raw, undefined)).toBe(false);
  });

  it('normalizes access token case and spaces', () => {
    const raw = 'ab7k-92qd';
    const hash = hashTicketPublicAccessToken(raw);
    expect(normalizeTicketPublicAccessToken(' AB7K-92QD ')).toBe('AB7K-92QD');
    expect(verifyTicketPublicAccessToken('ab7k 92qd', hash)).toBe(true);
  });

  it('builds hint from last 4 chars', () => {
    expect(publicAccessTokenHint('AB7K-92QD')).toBe('92QD');
  });
});
