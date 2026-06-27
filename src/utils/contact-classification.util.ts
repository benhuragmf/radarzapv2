import type { ConsentStatus } from '@/types/consent';
import { canSendPendingAttempt, ConsentStatus as CS } from '@/types/consent';
import {
  type CommercialStatus,
  type ContactClassification,
  type ContactKind,
  type ContactOrigin,
  type ContactTemperature,
  type DestinationClassificationInput,
  type LeadClassificationHint,
  type PhoneQuality,
  type SendPermission,
} from '@/types/contact-classification';

function isValidE164Phone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.startsWith('+')) return false;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return false;
  return /^[1-9]\d{9,14}$/.test(digits);
}

function effectiveConsent(status?: string, granted?: boolean): ConsentStatus {
  if (status) return status as ConsentStatus;
  return granted ? CS.ACCEPTED : CS.PENDING;
}

function resolvePermission(
  consentSt: ConsentStatus,
  pendingOutboundCount: number,
  kind: ContactKind,
): SendPermission {
  if (kind === 'blocked' || kind === 'internal' || kind === 'partner') {
    if (consentSt === CS.MANUALLY_BLOCKED) return 'blocked';
    if (kind === 'blocked') return 'blocked';
  }
  if (consentSt === CS.MANUALLY_BLOCKED) return 'blocked';
  if (consentSt === CS.ACCEPTED) return 'opt_in_accepted';
  if (
    consentSt === CS.REFUSED_FIRST ||
    consentSt === CS.REFUSED_SECOND ||
    consentSt === CS.REFUSED_THREE
  ) {
    return 'opt_out';
  }
  if (consentSt === CS.PENDING) {
    if (canSendPendingAttempt(consentSt, pendingOutboundCount)) return 'pending';
    return 'no_consent';
  }
  return 'no_consent';
}

function mapConsentSourceToOrigin(source?: string): ContactOrigin | null {
  if (!source) return null;
  const s = source.toLowerCase();
  if (s.includes('webchat')) return 'webchat';
  if (s.includes('whatsapp') || s.includes('wa')) return 'whatsapp';
  if (s.includes('form') || s.includes('lead')) return 'form';
  if (s.includes('csv') || s.includes('import')) return 'csv';
  if (s.includes('api')) return 'api';
  if (s.includes('campaign') || s.includes('campanha')) return 'campaign';
  if (s.includes('group') || s.includes('grupo')) return 'wa_group';
  if (s.includes('manual') || s.includes('opt-in') || s.includes('dashboard')) return 'manual';
  return null;
}

function mapLeadOrigin(origin?: string): ContactOrigin | null {
  if (!origin) return null;
  const map: Record<string, ContactOrigin> = {
    site: 'form',
    widget: 'form',
    wordpress: 'form',
    api: 'api',
    whatsapp: 'whatsapp',
    webchat: 'webchat',
    manual: 'manual',
    import: 'csv',
    campaign: 'campaign',
  };
  return map[origin] ?? null;
}

function mapLeadStatus(status?: string, converted?: boolean): CommercialStatus {
  if (converted || status === 'converted') return 'converted';
  const map: Record<string, CommercialStatus> = {
    new: 'new',
    in_review: 'new',
    in_progress: 'in_service',
    qualified: 'qualified',
    converted: 'converted',
    lost: 'lost',
    spam: 'lost',
  };
  return map[status ?? ''] ?? 'new';
}

function mapLeadTemperature(temp?: string, tags?: string[]): ContactTemperature {
  if (tags?.some(t => t.toLowerCase() === 'vip')) return 'vip';
  if (tags?.some(t => ['reclamação', 'reclamacao', 'risco', 'urgente'].includes(t.toLowerCase()))) {
    return 'risk';
  }
  const map: Record<string, ContactTemperature> = {
    cold: 'cold',
    warm: 'warm',
    hot: 'hot',
  };
  return map[temp ?? ''] ?? 'cold';
}

function resolveKind(
  stored: ContactKind | undefined,
  consentSt: ConsentStatus,
  lead?: LeadClassificationHint,
  tags?: string[],
): ContactKind {
  if (stored) return stored;
  if (consentSt === CS.MANUALLY_BLOCKED) return 'blocked';
  if (tags?.some(t => ['interno', 'equipe', 'team', 'admin', 'teste'].includes(t.toLowerCase()))) {
    return 'internal';
  }
  if (tags?.some(t => ['fornecedor', 'parceiro', 'partner'].includes(t.toLowerCase()))) {
    return 'partner';
  }
  if (lead) {
    if (lead.converted || lead.status === 'converted') return 'client';
    return 'lead';
  }
  return 'prospect';
}

function resolvePhoneQuality(
  dest: DestinationClassificationInput,
  duplicateIds: Set<string>,
  stored?: PhoneQuality,
): PhoneQuality {
  if (stored) return stored;
  if (duplicateIds.has(String(dest._id))) return 'duplicate';
  const id = dest.identifier?.trim() ?? '';
  if (!id || !isValidE164Phone(id.startsWith('+') ? id : `+${id.replace(/\D/g, '')}`)) {
    const digits = id.replace(/\D/g, '');
    if (digits.length > 0 && digits.length < 10) return 'incomplete';
    return 'invalid';
  }
  const digits = id.replace(/\D/g, '');
  if (digits && !digits.startsWith('55') && digits.length >= 10) return 'international';
  if (dest.hasProfilePicture || dest.phoneType === 'whatsapp') return 'verified';
  if (dest.pendingOutboundCount && dest.pendingOutboundCount >= 2) return 'attention';
  return 'attention';
}

function sendBlockReason(
  permission: SendPermission,
  phoneQuality: PhoneQuality,
  kind: ContactKind,
  consentSt: ConsentStatus,
  pendingOutboundCount: number,
): string | undefined {
  if (phoneQuality === 'invalid' || phoneQuality === 'incomplete') {
    return 'Telefone inválido ou incompleto';
  }
  if (phoneQuality === 'duplicate') return 'Número duplicado no cadastro';
  if (kind === 'internal') return 'Contato interno / equipe — não use em campanha';
  if (kind === 'partner') return 'Fornecedor / parceiro — campanha comum bloqueada';
  if (kind === 'blocked' || permission === 'blocked') return 'Bloqueado internamente';
  if (permission === 'opt_out') return 'Opt-out / recusou receber mensagens';
  if (permission === 'no_consent') {
    if (consentSt === CS.PENDING && pendingOutboundCount >= 3) {
      return 'Sem consentimento — tentativas de opt-in esgotadas';
    }
    return 'Sem consentimento para envio';
  }
  if (permission === 'pending') return 'Opt-in pendente — envio não recomendado';
  if (phoneQuality === 'suspicious') return 'Número suspeito — revise antes de enviar';
  return undefined;
}

function campaignSelectable(
  permission: SendPermission,
  phoneQuality: PhoneQuality,
  kind: ContactKind,
  consentSt: ConsentStatus,
  pendingOutboundCount: number,
): boolean {
  if (sendBlockReason(permission, phoneQuality, kind, consentSt, pendingOutboundCount)) {
    if (permission === 'pending' && canSendPendingAttempt(consentSt, pendingOutboundCount)) {
      return true;
    }
    return false;
  }
  return permission === 'opt_in_accepted' || permission === 'pending';
}

export function buildContactClassification(
  dest: DestinationClassificationInput,
  opts?: {
    lead?: LeadClassificationHint;
    duplicateIds?: Set<string>;
  },
): ContactClassification {
  if (dest.type === 'group') {
    return {
      kind: 'prospect',
      origin: 'wa_group',
      permission: 'opt_in_accepted',
      commercialStatus: 'new',
      temperature: 'cold',
      phoneQuality: 'verified',
      campaignSelectable: true,
    };
  }

  const consentSt = effectiveConsent(dest.consentStatus, dest.consent?.granted);
  const pending = dest.pendingOutboundCount ?? 0;
  const duplicateIds = opts?.duplicateIds ?? new Set<string>();
  const lead = opts?.lead;

  const kind = resolveKind(dest.contactKind, consentSt, lead, dest.tags);
  const origin =
    dest.contactOrigin ??
    mapLeadOrigin(lead?.origin) ??
    mapConsentSourceToOrigin(dest.consent?.source) ??
    'manual';

  const permission = resolvePermission(consentSt, pending, kind);
  const commercialStatus =
    dest.commercialStatus ?? mapLeadStatus(lead?.status, lead?.converted);
  const temperature =
    dest.temperature ?? mapLeadTemperature(lead?.temperature, dest.tags);
  const phoneQuality = resolvePhoneQuality(dest, duplicateIds, dest.phoneQuality);

  const blockReason = sendBlockReason(permission, phoneQuality, kind, consentSt, pending);
  const selectable = campaignSelectable(permission, phoneQuality, kind, consentSt, pending);

  return {
    kind,
    origin,
    permission,
    commercialStatus,
    temperature,
    phoneQuality,
    sendBlockReason: blockReason,
    campaignSelectable: selectable,
  };
}

export function findDuplicateDestinationIds(
  destinations: Array<{ _id: unknown; type: string; identifier: string }>,
): Set<string> {
  const byKey = new Map<string, string[]>();
  for (const d of destinations) {
    if (d.type !== 'contact') continue;
    const key = d.identifier.replace(/\D/g, '');
    if (!key) continue;
    const id = String(d._id);
    const list = byKey.get(key) ?? [];
    list.push(id);
    byKey.set(key, list);
  }
  const dupes = new Set<string>();
  for (const ids of byKey.values()) {
    if (ids.length > 1) ids.forEach(id => dupes.add(id));
  }
  return dupes;
}
