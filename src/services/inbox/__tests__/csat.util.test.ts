import { parseCsatScore } from '../csat.util';

describe('csat.util', () => {
  it('aceita 1-5', () => {
    expect(parseCsatScore('5')).toBe(5);
    expect(parseCsatScore(' 3 ')).toBe(3);
  });

  it('rejeita outras respostas', () => {
    expect(parseCsatScore('10')).toBeNull();
    expect(parseCsatScore('bom')).toBeNull();
  });
});
