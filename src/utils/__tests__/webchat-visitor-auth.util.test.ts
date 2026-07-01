import express from 'express';
import type { Request } from 'express';

const mockConfig = { NODE_ENV: 'production' as string };

jest.mock('@/config/environment', () => ({
  config: mockConfig,
}));

import { resolveWebChatVisitorTokenFromRequest } from '@/utils/webchat-visitor-auth.util';

function req(overrides: Partial<Request> & { query?: Record<string, string> } = {}): Request {
  return {
    headers: {},
    query: {},
    ...overrides,
  } as Request;
}

describe('resolveWebChatVisitorTokenFromRequest', () => {
  beforeEach(() => {
    mockConfig.NODE_ENV = 'production';
  });

  it('prefere header X-WebChat-Visitor', () => {
    const result = resolveWebChatVisitorTokenFromRequest(
      req({
        headers: { 'x-webchat-visitor': 'wcv_abc' },
        query: { v: 'wcv_query' },
      }),
    );
    expect(result).toEqual({ ok: true, token: 'wcv_abc' });
  });

  it('bloqueia query ?v= em produção', () => {
    const result = resolveWebChatVisitorTokenFromRequest(req({ query: { v: 'wcv_leak' } }));
    expect(result).toEqual({ ok: false, code: 'QUERY_TOKEN_FORBIDDEN' });
  });

  it('permite query ?v= em desenvolvimento', () => {
    mockConfig.NODE_ENV = 'development';
    const result = resolveWebChatVisitorTokenFromRequest(req({ query: { v: 'wcv_dev' } }));
    expect(result).toEqual({ ok: true, token: 'wcv_dev' });
  });
});
