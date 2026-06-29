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

  it('libera localhost em dev', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      expect(isEmbedPreviewPanelOrigin('http://localhost:5174', null)).toBe(true);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
