import mongoose from 'mongoose';
import crypto from 'crypto';
import { LeadForm, ILeadForm } from '@/models/LeadForm';
import { LeadCapture, ILeadCapture } from '@/models/LeadCapture';
import { ContactGroup } from '@/models/ContactGroup';
import { ContactAutoSegmentService } from '@/services/contacts/ContactAutoSegmentService';
import { ensureDestinationForWebChatVisitor } from '@/services/webchat/webchat-destination-link.util';
import { normalizeContactPhoneE164 } from '@/utils/contact-csv-import';
import { createServiceLogger } from '@/utils/logger';
import type {
  LeadCaptureListItem,
  LeadCaptureOrigin,
  LeadCaptureStatus,
  LeadTemperature,
  LeadContactSearchItem,
  LeadDuplicateHint,
  LeadFormListItem,
  LeadFormPublicConfig,
  LeadFormAppearance,
  LeadFormCustomField,
  LeadFormRouting,
  LeadSegmentSummary,
  LeadStats,
  LeadUtm,
} from '@/types/lead-form';
import {
  DEFAULT_LEAD_FORM_APPEARANCE,
  DEFAULT_LEAD_FORM_ROUTING,
  LEAD_CAPTURE_ORIGIN_LABEL,
  LEAD_CAPTURE_ORIGINS,
  LEAD_CAPTURE_STATUS_LABEL,
  LEAD_CAPTURE_STATUSES,
  LEAD_TEMPERATURE_LABEL,
} from '@/types/lead-form';
import {
  assertLeadFormOrigin,
  generateLeadFormPublicKey,
  sanitizeLeadText,
} from './lead-form-token.util';
import { appendLeadHistory, emitLeadWebhook } from './lead-events.util';

const logger = createServiceLogger('LeadFormService');

const CUSTOM_FIELD_ID_RE = /^cf_[a-f0-9]{8,24}$/;
const VALID_FIELD_TYPES = new Set(['text', 'textarea', 'email', 'tel', 'select', 'checkbox', 'hidden']);

function normalizeCustomFields(raw: unknown): LeadFormCustomField[] {
  if (!Array.isArray(raw)) return [];
  const out: LeadFormCustomField[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Partial<LeadFormCustomField>;
    const idRaw = typeof row.id === 'string' ? row.id.trim() : '';
    const id = CUSTOM_FIELD_ID_RE.test(idRaw)
      ? idRaw
      : `cf_${crypto.randomBytes(6).toString('hex')}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const label = sanitizeLeadText(row.label, 80);
    if (!label) continue;
    const type = VALID_FIELD_TYPES.has(row.type as string)
      ? (row.type as LeadFormCustomField['type'])
      : 'text';
    const options =
      type === 'select' && Array.isArray(row.options)
        ? row.options.map(o => sanitizeLeadText(String(o), 80)).filter(Boolean).slice(0, 20)
        : undefined;
    out.push({
      id,
      label,
      type,
      required: Boolean(row.required),
      placeholder: sanitizeLeadText(row.placeholder, 120) || undefined,
      options,
    });
    if (out.length >= 12) break;
  }
  return out;
}

function normalizeRouting(raw: Partial<LeadFormRouting> | undefined): LeadFormRouting {
  const base = { ...DEFAULT_LEAD_FORM_ROUTING, ...(raw ?? {}) };
  const status = LEAD_CAPTURE_STATUSES.includes(base.initialStatus as LeadCaptureStatus)
    ? (base.initialStatus as LeadCaptureStatus)
    : 'new';
  return {
    initialStatus: status,
    defaultContactGroupIds: (base.defaultContactGroupIds ?? [])
      .map(id => String(id).trim())
      .filter(Boolean)
      .slice(0, 10),
    defaultTags: (base.defaultTags ?? [])
      .map(t => sanitizeLeadText(t, 60))
      .filter(Boolean)
      .slice(0, 10),
    defaultAssigneeId: base.defaultAssigneeId?.trim() || undefined,
    contactMode: ['always', 'qualify', 'never'].includes(base.contactMode)
      ? base.contactMode
      : 'always',
    autoOpenInbox: Boolean(base.autoOpenInbox),
    autoOpenInboxWhenOnline: Boolean(base.autoOpenInboxWhenOnline),
  };
}

function normalizeAppearance(raw: Partial<LeadFormAppearance> | undefined): LeadFormAppearance {
  const base = { ...DEFAULT_LEAD_FORM_APPEARANCE, ...(raw ?? {}) };
  return {
    ...base,
    theme: ['auto', 'light', 'dark'].includes(base.theme) ? base.theme : 'auto',
    size: ['compact', 'default', 'wide'].includes(base.size) ? base.size : 'default',
    borderRadius: Math.min(24, Math.max(0, Number(base.borderRadius) || 8)),
    customFields: raw?.customFields !== undefined ? normalizeCustomFields(raw.customFields) : base.customFields ?? [],
    consentText: sanitizeLeadText(base.consentText, 500) || DEFAULT_LEAD_FORM_APPEARANCE.consentText,
    consentPolicyUrl: sanitizeLeadText(base.consentPolicyUrl, 500) || undefined,
  };
}

function parseCustomFieldValues(
  defs: LeadFormCustomField[],
  raw: Record<string, unknown> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const def of defs) {
    if (def.type === 'hidden') continue;
    const max = def.type === 'textarea' ? 2000 : 500;
    const val = sanitizeLeadText(raw?.[def.id], max);
    if (def.required && def.type !== 'checkbox' && !val) throw new Error(`${def.label} é obrigatório`);
    if (def.type === 'checkbox' && def.required && raw?.[def.id] !== true && raw?.[def.id] !== 'true') {
      throw new Error(`${def.label} é obrigatório`);
    }
    if (val || def.type === 'checkbox') {
      out[def.label] = def.type === 'checkbox' ? (raw?.[def.id] ? 'Sim' : 'Não') : val;
    }
  }
  return out;
}

function parseUtm(raw: unknown): LeadUtm | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const u = raw as Record<string, unknown>;
  const utm: LeadUtm = {
    source: sanitizeLeadText(u.source, 120) || undefined,
    medium: sanitizeLeadText(u.medium, 120) || undefined,
    campaign: sanitizeLeadText(u.campaign, 120) || undefined,
    term: sanitizeLeadText(u.term, 120) || undefined,
    content: sanitizeLeadText(u.content, 120) || undefined,
  };
  return Object.values(utm).some(Boolean) ? utm : undefined;
}

function detectOrigin(referer?: string, explicit?: string): LeadCaptureOrigin {
  if (explicit && LEAD_CAPTURE_ORIGINS.includes(explicit as LeadCaptureOrigin)) {
    return explicit as LeadCaptureOrigin;
  }
  const ref = (referer ?? '').toLowerCase();
  if (ref.includes('wordpress') || ref.includes('wp-content')) return 'wordpress';
  if (ref.includes('elementor')) return 'wordpress';
  return 'site';
}

function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export class LeadFormService {
  private static instance: LeadFormService;

  static getInstance(): LeadFormService {
    if (!LeadFormService.instance) {
      LeadFormService.instance = new LeadFormService();
    }
    return LeadFormService.instance;
  }

  async listForms(clientId: string): Promise<LeadFormListItem[]> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const [forms, counts, counts7d] = await Promise.all([
      LeadForm.find({ clientId: clientOid }).sort({ createdAt: -1 }).exec(),
      LeadCapture.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
        { $match: { clientId: clientOid } },
        { $group: { _id: '$formId', count: { $sum: 1 } } },
      ]),
      LeadCapture.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
        { $match: { clientId: clientOid, createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } } },
        { $group: { _id: '$formId', count: { $sum: 1 } } },
      ]),
    ]);
    const countMap = new Map(counts.map(c => [String(c._id), c.count]));
    const count7Map = new Map(counts7d.map(c => [String(c._id), c.count]));
    return forms.map(f => this.toFormListItem(f, countMap.get(String(f._id)) ?? 0, count7Map.get(String(f._id)) ?? 0));
  }

  async createForm(
    clientId: string,
    body: {
      name: string;
      appearance?: Partial<LeadFormAppearance>;
      routing?: Partial<LeadFormRouting>;
      allowedDomains?: string[];
    },
  ): Promise<LeadFormListItem> {
    const name = sanitizeLeadText(body.name, 120);
    if (!name) throw new Error('Nome do formulário é obrigatório');

    const form = await LeadForm.create({
      clientId: new mongoose.Types.ObjectId(clientId),
      name,
      publicKey: generateLeadFormPublicKey(),
      active: true,
      allowedDomains: (body.allowedDomains ?? []).map(d => d.trim()).filter(Boolean),
      appearance: normalizeAppearance(body.appearance),
      routing: normalizeRouting(body.routing),
    });
    return this.toFormListItem(form, 0, 0);
  }

  async duplicateForm(clientId: string, formId: string): Promise<LeadFormListItem | null> {
    const form = await LeadForm.findOne({
      _id: new mongoose.Types.ObjectId(formId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!form) return null;
    const copy = await LeadForm.create({
      clientId: form.clientId,
      name: `${form.name} (cópia)`,
      publicKey: generateLeadFormPublicKey(),
      active: false,
      allowedDomains: [...(form.allowedDomains ?? [])],
      appearance: { ...(form.appearance ?? DEFAULT_LEAD_FORM_APPEARANCE) },
      routing: { ...(form.routing ?? DEFAULT_LEAD_FORM_ROUTING) },
      redirectUrl: form.redirectUrl,
    });
    return this.toFormListItem(copy, 0, 0);
  }

  async updateForm(
    clientId: string,
    formId: string,
    patch: Partial<{
      name: string;
      active: boolean;
      allowedDomains: string[];
      appearance: Partial<LeadFormAppearance>;
      routing: Partial<LeadFormRouting>;
      redirectUrl: string | null;
    }>,
  ): Promise<LeadFormListItem | null> {
    const form = await LeadForm.findOne({
      _id: new mongoose.Types.ObjectId(formId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!form) return null;

    if (patch.name !== undefined) {
      const name = sanitizeLeadText(patch.name, 120);
      if (!name) throw new Error('Nome do formulário é obrigatório');
      form.name = name;
    }
    if (patch.active !== undefined) form.active = Boolean(patch.active);
    if (patch.allowedDomains !== undefined) {
      form.allowedDomains = patch.allowedDomains.map(d => d.trim()).filter(Boolean);
    }
    if (patch.appearance) {
      form.appearance = normalizeAppearance({ ...form.appearance, ...patch.appearance });
    }
    if (patch.routing) {
      if (patch.routing.defaultAssigneeId !== undefined) {
        await this.validateAssigneeId(clientId, patch.routing.defaultAssigneeId || undefined);
      }
      form.routing = normalizeRouting({ ...form.routing, ...patch.routing });
    }
    if (patch.redirectUrl !== undefined) {
      form.redirectUrl = patch.redirectUrl?.trim() || undefined;
    }

    this.validateFormFields(form.appearance);
    await form.save();

    const count = await LeadCapture.countDocuments({ clientId: form.clientId, formId: form._id });
    const count7 = await LeadCapture.countDocuments({
      clientId: form.clientId,
      formId: form._id,
      createdAt: { $gte: new Date(Date.now() - 7 * 86400000) },
    });
    return this.toFormListItem(form, count, count7);
  }

  validateFormFields(appearance: LeadFormAppearance): void {
    if (appearance.requireEmail && !appearance.askEmail) {
      throw new Error('E-mail obrigatório exige que o campo e-mail esteja ativo');
    }
    if (appearance.requireMessage && !appearance.askMessage) {
      throw new Error('Mensagem obrigatória exige que o campo mensagem esteja ativo');
    }
  }

  async deleteForm(clientId: string, formId: string): Promise<boolean> {
    const result = await LeadForm.deleteOne({
      _id: new mongoose.Types.ObjectId(formId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    return result.deletedCount > 0;
  }

  async getActiveFormByPublicKey(publicKey: string): Promise<ILeadForm | null> {
    return LeadForm.findOne({ publicKey, active: true }).exec();
  }

  getPublicConfig(form: ILeadForm): LeadFormPublicConfig {
    const a = normalizeAppearance(form.appearance);
    return {
      publicKey: form.publicKey,
      title: a.title,
      description: a.description,
      buttonText: a.buttonText,
      successMessage: a.successMessage,
      primaryColor: a.primaryColor,
      theme: a.theme,
      size: a.size,
      borderRadius: a.borderRadius,
      showLogo: a.showLogo,
      askEmail: a.askEmail,
      requireEmail: a.requireEmail,
      askMessage: a.askMessage,
      requireMessage: a.requireMessage,
      customFields: (a.customFields ?? []).filter(f => f.type !== 'hidden'),
      requireConsent: a.requireConsent,
      consentText: a.consentText,
      consentPolicyUrl: a.consentPolicyUrl,
      honeypot: a.honeypot,
      redirectUrl: form.redirectUrl,
    };
  }

  assertOrigin(form: ILeadForm, origin?: string | null, referer?: string | null): void {
    assertLeadFormOrigin(form.allowedDomains ?? [], origin, referer);
  }

  async detectDuplicates(
    clientId: string,
    phone: string,
    email?: string,
    excludeCaptureId?: string,
  ): Promise<{ possibleDuplicate: boolean; hints: LeadDuplicateHint[] }> {
    const hints: LeadDuplicateHint[] = [];
    const clientOid = new mongoose.Types.ObjectId(clientId);

    const { Destination } = await import('@/models/Destination');
    const contact = await Destination.findOne({
      clientId: clientOid,
      identifier: phone,
      type: 'contact',
    })
      .select('_id name identifier email')
      .lean();
    if (contact) {
      hints.push({
        kind: 'contact',
        id: String(contact._id),
        name: contact.name,
        phone: contact.identifier,
        email: contact.email,
      });
    }

    const leadFilter: Record<string, unknown> = { clientId: clientOid, phone };
    if (excludeCaptureId) {
      leadFilter._id = { $ne: new mongoose.Types.ObjectId(excludeCaptureId) };
    }
    const otherLead = await LeadCapture.findOne(leadFilter)
      .sort({ createdAt: -1 })
      .select('_id name phone email')
      .lean();
    if (otherLead) {
      hints.push({
        kind: 'lead',
        id: String(otherLead._id),
        name: otherLead.name,
        phone: otherLead.phone,
        email: otherLead.email,
      });
    }

    if (email) {
      const emailLead = await LeadCapture.findOne({
        clientId: clientOid,
        email,
        ...(excludeCaptureId ? { _id: { $ne: new mongoose.Types.ObjectId(excludeCaptureId) } } : {}),
      })
        .select('_id name phone email')
        .lean();
      if (emailLead && !hints.some(h => h.kind === 'lead' && h.id === String(emailLead._id))) {
        hints.push({
          kind: 'lead',
          id: String(emailLead._id),
          name: emailLead.name,
          phone: emailLead.phone,
          email: emailLead.email,
        });
      }
    }

    return { possibleDuplicate: hints.length > 0, hints };
  }

  async submitPublicLead(
    publicKey: string,
    body: {
      name?: string;
      phone?: string;
      email?: string;
      message?: string;
      sourceUrl?: string;
      pageTitle?: string;
      customFields?: Record<string, string>;
      utm?: LeadUtm;
      consent?: boolean;
      origin?: string;
      honeypot?: string;
    },
    meta: { origin?: string; referer?: string; ipAddress?: string; userAgent?: string },
  ): Promise<{ success: true; captureId: string; successMessage: string; redirectUrl?: string }> {
    const form = await this.getActiveFormByPublicKey(publicKey);
    if (!form) throw new Error('Formulário não encontrado ou inativo');

    this.assertOrigin(form, meta.origin, meta.referer);

    const appearance = normalizeAppearance(form.appearance);
    const routing = normalizeRouting(form.routing);

    if (appearance.honeypot && body.honeypot) {
      throw new Error('Envio rejeitado');
    }

    if (appearance.requireConsent && !body.consent) {
      throw new Error('Aceite de consentimento é obrigatório');
    }

    const name = sanitizeLeadText(body.name, 120);
    const phoneRaw = sanitizeLeadText(body.phone, 32);
    const email = sanitizeLeadText(body.email, 160).toLowerCase();
    const message = sanitizeLeadText(body.message, 2000);
    const sourceUrl = sanitizeLeadText(body.sourceUrl, 500);
    const pageTitle = sanitizeLeadText(body.pageTitle, 200);

    if (!name) throw new Error('Nome é obrigatório');
    if (!phoneRaw && !email) throw new Error('Informe telefone ou e-mail');
    if (!phoneRaw && appearance.requireEmail && !email) throw new Error('Telefone ou e-mail é obrigatório');

    let e164 = phoneRaw ? normalizeContactPhoneE164(phoneRaw) : '';
    if (phoneRaw && !e164) throw new Error('Telefone inválido');
    if (!e164 && email) e164 = `email:${email}`;

    if (appearance.requireEmail && !email) throw new Error('E-mail é obrigatório');
    if (appearance.requireMessage && !message) throw new Error('Mensagem é obrigatória');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('E-mail inválido');
    }

    const customDefs = appearance.customFields ?? [];
    const customValues = parseCustomFieldValues(customDefs, body.customFields);

    const metadata: Record<string, string> = { ...customValues };
    if (pageTitle) metadata.pageTitle = pageTitle;
    const utm = parseUtm(body.utm);

    const noteParts = [`Lead via formulário "${form.name}"`];
    if (sourceUrl) noteParts.push(`Origem: ${sourceUrl}`);
    if (message) noteParts.push(`Mensagem: ${message}`);
    for (const [label, val] of Object.entries(customValues)) {
      noteParts.push(`${label}: ${val}`);
    }

    const clientId = form.clientId.toString();
    const leadOrigin = detectOrigin(meta.referer, body.origin);

    let destinationId: mongoose.Types.ObjectId | undefined;
    if (routing.contactMode === 'always' && e164 && !e164.startsWith('email:')) {
      const ensured = await ensureDestinationForWebChatVisitor(clientId, e164, name, {
        email: email || undefined,
        notes: noteParts.join('\n'),
      });
      if (ensured) {
        destinationId = new mongoose.Types.ObjectId(ensured);
        const { Destination } = await import('@/models/Destination');
        const dest = await Destination.findById(ensured);
        if (dest) {
          await ContactAutoSegmentService.getInstance().tagLeadFromForm(clientId, dest, form.name);
          await this.applyDefaultGroupsAndTags(clientId, dest, routing);
        }
      }
    }

    const dup = await this.detectDuplicates(clientId, e164, email || undefined);

    const groupOids = (routing.defaultContactGroupIds ?? [])
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));

    const capture = await LeadCapture.create({
      clientId: form.clientId,
      formId: form._id,
      name,
      phone: e164,
      email: email || undefined,
      message: message || undefined,
      sourceUrl: sourceUrl || undefined,
      pageTitle: pageTitle || undefined,
      origin: leadOrigin,
      status: routing.initialStatus ?? 'new',
      destinationId,
      contactGroupIds: groupOids.length ? groupOids : undefined,
      assignedUserId: routing.defaultAssigneeId && mongoose.Types.ObjectId.isValid(routing.defaultAssigneeId)
        ? new mongoose.Types.ObjectId(routing.defaultAssigneeId)
        : undefined,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent ? sanitizeLeadText(meta.userAgent, 300) : undefined,
      metadata: Object.keys(metadata).length ? metadata : undefined,
      utm,
      consentAccepted: appearance.requireConsent ? Boolean(body.consent) : body.consent || undefined,
      consentAcceptedAt: body.consent ? new Date() : undefined,
      possibleDuplicate: dup.possibleDuplicate,
      duplicateHintIds: dup.hints.map(h => `${h.kind}:${h.id}`),
      history: appendLeadHistory(undefined, 'captured', `Capturado via ${LEAD_CAPTURE_ORIGIN_LABEL[leadOrigin]}`),
    });

    logger.info('Lead capturado via formulário público', {
      clientId,
      formId: form._id,
      captureId: capture._id,
    });

    emitLeadWebhook(clientId, 'captured', {
      capture_id: String(capture._id),
      form_id: String(form._id),
      form_name: form.name,
      name,
      phone: e164,
      email: email || null,
      origin: leadOrigin,
      status: capture.status,
    });

    return {
      success: true,
      captureId: String(capture._id),
      successMessage: appearance.successMessage,
      redirectUrl: form.redirectUrl,
    };
  }

  private async applyDefaultGroupsAndTags(
    clientId: string,
    dest: import('@/models/Destination').IDestination,
    routing: LeadFormRouting,
  ): Promise<void> {
    const groupIds = routing.defaultContactGroupIds ?? [];
    if (!groupIds.length && !(routing.defaultTags ?? []).length) return;

    const clientOid = new mongoose.Types.ObjectId(clientId);
    const validGroups = await ContactGroup.find({
      clientId: clientOid,
      _id: { $in: groupIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id)) },
    }).select('_id');

    const current = (dest.contactGroupIds ?? []).map(id => id.toString());
    for (const g of validGroups) {
      const gid = String(g._id);
      if (!current.includes(gid)) {
        dest.contactGroupIds = [...(dest.contactGroupIds ?? []), g._id as mongoose.Types.ObjectId];
      }
    }

    if (routing.defaultTags?.length) {
      const tags = new Set(dest.tags ?? []);
      for (const t of routing.defaultTags) tags.add(t);
      dest.tags = [...tags];
    }

    await dest.save();
  }

  async getStats(clientId: string): Promise<LeadStats> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const today = startOfDay();

    const [total, newToday, byStatusRaw, originRaw] = await Promise.all([
      LeadCapture.countDocuments({ clientId: clientOid }),
      LeadCapture.countDocuments({ clientId: clientOid, createdAt: { $gte: today } }),
      LeadCapture.aggregate<{ _id: LeadCaptureStatus; count: number }>([
        { $match: { clientId: clientOid } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      LeadCapture.aggregate<{ _id: LeadCaptureOrigin; count: number }>([
        { $match: { clientId: clientOid } },
        { $group: { _id: '$origin', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ]),
    ]);

    const byStatus = Object.fromEntries(
      LEAD_CAPTURE_STATUSES.map(s => [s, 0]),
    ) as Record<LeadCaptureStatus, number>;
    for (const row of byStatusRaw) {
      if (row._id) byStatus[row._id] = row.count;
    }

    const topOrigin = originRaw[0]?._id ?? null;
    const topOriginCount = originRaw[0]?.count ?? 0;

    return {
      total,
      newToday,
      inProgress: byStatus.in_progress + byStatus.in_review,
      converted: byStatus.converted,
      lost: byStatus.lost + byStatus.spam,
      topOrigin,
      topOriginCount,
      byStatus,
      funnel: LEAD_CAPTURE_STATUSES.filter(s => s !== 'spam' && s !== 'in_review').map(status => ({
        status,
        count: byStatus[status],
        label: LEAD_CAPTURE_STATUS_LABEL[status],
      })),
    };
  }

  async getSegmentSummary(clientId: string): Promise<LeadSegmentSummary[]> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const groups = await ContactGroup.find({ clientId: clientOid }).sort({ name: 1 }).exec();
    if (!groups.length) return [];

    const summaries: LeadSegmentSummary[] = [];
    for (const g of groups) {
      const gid = g._id as mongoose.Types.ObjectId;
      const [leadCount, convertedCount] = await Promise.all([
        LeadCapture.countDocuments({ clientId: clientOid, contactGroupIds: gid }),
        LeadCapture.countDocuments({ clientId: clientOid, contactGroupIds: gid, status: 'converted' }),
      ]);
      if (leadCount === 0 && !g.name.toLowerCase().includes('lead')) continue;
      summaries.push({
        id: String(gid),
        name: g.name,
        leadCount,
        convertedCount,
        conversionRate: leadCount > 0 ? Math.round((convertedCount / leadCount) * 100) : 0,
      });
    }
    return summaries.sort((a, b) => b.leadCount - a.leadCount);
  }

  async listCaptures(
    clientId: string,
    opts: {
      status?: LeadCaptureStatus;
      search?: string;
      formId?: string;
      origin?: LeadCaptureOrigin;
      groupId?: string;
      from?: string;
      to?: string;
      hasConsent?: boolean;
      hasValidPhone?: boolean;
      hasValidEmail?: boolean;
      page?: number;
      limit?: number;
    },
  ): Promise<{ items: LeadCaptureListItem[]; total: number }> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const filter: Record<string, unknown> = { clientId: clientOid };

    if (opts.status) filter.status = opts.status;
    if (opts.formId) filter.formId = new mongoose.Types.ObjectId(opts.formId);
    if (opts.origin) filter.origin = opts.origin;
    if (opts.groupId && mongoose.Types.ObjectId.isValid(opts.groupId)) {
      filter.contactGroupIds = new mongoose.Types.ObjectId(opts.groupId);
    }
    if (opts.from || opts.to) {
      const createdAt: Record<string, Date> = {};
      if (opts.from) createdAt.$gte = new Date(opts.from);
      if (opts.to) createdAt.$lte = new Date(opts.to);
      filter.createdAt = createdAt;
    }
    if (opts.hasConsent === true) filter.consentAccepted = true;
    if (opts.hasConsent === false) filter.consentAccepted = { $ne: true };
    if (opts.hasValidPhone === true) filter.phone = { $not: /^email:/ };
    if (opts.hasValidEmail === true) filter.email = { $exists: true, $nin: [null, ''] };

    const search = opts.search?.trim();
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: re },
        { phone: re },
        { email: re },
        { message: re },
        { sourceUrl: re },
        { 'metadata.pageTitle': re },
      ];
    }

    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 30));
    const skip = (page - 1) * limit;

    const [captures, total, forms, groups] = await Promise.all([
      LeadCapture.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      LeadCapture.countDocuments(filter),
      LeadForm.find({ clientId: clientOid }).select('_id name').exec(),
      ContactGroup.find({ clientId: clientOid }).select('_id name').exec(),
    ]);

    const formNameById = new Map(forms.map(f => [String(f._id), f.name]));
    const groupNameById = new Map(groups.map(g => [String(g._id), g.name]));

    const items = await Promise.all(
      captures.map(c => this.toListItem(c, formNameById.get(String(c.formId)) ?? '—', groupNameById)),
    );

    const userIds = captures.map(c => (c.assignedUserId ? String(c.assignedUserId) : '')).filter(Boolean);
    const userNames = await this.resolveUserNames(userIds);
    for (let i = 0; i < items.length; i++) {
      const uid = captures[i].assignedUserId ? String(captures[i].assignedUserId) : undefined;
      if (uid && userNames.has(uid)) items[i].assignedUserName = userNames.get(uid);
    }

    return { items, total };
  }

  async getCapture(clientId: string, captureId: string): Promise<LeadCaptureListItem | null> {
    const capture = await LeadCapture.findOne({
      _id: new mongoose.Types.ObjectId(captureId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!capture) return null;

    const [form, groups] = await Promise.all([
      LeadForm.findById(capture.formId).select('name'),
      ContactGroup.find({ clientId: new mongoose.Types.ObjectId(clientId) }).select('_id name'),
    ]);
    const groupNameById = new Map(groups.map(g => [String(g._id), g.name]));
    const item = await this.toListItem(capture, form?.name ?? '—', groupNameById);
    if (capture.assignedUserId) {
      const names = await this.resolveUserNames([String(capture.assignedUserId)]);
      item.assignedUserName = names.get(String(capture.assignedUserId));
    }
    return item;
  }

  async updateCapture(
    clientId: string,
    captureId: string,
    patch: { status?: LeadCaptureStatus; temperature?: LeadTemperature | null; internalNotes?: string },
    userId?: string,
  ): Promise<LeadCaptureListItem | null> {
    const capture = await LeadCapture.findOne({
      _id: new mongoose.Types.ObjectId(captureId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!capture) return null;

    const prevStatus = capture.status;
    if (patch.status && patch.status !== prevStatus) {
      capture.status = patch.status;
      capture.history = appendLeadHistory(
        capture.history,
        'status_changed',
        `${LEAD_CAPTURE_STATUS_LABEL[prevStatus]} → ${LEAD_CAPTURE_STATUS_LABEL[patch.status]}`,
        { userId },
      );
      emitLeadWebhook(clientId, 'status_changed', {
        capture_id: captureId,
        from: prevStatus,
        to: patch.status,
      });
    }
    if (patch.temperature !== undefined) {
      const prevTemp = capture.temperature;
      const nextTemp = patch.temperature ?? undefined;
      if (prevTemp !== nextTemp) {
        capture.temperature = nextTemp;
        const prevLabel = prevTemp ? LEAD_TEMPERATURE_LABEL[prevTemp] : '—';
        const nextLabel = nextTemp ? LEAD_TEMPERATURE_LABEL[nextTemp] : '—';
        capture.history = appendLeadHistory(
          capture.history,
          'temperature_changed',
          `${prevLabel} → ${nextLabel}`,
          { userId },
        );
      }
    }
    if (patch.internalNotes !== undefined) {
      capture.internalNotes = sanitizeLeadText(patch.internalNotes, 4000) || undefined;
      capture.history = appendLeadHistory(capture.history, 'note', 'Observação interna atualizada', { userId });
    }
    await capture.save();

    const form = await LeadForm.findById(capture.formId).select('name');
    const groups = await ContactGroup.find({ clientId: new mongoose.Types.ObjectId(clientId) }).select('_id name');
    const groupNameById = new Map(groups.map(g => [String(g._id), g.name]));
    return this.toListItem(capture, form?.name ?? '—', groupNameById);
  }

  async searchContacts(clientId: string, q: string, limit = 20): Promise<LeadContactSearchItem[]> {
    const term = q.trim();
    if (term.length < 2) return [];

    const { Destination } = await import('@/models/Destination');
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(safe, 'i');
    const digits = term.replace(/\D/g, '');

    const or: Record<string, unknown>[] = [{ name: re }, { email: re }];
    if (digits.length >= 4) {
      or.push({ identifier: { $regex: digits } });
    }

    const rows = await Destination.find({
      clientId: clientOid,
      type: 'contact',
      isActive: true,
      $or: or,
    })
      .select('name identifier email')
      .sort({ name: 1 })
      .limit(Math.min(30, Math.max(1, limit)))
      .lean();

    return rows.map(d => ({
      id: String(d._id),
      name: d.name ?? d.identifier,
      phone: d.identifier,
      email: d.email ?? undefined,
    }));
  }

  async linkCaptureToContact(
    clientId: string,
    captureId: string,
    contactId: string,
    userId?: string,
  ): Promise<LeadCaptureListItem> {
    const capture = await LeadCapture.findOne({
      _id: new mongoose.Types.ObjectId(captureId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!capture) throw new Error('Lead não encontrado');

    const { Destination } = await import('@/models/Destination');
    const existing = await Destination.findOne({
      _id: new mongoose.Types.ObjectId(contactId),
      clientId: new mongoose.Types.ObjectId(clientId),
      type: 'contact',
    });
    if (!existing) throw new Error('Contato não encontrado');

    capture.destinationId = existing._id as mongoose.Types.ObjectId;
    capture.history = appendLeadHistory(
      capture.history,
      'linked_contact',
      `Vinculado ao contato ${existing.name ?? existing.identifier}`,
      { userId },
    );
    await capture.save();

    const form = await LeadForm.findById(capture.formId).select('name');
    const groups = await ContactGroup.find({ clientId: new mongoose.Types.ObjectId(clientId) }).select('_id name');
    const groupNameById = new Map(groups.map(g => [String(g._id), g.name]));
    return this.toListItem(capture, form?.name ?? '—', groupNameById);
  }

  async convertCapture(
    clientId: string,
    captureId: string,
    opts: { contactGroupIds?: string[]; linkExistingId?: string },
    userId?: string,
  ): Promise<LeadCaptureListItem> {
    const capture = await LeadCapture.findOne({
      _id: new mongoose.Types.ObjectId(captureId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!capture) throw new Error('Lead não encontrado');

    const { Destination } = await import('@/models/Destination');
    let destinationId = capture.destinationId;

    if (opts.linkExistingId) {
      const existing = await Destination.findOne({
        _id: new mongoose.Types.ObjectId(opts.linkExistingId),
        clientId: new mongoose.Types.ObjectId(clientId),
      });
      if (!existing) throw new Error('Contato não encontrado');
      destinationId = existing._id as mongoose.Types.ObjectId;
      capture.history = appendLeadHistory(capture.history, 'linked_contact', `Vinculado ao contato ${existing.name ?? existing.identifier}`, { userId });
    } else if (!destinationId) {
      if (capture.phone.startsWith('email:')) {
        throw new Error('Lead sem telefone — vincule manualmente a um contato existente');
      }
      const ensured = await ensureDestinationForWebChatVisitor(clientId, capture.phone, capture.name, {
        email: capture.email,
        notes: capture.internalNotes ?? `Convertido do lead ${captureId}`,
      });
      if (!ensured) throw new Error('Não foi possível criar contato');
      destinationId = new mongoose.Types.ObjectId(ensured);
      capture.history = appendLeadHistory(capture.history, 'converted', 'Contato criado a partir do lead', { userId });
    } else {
      capture.history = appendLeadHistory(capture.history, 'converted', 'Lead convertido em contato existente', { userId });
    }

    capture.destinationId = destinationId;
    capture.status = 'converted';

    if (opts.contactGroupIds?.length) {
      const dest = await Destination.findById(destinationId);
      if (dest) {
        const valid = opts.contactGroupIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        for (const gid of valid) {
          const oid = new mongoose.Types.ObjectId(gid);
          if (!(dest.contactGroupIds ?? []).some(id => id.toString() === gid)) {
            dest.contactGroupIds = [...(dest.contactGroupIds ?? []), oid];
          }
        }
        await dest.save();
        capture.contactGroupIds = [
          ...new Set([...(capture.contactGroupIds ?? []).map(String), ...valid]),
        ].map(id => new mongoose.Types.ObjectId(id));
        capture.history = appendLeadHistory(capture.history, 'added_to_list', 'Adicionado a listas na conversão', { userId });
      }
    }

    await capture.save();

    emitLeadWebhook(clientId, 'converted', {
      capture_id: captureId,
      destination_id: String(destinationId),
    });

    const form = await LeadForm.findById(capture.formId).select('name');
    const groups = await ContactGroup.find({ clientId: new mongoose.Types.ObjectId(clientId) }).select('_id name');
    const groupNameById = new Map(groups.map(g => [String(g._id), g.name]));
    return this.toListItem(capture, form?.name ?? '—', groupNameById);
  }

  async addCaptureToGroups(
    clientId: string,
    captureId: string,
    groupIds: string[],
    userId?: string,
  ): Promise<LeadCaptureListItem | null> {
    const capture = await LeadCapture.findOne({
      _id: new mongoose.Types.ObjectId(captureId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!capture) return null;

    const valid = groupIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    capture.contactGroupIds = [
      ...new Set([...(capture.contactGroupIds ?? []).map(String), ...valid]),
    ].map(id => new mongoose.Types.ObjectId(id));

    if (capture.destinationId) {
      const { Destination } = await import('@/models/Destination');
      const dest = await Destination.findById(capture.destinationId);
      if (dest) {
        for (const gid of valid) {
          const oid = new mongoose.Types.ObjectId(gid);
          if (!(dest.contactGroupIds ?? []).some(id => id.toString() === gid)) {
            dest.contactGroupIds = [...(dest.contactGroupIds ?? []), oid];
          }
        }
        await dest.save();
      }
    }

    capture.history = appendLeadHistory(capture.history, 'added_to_list', 'Adicionado a lista/segmento', { userId });
    await capture.save();

    emitLeadWebhook(clientId, 'added_to_list', { capture_id: captureId, group_ids: valid });

    const form = await LeadForm.findById(capture.formId).select('name');
    const groups = await ContactGroup.find({ clientId: new mongoose.Types.ObjectId(clientId) }).select('_id name');
    const groupNameById = new Map(groups.map(g => [String(g._id), g.name]));
    return this.toListItem(capture, form?.name ?? '—', groupNameById);
  }

  async deleteCapture(clientId: string, captureId: string): Promise<boolean> {
    const result = await LeadCapture.deleteOne({
      _id: new mongoose.Types.ObjectId(captureId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    return result.deletedCount > 0;
  }

  async openInboxForCapture(
    clientId: string,
    userId: string,
    captureId: string,
  ): Promise<{ conversationId: string; created: boolean; assigned: boolean }> {
    const capture = await LeadCapture.findOne({
      _id: new mongoose.Types.ObjectId(captureId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!capture) throw new Error('Lead não encontrado');

    if (capture.inboxConversationId) {
      return {
        conversationId: String(capture.inboxConversationId),
        created: false,
        assigned: true,
      };
    }

    const form = await LeadForm.findById(capture.formId).select('name');
    const formName = form?.name ?? 'Formulário';

    let destinationId = capture.destinationId;
    if (!destinationId) {
      if (capture.phone.startsWith('email:')) {
        throw new Error('Lead sem telefone — converta ou vincule a um contato antes de abrir o Inbox');
      }
      const ensured = await ensureDestinationForWebChatVisitor(
        clientId,
        capture.phone,
        capture.name,
        { email: capture.email, notes: `Lead via ${formName}` },
      );
      if (!ensured) throw new Error('Não foi possível vincular contato ao lead');
      destinationId = new mongoose.Types.ObjectId(ensured);
      capture.destinationId = destinationId;
      await capture.save();
      const { Destination } = await import('@/models/Destination');
      const dest = await Destination.findById(ensured);
      if (dest) {
        await ContactAutoSegmentService.getInstance().tagLeadFromForm(clientId, dest, formName);
      }
    }

    const { InboxService } = await import('@/services/inbox/InboxService');
    const result = await InboxService.getInstance().openConversationFromLead(clientId, userId, {
      destinationId: String(destinationId),
      contactName: capture.name,
      formName,
      message: capture.message,
      email: capture.email,
      sourceUrl: capture.sourceUrl,
    });

    capture.inboxConversationId = new mongoose.Types.ObjectId(result.conversationId);
    if (['new', 'in_review', 'qualified'].includes(capture.status)) {
      capture.status = 'in_progress';
    }
    capture.history = appendLeadHistory(capture.history, 'sent_to_inbox', 'Enviado para atendimento no Inbox', { userId });
    await capture.save();

    emitLeadWebhook(clientId, 'sent_to_inbox', {
      capture_id: captureId,
      conversation_id: result.conversationId,
    });

    return result;
  }

  async listAssignees(clientId: string): Promise<{ userId: string; displayName: string }[]> {
    const { InboxService } = await import('@/services/inbox/InboxService');
    const members = await InboxService.getInstance().listTeamMembersForAssignment(clientId);
    return members
      .filter(m => m.userId && m.linked)
      .map(m => ({ userId: m.userId as string, displayName: m.displayName }));
  }

  private async resolveUserNames(userIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(userIds.filter(id => mongoose.Types.ObjectId.isValid(id)))];
    if (!unique.length) return new Map();
    const { User } = await import('@/models/User');
    const users = await User.find({
      _id: { $in: unique.map(id => new mongoose.Types.ObjectId(id)) },
    })
      .select('displayName email')
      .lean();
    return new Map(
      users.map(u => [
        String(u._id),
        u.displayName?.trim() || u.email?.split('@')[0] || 'Usuário',
      ]),
    );
  }

  private async validateAssigneeId(clientId: string, userId?: string): Promise<void> {
    if (!userId) return;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Responsável padrão inválido');
    }
    const assignees = await this.listAssignees(clientId);
    if (!assignees.some(a => a.userId === userId)) {
      throw new Error('Responsável padrão não é membro ativo da equipe');
    }
  }

  private async resolveDuplicateHints(capture: ILeadCapture): Promise<LeadDuplicateHint[]> {
    if (!capture.duplicateHintIds?.length) {
      const dup = await this.detectDuplicates(
        capture.clientId.toString(),
        capture.phone,
        capture.email,
        String(capture._id),
      );
      return dup.hints;
    }
    const hints: LeadDuplicateHint[] = [];
    for (const key of capture.duplicateHintIds) {
      const [kind, id] = key.split(':');
      if (kind === 'contact') {
        const { Destination } = await import('@/models/Destination');
        const d = await Destination.findById(id).select('name identifier email').lean();
        if (d) hints.push({ kind: 'contact', id, name: d.name, phone: d.identifier, email: d.email });
      } else if (kind === 'lead') {
        const l = await LeadCapture.findById(id).select('name phone email').lean();
        if (l) hints.push({ kind: 'lead', id, name: l.name, phone: l.phone, email: l.email });
      }
    }
    return hints;
  }

  private async toListItem(
    capture: ILeadCapture,
    formName: string,
    groupNameById: Map<string, string>,
  ): Promise<LeadCaptureListItem> {
    const groupIds = (capture.contactGroupIds ?? []).map(String);
    const duplicateHints = await this.resolveDuplicateHints(capture);

    let linkedContactName: string | undefined;
    if (capture.destinationId) {
      const { Destination } = await import('@/models/Destination');
      const dest = await Destination.findById(capture.destinationId).select('name identifier').lean();
      if (dest) linkedContactName = dest.name ?? dest.identifier;
    }

    return {
      id: String(capture._id),
      formId: String(capture.formId),
      formName,
      name: capture.name,
      phone: capture.phone,
      email: capture.email,
      message: capture.message,
      sourceUrl: capture.sourceUrl,
      pageTitle: capture.pageTitle,
      origin: capture.origin ?? 'site',
      status: capture.status,
      temperature: capture.temperature,
      internalNotes: capture.internalNotes,
      metadata: capture.metadata,
      utm: capture.utm,
      consentAccepted: capture.consentAccepted,
      consentAcceptedAt: capture.consentAcceptedAt?.toISOString(),
      destinationId: capture.destinationId ? String(capture.destinationId) : undefined,
      linkedContactName,
      inboxConversationId: capture.inboxConversationId
        ? String(capture.inboxConversationId)
        : undefined,
      contactGroupIds: groupIds.length ? groupIds : undefined,
      contactGroupNames: groupIds.map(id => groupNameById.get(id) ?? id),
      assignedUserId: capture.assignedUserId ? String(capture.assignedUserId) : undefined,
      possibleDuplicate: capture.possibleDuplicate ?? duplicateHints.length > 0,
      duplicateHints: duplicateHints.length ? duplicateHints : undefined,
      history: capture.history,
      createdAt: capture.createdAt.toISOString(),
      updatedAt: capture.updatedAt.toISOString(),
    };
  }

  private toFormListItem(form: ILeadForm, captureCount: number, captureCount7d: number): LeadFormListItem {
    return {
      id: String(form._id),
      name: form.name,
      publicKey: form.publicKey,
      active: form.active,
      allowedDomains: form.allowedDomains ?? [],
      appearance: normalizeAppearance(form.appearance),
      routing: normalizeRouting(form.routing),
      redirectUrl: form.redirectUrl,
      captureCount,
      captureCount7d,
      createdAt: form.createdAt.toISOString(),
      updatedAt: form.updatedAt.toISOString(),
    };
  }
}
