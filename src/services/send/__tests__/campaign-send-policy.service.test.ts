import {
  marketingMinIntervalMs,
  canUserDisableCampaignProtection,
} from '../campaign-send-policy.service';
import { CompanyRole } from '@/auth/rbac/roles';
import { DEFAULT_CAMPAIGN_DELAYS } from '@/types/whatsapp-send-policy';

describe('campaign-send-policy.service', () => {
  it('marketingMinIntervalMs respeita 2/min => 30s', () => {
    expect(marketingMinIntervalMs(2, DEFAULT_CAMPAIGN_DELAYS)).toBe(30_000);
  });

  it('canUserDisableCampaignProtection — dono sempre', () => {
    expect(
      canUserDisableCampaignProtection({
        companyRole: CompanyRole.OWNER,
        allowMembersDisableCampaignProtection: false,
      }),
    ).toBe(true);
  });

  it('canUserDisableCampaignProtection — membro so com liberacao', () => {
    expect(
      canUserDisableCampaignProtection({
        companyRole: CompanyRole.ATTENDANT,
        allowMembersDisableCampaignProtection: false,
      }),
    ).toBe(false);
    expect(
      canUserDisableCampaignProtection({
        companyRole: CompanyRole.ATTENDANT,
        allowMembersDisableCampaignProtection: true,
      }),
    ).toBe(true);
  });
});
