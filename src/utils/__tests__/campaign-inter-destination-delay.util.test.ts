import {
  averageCampaignDelayMs,
  computeJitteredCampaignDelayMs,
  snapCampaignDelayMs,
} from '../campaign-inter-destination-delay.util';

describe('campaign-inter-destination-delay.util', () => {
  it('snap safe para tiers 30/40/60', () => {
    expect(snapCampaignDelayMs(5_000, false)).toBe(30_000);
    expect(snapCampaignDelayMs(40_000, false)).toBe(40_000);
    expect(snapCampaignDelayMs(99_000, false)).toBe(60_000);
  });

  it('snap risk para 3/10/20', () => {
    expect(snapCampaignDelayMs(1_000, true)).toBe(3_000);
    expect(snapCampaignDelayMs(15_000, true)).toBe(20_000);
  });

  it('jitter safe respeita faixa do tier', () => {
    for (let i = 0; i < 20; i++) {
      const ms = computeJitteredCampaignDelayMs(30_000, false);
      expect(ms).toBeGreaterThanOrEqual(30_000);
      expect(ms).toBeLessThanOrEqual(39_000);
    }
    const normal = computeJitteredCampaignDelayMs(40_000, false);
    expect(normal).toBeGreaterThanOrEqual(40_000);
    expect(normal).toBeLessThanOrEqual(59_000);
    const optimal = computeJitteredCampaignDelayMs(60_000, false);
    expect(optimal).toBeGreaterThanOrEqual(60_000);
    expect(optimal).toBeLessThanOrEqual(80_000);
  });

  it('risk sem jitter', () => {
    expect(computeJitteredCampaignDelayMs(10_000, true)).toBe(10_000);
  });

  it('média para estimativa', () => {
    expect(averageCampaignDelayMs(30_000, false)).toBe(34_500);
    expect(averageCampaignDelayMs(40_000, false)).toBe(49_500);
    expect(averageCampaignDelayMs(60_000, false)).toBe(70_000);
  });
});
