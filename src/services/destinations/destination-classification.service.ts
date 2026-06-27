import mongoose from 'mongoose';
import { LeadCapture } from '@/models/LeadCapture';
import { Destination } from '@/models/Destination';
import type { IDestination } from '@/models/Destination';
import {
  ContactClassification,
  ContactKind,
  ContactOrigin,
  ContactTemperature,
  CommercialStatus,
  SendPermission,
  DestinationClassificationInput,
  DestinationClassificationStats,
  LeadClassificationHint,
  CONTACT_KINDS,
} from '@/types/contact-classification';
import {
  buildClassificationStatsCsv,
  buildContactsClassificationCsv,
} from '@/utils/classification-csv-export';
import {
  buildContactClassification,
  findDuplicateDestinationIds,
} from '@/utils/contact-classification.util';

export type EnrichedDestination = DestinationClassificationInput & {
  classification: ContactClassification;
};

export type CampaignClassificationContext = {
  duplicateIds: Set<string>;
  leadByDest: Map<string, LeadClassificationHint>;
};

export function destinationToClassificationInput(
  dest: IDestination | DestinationClassificationInput,
): DestinationClassificationInput {
  const d = dest as DestinationClassificationInput & {
    consent?: { granted?: boolean; source?: string };
    profilePictureMime?: string;
  };
  return {
    _id: String(d._id),
    type: d.type,
    identifier: d.identifier,
    name: d.name,
    consentStatus: d.consentStatus,
    consent: d.consent,
    pendingOutboundCount: d.pendingOutboundCount,
    tags: d.tags,
    phoneType: d.phoneType,
    hasProfilePicture: Boolean(
      (d as { hasProfilePicture?: boolean }).hasProfilePicture ??
        d.profilePictureMime?.startsWith('image/'),
    ),
    lastMessageSent: d.lastMessageSent,
    createdAt: d.createdAt,
    contactKind: d.contactKind,
    contactOrigin: d.contactOrigin,
    commercialStatus: d.commercialStatus,
    temperature: d.temperature,
    phoneQuality: d.phoneQuality,
  };
}

export async function loadCampaignClassificationContext(
  clientId: string,
): Promise<CampaignClassificationContext> {
  const contacts = await Destination.find({
    clientId: new mongoose.Types.ObjectId(clientId),
    type: 'contact',
  })
    .select('_id identifier')
    .lean();

  const duplicateIds = findDuplicateDestinationIds(
    contacts.map(c => ({
      _id: String(c._id),
      type: 'contact' as const,
      identifier: String(c.identifier),
    })),
  );

  const leadByDest = new Map<string, LeadClassificationHint>();
  const leads = await LeadCapture.find({
    clientId: new mongoose.Types.ObjectId(clientId),
    destinationId: { $exists: true, $ne: null },
  })
    .sort({ updatedAt: -1 })
    .select('destinationId status temperature origin')
    .lean();

  for (const lead of leads) {
    const destId = String(lead.destinationId);
    if (!destId || leadByDest.has(destId)) continue;
    leadByDest.set(destId, {
      status: lead.status,
      temperature: lead.temperature,
      origin: lead.origin,
      converted: lead.status === 'converted',
    });
  }

  return { duplicateIds, leadByDest };
}

export function classifyDestination(
  dest: IDestination | DestinationClassificationInput,
  ctx: CampaignClassificationContext,
): ContactClassification {
  const input = destinationToClassificationInput(dest);
  return buildContactClassification(input, {
    lead: ctx.leadByDest.get(String(input._id)),
    duplicateIds: ctx.duplicateIds,
  });
}

/** Retorna mensagem de erro se o contato não pode receber campanha. */
export function assertCampaignSendAllowed(
  dest: IDestination,
  ctx: CampaignClassificationContext,
): string | null {
  if (dest.type === 'group') return null;
  const classification = classifyDestination(dest, ctx);
  if (!classification.campaignSelectable) {
    return classification.sendBlockReason ?? 'Contato não elegível para campanha';
  }
  return null;
}

export function setContactClassificationFields(
  dest: IDestination,
  patch: {
    contactKind?: ContactKind;
    contactOrigin?: ContactOrigin;
    commercialStatus?: CommercialStatus;
    temperature?: ContactTemperature;
  },
  opts?: { onlyIfEmpty?: boolean },
): void {
  const onlyIfEmpty = opts?.onlyIfEmpty !== false;
  if (patch.contactKind && (!onlyIfEmpty || !dest.contactKind)) {
    dest.contactKind = patch.contactKind;
  }
  if (patch.contactOrigin && (!onlyIfEmpty || !dest.contactOrigin)) {
    dest.contactOrigin = patch.contactOrigin;
  }
  if (patch.commercialStatus && (!onlyIfEmpty || !dest.commercialStatus)) {
    dest.commercialStatus = patch.commercialStatus;
  }
  if (patch.temperature && (!onlyIfEmpty || !dest.temperature)) {
    const t = patch.temperature;
    if (['cold', 'warm', 'hot', 'vip', 'risk'].includes(t)) {
      dest.temperature = t;
    }
  }
}

/** PATCH explícito de classificação (painel / visitor-profile). */
export function applyContactClassificationPatch(
  dest: IDestination,
  patch: {
    contactKind?: ContactKind | null;
    contactOrigin?: ContactOrigin | null;
    commercialStatus?: CommercialStatus | null;
    temperature?: ContactTemperature | null;
  },
): void {
  if (patch.contactKind !== undefined) {
    dest.contactKind = patch.contactKind === null ? undefined : patch.contactKind || undefined;
  }
  if (patch.contactOrigin !== undefined) {
    dest.contactOrigin = patch.contactOrigin === null ? undefined : patch.contactOrigin || undefined;
  }
  if (patch.commercialStatus !== undefined) {
    dest.commercialStatus =
      patch.commercialStatus === null ? undefined : patch.commercialStatus || undefined;
  }
  if (patch.temperature !== undefined) {
    dest.temperature = patch.temperature === null ? undefined : patch.temperature || undefined;
  }
}

const LEAD_ORIGIN_TO_CONTACT: Record<string, ContactOrigin> = {
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

export function mapLeadOriginToContactOrigin(origin?: string): ContactOrigin {
  if (!origin) return 'form';
  return LEAD_ORIGIN_TO_CONTACT[origin] ?? 'form';
}

export async function syncDestinationClassificationFromLead(
  destinationId: mongoose.Types.ObjectId | string,
  capture: {
    origin?: string;
    status?: string;
    temperature?: string;
  },
  mode: 'lead' | 'converted',
): Promise<void> {
  const { Destination } = await import('@/models/Destination');
  const dest = await Destination.findById(destinationId);
  if (!dest || dest.type !== 'contact') return;

  if (mode === 'converted') {
    setContactClassificationFields(
      dest,
      {
        contactKind: 'client',
        commercialStatus: 'converted',
        contactOrigin: mapLeadOriginToContactOrigin(capture.origin),
      },
      { onlyIfEmpty: false },
    );
  } else {
    setContactClassificationFields(dest, {
      contactKind: 'lead',
      contactOrigin: mapLeadOriginToContactOrigin(capture.origin),
      commercialStatus: capture.status === 'converted' ? 'converted' : 'new',
      temperature:
        capture.temperature === 'hot' ||
        capture.temperature === 'warm' ||
        capture.temperature === 'cold'
          ? capture.temperature
          : undefined,
    });
  }

  await dest.save();
}

export async function enrichDestinationsWithClassification(  destinations: Array<DestinationClassificationInput & { clientId?: unknown }>,
): Promise<EnrichedDestination[]> {
  const contactIds = destinations
    .filter(d => d.type === 'contact')
    .map(d => new mongoose.Types.ObjectId(String(d._id)));

  const leadByDest = new Map<
    string,
    { status?: string; temperature?: string; origin?: string; converted?: boolean }
  >();

  if (contactIds.length > 0) {
    const clientId = destinations[0]?.clientId;
    const leadQuery: Record<string, unknown> = {
      destinationId: { $in: contactIds },
    };
    if (clientId) leadQuery.clientId = clientId;

    const leads = await LeadCapture.find(leadQuery)
      .sort({ updatedAt: -1 })
      .select('destinationId status temperature origin')
      .lean();

    for (const lead of leads) {
      const destId = String(lead.destinationId);
      if (!destId || leadByDest.has(destId)) continue;
      leadByDest.set(destId, {
        status: lead.status,
        temperature: lead.temperature,
        origin: lead.origin,
        converted: lead.status === 'converted',
      });
    }
  }

  const duplicateIds = findDuplicateDestinationIds(destinations);

  return destinations.map(d => ({
    ...d,
    classification: buildContactClassification(d, {
      lead: leadByDest.get(String(d._id)),
      duplicateIds,
    }),
  }));
}

export type SmartSegmentPresetId =
  | 'opt_in_leads'
  | 'active_clients'
  | 'hot_leads'
  | 'pending_consent'
  | 'blocked_send';

export interface SmartSegmentPreset {
  id: SmartSegmentPresetId;
  label: string;
  description: string;
  count: number;
}

export function computeSmartSegmentPresets(enriched: EnrichedDestination[]): SmartSegmentPreset[] {
  let optInLeads = 0;
  let activeClients = 0;
  let hotLeads = 0;
  let pendingConsent = 0;
  let blockedSend = 0;

  for (const d of enriched) {
    if (d.type !== 'contact' || !d.classification) continue;
    const c = d.classification;
    if (c.kind === 'lead' && c.permission === 'opt_in_accepted') optInLeads += 1;
    if (
      c.kind === 'client' &&
      c.permission === 'opt_in_accepted' &&
      c.commercialStatus !== 'inactive' &&
      c.commercialStatus !== 'lost'
    ) {
      activeClients += 1;
    }
    if (c.kind === 'lead' && (c.temperature === 'hot' || c.temperature === 'warm')) hotLeads += 1;
    if (c.permission === 'pending') pendingConsent += 1;
    if (!c.campaignSelectable) blockedSend += 1;
  }

  return [
    {
      id: 'opt_in_leads',
      label: 'Leads com opt-in',
      description: 'Leads que autorizaram receber mensagens',
      count: optInLeads,
    },
    {
      id: 'active_clients',
      label: 'Clientes ativos',
      description: 'Clientes com opt-in e funil ativo',
      count: activeClients,
    },
    {
      id: 'hot_leads',
      label: 'Leads quentes/mornos',
      description: 'Temperatura comercial alta',
      count: hotLeads,
    },
    {
      id: 'pending_consent',
      label: 'Opt-in pendente',
      description: 'Aguardando confirmação LGPD',
      count: pendingConsent,
    },
    {
      id: 'blocked_send',
      label: 'Bloqueados p/ campanha',
      description: 'Não podem receber envio em massa',
      count: blockedSend,
    },
  ];
}

/** Filtro rápido `?class=` em GET /destinations (paridade com UI /contact). */
export type DestinationClassFilterKey =
  | 'opt_in'
  | 'pending'
  | 'hot'
  | 'blocked'
  | ContactKind;

const CLASS_FILTER_ALIASES = new Set<string>([
  'opt_in',
  'pending',
  'hot',
  'blocked',
  ...CONTACT_KINDS,
]);

export function parseDestinationClassFilter(
  raw?: string,
): DestinationClassFilterKey | undefined {
  const key = raw?.trim();
  if (!key || !CLASS_FILTER_ALIASES.has(key)) return undefined;
  return key as DestinationClassFilterKey;
}

export function classFilterToDestinationQuery(
  key: DestinationClassFilterKey,
): DestinationClassificationQuery {
  if (key === 'opt_in') return { permission: 'opt_in_accepted' };
  if (key === 'pending') return { permission: 'pending' };
  if (key === 'hot') return { temperatures: ['hot', 'warm'] };
  if (key === 'blocked') return { campaignBlockedOnly: true };
  return { kinds: [key] };
}

export function matchesDestinationClassFilter(
  classification: ContactClassification | undefined,
  key: DestinationClassFilterKey,
): boolean {
  if (!classification) return false;
  if (key === 'opt_in') return classification.permission === 'opt_in_accepted';
  if (key === 'pending') return classification.permission === 'pending';
  if (key === 'hot') {
    return classification.temperature === 'hot' || classification.temperature === 'warm';
  }
  if (key === 'blocked') return !classification.campaignSelectable;
  return classification.kind === key;
}

function bumpCount(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

export async function getDestinationClassificationStats(
  clientId: string,
): Promise<DestinationClassificationStats> {
  const destinations = await Destination.find({
    clientId: new mongoose.Types.ObjectId(clientId),
    type: 'contact',
  })
    .select('-profilePictureData')
    .lean();

  const enriched = await enrichDestinationsWithClassification(
    destinations as unknown as Array<DestinationClassificationInput & { clientId?: unknown }>,
  );

  const byKind: Record<string, number> = {};
  const byPermission: Record<string, number> = {};
  const byOrigin: Record<string, number> = {};
  const byTemperature: Record<string, number> = {};
  const byCommercialStatus: Record<string, number> = {};
  const byPhoneQuality: Record<string, number> = {};
  let campaignSelectable = 0;
  let campaignBlocked = 0;

  for (const d of enriched) {
    const c = d.classification;
    if (!c) continue;
    bumpCount(byKind, c.kind);
    bumpCount(byPermission, c.permission);
    bumpCount(byOrigin, c.origin);
    bumpCount(byTemperature, c.temperature);
    bumpCount(byCommercialStatus, c.commercialStatus);
    bumpCount(byPhoneQuality, c.phoneQuality);
    if (c.campaignSelectable) campaignSelectable += 1;
    else campaignBlocked += 1;
  }

  const [smartSegments, backfillPending] = await Promise.all([
    Promise.resolve(computeSmartSegmentPresets(enriched)),
    countClassificationBackfillPending(clientId),
  ]);

  return {
    totalContacts: enriched.length,
    campaignSelectable,
    campaignBlocked,
    backfillPending,
    smartSegments,
    byKind,
    byPermission,
    byOrigin,
    byTemperature,
    byCommercialStatus,
    byPhoneQuality,
  };
}

export async function exportClassificationStatsCsv(
  clientId: string,
): Promise<{ csv: string; filename: string }> {
  const stats = await getDestinationClassificationStats(clientId);
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    csv: buildClassificationStatsCsv(stats),
    filename: `classificacao-resumo-${stamp}.csv`,
  };
}

export async function exportContactsClassificationCsv(
  clientId: string,
  classFilter?: DestinationClassFilterKey,
): Promise<{ csv: string; filename: string; count: number }> {
  const clientOid = new mongoose.Types.ObjectId(clientId);
  const mongoFilter: Record<string, unknown> = {
    clientId: clientOid,
    type: 'contact',
    isActive: true,
  };

  if (classFilter) {
    const ids = await findDestinationIdsMatchingClassification(
      clientId,
      classFilterToDestinationQuery(classFilter),
    );
    if (!ids.length) {
      const stamp = new Date().toISOString().slice(0, 10);
      return {
        csv: buildContactsClassificationCsv([]),
        filename: `contatos-classificacao-${classFilter}-${stamp}.csv`,
        count: 0,
      };
    }
    mongoFilter._id = { $in: ids };
  }

  const destinations = await Destination.find(mongoFilter).sort({ name: 1 }).lean();
  const enriched = await enrichDestinationsWithClassification(
    destinations as unknown as Array<DestinationClassificationInput & { clientId?: unknown }>,
  );

  const rows = enriched
    .filter(d => d.classification)
    .map(d => ({
      nome: String(d.name ?? ''),
      telefone: String(d.identifier ?? ''),
      email: (d as { email?: string }).email,
      empresa: (d as { organization?: string }).organization,
      classification: d.classification!,
    }));

  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = classFilter ? `-${classFilter}` : '';
  return {
    csv: buildContactsClassificationCsv(rows),
    filename: `contatos-classificacao${suffix}-${stamp}.csv`,
    count: rows.length,
  };
}

/** Anexa classificação CRM compacta às linhas do Inbox (lista unificada). */
export async function attachClassificationToConversationRows<
  T extends { destinationId?: string | null | undefined },
>(
  clientId: string,
  rows: T[],
): Promise<Array<T & { contactClassification?: ContactClassification }>> {
  const destIdSet = new Set(
    rows.map(r => (r.destinationId ? String(r.destinationId) : '')).filter(Boolean),
  );
  if (!destIdSet.size) {
    return rows.map(r => ({ ...r }));
  }

  const destinations = await Destination.find({
    clientId: new mongoose.Types.ObjectId(clientId),
    _id: { $in: [...destIdSet].map(id => new mongoose.Types.ObjectId(id)) },
    type: 'contact',
  })
    .select(
      'name identifier consentStatus consent pendingOutboundCount contactKind contactOrigin commercialStatus temperature phoneQuality phoneType profilePictureMime type tags',
    )
    .lean();

  if (!destinations.length) {
    return rows.map(r => ({ ...r }));
  }

  const ctx = await loadCampaignClassificationContext(clientId);
  const byDest = new Map<string, ContactClassification>();
  for (const raw of destinations) {
    byDest.set(String(raw._id), classifyDestination(raw as unknown as IDestination, ctx));
  }

  return rows.map(r => {
    const destId = r.destinationId ? String(r.destinationId) : '';
    return {
      ...r,
      contactClassification: destId ? byDest.get(destId) : undefined,
    };
  });
}

export async function listSmartSegmentPresets(clientId: string): Promise<SmartSegmentPreset[]> {
  const destinations = await Destination.find({
    clientId: new mongoose.Types.ObjectId(clientId),
    type: 'contact',
  })
    .select('-profilePictureData')
    .lean();
  const enriched = await enrichDestinationsWithClassification(
    destinations as unknown as Array<DestinationClassificationInput & { clientId?: unknown }>,
  );
  return computeSmartSegmentPresets(enriched);
}

const SMART_SEGMENT_PRESET_IDS = new Set<SmartSegmentPresetId>([
  'opt_in_leads',
  'active_clients',
  'hot_leads',
  'pending_consent',
  'blocked_send',
]);

export function isSmartSegmentPresetId(id: string): id is SmartSegmentPresetId {
  return SMART_SEGMENT_PRESET_IDS.has(id as SmartSegmentPresetId);
}

export function destinationMatchesSmartSegment(
  classification: ContactClassification,
  presetId: SmartSegmentPresetId,
): boolean {
  switch (presetId) {
    case 'opt_in_leads':
      return classification.kind === 'lead' && classification.permission === 'opt_in_accepted';
    case 'active_clients':
      return (
        classification.kind === 'client' &&
        classification.permission === 'opt_in_accepted' &&
        classification.commercialStatus !== 'inactive' &&
        classification.commercialStatus !== 'lost'
      );
    case 'hot_leads':
      return (
        classification.kind === 'lead' &&
        (classification.temperature === 'hot' || classification.temperature === 'warm')
      );
    case 'pending_consent':
      return classification.permission === 'pending';
    case 'blocked_send':
      return !classification.campaignSelectable;
    default:
      return false;
  }
}

export async function listSmartSegmentMembers(
  clientId: string,
  presetId: SmartSegmentPresetId,
  opts?: { limit?: number },
): Promise<EnrichedDestination[]> {
  if (!isSmartSegmentPresetId(presetId)) {
    throw new Error('Segmento inteligente inválido');
  }
  const limit = Math.min(Math.max(opts?.limit ?? 500, 1), 2000);
  const destinations = await Destination.find({
    clientId: new mongoose.Types.ObjectId(clientId),
    type: 'contact',
    isActive: true,
  })
    .select('-profilePictureData')
    .sort({ name: 1 })
    .lean();
  const enriched = await enrichDestinationsWithClassification(
    destinations as unknown as Array<DestinationClassificationInput & { clientId?: unknown }>,
  );
  return enriched
    .filter(d => d.classification && destinationMatchesSmartSegment(d.classification, presetId))
    .slice(0, limit);
}

function classificationBackfillQuery(clientId: string) {
  return {
    clientId: new mongoose.Types.ObjectId(clientId),
    type: 'contact' as const,
    $or: [
      { contactKind: { $exists: false } },
      { contactKind: null },
      { contactOrigin: { $exists: false } },
      { contactOrigin: null },
      { commercialStatus: { $exists: false } },
      { commercialStatus: null },
      { temperature: { $exists: false } },
      { temperature: null },
    ],
  };
}

export async function countClassificationBackfillPending(clientId: string): Promise<number> {
  return Destination.countDocuments(classificationBackfillQuery(clientId));
}

export async function backfillStoredClassification(
  clientId: string,
  opts?: { limit?: number; dryRun?: boolean },
): Promise<{ scanned: number; updated: number; pending: number }> {
  const limit = Math.min(Math.max(opts?.limit ?? 500, 1), 5000);
  const dryRun = opts?.dryRun === true;
  const ctx = await loadCampaignClassificationContext(clientId);
  const batch = await Destination.find(classificationBackfillQuery(clientId))
    .sort({ updatedAt: 1 })
    .limit(limit)
    .lean();

  let updated = 0;
  for (const raw of batch) {
    const classification = classifyDestination(raw as unknown as IDestination, ctx);
    if (dryRun) {
      updated += 1;
      continue;
    }
    const dest = await Destination.findById(raw._id);
    if (!dest || dest.type !== 'contact') continue;

    let changed = false;
    if (!dest.contactKind && classification.kind) {
      dest.contactKind = classification.kind;
      changed = true;
    }
    if (!dest.contactOrigin && classification.origin) {
      dest.contactOrigin = classification.origin;
      changed = true;
    }
    if (!dest.commercialStatus && classification.commercialStatus) {
      dest.commercialStatus = classification.commercialStatus;
      changed = true;
    }
    if (!dest.temperature && classification.temperature) {
      dest.temperature = classification.temperature;
      changed = true;
    }
    if (changed) {
      await dest.save();
      updated += 1;
    }
  }

  const pending = await countClassificationBackfillPending(clientId);
  return { scanned: batch.length, updated, pending };
}

export type DestinationClassificationQuery = {
  kinds?: ContactKind[];
  permission?: SendPermission;
  temperatures?: ContactTemperature[];
  campaignSelectableOnly?: boolean;
  campaignBlockedOnly?: boolean;
};

export async function findDestinationIdsMatchingClassification(
  clientId: string,
  query: DestinationClassificationQuery,
): Promise<mongoose.Types.ObjectId[]> {
  const destinations = await Destination.find({
    clientId: new mongoose.Types.ObjectId(clientId),
    type: 'contact',
    isActive: true,
  })
    .select('-profilePictureData')
    .lean();

  if (!destinations.length) return [];

  const ctx = await loadCampaignClassificationContext(clientId);
  const ids: mongoose.Types.ObjectId[] = [];

  for (const raw of destinations) {
    const classification = classifyDestination(raw as unknown as IDestination, ctx);
    if (query.kinds?.length && !query.kinds.includes(classification.kind)) continue;
    if (query.permission && classification.permission !== query.permission) continue;
    if (query.temperatures?.length && !query.temperatures.includes(classification.temperature)) {
      continue;
    }
    if (query.campaignSelectableOnly && !classification.campaignSelectable) continue;
    if (query.campaignBlockedOnly && classification.campaignSelectable) continue;
    ids.push(raw._id as mongoose.Types.ObjectId);
  }

  return ids;
}

export type AutomationClassificationFilter = {
  destinationSmartSegmentId?: string;
  destinationFilterKinds?: ContactKind[];
  destinationFilterPermissions?: SendPermission[];
  destinationFilterTemperatures?: ContactTemperature[];
  destinationCampaignSelectableOnly?: boolean;
};

export function hasAutomationClassificationFilter(
  filter: AutomationClassificationFilter,
): boolean {
  return Boolean(
    filter.destinationSmartSegmentId ||
      filter.destinationFilterKinds?.length ||
      filter.destinationFilterPermissions?.length ||
      filter.destinationFilterTemperatures?.length ||
      filter.destinationCampaignSelectableOnly,
  );
}

export function matchesAutomationClassificationFilter(
  classification: ContactClassification,
  filter: AutomationClassificationFilter,
): boolean {
  if (
    filter.destinationSmartSegmentId &&
    isSmartSegmentPresetId(filter.destinationSmartSegmentId)
  ) {
    return destinationMatchesSmartSegment(classification, filter.destinationSmartSegmentId);
  }
  if (filter.destinationFilterKinds?.length) {
    if (!filter.destinationFilterKinds.includes(classification.kind)) return false;
  }
  if (filter.destinationFilterPermissions?.length) {
    if (!filter.destinationFilterPermissions.includes(classification.permission)) return false;
  }
  if (filter.destinationFilterTemperatures?.length) {
    if (!filter.destinationFilterTemperatures.includes(classification.temperature)) return false;
  }
  if (filter.destinationCampaignSelectableOnly && !classification.campaignSelectable) {
    return false;
  }
  return true;
}

export function automationFilterFromRule(rule: AutomationClassificationFilter): AutomationClassificationFilter {
  return {
    destinationSmartSegmentId: rule.destinationSmartSegmentId || undefined,
    destinationFilterKinds: rule.destinationFilterKinds?.length
      ? rule.destinationFilterKinds
      : undefined,
    destinationFilterPermissions: rule.destinationFilterPermissions?.length
      ? rule.destinationFilterPermissions
      : undefined,
    destinationFilterTemperatures: rule.destinationFilterTemperatures?.length
      ? rule.destinationFilterTemperatures
      : undefined,
    destinationCampaignSelectableOnly: rule.destinationCampaignSelectableOnly === true
      ? true
      : undefined,
  };
}
