import { memberHasAnyRole, parseDiscordIdList } from '../discord-id-list.util';

describe('discord-id-list.util', () => {
  describe('parseDiscordIdList', () => {
    it('parseia array e string vírgula', () => {
      expect(parseDiscordIdList(['123456789012345678', 'bad'])).toEqual(['123456789012345678']);
      expect(parseDiscordIdList('123456789012345678, 987654321098765432')).toEqual([
        '123456789012345678',
        '987654321098765432',
      ]);
    });
  });

  describe('memberHasAnyRole', () => {
    it('exige interseção quando há filtro', () => {
      expect(memberHasAnyRole(['a', 'b'], ['c'])).toBe(false);
      expect(memberHasAnyRole(['a', 'b'], ['b'])).toBe(true);
      expect(memberHasAnyRole(undefined, ['b'])).toBe(false);
      expect(memberHasAnyRole(['a'], [])).toBe(true);
    });
  });
});
