import { Cap } from '@/auth/rbac/capabilities';
import { buildCapabilities } from '@/auth/rbac/can';
import { CompanyRole, SystemRole } from '@/auth/rbac/roles';
import {
  assertWhatsappSessionClientMatch,
  canUserManageWhatsappSession,
  canUserViewWhatsappSession,
  isWhatsappSessionConnected,
  isWhatsappQrLogSafe,
  normalizeWhatsappSessionStatus,
  sanitizeWhatsappOutboundText,
  WHATSAPP_OUTBOUND_TEXT_MAX,
} from '@/types/whatsapp-session.util';

describe('whatsapp-session.util', () => {
  it('normalizeWhatsappSessionStatus mapeia estados do cache', () => {
    expect(normalizeWhatsappSessionStatus({ cacheStatus: 'connected' })).toBe('connected');
    expect(normalizeWhatsappSessionStatus({ isLive: true })).toBe('connected');
    expect(normalizeWhatsappSessionStatus({ cacheStatus: 'qr-required' })).toBe('qr_pending');
    expect(normalizeWhatsappSessionStatus({ cacheStatus: 'connecting' })).toBe('connecting');
    expect(
      normalizeWhatsappSessionStatus({ cacheStatus: 'connecting', isReconnecting: true }),
    ).toBe('reconnecting');
    expect(normalizeWhatsappSessionStatus({ integrationDisabled: true })).toBe('disabled');
    expect(
      normalizeWhatsappSessionStatus({ cacheStatus: 'disconnected', manualDisconnect: true }),
    ).toBe('logged_out');
    expect(normalizeWhatsappSessionStatus({ cacheStatus: 'disconnected', statusReason: 500 })).toBe(
      'error',
    );
  });

  it('isWhatsappSessionConnected', () => {
    expect(isWhatsappSessionConnected('connected')).toBe(true);
    expect(isWhatsappSessionConnected('connecting')).toBe(false);
  });

  it('capabilities de sessão WA', () => {
    const ownerCaps = buildCapabilities(SystemRole.USER, CompanyRole.OWNER, [], 'pro', []);
    const adminCaps = buildCapabilities(SystemRole.USER, CompanyRole.ADMIN, [], 'pro', []);
    expect(canUserManageWhatsappSession(ownerCaps)).toBe(true);
    expect(canUserViewWhatsappSession(ownerCaps)).toBe(true);
    expect(canUserManageWhatsappSession(adminCaps)).toBe(false);
    expect(canUserViewWhatsappSession(adminCaps)).toBe(true);
    expect(adminCaps.includes(Cap.WHATSAPP_SESSION_VIEW)).toBe(true);
  });

  it('sanitizeWhatsappOutboundText limita tamanho', () => {
    expect(sanitizeWhatsappOutboundText('  Olá\x00  ')).toBe('Olá');
    expect(sanitizeWhatsappOutboundText('x'.repeat(WHATSAPP_OUTBOUND_TEXT_MAX + 50)).length).toBe(
      WHATSAPP_OUTBOUND_TEXT_MAX,
    );
  });

  it('isWhatsappQrLogSafe bloqueia campos sensíveis', () => {
    expect(isWhatsappQrLogSafe('profileName')).toBe(true);
    expect(isWhatsappQrLogSafe('qrCodeRaw')).toBe(false);
    expect(isWhatsappQrLogSafe('sessionData')).toBe(false);
  });

  it('assertWhatsappSessionClientMatch impede cross-tenant', () => {
    expect(() => assertWhatsappSessionClientMatch('org-a', 'org-a')).not.toThrow();
    expect(() => assertWhatsappSessionClientMatch('org-a', 'org-b')).toThrow(/organização/);
  });
});
