import {
  AI_NAME_RECONFIRM_AFTER_MS,
  maskContactDisplayName,
  resolveRegistryNameFromDestination,
  shouldReconfirmContactName,
} from '@/utils/ai-name-confirm.util';

describe('ai-name-confirm.util', () => {
  it('mascara cada palavra — 1ª/última maiúsculas e * proporcionais', () => {
    expect(maskContactDisplayName('Benhur')).toBe('B****R');
    expect(maskContactDisplayName('Benhur Monteiro')).toBe('B****R M******O');
    expect(maskContactDisplayName('Benhur Augusto')).toBe('B****R A*****O');
    expect(maskContactDisplayName('benhur augusto gomes monteiro faria')).toBe(
      'B****R A*****O G***S M******O F***A',
    );
    expect(maskContactDisplayName('Maria Silva')).toBe('M***A S***A');
    expect(maskContactDisplayName('Ana')).toBe('A*A');
  });

  it('preserva espaços do cadastro', () => {
    expect(maskContactDisplayName('Benhur  Monteiro')).toBe('B****R  M******O');
  });

  it('exige reconfirmação após 30 dias', () => {
    const now = new Date('2026-06-30T12:00:00Z');
    expect(shouldReconfirmContactName(null, now)).toBe(true);
    expect(shouldReconfirmContactName(new Date('2026-06-29T12:00:00Z'), now)).toBe(false);
    expect(
      shouldReconfirmContactName(
        new Date(now.getTime() - AI_NAME_RECONFIRM_AFTER_MS - 1),
        now,
      ),
    ).toBe(true);
  });

  it('ignora nome igual ao telefone no cadastro', () => {
    expect(
      resolveRegistryNameFromDestination({
        name: '5566996819456',
        identifier: '5566996819456',
      }),
    ).toBeUndefined();
    expect(
      resolveRegistryNameFromDestination({
        name: 'Benhur',
        identifier: '5566996819456',
      }),
    ).toBe('Benhur');
  });
});
