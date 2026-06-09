import { ConsentService } from '@/services/consent/ConsentService';
import { ConsentStatus } from '@/types/consent';
import type { IDestination } from '@/models/Destination';

function mockDest(overrides: Partial<IDestination> = {}): IDestination {
  return {
    type: 'contact',
    consentStatus: ConsentStatus.ACCEPTED,
    lastConsentPromptAt: new Date('2026-01-01'),
    pendingOutboundDeliveries: [],
    ...overrides,
  } as IDestination;
}

describe('ConsentService.shouldDeferToConsentFlow', () => {
  const svc = ConsentService.getInstance();

  it('não bloqueia 1/2 com consentimento já aceito (prompt antigo)', () => {
    expect(svc.shouldDeferToConsentFlow(mockDest(), '1')).toBe(false);
    expect(svc.shouldDeferToConsentFlow(mockDest(), '2')).toBe(false);
  });

  it('bloqueia 1/2 enquanto aguarda aceite LGPD (PENDING)', () => {
    expect(
      svc.shouldDeferToConsentFlow(
        mockDest({
          consentStatus: ConsentStatus.PENDING,
          lastConsentPromptAt: new Date(),
        }),
        '1',
      ),
    ).toBe(true);
  });

  it('bloqueia com fila outbound pendente', () => {
    expect(
      svc.shouldDeferToConsentFlow(
        mockDest({
          pendingOutboundDeliveries: [{ type: 'text', body: 'campanha' }],
        }),
        'oi',
      ),
    ).toBe(true);
  });
});
