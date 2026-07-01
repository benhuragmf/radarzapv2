import express from 'express';
import request from 'supertest';

const mockConfig = {
  NODE_ENV: 'production' as string,
  DASHBOARD: { FRONTEND_URL: 'https://app.radarchat.example' },
};

jest.mock('@/config/environment', () => ({
  config: mockConfig,
}));

import { requireDashboardOrigin } from '@/middleware/same-origin';

function appWithOriginGuard() {
  const app = express();
  app.use(requireDashboardOrigin);
  app.post('/api/test', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('requireDashboardOrigin', () => {
  beforeEach(() => {
    mockConfig.NODE_ENV = 'production';
    mockConfig.DASHBOARD.FRONTEND_URL = 'https://app.radarchat.example';
  });

  it('permite mutação com Origin do painel', async () => {
    const res = await request(appWithOriginGuard())
      .post('/api/test')
      .set('Origin', 'https://app.radarchat.example');

    expect(res.status).toBe(200);
  });

  it('bloqueia Origin de outro domínio', async () => {
    const res = await request(appWithOriginGuard())
      .post('/api/test')
      .set('Origin', 'https://evil.example');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_ORIGIN');
  });

  it('permite mutação sem Origin quando Sec-Fetch-Site é same-origin', async () => {
    const res = await request(appWithOriginGuard())
      .post('/api/test')
      .set('Sec-Fetch-Site', 'same-origin');

    expect(res.status).toBe(200);
  });

  it('permite mutação sem Origin quando Referer é do painel', async () => {
    const res = await request(appWithOriginGuard())
      .post('/api/test')
      .set('Referer', 'https://app.radarchat.example/settings');

    expect(res.status).toBe(200);
  });

  it('bloqueia mutação sem Origin nem Referer nem Sec-Fetch-Site', async () => {
    const res = await request(appWithOriginGuard()).post('/api/test');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MISSING_ORIGIN');
  });

  it('ignora em desenvolvimento', async () => {
    mockConfig.NODE_ENV = 'development';
    const res = await request(appWithOriginGuard()).post('/api/test');
    expect(res.status).toBe(200);
  });
});
