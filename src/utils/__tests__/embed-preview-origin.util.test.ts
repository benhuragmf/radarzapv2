import { isEmbedPreviewPanelOrigin } from '../embed-preview-origin.util';

jest.mock('@/config/environment', () => ({
  config: {
    DASHBOARD: { FRONTEND_URL: 'https://app.radarchat.com.br' },
    CORS_ORIGIN: 'https://app.radarchat.com.br',
  },
}));

describe('embed-preview-origin.util', () => {
  it('libera origem do painel em produção', () => {
    expect(isEmbedPreviewPanelOrigin('https://app.radarchat.com.br', null)).toBe(true);
  });

  it('bloqueia origem de site externo', () => {
    expect(isEmbedPreviewPanelOrigin('https://evil-phish.com', null)).toBe(false);
  });

  it('libera same-origin sem Referer em produção (iframe do painel)', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(isEmbedPreviewPanelOrigin(null, null, { secFetchSite: 'same-origin' })).toBe(true);
      expect(isEmbedPreviewPanelOrigin(null, null, { secFetchSite: 'cross-origin' })).toBe(false);
      expect(isEmbedPreviewPanelOrigin(null, null, {})).toBe(false);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
