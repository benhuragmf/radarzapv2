import { formatCepDisplay, isValidCepDigits, normalizeCepDigits } from '../br-cep.util';

describe('br-cep.util', () => {
  it('normaliza e formata CEP', () => {
    expect(normalizeCepDigits('01001-000')).toBe('01001000');
    expect(formatCepDisplay('01001000')).toBe('01001-000');
    expect(isValidCepDigits('01001-000')).toBe(true);
    expect(isValidCepDigits('0100')).toBe(false);
  });
});
