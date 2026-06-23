import mongoose from 'mongoose';
import { LeadForm, ILeadForm } from '@/models/LeadForm';
import { LeadCapture, ILeadCapture } from '@/models/LeadCapture';
import { ContactAutoSegmentService } from '@/services/contacts/ContactAutoSegmentService';
import { ensureDestinationForWebChatVisitor } from '@/services/webchat/webchat-destination-link.util';
import { normalizeContactPhoneE164 } from '@/utils/contact-csv-import';
import { createServiceLogger } from '@/utils/logger';
import type {
  LeadCaptureListItem,
  LeadCaptureStatus,
  LeadFormPublicConfig,
  LeadFormAppearance,
} from '@/types/lead-form';
import { DEFAULT_LEAD_FORM_APPEARANCE } from '@/types/lead-form';
import {
  assertLeadFormOrigin,
  generateLeadFormPublicKey,
  sanitizeLeadText,
} from './lead-form-token.util';

const logger = createServiceLogger('LeadFormService');

export class LeadFormService {
  private static instance: LeadFormService;

  static getInstance(): LeadFormService {
    if (!LeadFormService.instance) {
      LeadFormService.instance = new LeadFormService();
    }
    return LeadFormService.instance;
  }

  async listForms(clientId: string): Promise<ILeadForm[]> {
    return LeadForm.find({ clientId: new mongoose.Types.ObjectId(clientId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async createForm(
    clientId: string,
    body: { name: string; appearance?: Partial<LeadFormAppearance>; allowedDomains?: string[] },
  ): Promise<ILeadForm> {
    const name = sanitizeLeadText(body.name, 120);
    if (!name) throw new Error('Nome do formulário é obrigatório');

    return LeadForm.create({
      clientId: new mongoose.Types.ObjectId(clientId),
      name,
      publicKey: generateLeadFormPublicKey(),
      active: true,
      allowedDomains: (body.allowedDomains ?? []).map(d => d.trim()).filter(Boolean),
      appearance: { ...DEFAULT_LEAD_FORM_APPEARANCE, ...(body.appearance ?? {}) },
    });
  }

  async updateForm(
    clientId: string,
    formId: string,
    patch: Partial<{
      name: string;
      active: boolean;
      allowedDomains: string[];
      appearance: Partial<LeadFormAppearance>;
      redirectUrl: string | null;
    }>,
  ): Promise<ILeadForm | null> {
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
      form.appearance = { ...form.appearance, ...patch.appearance };
    }
    if (patch.redirectUrl !== undefined) {
      form.redirectUrl = patch.redirectUrl?.trim() || undefined;
    }
    await form.save();
    return form;
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
    const a = form.appearance ?? DEFAULT_LEAD_FORM_APPEARANCE;
    return {
      publicKey: form.publicKey,
      title: a.title,
      description: a.description,
      buttonText: a.buttonText,
      successMessage: a.successMessage,
      primaryColor: a.primaryColor,
      askEmail: a.askEmail,
      requireEmail: a.requireEmail,
      askMessage: a.askMessage,
      requireMessage: a.requireMessage,
      redirectUrl: form.redirectUrl,
    };
  }

  assertOrigin(form: ILeadForm, origin?: string | null, referer?: string | null): void {
    assertLeadFormOrigin(form.allowedDomains ?? [], origin, referer);
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
    },
    meta: { origin?: string; referer?: string; ipAddress?: string },
  ): Promise<{ success: true; captureId: string; successMessage: string; redirectUrl?: string }> {
    const form = await this.getActiveFormByPublicKey(publicKey);
    if (!form) throw new Error('Formulário não encontrado ou inativo');

    this.assertOrigin(form, meta.origin, meta.referer);

    const appearance = form.appearance ?? DEFAULT_LEAD_FORM_APPEARANCE;
    const name = sanitizeLeadText(body.name, 120);
    const phoneRaw = sanitizeLeadText(body.phone, 32);
    const email = sanitizeLeadText(body.email, 160).toLowerCase();
    const message = sanitizeLeadText(body.message, 2000);
    const sourceUrl = sanitizeLeadText(body.sourceUrl, 500);
    const pageTitle = sanitizeLeadText(body.pageTitle, 200);

    if (!name) throw new Error('Nome é obrigatório');
    if (!phoneRaw) throw new Error('Telefone/WhatsApp é obrigatório');

    const e164 = normalizeContactPhoneE164(phoneRaw);
    if (!e164) throw new Error('Telefone inválido');

    if (appearance.requireEmail && !email) throw new Error('E-mail é obrigatório');
    if (appearance.requireMessage && !message) throw new Error('Mensagem é obrigatória');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('E-mail inválido');
    }

    const clientId = form.clientId.toString();
    const noteParts = [`Lead via formulário "${form.name}"`];
    if (sourceUrl) noteParts.push(`Origem: ${sourceUrl}`);
    if (message) noteParts.push(`Mensagem: ${message}`);

    const destinationId = await ensureDestinationForWebChatVisitor(clientId, e164, name, {
      email: email || undefined,
      notes: noteParts.join('\n'),
    });

    if (destinationId) {
      const { Destination } = await import('@/models/Destination');
      const dest = await Destination.findById(destinationId);
      if (dest) {
        await ContactAutoSegmentService.getInstance().tagLeadFromForm(
          clientId,
          dest,
          form.name,
        );
      }
    }

    const capture = await LeadCapture.create({
      clientId: form.clientId,
      formId: form._id,
      name,
      phone: e164,
      email: email || undefined,
      message: message || undefined,
      sourceUrl: sourceUrl || undefined,
      pageTitle: pageTitle || undefined,
      status: 'new',
      destinationId,
      ipAddress: meta.ipAddress,
      metadata: pageTitle ? { pageTitle } : undefined,
    });

    logger.info('Lead capturado via formulário público', {
      clientId,
      formId: form._id,
      captureId: capture._id,
    });

    return {
      success: true,
      captureId: String(capture._id),
      successMessage: appearance.successMessage,
      redirectUrl: form.redirectUrl,
    };
  }

  async listCaptures(
    clientId: string,
    opts: {
      status?: LeadCaptureStatus;
      search?: string;
      formId?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ items: LeadCaptureListItem[]; total: number }> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const filter: Record<string, unknown> = { clientId: clientOid };

    if (opts.status) filter.status = opts.status;
    if (opts.formId) filter.formId = new mongoose.Types.ObjectId(opts.formId);

    const search = opts.search?.trim();
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: re }, { phone: re }, { email: re }];
    }

    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 30));
    const skip = (page - 1) * limit;

    const [captures, total, forms] = await Promise.all([
      LeadCapture.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      LeadCapture.countDocuments(filter),
      LeadForm.find({ clientId: clientOid }).select('_id name').exec(),
    ]);

    const formNameById = new Map(forms.map(f => [String(f._id), f.name]));

    return {
      items: captures.map(c => this.toListItem(c, formNameById.get(String(c.formId)) ?? '—')),
      total,
    };
  }

  async getCapture(clientId: string, captureId: string): Promise<LeadCaptureListItem | null> {
    const capture = await LeadCapture.findOne({
      _id: new mongoose.Types.ObjectId(captureId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!capture) return null;

    const form = await LeadForm.findById(capture.formId).select('name');
    return this.toListItem(capture, form?.name ?? '—');
  }

  async updateCapture(
    clientId: string,
    captureId: string,
    patch: { status?: LeadCaptureStatus; internalNotes?: string },
  ): Promise<LeadCaptureListItem | null> {
    const capture = await LeadCapture.findOne({
      _id: new mongoose.Types.ObjectId(captureId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!capture) return null;

    if (patch.status) capture.status = patch.status;
    if (patch.internalNotes !== undefined) {
      capture.internalNotes = sanitizeLeadText(patch.internalNotes, 4000) || undefined;
    }
    await capture.save();

    const form = await LeadForm.findById(capture.formId).select('name');
    return this.toListItem(capture, form?.name ?? '—');
  }

  private toListItem(capture: ILeadCapture, formName: string): LeadCaptureListItem {
    return {
      id: String(capture._id),
      formId: String(capture.formId),
      formName,
      name: capture.name,
      phone: capture.phone,
      email: capture.email,
      message: capture.message,
      sourceUrl: capture.sourceUrl,
      status: capture.status,
      internalNotes: capture.internalNotes,
      destinationId: capture.destinationId ? String(capture.destinationId) : undefined,
      createdAt: capture.createdAt.toISOString(),
      updatedAt: capture.updatedAt.toISOString(),
    };
  }
}
