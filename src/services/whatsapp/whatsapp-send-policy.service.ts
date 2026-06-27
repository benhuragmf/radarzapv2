import mongoose from 'mongoose';
import { Organization } from '@/models/Organization';
import { getOrCreateSystemWhatsAppPolicy } from '@/models/SystemWhatsAppPolicy';
import {
  DEFAULT_SYSTEM_WHATSAPP_POLICY,
  FALLBACK_WHEN_LIMITS_DISABLED,
  type OrgWhatsAppSendPolicyOverride,
  type WhatsAppKindLimitConfig,
  type WhatsAppSendPolicySnapshot,
} from '@/types/whatsapp-send-policy';
import type { WhatsAppSendKind } from '@/utils/whatsapp-session-rate-limit';
import {
  normalizeCampaignDelaysConfig,
  type CampaignDelaysConfig,
} from '@/utils/campaign-inter-destination-delay.util';

export async function getCampaignDelaysConfig(): Promise<CampaignDelaysConfig> {
  const doc = await getOrCreateSystemWhatsAppPolicy();
  return normalizeCampaignDelaysConfig(
    doc.campaignDelays as CampaignDelaysConfig | undefined,
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function mergeKind(
  kind: WhatsAppSendKind,
  systemDefault: WhatsAppKindLimitConfig,
  cap: number,
  orgOverride: Partial<WhatsAppKindLimitConfig> | undefined,
  limitsDisabled: boolean,
): WhatsAppKindLimitConfig {
  if (limitsDisabled) {
    return { enabled: false, maxPerMinute: FALLBACK_WHEN_LIMITS_DISABLED[kind] };
  }
  const enabled = orgOverride?.enabled ?? systemDefault.enabled;
  const raw = orgOverride?.maxPerMinute ?? systemDefault.maxPerMinute;
  return {
    enabled,
    maxPerMinute: clamp(raw, 1, cap),
  };
}

export async function resolveWhatsAppSendPolicy(
  clientId: string,
): Promise<WhatsAppSendPolicySnapshot> {
  const system = await getOrCreateSystemWhatsAppPolicy();
  const org = await Organization.findById(clientId)
    .select('whatsappSendPolicy')
    .lean();
  const override = (org?.whatsappSendPolicy ?? {}) as OrgWhatsAppSendPolicyOverride;
  const limitsDisabled = override.limitsDisabled === true;

  const caps = {
    conversation: system.caps.conversation ?? DEFAULT_SYSTEM_WHATSAPP_POLICY.caps.conversation,
    marketing: system.caps.marketing ?? DEFAULT_SYSTEM_WHATSAPP_POLICY.caps.marketing,
    alert: system.caps.alert ?? DEFAULT_SYSTEM_WHATSAPP_POLICY.caps.alert,
  };

  return {
    limitsDisabled: override.limitsDisabled === true,
    humanizeEnabled: override.humanizeEnabled ?? system.humanizeEnabled,
    composingEnabled: override.composingEnabled ?? system.composingEnabled,
    caps,
    conversation: mergeKind(
      'conversation',
      system.defaults.conversation,
      caps.conversation,
      override.conversation,
      limitsDisabled,
    ),
    marketing: mergeKind(
      'marketing',
      system.defaults.marketing,
      caps.marketing,
      override.marketing,
      limitsDisabled,
    ),
    alert: mergeKind(
      'alert',
      system.defaults.alert,
      caps.alert,
      override.alert,
      limitsDisabled,
    ),
  };
}

export function maxPerMinuteFromPolicy(
  policy: WhatsAppSendPolicySnapshot,
  kind: WhatsAppSendKind,
): number {
  const cfg = policy[kind];
  if (!cfg.enabled) return FALLBACK_WHEN_LIMITS_DISABLED[kind];
  return cfg.maxPerMinute;
}

export async function patchSystemWhatsAppPolicy(body: Partial<{
  humanizeEnabled: boolean;
  composingEnabled: boolean;
  defaults: Partial<Record<WhatsAppSendKind, Partial<WhatsAppKindLimitConfig>>>;
  caps: Partial<Record<WhatsAppSendKind, number>>;
  campaignDelays: Partial<CampaignDelaysConfig>;
}>): Promise<{ policy: SystemWhatsAppPolicyDoc }> {
  const doc = await getOrCreateSystemWhatsAppPolicy();
  if (typeof body.humanizeEnabled === 'boolean') doc.humanizeEnabled = body.humanizeEnabled;
  if (typeof body.composingEnabled === 'boolean') doc.composingEnabled = body.composingEnabled;

  for (const kind of ['conversation', 'marketing', 'alert'] as WhatsAppSendKind[]) {
    if (body.caps?.[kind] != null) {
      doc.caps[kind] = clamp(body.caps[kind]!, 1, 200);
    }
    const patch = body.defaults?.[kind];
    if (patch) {
      if (typeof patch.enabled === 'boolean') doc.defaults[kind].enabled = patch.enabled;
      if (patch.maxPerMinute != null) {
        doc.defaults[kind].maxPerMinute = clamp(patch.maxPerMinute, 1, doc.caps[kind]);
      }
    }
  }

  if (body.campaignDelays) {
    const current = normalizeCampaignDelaysConfig(
      doc.campaignDelays as CampaignDelaysConfig | undefined,
    );
    doc.campaignDelays = normalizeCampaignDelaysConfig({
      ...current,
      ...body.campaignDelays,
      protectedTiers: body.campaignDelays.protectedTiers ?? current.protectedTiers,
      riskDelaysSec: body.campaignDelays.riskDelaysSec ?? current.riskDelaysSec,
    }) as CampaignDelaysConfig;
    doc.markModified('campaignDelays');
  }

  await doc.save();
  return getSystemWhatsAppPolicyForAdmin();
}

export async function patchOrgWhatsAppSendPolicy(
  clientId: string,
  body: OrgWhatsAppSendPolicyOverride,
): Promise<WhatsAppSendPolicySnapshot> {
  const system = await getOrCreateSystemWhatsAppPolicy();
  const org = await Organization.findById(clientId);
  if (!org) throw new Error('Organização não encontrada');

  const current = (org.whatsappSendPolicy ?? {}) as OrgWhatsAppSendPolicyOverride;
  const next: OrgWhatsAppSendPolicyOverride = { ...current, ...body };

  for (const kind of ['conversation', 'marketing', 'alert'] as WhatsAppSendKind[]) {
    const patch = body[kind];
    if (patch) {
      next[kind] = { ...current[kind], ...patch };
      if (next[kind]?.maxPerMinute != null) {
        next[kind]!.maxPerMinute = clamp(
          next[kind]!.maxPerMinute!,
          1,
          system.caps[kind] ?? 200,
        );
      }
    }
  }

  org.whatsappSendPolicy = next;
  await org.save();
  return resolveWhatsAppSendPolicy(clientId);
}

export async function getSystemWhatsAppPolicyForAdmin(): Promise<{
  policy: SystemWhatsAppPolicyDoc;
}> {
  const doc = await getOrCreateSystemWhatsAppPolicy();
  return {
    policy: {
      humanizeEnabled: doc.humanizeEnabled,
      composingEnabled: doc.composingEnabled,
      defaults: doc.defaults,
      caps: doc.caps,
      campaignDelays: normalizeCampaignDelaysConfig(
        doc.campaignDelays as CampaignDelaysConfig | undefined,
      ),
    },
  };
}

export type SystemWhatsAppPolicyDoc = import('@/types/whatsapp-send-policy').SystemWhatsAppPolicyDoc;
