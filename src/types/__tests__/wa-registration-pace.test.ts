import {
  estimateWaValidationHoursRemaining,
  formatWaValidationEta,
  WA_REGISTRATION_INTERVAL_MS,
} from '@/types/wa-registration';

describe('wa-registration pace', () => {
  it('1000 contatos ≈ 24h na fila', () => {
    const hours = estimateWaValidationHoursRemaining(1000);
    expect(hours).toBeGreaterThanOrEqual(23);
    expect(hours).toBeLessThanOrEqual(25);
  });

  it('intervalo entre checagens ~86s', () => {
    expect(WA_REGISTRATION_INTERVAL_MS).toBeGreaterThanOrEqual(86_000);
    expect(WA_REGISTRATION_INTERVAL_MS).toBeLessThanOrEqual(87_000);
  });

  it('formata ETA legível', () => {
    expect(formatWaValidationEta(0.5)).toMatch(/min/);
    expect(formatWaValidationEta(12)).toMatch(/12 h/);
  });
});
