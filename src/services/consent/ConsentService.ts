import mongoose from 'mongoose';
import { Destination, IDestination } from '@/models/Destination';
import { ConsentHistory } from '@/models/ConsentHistory';
import { ConsentRenewalRequest, IConsentRenewalRequest } from '@/models/ConsentRenewalRequest';
import { User } from '@/models/User';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';
import {
  ConsentStatus,
  CONSENT_ACCEPTED_REPLY,
  CONSENT_OPT_OUT_CANCELLED_REPLY,
  CONSENT_OPT_OUT_CONFIRM_PROMPT,
  CONSENT_OPT_OUT_PENDING_HINT,
  CONSENT_OPT_OUT_REPLY,
  CONSENT_REFUSED_REPLY,
  CONSENT_RESUBSCRIBE_REPLY,
  MAX_PENDING_OUTBOUND,
  canReplyToConsentPrompt,
  canSendPendingAttempt,
  canSendToContact,
  isBlockedStatus,
  nextRefusalStatus,
  ownerCanResetStatus,
  parseConsentReply,
  parseOptOutAbort,
  parseOptOutConfirm,
  parseOptOutRequest,
  parseResubscribeReply,
  type ConsentActionOrigin,
} from '@/types/consent';
import { createServiceLogger } from '@/utils/logger';
import { identifierCandidatesFromJids } from '@/utils/whatsapp-phone';

const logger = createServiceLogger('ConsentService');

const CONSENT_PROMPT_COOLDOWN_MS = 90_000;

export class ConsentService {
  private static instance: ConsentService;

  static getInstance(): ConsentService {
    if (!ConsentService.instance) ConsentService.instance = new ConsentService();
    return ConsentService.instance;
  }

  /** Contatos novos entram PENDING; grupos seguem fluxo anterior */
  initialStatusForType(type: 'contact' | 'group'): ConsentStatus {
    return type === 'contact' ? ConsentStatus.PENDING : ConsentStatus.ACCEPTED;
  }

  async recordHistory(
    dest: IDestination,
    previousStatus: ConsentStatus,
    newStatus: ConsentStatus,
    origin: ConsentActionOrigin,
    extra?: {
      replyText?: string;
      attemptNumber?: number;
      requestedByUserId?: string;
      requestedByUsername?: string;
    },
  ): Promise<void> {
    const user = await User.findById(dest.clientId).lean();
    await ConsentHistory.create({
      clientId: dest.clientId,
      destinationId: dest._id,
      phone: dest.identifier,
      companyName: user?.email ?? user?.discordUserId,
      previousStatus,
      newStatus,
      origin,
      ...extra,
    });
  }

  async applyStatus(
    dest: IDestination,
    newStatus: ConsentStatus,
    origin: ConsentActionOrigin,
    extra?: Parameters<ConsentService['recordHistory']>[4],
  ): Promise<void> {
    const prev = dest.consentStatus;
    dest.consentStatus = newStatus;

    if (newStatus === ConsentStatus.ACCEPTED) {
      dest.consent.granted = true;
      dest.consent.grantedAt = new Date();
      dest.consent.source = origin === 'whatsapp-inbound' ? 'opt-in' : 'manual';
      dest.consent.ipAddress = '0.0.0.0';
      dest.isActive = true;
      dest.pendingOutboundCount = 0;
    } else if (
      newStatus === ConsentStatus.REFUSED_THREE ||
      newStatus === ConsentStatus.MANUALLY_BLOCKED
    ) {
      dest.consent.granted = false;
      dest.isActive = false;
    } else if (newStatus.startsWith('REFUSED')) {
      dest.consent.granted = false;
      dest.isActive = true;
    } else     if (newStatus === ConsentStatus.PENDING) {
      dest.consent.granted = false;
      dest.isActive = true;
      dest.pendingOutboundCount = 0;
    }

    dest.optOutConfirmPendingAt = undefined;

    await dest.save();
    await this.recordHistory(dest, prev, newStatus, origin, extra);
  }

  /** Valida se envio é permitido; retorna mensagem de erro ou null */
  assertCanSend(dest: IDestination): string | null {
    if (dest.type === 'group') return null;

    const st = dest.consentStatus ?? ConsentStatus.PENDING;
    if (st === ConsentStatus.MANUALLY_BLOCKED) {
      return 'Contato bloqueado manualmente pelo RadarZap';
    }
    if (st === ConsentStatus.REFUSED_THREE) {
      return 'Contato recusou 3 vezes — não é possível enviar. Contate o suporte RadarZap.';
    }
    if (st === ConsentStatus.REFUSED_FIRST || st === ConsentStatus.REFUSED_SECOND) {
      return 'Contato recusou receber mensagens. O dono da empresa deve aprovar novo consentimento.';
    }
    if (st === ConsentStatus.ACCEPTED) return null;
    if (canSendPendingAttempt(st, dest.pendingOutboundCount ?? 0)) return null;
    return `Limite de ${MAX_PENDING_OUTBOUND} tentativas sem aceite atingido. Solicite novo consentimento ao dono.`;
  }

  needsConsentPrompt(dest: IDestination): boolean {
    if (dest.type !== 'contact') return false;
    const st = dest.consentStatus ?? ConsentStatus.PENDING;
    return st === ConsentStatus.PENDING;
  }

  /** Após envio bem-sucedido da mensagem do cliente */
  async afterOutboundSend(
    clientId: string,
    dest: IDestination,
    origin: ConsentActionOrigin,
  ): Promise<void> {
    if (dest.type !== 'contact') return;
    const st = dest.consentStatus ?? ConsentStatus.PENDING;

    if (st === ConsentStatus.PENDING) {
      const lastPrompt = dest.lastConsentPromptAt ? new Date(dest.lastConsentPromptAt).getTime() : 0;
      if (lastPrompt && Date.now() - lastPrompt < CONSENT_PROMPT_COOLDOWN_MS) {
        logger.info('Consent prompt skipped (duplicate within cooldown)', {
          clientId,
          phone: dest.identifier,
        });
        return;
      }

      if (!dest.isActive) {
        dest.isActive = true;
      }

      const wa = WhatsAppService.getInstance();
      await wa.sendConsentRequest(clientId, dest.identifier);

      dest.pendingOutboundCount = (dest.pendingOutboundCount ?? 0) + 1;
      dest.lastConsentPromptAt = new Date();
      await dest.save();

      await this.recordHistory(dest, st, st, origin, {
        attemptNumber: dest.pendingOutboundCount,
      });
    }
  }

  private async findContactDestination(
    clientId: string,
    fromJid: string,
    altJid?: string,
  ): Promise<IDestination | null> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    for (const identifier of identifierCandidatesFromJids(fromJid, altJid)) {
      const dest = await Destination.findByIdentifier(identifier, clientOid);
      if (dest) return dest;
    }
    return null;
  }

  /** Opt-out em duas etapas quando o contato já aceitou */
  private async handleAcceptedInbound(
    clientId: string,
    dest: IDestination,
    text: string,
    wa: WhatsAppService,
  ): Promise<void> {
    const pending = !!dest.optOutConfirmPendingAt;

    if (pending) {
      if (parseOptOutAbort(text)) {
        dest.optOutConfirmPendingAt = undefined;
        await dest.save();
        await wa.sendManualMessage(
          clientId,
          dest.identifier,
          CONSENT_OPT_OUT_CANCELLED_REPLY,
          undefined,
          { skipConsentCheck: true, skipRateLimit: true },
        );
        logger.info('Opt-out abortado — usuário manteve inscrição', {
          clientId,
          phone: dest.identifier,
        });
        return;
      }

      if (parseOptOutConfirm(text)) {
        await this.applyStatus(dest, ConsentStatus.REFUSED_FIRST, 'whatsapp-inbound', {
          replyText: text,
        });
        await wa.sendManualMessage(clientId, dest.identifier, CONSENT_OPT_OUT_REPLY, undefined, {
          skipConsentCheck: true,
          skipRateLimit: true,
        });
        logger.info('Opt-out confirmado via WhatsApp', { clientId, phone: dest.identifier });
        return;
      }

      if (parseResubscribeReply(text)) {
        await wa.sendManualMessage(
          clientId,
          dest.identifier,
          CONSENT_OPT_OUT_PENDING_HINT,
          undefined,
          { skipConsentCheck: true, skipRateLimit: true },
        );
      }
      return;
    }

    if (parseOptOutRequest(text)) {
      dest.optOutConfirmPendingAt = new Date();
      await dest.save();
      await wa.sendManualMessage(
        clientId,
        dest.identifier,
        CONSENT_OPT_OUT_CONFIRM_PROMPT,
        undefined,
        { skipConsentCheck: true, skipRateLimit: true },
      );
      logger.info('Opt-out: aguardando confirmação', { clientId, phone: dest.identifier });
    }
  }

  /** Processa mensagem recebida no WhatsApp */
  async handleInboundMessage(
    clientId: string,
    fromJid: string,
    text: string,
    altJid?: string,
  ): Promise<void> {
    const dest = await this.findContactDestination(clientId, fromJid, altJid);
    if (!dest) {
      logger.warn('Inbound consent: contato não encontrado pelo JID', { clientId, fromJid, altJid, text });
      return;
    }

    const prev = dest.consentStatus ?? ConsentStatus.PENDING;
    const wa = WhatsAppService.getInstance();

    if (prev === ConsentStatus.ACCEPTED) {
      await this.handleAcceptedInbound(clientId, dest, text, wa);
      return;
    }

    if (
      prev === ConsentStatus.REFUSED_FIRST ||
      prev === ConsentStatus.REFUSED_SECOND
    ) {
      if (parseResubscribeReply(text)) {
        await this.applyStatus(dest, ConsentStatus.ACCEPTED, 'whatsapp-inbound', {
          replyText: text,
        });
        await wa.sendManualMessage(
          clientId,
          dest.identifier,
          CONSENT_RESUBSCRIBE_REPLY,
          undefined,
          { skipConsentCheck: true, skipRateLimit: true },
        );
        logger.info('Contato voltou a receber (entrar/aceitar)', {
          clientId,
          phone: dest.identifier,
        });
      }
      return;
    }

    if (!canReplyToConsentPrompt(prev)) {
      return;
    }

    const reply = parseConsentReply(text);
    if (!reply) return;

    if (reply === 'accept') {
      await this.applyStatus(dest, ConsentStatus.ACCEPTED, 'whatsapp-inbound', {
        replyText: text,
      });
      await wa.sendManualMessage(clientId, dest.identifier, CONSENT_ACCEPTED_REPLY, undefined, {
        skipConsentCheck: true,
        skipRateLimit: true,
      });
      logger.info('Consent accepted via WhatsApp', { clientId, phone: dest.identifier });
      return;
    }

    const next = nextRefusalStatus(prev);
    await this.applyStatus(dest, next, 'whatsapp-inbound', { replyText: text });
    await wa.sendManualMessage(clientId, dest.identifier, CONSENT_REFUSED_REPLY, undefined, {
      skipConsentCheck: true,
      skipRateLimit: true,
    });
    logger.info('Consent refused via WhatsApp', { clientId, phone: dest.identifier, next });
  }

  async requestRenewal(
    clientId: string,
    destinationId: string,
    requestedBy: { userId: string; username: string },
    reason?: string,
  ): Promise<IConsentRenewalRequest> {
    const dest = await Destination.findOne({
      _id: destinationId,
      clientId: new mongoose.Types.ObjectId(clientId),
      type: 'contact',
    });
    if (!dest) throw new Error('Contato não encontrado');

    const st = dest.consentStatus ?? ConsentStatus.PENDING;
    if (st === ConsentStatus.REFUSED_THREE) {
      throw new Error('Este contato recusou 3 vezes. Nem o dono consegue liberar — contate o suporte RadarZap.');
    }
    if (st === ConsentStatus.MANUALLY_BLOCKED) {
      throw new Error('Contato bloqueado pelo administrador RadarZap.');
    }
    const exhaustedPending =
      st === ConsentStatus.PENDING && (dest.pendingOutboundCount ?? 0) >= MAX_PENDING_OUTBOUND;
    if (!isBlockedStatus(st) && !exhaustedPending) {
      throw new Error('Só é possível solicitar novo aceite após recusa ou esgotamento de tentativas.');
    }

    const pending = await ConsentRenewalRequest.findOne({
      destinationId: dest._id,
      status: 'pending',
    });
    if (pending) throw new Error('Já existe uma solicitação pendente para este contato.');

    const req = await ConsentRenewalRequest.create({
      clientId: dest.clientId,
      destinationId: dest._id,
      phone: dest.identifier,
      contactName: dest.name,
      previousStatus: st,
      requestedByUserId: requestedBy.userId,
      requestedByUsername: requestedBy.username,
      reason,
      status: 'pending',
    });

    await this.recordHistory(dest, st, st, 'admin-request-renewal', {
      requestedByUserId: requestedBy.userId,
      requestedByUsername: requestedBy.username,
    });

    return req;
  }

  async approveRenewal(
    clientId: string,
    requestId: string,
    owner: { userId: string; username: string },
  ): Promise<void> {
    const req = await ConsentRenewalRequest.findOne({
      _id: requestId,
      clientId: new mongoose.Types.ObjectId(clientId),
      status: 'pending',
    });
    if (!req) throw new Error('Solicitação não encontrada');

    const dest = await Destination.findById(req.destinationId);
    if (!dest) throw new Error('Contato não encontrado');

    const prev = dest.consentStatus ?? ConsentStatus.PENDING;
    if (prev === ConsentStatus.REFUSED_THREE) {
      throw new Error('Recusa definitiva (3x) — não pode ser liberada pelo dono.');
    }

    await this.applyStatus(dest, ConsentStatus.PENDING, 'owner-approve-renewal', {
      requestedByUserId: owner.userId,
      requestedByUsername: owner.username,
    });

    req.status = 'approved';
    req.resolvedByUserId = owner.userId;
    req.resolvedAt = new Date();
    await req.save();
  }

  async clearRefusal(
    clientId: string,
    destinationId: string,
    owner: { userId: string; username: string },
  ): Promise<void> {
    const dest = await Destination.findOne({
      _id: destinationId,
      clientId: new mongoose.Types.ObjectId(clientId),
      type: 'contact',
    });
    if (!dest) throw new Error('Contato não encontrado');

    const st = dest.consentStatus ?? ConsentStatus.PENDING;
    if (!ownerCanResetStatus(st)) {
      if (st === ConsentStatus.REFUSED_THREE) {
        throw new Error('Recusa definitiva (3x) — nem o dono consegue apagar. Contate o suporte RadarZap.');
      }
      throw new Error('Este contato não está em status de recusa liberável.');
    }

    await this.applyStatus(dest, ConsentStatus.PENDING, 'owner-reset', {
      requestedByUserId: owner.userId,
      requestedByUsername: owner.username,
    });
  }

  async manualBlock(
    destinationId: string,
    adminUserId: string,
  ): Promise<void> {
    const dest = await Destination.findById(destinationId);
    if (!dest) throw new Error('Contato não encontrado');
    const prev = dest.consentStatus ?? ConsentStatus.PENDING;
    await this.applyStatus(dest, ConsentStatus.MANUALLY_BLOCKED, 'system-block', {
      requestedByUserId: adminUserId,
    });
    logger.warn('Contact manually blocked', { destinationId, prev, adminUserId });
  }

  async getHistory(clientId: string, destinationId: string) {
    return ConsentHistory.find({
      clientId: new mongoose.Types.ObjectId(clientId),
      destinationId: new mongoose.Types.ObjectId(destinationId),
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
  }

  async listPendingRenewals(clientId: string) {
    return ConsentRenewalRequest.find({
      clientId: new mongoose.Types.ObjectId(clientId),
      status: 'pending',
    })
      .sort({ createdAt: -1 })
      .lean();
  }
}

export { canSendToContact, ConsentStatus, MAX_PENDING_OUTBOUND };