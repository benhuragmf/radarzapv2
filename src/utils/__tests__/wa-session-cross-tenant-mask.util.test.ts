import { maskCrossTenantWaSession } from '@/utils/wa-session-cross-tenant-mask.util';

describe('maskCrossTenantWaSession', () => {
  const base = {
    clientId: 'tenant-a',
    discordUserId: 'u1',
    displayName: 'Org A',
    status: 'connected',
    state: 'open',
    qrCode: 'data:image/png;base64,abc',
    phoneNumber: '+5511987654321',
    profilePictureUrl: 'https://cdn.example/avatar.jpg',
    wuid: '5511987654321@s.whatsapp.net',
    hasPersistedSession: true,
  };

  it('não mascara sessão do próprio tenant', () => {
    expect(maskCrossTenantWaSession(base, 'tenant-a')).toEqual(base);
  });

  it('remove QR, avatar e wuid de outro tenant', () => {
    const masked = maskCrossTenantWaSession(base, 'tenant-b');
    expect(masked.qrCode).toBeUndefined();
    expect(masked.profilePictureUrl).toBeUndefined();
    expect(masked.wuid).toBeUndefined();
    expect(masked.phoneNumber).toBe('****4321');
    expect(masked.status).toBe('connected');
  });
});
