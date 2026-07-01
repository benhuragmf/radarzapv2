import { ensureWaRegistrationVerifiedFromInbound, markWaRegistrationVerifiedInbound } from '@/services/destinations/wa-registration-validation.service';

describe('ensureWaRegistrationVerifiedFromInbound', () => {
  it('marca pending como verified e persiste', async () => {
    const dest = {
      type: 'contact' as const,
      waRegistrationStatus: 'pending' as const,
      phoneQuality: 'attention' as const,
      save: jest.fn().mockResolvedValue(undefined),
    };

    const changed = await ensureWaRegistrationVerifiedFromInbound(dest as never);
    expect(changed).toBe(true);
    expect(dest.waRegistrationStatus).toBe('verified');
    expect(dest.phoneQuality).toBe('verified');
    expect(dest.save).toHaveBeenCalled();
  });

  it('não altera se já verified', async () => {
    const dest = {
      type: 'contact' as const,
      waRegistrationStatus: 'verified' as const,
      save: jest.fn(),
    };
    const changed = await ensureWaRegistrationVerifiedFromInbound(dest as never);
    expect(changed).toBe(false);
    expect(dest.save).not.toHaveBeenCalled();
  });

  it('corrige not_on_whatsapp quando cliente manda inbound', () => {
    const dest = {
      type: 'contact' as const,
      waRegistrationStatus: 'not_on_whatsapp' as const,
      phoneQuality: 'no_whatsapp' as const,
      waResolvedJid: undefined as string | undefined,
    };
    markWaRegistrationVerifiedInbound(dest as never, '5566999999999@s.whatsapp.net');
    expect(dest.waRegistrationStatus).toBe('verified');
    expect(dest.phoneQuality).toBe('verified');
    expect(dest.waResolvedJid).toBe('5566999999999@s.whatsapp.net');
  });
});
