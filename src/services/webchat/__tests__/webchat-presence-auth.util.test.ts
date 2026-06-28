import { config } from '@/config/environment';
import {
  issueWebChatPresenceSocketAuth,
  verifyWebChatPresenceSocketAuth,
} from '../webchat-presence-auth.util';

describe('webchat-presence-auth.util', () => {
  const clientId = '507f1f77bcf86cd799439011';
  const presenceId = 'wcp_abc123';

  it('emite e valida token de presença', () => {
    const token = issueWebChatPresenceSocketAuth(clientId, presenceId);
    expect(token.startsWith('wcpa_')).toBe(true);
    expect(verifyWebChatPresenceSocketAuth(token, clientId, presenceId)).toBe(true);
  });

  it('rejeita token de outro presenceId', () => {
    const token = issueWebChatPresenceSocketAuth(clientId, presenceId);
    expect(verifyWebChatPresenceSocketAuth(token, clientId, 'wcp_other')).toBe(false);
  });

  it('rejeita token adulterado', () => {
    const token = issueWebChatPresenceSocketAuth(clientId, presenceId);
    expect(verifyWebChatPresenceSocketAuth(`${token}x`, clientId, presenceId)).toBe(false);
  });

  it('rejeita token expirado', () => {
    const token = issueWebChatPresenceSocketAuth(clientId, presenceId);
    const realNow = Date.now;
    Date.now = () => realNow() + 6 * 60 * 1000;
    try {
      expect(verifyWebChatPresenceSocketAuth(token, clientId, presenceId)).toBe(false);
    } finally {
      Date.now = realNow;
    }
  });
});

describe('webchat-presence-auth.util — produção', () => {
  it('usa SESSION_SECRET do config', () => {
    expect(config.SECURITY.SESSION_SECRET.length).toBeGreaterThan(8);
  });
});
