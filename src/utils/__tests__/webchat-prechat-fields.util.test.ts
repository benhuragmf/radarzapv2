import {
  classicPrechatFormAppearance,
  resolvePrechatMode,
  syncLegacyAppearanceFlags,
  toPlainAppearance,
} from '../webchat-prechat-fields.util';

describe('toPlainAppearance', () => {
  it('retorna objeto vazio para null/undefined', () => {
    expect(toPlainAppearance(null)).toEqual({});
    expect(toPlainAppearance(undefined)).toEqual({});
  });

  it('usa toObject em subdocumento Mongoose', () => {
    const doc = {
      theme: 'dark',
      primaryColor: '#0ea5e9',
      toObject: () => ({
        theme: 'dark',
        primaryColor: '#0ea5e9',
        title: 'Suporte',
        previewTemplateId: 'tech',
      }),
    };
    expect(toPlainAppearance(doc)).toEqual({
      theme: 'dark',
      primaryColor: '#0ea5e9',
      title: 'Suporte',
      previewTemplateId: 'tech',
    });
  });

  it('spread direto no subdocumento não expõe campos internos do toObject', () => {
    const mongooseLike = {
      _doc: { theme: 'dark', primaryColor: '#111' },
      toObject() {
        return { theme: 'dark', primaryColor: '#111', title: 'Chat' };
      },
    };
    const badMerge = { ...mongooseLike, prechatMode: 'form' as const };
    expect((badMerge as { theme?: string }).theme).toBeUndefined();

    const fixed = { ...toPlainAppearance(mongooseLike), prechatMode: 'form' as const };
    expect(fixed.theme).toBe('dark');
    expect(fixed.primaryColor).toBe('#111');
    expect(fixed.prechatMode).toBe('form');
  });
});

describe('syncLegacyAppearanceFlags — merge pré-chat × visual', () => {
  const darkVisual = {
    theme: 'dark' as const,
    primaryColor: '#22d3ee',
    title: 'Suporte TI',
    subtitle: 'Online agora',
    previewTemplateId: 'tech',
    prechatMode: 'steps' as const,
  };

  it('preserva tema e cores ao mudar só prechatMode', () => {
    const base = syncLegacyAppearanceFlags(darkVisual);
    const merged = syncLegacyAppearanceFlags({
      ...toPlainAppearance(base),
      prechatMode: 'form',
    });
    expect(merged.theme).toBe('dark');
    expect(merged.primaryColor).toBe('#22d3ee');
    expect(merged.previewTemplateId).toBe('tech');
    expect(merged.title).toBe('Suporte TI');
    expect(merged.prechatMode).toBe('form');
  });

  it('preserva visual ao aplicar formulário clássico', () => {
    const base = syncLegacyAppearanceFlags(darkVisual);
    const classic = classicPrechatFormAppearance(base);
    expect(classic.theme).toBe('dark');
    expect(classic.primaryColor).toBe('#22d3ee');
    expect(classic.previewTemplateId).toBe('tech');
    expect(resolvePrechatMode(classic)).toBe('form');
    expect(classic.prechatFields?.some(f => f.preset === 'phone')).toBe(true);
  });

  it('simula PATCH parcial de pré-chat sobre subdocumento existente', () => {
    const existingDoc = {
      toObject: () =>
        syncLegacyAppearanceFlags({
          ...darkVisual,
          askName: true,
          askPhone: true,
        }),
    };
    const prechatPatch = { prechatMode: 'form' as const };
    const merged = syncLegacyAppearanceFlags({
      ...toPlainAppearance(existingDoc),
      ...prechatPatch,
    });
    expect(merged.theme).toBe('dark');
    expect(merged.previewTemplateId).toBe('tech');
    expect(merged.prechatMode).toBe('form');
  });
});
