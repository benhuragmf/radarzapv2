import {
  applyVisitorIntake,
  resolveVisitorNameFromIntake,
} from '@/utils/webchat-prechat-fields.util';

describe('webchat-prechat-fields name resolution', () => {
  const appearance = {
    prechatFields: [
      {
        id: 'qual_seu_nome',
        label: 'Qual seu nome',
        type: 'text' as const,
        enabled: true,
        required: true,
        preset: 'name' as const,
      },
      {
        id: 'phone',
        label: 'WhatsApp',
        type: 'phone' as const,
        enabled: true,
        required: true,
        preset: 'phone' as const,
      },
    ],
  };

  it('maps name from custom field id with preset name', () => {
    const applied = applyVisitorIntake(
      { qual_seu_nome: 'Maria Silva', phone: '5566999999999' },
      appearance,
    );
    expect(applied.visitorName).toBe('Maria Silva');
  });

  it('ignores label text stored as visitorName', () => {
    expect(
      resolveVisitorNameFromIntake(
        'Qual seu nome',
        { qual_seu_nome: 'João' },
        appearance,
      ),
    ).toBe('João');
  });
});
