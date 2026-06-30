import {
  canRemoveBranding,
  resolveProductBrandingVisible,
} from '@/utils/branding-plan.util';

describe('branding-plan.util', () => {
  it('free and starter cannot remove branding', () => {
    expect(canRemoveBranding('free')).toBe(false);
    expect(canRemoveBranding('starter')).toBe(false);
    expect(canRemoveBranding('trial')).toBe(false);
  });

  it('pro and enterprise can remove branding', () => {
    expect(canRemoveBranding('pro')).toBe(true);
    expect(canRemoveBranding('enterprise')).toBe(true);
  });

  it('resolveProductBrandingVisible forces true on entry plans', () => {
    expect(resolveProductBrandingVisible('free', false)).toBe(true);
    expect(resolveProductBrandingVisible('starter', false)).toBe(true);
  });

  it('resolveProductBrandingVisible respects preference on paid plans', () => {
    expect(resolveProductBrandingVisible('pro', false)).toBe(false);
    expect(resolveProductBrandingVisible('pro', true)).toBe(true);
    expect(resolveProductBrandingVisible('pro', undefined)).toBe(true);
  });
});
