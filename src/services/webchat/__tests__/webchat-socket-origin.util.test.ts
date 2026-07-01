import { WebChatWidget } from '@/models/WebChatWidget';
import { Organization } from '@/models/Organization';
import {
  dashboardSocketOrigins,
  isSocketIoOriginAllowed,
  resetSocketEmbedOriginCache,
} from '../webchat-socket-origin.util';

jest.mock('@/models/WebChatWidget', () => ({
  WebChatWidget: { find: jest.fn() },
}));

jest.mock('@/models/Organization', () => ({
  Organization: { find: jest.fn() },
}));

describe('webchat-socket-origin.util', () => {
  beforeEach(() => {
    resetSocketEmbedOriginCache();
    jest.clearAllMocks();
    (Organization.find as jest.Mock).mockReturnValue({
      select: () => ({ lean: async () => [] }),
    });
    (WebChatWidget.find as jest.Mock).mockReturnValue({
      select: () => ({ lean: async () => [] }),
    });
  });

  it('dashboardSocketOrigins inclui localhost', () => {
    expect(dashboardSocketOrigins()).toContain('http://localhost:3001');
  });

  it('permite origem do painel sem consultar widgets', async () => {
    await expect(isSocketIoOriginAllowed('http://localhost:3001')).resolves.toBe(true);
    expect(WebChatWidget.find).not.toHaveBeenCalled();
  });

  it('valida embed contra allowedDomains dos widgets ativos', async () => {
    (WebChatWidget.find as jest.Mock).mockReturnValue({
      select: () => ({
        lean: async () => [{ allowedDomains: ['cliente.com.br'], clientId: '507f1f77bcf86cd799439011' }],
      }),
    });
    (Organization.find as jest.Mock).mockReturnValue({
      select: () => ({ lean: async () => [] }),
    });

    await expect(isSocketIoOriginAllowed('https://cliente.com.br')).resolves.toBe(true);
    await expect(isSocketIoOriginAllowed('https://evil.example')).resolves.toBe(false);
  });
});
