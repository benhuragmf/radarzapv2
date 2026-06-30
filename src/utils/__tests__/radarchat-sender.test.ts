import {
  resolveSenderLabel,
} from '@/utils/discord-wa-format';
import {
  isGenericOrganizationName,
  resolveTenantSenderLabel,
} from '@/utils/radarchat-sender';
import type { ExtractedMessage } from '@/services/discord-bot/MessageExtractor';

describe('isGenericOrganizationName', () => {
  it('detecta Empresa + id hex', () => {
    expect(isGenericOrganizationName('Empresa a2c56b')).toBe(true);
    expect(isGenericOrganizationName('Minha empresa')).toBe(true);
  });

  it('aceita nome real', () => {
    expect(isGenericOrganizationName('SoContabilida')).toBe(false);
    expect(isGenericOrganizationName('skulksgamer')).toBe(false);
  });
});

describe('resolveTenantSenderLabel', () => {
  it('ignora Empresa a2c56b e usa displayName do painel', () => {
    expect(
      resolveTenantSenderLabel(
        { name: 'Empresa a2c56b' },
        { displayName: 'skulksgamer', email: 'a@b.com', discordUserId: '1' },
        'skulksgamer'
      )
    ).toBe('skulksgamer');
  });

  it('prioriza nome da empresa quando não é genérico', () => {
    expect(
      resolveTenantSenderLabel(
        { name: 'SoContabilida' },
        { displayName: 'João Google', email: 'a@b.com', discordUserId: '1' },
        'skulksgamer'
      )
    ).toBe('SoContabilida');
  });

  it('usa conta Discord quando não há displayName', () => {
    expect(
      resolveTenantSenderLabel(
        { name: 'Empresa deadbeef' },
        { displayName: '', email: 'x@y.com', discordUserId: '99' },
        'skulksgamer'
      )
    ).toBe('skulksgamer');
  });
});

describe('resolveSenderLabel (rodapé)', () => {
  it('usa radarchatSenderLabel do tenant, não autor do post Discord', () => {
    const extracted = {
      authorName: 'outro_user_no_canal',
      radarchatSenderLabel: 'SoContabilida',
    } as ExtractedMessage;

    expect(resolveSenderLabel(extracted)).toBe('SoContabilida');
  });
});
