import { generateInboxTicketRef } from '../inbox-ticket-ref';

const AMBIGUOUS = /[01ILO]/;

describe('generateInboxTicketRef', () => {
  it('gera TK- com 6 caracteres após o prefixo', () => {
    const ref = generateInboxTicketRef();
    expect(ref).toMatch(/^TK-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  });

  it('não usa caracteres ambíguos (0/O/1/I/L)', () => {
    for (let i = 0; i < 50; i++) {
      const suffix = generateInboxTicketRef().slice(3);
      expect(suffix).not.toMatch(AMBIGUOUS);
    }
  });
});
