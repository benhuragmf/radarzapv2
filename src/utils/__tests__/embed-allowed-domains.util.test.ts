import {
  hostsFromWebsiteUrl,
  isEmbedOriginAllowed,
  resolveEmbedAllowedDomains,
} from '../embed-allowed-domains.util';

jest.mock('@/config/environment', () => ({
  config: {
    PUBLIC_EMBED: { ALLOW_OPEN_ORIGIN: false },
    DASHBOARD: { FRONTEND_URL: 'https://app.radarchat.com.br' },
    CORS_ORIGIN: 'https://app.radarchat.com.br',
  },
}));

describe('embed-allowed-domains.util', () => {
  it('hostsFromWebsiteUrl extrai www e apex', () => {
    expect(hostsFromWebsiteUrl('https://www.radarchat.com.br/')).toEqual(
      expect.arrayContaining(['www.radarchat.com.br', 'radarchat.com.br']),
    );
    expect(hostsFromWebsiteUrl('radarchat.com.br')).toEqual(
      expect.arrayContaining(['radarchat.com.br', 'www.radarchat.com.br']),
    );
  });

  it('resolveEmbedAllowedDomains mescla site da empresa com extras', () => {
    const effective = resolveEmbedAllowedDomains(['outrosite.com'], {
      companyWebsite: 'https://www.radarchat.com.br',
      includeCompanyWebsite: true,
    });
    expect(effective).toEqual(
      expect.arrayContaining(['www.radarchat.com.br', 'radarchat.com.br', 'outrosite.com']),
    );
  });

  it('includeCompanyWebsite false usa só domínios extras', () => {
    const effective = resolveEmbedAllowedDomains(['outrosite.com'], {
      companyWebsite: 'https://radarchat.com.br',
      includeCompanyWebsite: false,
    });
    expect(effective).toEqual(['outrosite.com']);
  });

  it('isEmbedOriginAllowed libera origem do site cadastrado na empresa', () => {
    expect(
      isEmbedOriginAllowed([], 'https://www.radarchat.com.br', null, {
        companyWebsite: 'https://www.radarchat.com.br/',
        includeCompanyWebsite: true,
      }),
    ).toBe(true);
    expect(
      isEmbedOriginAllowed([], 'https://radarchat.com.br', null, {
        companyWebsite: 'https://www.radarchat.com.br/',
        includeCompanyWebsite: true,
      }),
    ).toBe(true);
  });

  it('isEmbedOriginAllowed bloqueia quando embed é só para outro site', () => {
    expect(
      isEmbedOriginAllowed(['loja.com'], 'https://radarchat.com.br', null, {
        companyWebsite: 'https://radarchat.com.br',
        includeCompanyWebsite: false,
      }),
    ).toBe(false);
    expect(
      isEmbedOriginAllowed(['loja.com'], 'https://loja.com', null, {
        companyWebsite: 'https://radarchat.com.br',
        includeCompanyWebsite: false,
      }),
    ).toBe(true);
  });

  it('isEmbedOriginAllowed aceita * nos domínios adicionais', () => {
    const effective = resolveEmbedAllowedDomains(['*'], {
      companyWebsite: 'https://radarchat.com.br',
      includeCompanyWebsite: true,
    });
    expect(effective).toContain('*');
    expect(
      isEmbedOriginAllowed(['*'], 'https://qualquer-site.com', null, {
        companyWebsite: 'https://radarchat.com.br',
        includeCompanyWebsite: true,
      }),
    ).toBe(true);
  });
});
