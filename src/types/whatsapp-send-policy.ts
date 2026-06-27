import type { WhatsAppSendKind } from '@/utils/whatsapp-session-rate-limit';

export interface WhatsAppKindLimitConfig {
  /** Limite ativo para este tipo */
  enabled: boolean;
  /** Mensagens por minuto (quando enabled) */
  maxPerMinute: number;
}

export interface WhatsAppSendPolicySnapshot {
  /** Empresa desligou limites (só tenant) */
  limitsDisabled?: boolean;
  /** Simula digitação + delay proporcional ao texto */
  humanizeEnabled: boolean;
  /** Indicador "digitando…" no WhatsApp antes do envio */
  composingEnabled: boolean;
  /** Teto máximo que o admin permite nos sliders (por tipo) */
  caps: Record<WhatsAppSendKind, number>;
  conversation: WhatsAppKindLimitConfig;
  marketing: WhatsAppKindLimitConfig;
  alert: WhatsAppKindLimitConfig;
}

export interface CampaignProtectedTier {
  id: 'minimum' | 'normal' | 'optimal';
  label: string;
  baseSec: number;
  jitterMinSec: number;
  jitterMaxSec: number;
  enabled: boolean;
}

export interface CampaignDelaysConfig {
  protectedTiers: CampaignProtectedTier[];
  protectedDefaultTierId: CampaignProtectedTier['id'];
  riskDelaysSec: number[];
  riskMinSec: number;
}

export const DEFAULT_CAMPAIGN_DELAYS: CampaignDelaysConfig = {
  protectedTiers: [
    {
      id: 'minimum',
      label: 'Mínimo',
      baseSec: 30,
      jitterMinSec: 30,
      jitterMaxSec: 39,
      enabled: true,
    },
    {
      id: 'normal',
      label: 'Normal',
      baseSec: 40,
      jitterMinSec: 40,
      jitterMaxSec: 59,
      enabled: true,
    },
    {
      id: 'optimal',
      label: 'Ótimo',
      baseSec: 60,
      jitterMinSec: 60,
      jitterMaxSec: 80,
      enabled: true,
    },
  ],
  protectedDefaultTierId: 'normal',
  riskDelaysSec: [3, 10, 20],
  riskMinSec: 3,
};

export interface SystemWhatsAppPolicyDoc {
  humanizeEnabled: boolean;
  composingEnabled: boolean;
  defaults: Record<WhatsAppSendKind, WhatsAppKindLimitConfig>;
  caps: Record<WhatsAppSendKind, number>;
  campaignDelays?: CampaignDelaysConfig;
}

export interface OrgWhatsAppSendPolicyOverride {
  /** Empresa desliga limites (aceita risco de ban) — fila humanizada continua */
  limitsDisabled?: boolean;
  humanizeEnabled?: boolean;
  composingEnabled?: boolean;
  /** Dono libera checkbox "desativar proteção" para atendentes no /send */
  allowMembersDisableCampaignProtection?: boolean;
  conversation?: Partial<WhatsAppKindLimitConfig>;
  marketing?: Partial<WhatsAppKindLimitConfig>;
  alert?: Partial<WhatsAppKindLimitConfig>;
}

export const DEFAULT_SYSTEM_WHATSAPP_POLICY: SystemWhatsAppPolicyDoc = {
  humanizeEnabled: true,
  composingEnabled: true,
  defaults: {
    conversation: { enabled: true, maxPerMinute: 10 },
    marketing: { enabled: true, maxPerMinute: 2 },
    alert: { enabled: true, maxPerMinute: 30 },
  },
  caps: {
    conversation: 30,
    marketing: 10,
    alert: 60,
  },
  campaignDelays: DEFAULT_CAMPAIGN_DELAYS,
};

export const FALLBACK_WHEN_LIMITS_DISABLED: Record<WhatsAppSendKind, number> = {
  conversation: 120,
  marketing: 60,
  alert: 120,
};
