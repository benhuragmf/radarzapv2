import mongoose from 'mongoose';
import { MessageQueue, IMessageQueue } from '@/models/MessageQueue';
import { Destination } from '@/models/Destination';
import { Organization } from '@/models/Organization';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';
import { SessionCache } from '@/cache/SessionCache';
import { ConsentService } from '@/services/consent/ConsentService';
import { delay } from '@/services/whatsapp/waSessionEvents';
import { createServiceLogger } from '@/utils/logger';
import { User } from '@/models/User';
import { renderPlatformTemplateForClient } from '@/services/platform/platformTemplateRender';
import {
  buildPlatformWhatsAppVariables,
  type PlatformWaVariableContext,
} from '@/utils/platform-wa-variables';
import {
  getDispatchBatchSize,
  normalizeDelayBetweenMs,
  nextPlanResetDate,
  validateCampaignCreate,
  WHATSAPP_LIMITS,
} from '@/config/limits';

const logger = createServiceLogger('CampaignDispatchService');

/** @deprecated use WHATSAPP_LIMITS.MIN_DELAY_BETWEEN_MS */
export const MIN_CAMPAIGN_DELAY_MS = WHATSAPP_LIMITS.MIN_DELAY_BETWEEN_MS;

const PRIORITY_MAP = { high: 8, medium: 5, low: 2 } as const;

export type CampaignPriority = keyof typeof PRIORITY_MAP;

export type CampaignMessageMode = 'plain' | 'platform_template';

export interface CreateCampaignInput {
  clientId: string;
  title: string;
  message: string;
  image?: string;
  destinations: Array<{ type: 'group' | 'contact'; identifier: string; name: string }>;
  sendAt?: Date;
  priority?: CampaignPriority;
  delayBetweenMs?: number;
  requireConnected?: boolean;
  acceptWhatsAppRisk?: boolean;
  /** pw-* — render por destino no dispatch */
  messageMode?: CampaignMessageMode;
  platformTemplateName?: string;
  templateVariables?: PlatformWaVariableContext;
  perDestinationRender?: boolean;
}

interface CampaignVars {
  title?: string;
  delayBetweenMs?: number;
  requireConnected?: boolean;
  priority?: CampaignPriority;
  acceptWhatsAppRisk?: boolean;
  sentIndex?: number;
  sentCount?: number;
  dispatchErrors?: string[];
  pauseReason?: string;
  messageMode?: CampaignMessageMode;
  platformTemplateName?: string;
  templateVariables?: PlatformWaVariableContext;
  perDestinationRender?: boolean;
}

function readVars(msg: IMessageQueue): CampaignVars {
  return (msg.content.variables ?? {}) as CampaignVars;
}

/**
 * Cria e despacha campanhas de envio manual (painel Enviar agora).
 * Modo protegido: lotes de ~20 msg/min com pausa entre lotes — entrega tudo via fila.
 */
export class CampaignDispatchService {
  private static instance: CampaignDispatchService;
  private sessionCache = SessionCache.getInstance();

  static getInstance(): CampaignDispatchService {
    if (!CampaignDispatchService.instance) {
      CampaignDispatchService.instance = new CampaignDispatchService();
    }
    return CampaignDispatchService.instance;
  }

  priorityValue(p: CampaignPriority = 'medium'): number {
    return PRIORITY_MAP[p] ?? 5;
  }

  private async isWhatsAppBusiness(clientId: string): Promise<boolean> {
    const cached = await this.sessionCache.getWhatsAppSession(clientId);
    if (cached?.waAccountType === 'business') return true;
    if (cached?.deviceInfo?.platform === 'business') return true;
    return false;
  }

  async createCampaign(input: CreateCampaignInput): Promise<IMessageQueue> {
    const user = await User.findById(input.clientId);
    if (!user) throw new Error('Usuário não encontrado');

    const destCount = input.destinations.length;
    const created = validateCampaignCreate(destCount);
    if (created.ok === false) throw new Error(created.error);

    const acceptRisk = input.acceptWhatsAppRisk === true;
    const isBusiness = await this.isWhatsAppBusiness(input.clientId);
    const scheduledFor = input.sendAt && input.sendAt > new Date()
      ? input.sendAt
      : new Date();

    const batchCount = Math.ceil(
      destCount / getDispatchBatchSize(acceptRisk, isBusiness),
    );

    const messageMode: CampaignMessageMode =
      input.messageMode === 'platform_template' && input.platformTemplateName
        ? 'platform_template'
        : 'plain';

    let queueText = input.message.trim();
    if (messageMode === 'platform_template' && input.platformTemplateName) {
      const clientOid = new mongoose.Types.ObjectId(input.clientId);
      const first = input.destinations[0];
      if (first) {
        const destDoc = await Destination.findByIdentifier(first.identifier, clientOid);
        const org = await Organization.findById(input.clientId);
        const user = await User.findById(org?.ownerUserId ?? input.clientId);
        const baseDest = destDoc ?? {
          name: first.name,
          identifier: first.identifier,
          type: first.type,
        };
        const waVars = buildPlatformWhatsAppVariables(
          baseDest as Parameters<typeof buildPlatformWhatsAppVariables>[0],
          org,
          user,
          input.templateVariables,
        );
        const rendered = await renderPlatformTemplateForClient(
          clientOid,
          input.platformTemplateName,
          waVars,
        );
        if (rendered?.trim()) queueText = rendered;
      }
      if (!queueText) {
        throw new Error('Não foi possível renderizar o modelo plataforma');
      }
    }

    const msg = await MessageQueue.createMessage(
      new mongoose.Types.ObjectId(input.clientId),
      {
        text: queueText,
        image: input.image,
        template: messageMode === 'platform_template' ? 'platform-send' : 'manual-send',
        variables: {
          title: input.title,
          delayBetweenMs: normalizeDelayBetweenMs(input.delayBetweenMs, acceptRisk),
          requireConnected: input.requireConnected !== false,
          priority: input.priority ?? 'medium',
          acceptWhatsAppRisk: acceptRisk,
          sentIndex: 0,
          sentCount: 0,
          dispatchErrors: [],
          messageMode,
          platformTemplateName: input.platformTemplateName,
          templateVariables: input.templateVariables,
          perDestinationRender: input.perDestinationRender !== false,
        },
      },
      input.destinations,
      this.priorityValue(input.priority),
      scheduledFor,
    );

    msg.maxAttempts = Math.max(3, batchCount + 5);
    await msg.save();

    if (scheduledFor <= new Date()) {
      await this.dispatchOne(msg);
    }

    return msg;
  }

  async processPending(): Promise<number> {
    const pending = await MessageQueue.findPendingMessages(15);
    const processing = await MessageQueue.find({
      status: 'processing',
      'content.template': { $in: ['manual-send', 'platform-send'] },
      scheduledFor: { $lte: new Date() },
    }).limit(5);

    const toRun = [...pending, ...processing];
    let processed = 0;
    for (const msg of toRun) {
      try {
        await this.dispatchOne(msg);
        processed++;
      } catch (err) {
        logger.error(`Campaign dispatch failed ${msg._id}:`, err);
      }
    }
    return processed;
  }

  private async resolveOutboundText(
    msg: IMessageQueue,
    dest: { type: 'group' | 'contact'; identifier: string; name: string },
    vars: CampaignVars,
  ): Promise<string> {
    if (
      vars.messageMode !== 'platform_template' ||
      !vars.platformTemplateName ||
      vars.perDestinationRender === false
    ) {
      return msg.content.text;
    }

    const destDoc = await Destination.findByIdentifier(dest.identifier, msg.clientId);
    const org = await Organization.findById(msg.clientId);
    const user = await User.findById(org?.ownerUserId ?? msg.clientId);
    const baseDest = destDoc ?? {
      name: dest.name,
      identifier: dest.identifier,
      type: dest.type,
    };
    const waVars = buildPlatformWhatsAppVariables(
      baseDest as Parameters<typeof buildPlatformWhatsAppVariables>[0],
      org,
      user,
      vars.templateVariables,
    );
    const rendered = await renderPlatformTemplateForClient(
      msg.clientId,
      vars.platformTemplateName,
      waVars,
    );
    return rendered?.trim() || msg.content.text;
  }

  async dispatchOne(msg: IMessageQueue): Promise<void> {
    if (msg.status !== 'pending' && msg.status !== 'processing') return;
    if (msg.content.template !== 'manual-send' && msg.content.template !== 'platform-send') {
      return;
    }

    const vars = readVars(msg);
    const clientId = msg.clientId.toString();
    const wa = WhatsAppService.getInstance();
    const acceptRisk = vars.acceptWhatsAppRisk === true;
    const requireConnected = vars.requireConnected !== false;
    const delayBetweenMs = normalizeDelayBetweenMs(vars.delayBetweenMs, acceptRisk);
    const isBusiness = await this.isWhatsAppBusiness(clientId);
    const batchSize = getDispatchBatchSize(acceptRisk, isBusiness);
    let sentIndex = Number(vars.sentIndex) || 0;
    let successCount = Number(vars.sentCount) || 0;
    const errors: string[] = [...(vars.dispatchErrors ?? [])];

    if (requireConnected && !wa.isClientConnected(clientId)) {
      const overdue = msg.scheduledFor.getTime() < Date.now() - 60 * 60 * 1000;
      if (overdue) {
        await msg.markAsFailed('WhatsApp desconectado — reconecte em Conexão WhatsApp');
      }
      return;
    }

    if (sentIndex >= msg.destinations.length) {
      await msg.markAsSent();
      return;
    }

    await msg.markAsProcessing();

    let sentThisBatch = 0;

    for (let i = sentIndex; i < msg.destinations.length; i++) {
      if (sentThisBatch >= batchSize) break;

      const org = await Organization.findById(clientId);
      if (org && !org.canSendMessage()) {
        vars.sentIndex = i;
        vars.sentCount = successCount;
        vars.pauseReason = 'plan_limit';
        vars.dispatchErrors = errors;
        msg.content.variables = vars;
        msg.status = 'pending';
        msg.scheduledFor = nextPlanResetDate(org.usage.lastReset);
        msg.lastError = `Pausado: limite diário do plano (${org.limits.messagesPerDay}/dia). Retoma automaticamente.`;
        await msg.save();
        return;
      }

      const user = await User.findById(clientId);
      if (!org && user && !user.canSendMessage()) {
        vars.sentIndex = i;
        vars.sentCount = successCount;
        vars.pauseReason = 'plan_limit';
        vars.dispatchErrors = errors;
        msg.content.variables = vars;
        msg.status = 'pending';
        msg.scheduledFor = nextPlanResetDate(user.usage.lastReset);
        msg.lastError = `Pausado: limite diário do plano (${user.limits.messagesPerDay}/dia). Retoma automaticamente.`;
        await msg.save();
        return;
      }

      const dest = msg.destinations[i];
      try {
        if (i > sentIndex) await delay(delayBetweenMs);

        if (dest.type === 'contact') {
          const destDoc = await Destination.findByIdentifier(
            dest.identifier,
            msg.clientId,
          );
          if (destDoc) {
            const consentErr = ConsentService.getInstance().assertCanSend(destDoc);
            if (consentErr) throw new Error(consentErr);
          }
        }

        const outboundText = await this.resolveOutboundText(msg, dest, vars);

        await wa.sendManualMessage(
          clientId,
          dest.identifier,
          outboundText,
          msg.content.image,
          { skipRateLimit: acceptRisk, consentOrigin: 'campaign' },
        );
        sentThisBatch++;
        successCount++;
        sentIndex = i + 1;
        vars.sentIndex = sentIndex;
        vars.sentCount = successCount;
        vars.dispatchErrors = errors;
        msg.content.variables = vars;
        await msg.save();
      } catch (e) {
        const errMsg = `${dest.name}: ${(e as Error).message}`;
        errors.push(errMsg);
        vars.dispatchErrors = errors;
        msg.content.variables = vars;
        sentIndex = i + 1;
        vars.sentIndex = sentIndex;
        await msg.save();
      }
    }

    if (sentIndex >= msg.destinations.length) {
      if (successCount === msg.destinations.length) {
        await msg.markAsSent();
      } else if (successCount > 0) {
        await msg.markAsFailed(
          `Enviado para ${successCount}/${msg.destinations.length}. ${errors.slice(-3).join('; ')}`,
        );
      } else {
        await msg.markAsFailed(errors.join('; ') || 'Falha ao enviar para todos os destinos');
      }
      return;
    }

    msg.status = 'pending';
    msg.scheduledFor = new Date(
      Date.now() + (acceptRisk ? delayBetweenMs : WHATSAPP_LIMITS.SAFE_BATCH_COOLDOWN_MS),
    );
    msg.lastError = acceptRisk
      ? undefined
      : `Fila: ${sentIndex}/${msg.destinations.length} enviados — próximo lote em ~1 min`;
    await msg.save();
  }

  async cancelCampaign(id: string, clientId: string): Promise<boolean> {
    const msg = await MessageQueue.findOne({
      _id: id,
      clientId: new mongoose.Types.ObjectId(clientId),
      status: { $in: ['pending', 'processing'] },
    });
    if (!msg) return false;
    await msg.markAsFailed('Cancelado pelo usuário');
    return true;
  }
}
