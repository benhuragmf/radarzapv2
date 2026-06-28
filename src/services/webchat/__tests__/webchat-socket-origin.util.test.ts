import { WebChatWidget } from '@/models/WebChatWidget';
import {
  dashboardSocketOrigins,
  isSocketIoOriginAllowed,
  resetSocketEmbedOriginCache,
} from '../webchat-socket-origin.util';

jest.mock('@/models/WebChatWidget', () => ({
  WebChatWidget: { find: jest.fn() },
}));

describe('webchat-socket-origin.util', () => {
  beforeEach(() => {
    resetSocketEmbedOriginCache();
    jest.clearAllMocks();
  });

  it('dashboardSocketOrigins inclui localhost', () => {
    expect(dashboardSocketOrigins()).toContain('http://localhost:3001');
  });

  it('permite origem do painel sem consultar widgets', async () => {
    const origins = dashboardSocketOrigins();
    await expect(isSocketIoOriginAllowed(origins[0])).resolves.toBe(true);
    expect(WebChatWidget.find).not.toHaveBeenCalled();
  });

  it('valida embed contra allowedDomains dos widgets ativos', async () => {
    (WebChatWidget.find as jest.Mock).mockReturnValue({
      select: () => ({
        lean: async () => [{ allowedDomains: ['cliente.com.br'] }],
      }),
    });

    await expect(isSocketIoOriginAllowed('https://cliente.com.br')).resolves.toBe(true);
    await expect(isSocketIoOriginAllowed('https://evil.example')).resolves.toBe(false);
  });
});
