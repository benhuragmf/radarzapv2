import mongoose from 'mongoose';
import { DEFAULT_INBOX_DEPARTMENTS } from '@/constants/inbox-triage';
import { getBusinessVerticalPreset } from '@/constants/business-vertical-presets';
import { InboxDepartment } from '@/models/InboxDepartment';
import { InboxSettings } from '@/models/InboxSettings';
import { InboxConversation } from '@/models/InboxConversation';
import { Organization } from '@/models/Organization';
import { AiKnowledgeBase } from '@/models/AiKnowledgeBase';
import { AiPrompt } from '@/models/AiPrompt';
import { AiSettings } from '@/models/AiSettings';
import { WebChatWidget } from '@/models/WebChatWidget';
import { WebChatService } from '@/services/webchat/WebChatService';
import { DEFAULT_WEBCHAT_APPEARANCE } from '@/types/webchat';
import { normalizeQuickReplies } from '@/types/inbox-quick-replies';
import { attendanceSettingsPatchFromSelection } from '@/types/attendance-mode';
import { AiSkill } from '@/models/AiSkill';
import { AiMemory } from '@/models/AiMemory';
import { DEFAULT_AI_TRANSFER_RULES, type AiTransferRules } from '@/types/ai-assistant';
import type {
  BusinessVerticalDepartmentPreset,
  BusinessVerticalId,
  BusinessVerticalPreset,
} from '@/types/business-vertical';
import { isBusinessVerticalId, verticalAiRulesText } from '@/types/business-vertical';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('BusinessVerticalSetup');

export interface ApplyBusinessVerticalOptions {
  overwrite?: boolean;
}

export interface ApplyBusinessVerticalResult {
  verticalId: BusinessVerticalId;
  appliedAt: Date;
  sections: {
    departments: 'created' | 'replaced' | 'skipped';
    inboxSettings: 'updated' | 'skipped';
    webChat: 'created' | 'updated' | 'skipped';
    knowledgeBase: 'seeded' | 'skipped';
    quickReplies: 'merged' | 'skipped';
    aiPrompt: 'updated' | 'skipped';
    aiSettings: 'updated' | 'skipped';
    aiSkills: 'seeded' | 'skipped';
    aiMemories: 'seeded' | 'skipped';
  };
}

export class BusinessVerticalSetupService {
  private static instance: BusinessVerticalSetupService;

  static getInstance(): BusinessVerticalSetupService {
    if (!BusinessVerticalSetupService.instance) {
      BusinessVerticalSetupService.instance = new BusinessVerticalSetupService();
    }
    return BusinessVerticalSetupService.instance;
  }

  async getStatus(clientId: string): Promise<{
    businessVertical: BusinessVerticalId | null;
    businessVerticalAppliedAt: string | null;
    needsOnboarding: boolean;
  }> {
    const org = await Organization.findById(clientId).lean();
    if (!org) {
      return { businessVertical: null, businessVerticalAppliedAt: null, needsOnboarding: true };
    }
    const vertical = org.businessVertical ?? null;
    const appliedAt = org.businessVerticalAppliedAt?.toISOString() ?? null;
    return {
      businessVertical: vertical,
      businessVerticalAppliedAt: appliedAt,
      needsOnboarding: !vertical,
    };
  }

  async applyPreset(
    clientId: string,
    verticalId: string,
    options: ApplyBusinessVerticalOptions = {},
  ): Promise<ApplyBusinessVerticalResult> {
    if (!isBusinessVerticalId(verticalId)) {
      throw new Error('Tipo de negócio inválido');
    }

    const preset = getBusinessVerticalPreset(verticalId);
    if (!preset) {
      throw new Error('Preset não encontrado');
    }

    const org = await Organization.findById(clientId);
    if (!org) {
      throw new Error('Empresa não encontrada');
    }

    const overwrite = options.overwrite === true;
    if (org.businessVertical && !overwrite) {
      throw new Error(
        'Esta empresa já possui um tipo de negócio configurado. Use overwrite para substituir.',
      );
    }

    const clientOid = new mongoose.Types.ObjectId(clientId);
    const result: ApplyBusinessVerticalResult = {
      verticalId,
      appliedAt: new Date(),
      sections: {
        departments: 'skipped',
        inboxSettings: 'skipped',
        webChat: 'skipped',
        knowledgeBase: 'skipped',
        quickReplies: 'skipped',
        aiPrompt: 'skipped',
        aiSettings: 'skipped',
        aiSkills: 'skipped',
        aiMemories: 'skipped',
      },
    };

    result.sections.departments = await this.applyDepartments(clientOid, preset.departments, overwrite);
    result.sections.inboxSettings = await this.applyInboxSettings(clientOid, preset.inbox);
    result.sections.webChat = await this.applyWebChat(clientId, preset.webChat);
    result.sections.knowledgeBase = await this.applyKnowledgeBase(clientOid, preset.knowledgeBase, overwrite);
    result.sections.quickReplies = await this.applyQuickReplies(clientOid, preset.quickRepliesExtra);
    result.sections.aiPrompt = await this.applyAiPrompt(clientOid, preset.aiPrompt, overwrite);
    result.sections.aiSettings = await this.applyAiSettings(clientOid, preset, overwrite);
    result.sections.aiSkills = await this.applyAiSkills(clientOid, preset.aiSkills, overwrite);
    result.sections.aiMemories = await this.applyAiMemories(clientOid, preset.aiMemories, overwrite);

    await this.linkWebChatDefaultDepartment(clientOid);

    org.businessVertical = verticalId;
    org.businessVerticalAppliedAt = result.appliedAt;
    await org.save();

    logger.info('Business vertical preset applied', {
      clientId,
      verticalId,
      sections: result.sections,
    });

    return result;
  }

  private async canReplaceDepartments(clientOid: mongoose.Types.ObjectId): Promise<boolean> {
    const [convCount, depts] = await Promise.all([
      InboxConversation.countDocuments({ clientId: clientOid }),
      InboxDepartment.find({ clientId: clientOid, isActive: true }),
    ]);
    if (convCount > 0) return false;
    if (depts.length === 0) return true;
    if (depts.some(d => d.memberUserIds.length > 0)) return false;
    const defaultNames = new Set<string>(DEFAULT_INBOX_DEPARTMENTS.map(d => d.name));
    if (depts.length !== DEFAULT_INBOX_DEPARTMENTS.length) return false;
    return depts.every(d => defaultNames.has(d.name));
  }

  private async applyDepartments(
    clientOid: mongoose.Types.ObjectId,
    departments: BusinessVerticalDepartmentPreset[],
    overwrite: boolean,
  ): Promise<'created' | 'replaced' | 'skipped'> {
    const existing = await InboxDepartment.find({ clientId: clientOid, isActive: true });
    const canReplace = overwrite
      ? (await InboxConversation.countDocuments({ clientId: clientOid })) === 0
      : await this.canReplaceDepartments(clientOid);

    if (!canReplace && existing.length > 0) {
      return 'skipped';
    }

    if (existing.length > 0) {
      await InboxDepartment.deleteMany({ clientId: clientOid });
    }

    await InboxDepartment.insertMany(
      departments.map(d => ({
        clientId: clientOid,
        name: d.name,
        description: d.description,
        menuKey: d.menuKey,
        sortOrder: d.sortOrder,
        isActive: true,
        clientVisible: true,
        internalRank: 0,
        memberUserIds: [],
      })),
    );

    return existing.length > 0 ? 'replaced' : 'created';
  }

  private async applyInboxSettings(
    clientOid: mongoose.Types.ObjectId,
    patch?: NonNullable<ReturnType<typeof getBusinessVerticalPreset>>['inbox'],
  ): Promise<'updated' | 'skipped'> {
    if (!patch || Object.keys(patch).length === 0) return 'skipped';
    const doc = await InboxSettings.getOrCreate(clientOid);
    Object.assign(doc, patch);
    await doc.save();
    return 'updated';
  }

  private async applyWebChat(
    clientId: string,
    patch?: NonNullable<ReturnType<typeof getBusinessVerticalPreset>>['webChat'],
  ): Promise<'created' | 'updated' | 'skipped'> {
    if (!patch) return 'skipped';

    const clientOid = new mongoose.Types.ObjectId(clientId);
    const widgets = await WebChatWidget.find({ clientId: clientOid }).sort({ createdAt: -1 });

    if (widgets.length === 0) {
      try {
        await WebChatService.getInstance().createWidget(clientId, {
          name: 'Chat do site',
          appearance: { ...DEFAULT_WEBCHAT_APPEARANCE, ...patch.appearance },
        });
        const created = await WebChatWidget.findOne({ clientId: clientOid }).sort({ createdAt: -1 });
        if (created) {
          await this.patchWebChatWidget(created, patch);
        }
        return 'created';
      } catch (err) {
        logger.warn('WebChat widget create skipped (plan limit?)', { clientId, err });
        return 'skipped';
      }
    }

    const widget = widgets[0];
    await this.patchWebChatWidget(widget, patch);
    return 'updated';
  }

  private async patchWebChatWidget(
    widget: InstanceType<typeof WebChatWidget>,
    patch: NonNullable<ReturnType<typeof getBusinessVerticalPreset>>['webChat'],
  ): Promise<void> {
    if (patch.appearance) {
      widget.appearance = { ...widget.appearance, ...patch.appearance };
      if (patch.contactReasonOptions) {
        widget.appearance.contactReasonOptions = [...patch.contactReasonOptions];
      }
    } else if (patch.contactReasonOptions) {
      widget.appearance.contactReasonOptions = [...patch.contactReasonOptions];
    }
    if (patch.autoReplyMessage !== undefined) widget.autoReplyMessage = patch.autoReplyMessage;
    if (patch.autoReplySenderName !== undefined) widget.autoReplySenderName = patch.autoReplySenderName;
    if (patch.proactiveGreetingEnabled !== undefined) {
      widget.proactiveGreetingEnabled = patch.proactiveGreetingEnabled;
    }
    if (patch.proactiveGreetingMessage !== undefined) {
      widget.proactiveGreetingMessage = patch.proactiveGreetingMessage;
    }
    if (patch.proactiveGreetingDelaySeconds !== undefined) {
      widget.proactiveGreetingDelaySeconds = patch.proactiveGreetingDelaySeconds;
    }
    if (patch.outsideHoursMessage !== undefined) widget.outsideHoursMessage = patch.outsideHoursMessage;
    await widget.save();
  }

  private async applyKnowledgeBase(
    clientOid: mongoose.Types.ObjectId,
    articles?: BusinessVerticalPreset['knowledgeBase'],
    overwrite = false,
  ): Promise<'seeded' | 'skipped'> {
    if (!articles?.length) return 'skipped';
    const existing = await AiKnowledgeBase.find({ clientId: clientOid }).select('title').lean();
    const existingTitles = new Set(existing.map(a => a.title.toLowerCase()));
    const toInsert = overwrite
      ? articles
      : articles.filter(a => !existingTitles.has(a.title.toLowerCase()));
    if (toInsert.length === 0) return 'skipped';

    await AiKnowledgeBase.insertMany(
      toInsert.map(a => ({
        clientId: clientOid,
        title: a.title,
        content: a.content,
        category: a.category,
        keywords: a.keywords,
        showAsQuickReply: a.showAsQuickReply ?? false,
        quickReplyLabel: a.quickReplyLabel,
        active: true,
        links: [],
      })),
    );
    return 'seeded';
  }

  private async applyQuickReplies(
    clientOid: mongoose.Types.ObjectId,
    extra?: NonNullable<ReturnType<typeof getBusinessVerticalPreset>>['quickRepliesExtra'],
  ): Promise<'merged' | 'skipped'> {
    if (!extra?.length) return 'skipped';
    const doc = await InboxSettings.getOrCreate(clientOid);
    const current = normalizeQuickReplies(doc.quickReplies);
    const codes = new Set(current.map(q => q.code));
    for (const qr of extra) {
      if (!codes.has(qr.code)) {
        current.push({ ...qr });
        codes.add(qr.code);
      }
    }
    doc.quickReplies = current;
    await doc.save();
    return 'merged';
  }

  private async applyAiPrompt(
    clientOid: mongoose.Types.ObjectId,
    patch?: BusinessVerticalPreset['aiPrompt'],
    overwrite = false,
  ): Promise<'updated' | 'skipped'> {
    if (!patch || Object.keys(patch).length === 0) return 'skipped';
    let doc = await AiPrompt.findOne({ clientId: clientOid });
    if (!doc) {
      doc = await AiPrompt.create({ clientId: clientOid });
    } else if (doc.customRules?.trim() && !overwrite) {
      const scalarPatch = { ...patch };
      delete scalarPatch.systemPrompt;
      delete scalarPatch.agentsGuide;
      Object.assign(doc, scalarPatch);
      await doc.save();
      return 'updated';
    }

    const { systemPrompt, agentsGuide, ...scalarFields } = patch;
    Object.assign(doc, scalarFields);
    const rules = verticalAiRulesText({ systemPrompt, agentsGuide });
    if (rules) {
      doc.customRules = rules.slice(0, 6000);
      doc.agentsGuide = agentsGuide?.slice(0, 6000) ?? doc.agentsGuide;
      if (systemPrompt) doc.systemPrompt = systemPrompt.slice(0, 8000);
    }
    await doc.save();
    return 'updated';
  }

  private async applyAiSettings(
    clientOid: mongoose.Types.ObjectId,
    preset: BusinessVerticalPreset,
    overwrite: boolean,
  ): Promise<'updated' | 'skipped'> {
    const cfg = preset.aiSettings;
    const mode = cfg?.suggestedAttendanceMode ?? preset.suggestedAttendanceMode ?? 'disabled';
    if (mode === 'disabled') return 'skipped';

    let doc = await AiSettings.findOne({ clientId: clientOid });
    if (!doc) {
      doc = await AiSettings.create({ clientId: clientOid });
    }

    if (doc.attendanceMode && doc.attendanceMode !== 'disabled' && !overwrite) {
      if (cfg?.transferRules) {
        Object.assign(doc.transferRules ?? {}, cfg.transferRules);
        await doc.save();
      }
      return 'skipped';
    }

    const credentialSource = cfg?.credentialSource ?? 'none';
    const patch = attendanceSettingsPatchFromSelection({ attendanceMode: mode, credentialSource });
    doc.attendanceMode = patch.attendanceMode;
    doc.mode = patch.mode;
    doc.enabled = patch.enabled;

    if (cfg?.transferRules) {
      const current = doc.transferRules as AiTransferRules | undefined;
      doc.transferRules = { ...(current ?? DEFAULT_AI_TRANSFER_RULES), ...cfg.transferRules };
    }

    await doc.save();
    return 'updated';
  }

  private async applyAiSkills(
    clientOid: mongoose.Types.ObjectId,
    skills?: BusinessVerticalPreset['aiSkills'],
    overwrite = false,
  ): Promise<'seeded' | 'skipped'> {
    if (!skills?.length) return 'skipped';
    const existing = await AiSkill.find({ clientId: clientOid }).select('title').lean();
    const titles = new Set(existing.map(s => s.title.toLowerCase()));
    const toInsert = skills.filter(s => overwrite || !titles.has(s.title.toLowerCase()));
    if (toInsert.length === 0) return 'skipped';

    await AiSkill.insertMany(
      toInsert.map(s => ({
        clientId: clientOid,
        title: s.title,
        triggers: s.triggers,
        solution: s.solution,
        status: 'approved' as const,
        source: 'manual' as const,
        approvedAt: new Date(),
        usageCount: 0,
      })),
    );
    return 'seeded';
  }

  /** Semeia memórias aprovadas — independente do plano (runtime bloqueia uso no free). */
  private async applyAiMemories(
    clientOid: mongoose.Types.ObjectId,
    memories?: BusinessVerticalPreset['aiMemories'],
    overwrite = false,
  ): Promise<'seeded' | 'skipped'> {
    if (!memories?.length) return 'skipped';
    const existing = await AiMemory.find({ clientId: clientOid }).select('title').lean();
    const titles = new Set(existing.map(m => m.title.toLowerCase()));
    const toInsert = memories.filter(m => overwrite || !titles.has(m.title.toLowerCase()));
    if (toInsert.length === 0) return 'skipped';

    await AiMemory.insertMany(
      toInsert.map(m => ({
        clientId: clientOid,
        title: m.title,
        content: m.content,
        tags: m.tags,
        status: 'approved' as const,
        source: 'manual' as const,
        approvedAt: new Date(),
        usageCount: 0,
      })),
    );
    return 'seeded';
  }

  private async linkWebChatDefaultDepartment(clientOid: mongoose.Types.ObjectId): Promise<void> {
    const [widget, firstDept] = await Promise.all([
      WebChatWidget.findOne({ clientId: clientOid }).sort({ createdAt: 1 }),
      InboxDepartment.findOne({ clientId: clientOid, isActive: true, clientVisible: { $ne: false } }).sort({
        sortOrder: 1,
        menuKey: 1,
      }),
    ]);
    if (widget && firstDept && !widget.defaultDepartmentId) {
      widget.defaultDepartmentId = firstDept._id as mongoose.Types.ObjectId;
      await widget.save();
    }
  }
}
