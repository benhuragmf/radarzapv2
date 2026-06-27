import { Organization } from '@/models/Organization';
import { getOrCreateSystemWhatsAppPolicy } from '@/models/SystemWhatsAppPolicy';
import { CompanyRole } from '@/auth/rbac/roles';
import {
  getCampaignDelaysConfig,
  resolveWhatsAppSendPolicy,
} from '@/services/whatsapp/whatsapp-send-policy.service';
import type {
  CampaignDelaysConfig,
  WhatsAppSendPolicySnapshot,
  SystemWhatsAppPolicyDoc,
} from '@/types/whatsapp-send-policy';
import {
  averageCampaignDelayMs,
  campaignDelayJitterHint,
  defaultProtectedDelayMs,
  protectedDelayOptionsMs,
  riskDelayOptionsMs,
  snapCampaignDelayMs,
} from '@/utils/campaign-inter-destination-delay.util';

export type CampaignSendPolicyPayload = {
  canDisableProtection: boolean;
  isOwner: boolean;
  allowMembersDisableProtection: boolean;
  campaignDelays: CampaignDelaysConfig;
  defaultProtectedDelayMs: number;
  defaultRiskDelayMs: number;
  system: {
    marketingDefaultMaxPerMinute: number;
    marketingCapMaxPerMinute: number;
    humanizeEnabled: boolean;
    composingEnabled: boolean;
  };
  org: {
    marketingMaxPerMinute: number;
    marketingEnabled: boolean;
    limitsDisabled: boolean;
    humanizeEnabled: boolean;
    composingEnabled: boolean;
  };
  effective: {
    marketingMaxPerMinute: number | null;
    marketingMinIntervalMs: number;
    marketingMinIntervalSec: number;
    humanizeEnabled: boolean;
    composingEnabled: boolean;
    protectedMode: boolean;
    avgDelayMs: number;
    avgDelaySec: number;
  };
  protectedDelayOptionsMs: number[];
  riskDelayOptionsMs: number[];
  delayJitterHint: string | null;
};

export function marketingMinIntervalMs(
  marketingMaxPerMinute: number | null | undefined,
  campaignDelays: CampaignDelaysConfig,
): number {
  const enabled = campaignDelays.protectedTiers.filter(t => t.enabled);
  const minTierSec = enabled.length
    ? Math.min(...enabled.map(t => t.jitterMinSec))
    : 30;
  const floorMs = minTierSec * 1000;
  if (!marketingMaxPerMinute || marketingMaxPerMinute <= 0) {
    return floorMs;
  }
  return Math.max(floorMs, Math.ceil(60_000 / marketingMaxPerMinute));
}

export function canUserDisableCampaignProtection(input: {
  companyRole: CompanyRole | null;
  allowMembersDisableCampaignProtection: boolean;
}): boolean {
  if (input.companyRole === CompanyRole.OWNER) return true;
  return input.allowMembersDisableCampaignProtection === true;
}

function buildSystemSlice(system: SystemWhatsAppPolicyDoc) {
  return {
    marketingDefaultMaxPerMinute: system.defaults.marketing.maxPerMinute,
    marketingCapMaxPerMinute: system.caps.marketing,
    humanizeEnabled: system.humanizeEnabled,
    composingEnabled: system.composingEnabled,
  };
}

function buildOrgSlice(resolved: WhatsAppSendPolicySnapshot) {
  return {
    marketingMaxPerMinute: resolved.marketing.maxPerMinute,
    marketingEnabled: resolved.marketing.enabled,
    limitsDisabled: resolved.limitsDisabled === true,
    humanizeEnabled: resolved.humanizeEnabled,
    composingEnabled: resolved.composingEnabled,
  };
}

export async function buildCampaignSendPolicy(
  clientId: string,
  companyRole: CompanyRole | null,
): Promise<CampaignSendPolicyPayload> {
  const [systemDoc, resolved, org, campaignDelays] = await Promise.all([
    getOrCreateSystemWhatsAppPolicy(),
    resolveWhatsAppSendPolicy(clientId),
    Organization.findById(clientId).select('whatsappSendPolicy').lean(),
    getCampaignDelaysConfig(),
  ]);

  const systemPolicy: SystemWhatsAppPolicyDoc = {
    humanizeEnabled: systemDoc.humanizeEnabled,
    composingEnabled: systemDoc.composingEnabled,
    defaults: systemDoc.defaults,
    caps: systemDoc.caps,
    campaignDelays,
  };

  const override = (org?.whatsappSendPolicy ?? {}) as {
    allowMembersDisableCampaignProtection?: boolean;
  };
  const allowMembersDisableProtection =
    override.allowMembersDisableCampaignProtection === true;

  const canDisableProtection = canUserDisableCampaignProtection({
    companyRole,
    allowMembersDisableCampaignProtection: allowMembersDisableProtection,
  });

  const marketingMaxPerMinute =
    resolved.limitsDisabled || !resolved.marketing.enabled
      ? null
      : resolved.marketing.maxPerMinute;

  const defaultSafeDelay = defaultProtectedDelayMs(campaignDelays);
  const minIntervalMs = marketingMinIntervalMs(marketingMaxPerMinute, campaignDelays);
  const avgDelayMs = averageCampaignDelayMs(defaultSafeDelay, false, campaignDelays);

  return {
    canDisableProtection,
    isOwner: companyRole === CompanyRole.OWNER,
    allowMembersDisableProtection,
    campaignDelays,
    defaultProtectedDelayMs: defaultSafeDelay,
    defaultRiskDelayMs: campaignDelays.riskDelaysSec[0]! * 1000,
    system: buildSystemSlice(systemPolicy),
    org: buildOrgSlice(resolved),
    effective: {
      marketingMaxPerMinute,
      marketingMinIntervalMs: minIntervalMs,
      marketingMinIntervalSec: Math.ceil(minIntervalMs / 1000),
      humanizeEnabled: resolved.humanizeEnabled,
      composingEnabled: resolved.composingEnabled,
      protectedMode: !resolved.limitsDisabled,
      avgDelayMs,
      avgDelaySec: Math.ceil(avgDelayMs / 1000),
    },
    protectedDelayOptionsMs: protectedDelayOptionsMs(campaignDelays),
    riskDelayOptionsMs: riskDelayOptionsMs(campaignDelays),
    delayJitterHint: campaignDelayJitterHint(defaultSafeDelay, campaignDelays),
  };
}

export function clampCampaignDelayMs(
  delayMs: number | undefined,
  acceptRisk: boolean,
  policy: CampaignSendPolicyPayload,
): number {
  return snapCampaignDelayMs(delayMs, acceptRisk, policy.campaignDelays);
}
