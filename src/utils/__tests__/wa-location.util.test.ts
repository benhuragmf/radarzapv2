import { describe, expect, it } from 'vitest';
import {
  formatLocationLabel,
  isValidWaCoordinates,
  waCoordToDegrees,
} from '../wa-location.util';

describe('wa-location.util', () => {
  it('converte coordenadas semimicro WhatsApp', () => {
    expect(waCoordToDegrees(-23550500)).toBeCloseTo(-23.5505, 4);
    expect(waCoordToDegrees(-46.6333)).toBeCloseTo(-46.6333, 4);
  });

  it('valida coordenadas', () => {
    expect(isValidWaCoordinates(-23.55, -46.63)).toBe(true);
    expect(isValidWaCoordinates(0, 0)).toBe(false);
    expect(isValidWaCoordinates(91, 0)).toBe(false);
  });

  it('formata rótulo da mensagem', () => {
    expect(formatLocationLabel(-23.55, -46.63, 'Casa')).toContain('Casa');
    expect(formatLocationLabel(-23.55, -46.63)).toContain('Localização');
  });
});
