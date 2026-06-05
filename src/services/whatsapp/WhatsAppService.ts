/*
 * RadarZap / RadarGamer
 * Copyright (c) 2026 Benhur Augusto Gomes Monteiro Faria
 * Todos os direitos reservados.
 * Uso, cópia, distribuição ou modificação sem autorização é proibido.
 */

import makeWASocket, {
  ConnectionState,
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  MessageUpsertType,
  WAMessage,
  WAMessageKey,
  BaileysEventMap,
  jidNormalizedUser,
  getKeyAuthor,
  decryptPollVote,
  sha256,
  normalizeMessageContent,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import { config } from '@/config/environment';
import { logger, createServiceLogger } from '@/utils/logger';
import { SessionCache } from '@/cache/SessionCache';
import { QueueManager } from '@/cache/QueueManager';
import { RateLimiter } from '@/cache/RateLimiter';
import { WhatsAppSession, User, Destination, Organization } from '@/models';
import { ConsentPoll } from '@/models/ConsentPoll';
import { CircuitBreaker } from '../common/CircuitBreaker';
import { RedisManager } from '@/cache/RedisManager';
import { validateMessageText } from '@/config/limits';
import {
  buildFinalWhatsAppBody,
  splitImageCaption,
} from '@/utils/discord-wa-format';
import { logPipeline } from '@/utils/pipeline-log';
import { buildPipelineTrackingMeta } from '@/utils/pipeline-tracking';
import {
  previewOutbound,
  resolveOutboundTemplate,
  shouldUseLiveTemplate,
  streamLinkFromExtracted,
} from '@/utils/stream-template';
import { ConsentService } from '@/services/consent/ConsentService';
import { ConsentStatus } from '@/types/consent';
import { isPhoneInParticipants } from '@/utils/group-membership';
import { downloadProfilePictureFromUrl } from '@/utils/profile-picture-download';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import {
  WaConnectionState,
  WaInstanceState,
  WaQrCodePayload,
  WaSessionEvent,
  cacheStatusToState,
  delay,
  liveStateToStatus,
  wuidToPhone,
} from './waSessionEvents';

/** Redis cache TTL for live WA state (QR, connected) — 7 days */
const WA_CACHE_TTL_SEC = 7 * 24 * 60 * 60;
/** MongoDB backup expiry — 30 days, renewed on activity */
const WA_DB_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
const WA_SESSION_CHANNEL = 'radarzap:wa-session';

/**
 * WhatsApp Service with autonomous session management
 */
export class WhatsAppService {
  private static instance: WhatsAppService;
  private sessions: Map<string, WASocket> = new Map();
  private sessionStates: Map<string, any> = new Map();
  private sessionIntervals: Map<string, NodeJS.Timeout> = new Map();
  private pendingConnections: Map<string, { discordUserId: string; channelId: string; qrMessageId?: string }> = new Map();
  private qrCounts: Map<string, number> = new Map();
  private connectingClients: Set<string> = new Set();
  private serviceLogger = createServiceLogger('WhatsAppService');
  private sessionCache: SessionCache;
  private queueManager: QueueManager;
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  private isInitialized = false;
  private sessionCleanupInterval: NodeJS.Timeout | null = null;
  private destinationCleanupInterval: NodeJS.Timeout | null = null;
  private profilePictureSyncInterval: NodeJS.Timeout | null = null;
  private profilePictureSyncRunning = false;
  private profilePictureSyncClientCursor = 0;
  private autoReconnectInterval: NodeJS.Timeout | null = null;
  /** Evita múltiplos createWhatsAppSession simultâneos (causa erro 440) */
  private reconnectingClients = new Set<string>();
  /** Desconexão manual (Discord/painel) — não auto-reconectar */
  private manuallyDisconnectedClients = new Set<string>();
  /** Mensagens enviadas (necessário para decifrar votos em enquetes de consentimento) */
  private outboundMessages = new Map<string, WAMessage>();
  private lastWaConnectionLogKey = new Map<string, string>();
  private lastSessionSaveLogAt = new Map<string, number>();
  /** JIDs de contatos 1:1 sincronizados pela sessão WA (para status/stories) */
  private waStatusContactJids = new Map<string, Set<string>>();

  /** Read all Baileys auth files from the session directory */
  private readSessionDirectory(sessionDir: string): Record<string, string> {
    const files: Record<string, string> = {};
    if (!fs.existsSync(sessionDir)) return files;
    for (const name of fs.readdirSync(sessionDir)) {
      const filePath = path.join(sessionDir, name);
      if (fs.statSync(filePath).isFile()) {
        files[name] = fs.readFileSync(filePath, 'utf8');
      }
    }
    return files;
  }

  private messageKeyString(key: WAMessageKey): string {
    return `${key.remoteJid ?? ''}:${key.id ?? ''}`;
  }

  private storeOutboundMessage(msg: WAMessage | undefined): void {
    if (!msg?.key?.id || !msg.key.remoteJid) return;
    this.outboundMessages.set(this.messageKeyString(msg.key), msg);
    // Índice secundário por msg id — remoteJid muda entre envio e voto (BR 9º dígito, @lid)
    this.outboundMessages.set(`id:${msg.key.id}`, msg);
    if (this.outboundMessages.size > 1000) {
      const first = this.outboundMessages.keys().next().value;
      if (first) this.outboundMessages.delete(first);
    }
  }

  private findOutboundByMsgId(msgId: string | undefined | null): WAMessage | undefined {
    if (!msgId) return undefined;
    return this.outboundMessages.get(`id:${msgId}`);
  }

  private pollProtoFromPersisted(poll: {
    messageSecretB64: string;
    optionNames: string[];
  }): proto.IMessage {
    return {
      messageContextInfo: {
        messageSecret: Buffer.from(poll.messageSecretB64, 'base64'),
      },
      pollCreationMessageV3: {
        name: 'Consentimento',
        selectableOptionsCount: 1,
        options: poll.optionNames.map(optionName => ({ optionName })),
      },
    };
  }

  /** Recupera enquete para decifrar voto (Baileys 7 exige getMessage / messageSecret) */
  private async resolveConsentPollForVote(
    clientId: string,
    creationKey: WAMessageKey,
  ): Promise<{ pollEncKey: Uint8Array; optionNames: string[]; creatorJid?: string } | null> {
    if (!creationKey.id) return null;

    const stored = this.findOutboundByMsgId(creationKey.id);
    if (stored?.message) {
      const pollEncKey = stored.message.messageContextInfo?.messageSecret;
      const pollContent =
        stored.message.pollCreationMessageV3 ??
        stored.message.pollCreationMessageV2 ??
        stored.message.pollCreationMessage;
      const optionNames = pollContent?.options?.map(o => o.optionName || '').filter(Boolean) ?? [];
      if (pollEncKey && optionNames.length) {
        return { pollEncKey, optionNames, creatorJid: undefined };
      }
    }

    const persisted = await ConsentPoll.findByPollId(clientId, creationKey.id);
    if (persisted) {
      return {
        pollEncKey: Buffer.from(persisted.messageSecretB64, 'base64'),
        optionNames: persisted.optionNames,
        creatorJid: persisted.creatorJid,
      };
    }

    return null;
  }

  /** Implementação de getMessage exigida pelo Baileys (retries + enquetes) */
  private async getStoredMessageContent(
    clientId: string,
    key: WAMessageKey,
  ): Promise<proto.IMessage | undefined> {
    const cached = this.findOutboundByMsgId(key.id);
    if (cached?.message) return cached.message;

    if (key.id) {
      const persisted = await ConsentPoll.findByPollId(clientId, key.id);
      if (persisted) return this.pollProtoFromPersisted(persisted);
    }

    return undefined;
  }

  /** Pastas em sessions/ com creds.json (reconexão sem depender só do MongoDB) */
  private discoverLocalSessionClientIds(): string[] {
    const sessionsDir = path.join(process.cwd(), 'sessions');
    if (!fs.existsSync(sessionsDir)) return [];
    return fs.readdirSync(sessionsDir).filter(name => {
      const creds = path.join(sessionsDir, name, 'creds.json');
      return fs.statSync(path.join(sessionsDir, name)).isDirectory() && fs.existsSync(creds);
    });
  }

  private extractInboundText(msg: WAMessage): string {
    const m = normalizeMessageContent(msg.message);
    if (!m) return '';
    return (
      m.conversation ??
      m.extendedTextMessage?.text ??
      m.buttonsResponseMessage?.selectedDisplayText ??
      m.buttonsResponseMessage?.selectedButtonId ??
      m.templateButtonReplyMessage?.selectedDisplayText ??
      m.templateButtonReplyMessage?.selectedId ??
      m.listResponseMessage?.singleSelectReply?.selectedRowId ??
      m.listResponseMessage?.title ??
      ''
    ).trim();
  }

  private toPollEncKey(secret: Uint8Array | Buffer): Uint8Array {
    return secret instanceof Uint8Array ? secret : new Uint8Array(secret);
  }

  /**
   * Decifra voto de enquete (Baileys 7 não faz isso automaticamente).
   * Após normaliseKey o creationKey vem com fromMe:false — forçamos fromMe:true pois nós enviamos a enquete.
   */
  private decryptConsentPollVote(
    vote: proto.Message.IPollEncValue,
    pollEncKey: Uint8Array | Buffer,
    pollMsgId: string,
    meId: string,
    creationKey: WAMessageKey,
    msgKey: WAMessageKey,
    storedCreatorJid?: string,
  ): proto.Message.IPollVoteMessage | null {
    const encKey = this.toPollEncKey(pollEncKey);
    const meNorm = jidNormalizedUser(meId);
    const creationAsOurs: WAMessageKey = { ...creationKey, fromMe: true };
    const voterJidPrimary = jidNormalizedUser(getKeyAuthor(msgKey, meNorm));

    const creatorCandidates = [
      storedCreatorJid ? jidNormalizedUser(storedCreatorJid) : undefined,
      storedCreatorJid,
      jidNormalizedUser(getKeyAuthor(creationAsOurs, meNorm)),
      meNorm,
      meId,
    ].filter((j): j is string => !!j)
      .filter((j, i, a) => a.indexOf(j) === i);

    const voterCandidates = [
      voterJidPrimary,
      msgKey.remoteJidAlt ? jidNormalizedUser(msgKey.remoteJidAlt) : undefined,
      msgKey.remoteJid ? jidNormalizedUser(msgKey.remoteJid) : undefined,
      msgKey.participant ? jidNormalizedUser(msgKey.participant) : undefined,
    ].filter((j): j is string => !!j)
      .filter((j, i, a) => a.indexOf(j) === i);

    for (const pollCreatorJid of creatorCandidates) {
      for (const voterJid of voterCandidates) {
        try {
          return decryptPollVote(vote, { pollEncKey: encKey, pollCreatorJid, pollMsgId, voterJid });
        } catch {
          /* próxima combinação */
        }
      }
    }
    return null;
  }

  private async applyConsentFromPollChoice(
    clientId: string,
    socket: WASocket,
    voteMsg: proto.Message.IPollVoteMessage,
    optionNames: string[],
    voterMsgKey: WAMessageKey,
    creationKey: WAMessageKey,
  ): Promise<boolean> {
    const selectedHashes = new Set(
      (voteMsg.selectedOptions ?? []).map(o => Buffer.from(o as Uint8Array).toString()),
    );
    let chosenName = '';
    for (const name of optionNames) {
      const hash = sha256(Buffer.from(name)).toString();
      if (selectedHashes.has(hash)) {
        chosenName = name;
        break;
      }
    }
    if (!chosenName) {
      this.serviceLogger.warn('Poll vote: opção não reconhecida após decifra', {
        pollId: creationKey.id,
        optionNames,
      });
      return false;
    }

    const meId = jidNormalizedUser(socket.user?.id);
    const voterJid = jidNormalizedUser(getKeyAuthor(voterMsgKey, meId));
    this.serviceLogger.info('Poll vote received', { clientId, voterJid, chosenName });

    const replyText = chosenName.toLowerCase().includes('aceito') ? 'aceito' : 'recusar';
    await ConsentService.getInstance().handleInboundMessage(
      clientId,
      voterJid,
      replyText,
      voterMsgKey.remoteJidAlt ?? creationKey.remoteJid ?? undefined,
    );
    return true;
  }

  private async sendConsentPollFallback(socket: WASocket, chatJid: string): Promise<void> {
    try {
      await socket.sendMessage(chatJid, {
        text: '⚠️ Não registramos o toque na enquete. Responda *1* (aceito) ou *2* (recuso) para confirmar.',
      });
    } catch (err) {
      this.serviceLogger.warn('Falha ao enviar dica de consentimento (fallback enquete)', err);
    }
  }

  /** Processa voto em enquete de consentimento (Baileys 7 não decifra automaticamente) */
  private async handlePollVoteMessage(
    clientId: string,
    socket: WASocket,
    msg: WAMessage,
  ): Promise<void> {
    const pollUpdate = msg.message?.pollUpdateMessage;
    if (!pollUpdate?.pollCreationMessageKey || !pollUpdate.vote) return;

    const creationKey = pollUpdate.pollCreationMessageKey;
    const resolved = await this.resolveConsentPollForVote(clientId, creationKey);

    if (!resolved) {
      this.serviceLogger.warn('Poll vote: enquete não encontrada (cache/db)', {
        pollId: creationKey.id,
        creationRemoteJid: creationKey.remoteJid,
        voterRemoteJid: msg.key.remoteJid,
      });
      return;
    }

    const { pollEncKey, optionNames, creatorJid } = resolved;

    const meId = jidNormalizedUser(socket.user?.id ?? '');
    const voteMsg = this.decryptConsentPollVote(
      pollUpdate.vote,
      pollEncKey,
      creationKey.id!,
      meId,
      creationKey,
      msg.key,
      creatorJid,
    );

    const chatJid = msg.key.remoteJid ?? msg.key.remoteJidAlt;
    if (!voteMsg) {
      this.serviceLogger.warn('Poll vote decrypt failed', {
        pollId: creationKey.id,
        meId,
        creatorJid,
        creationRemoteJid: creationKey.remoteJid,
        voterRemoteJid: msg.key.remoteJid,
      });
      if (chatJid) await this.sendConsentPollFallback(socket, chatJid);
      return;
    }

    const ok = await this.applyConsentFromPollChoice(
      clientId,
      socket,
      voteMsg,
      optionNames,
      msg.key,
      creationKey,
    );
    if (!ok && chatJid) await this.sendConsentPollFallback(socket, chatJid);
  }

  /** Write Baileys auth files back to disk (restore after restart) */
  private writeSessionDirectory(sessionDir: string, files: Record<string, string>): void {
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(sessionDir, name), content, 'utf8');
    }
  }

  /** Push session state to Redis cache + dashboard via pub/sub (Evolution-style events) */
  private logConnectionUpdate(
    clientId: string,
    connection: ConnectionState['connection'],
    hasQr: boolean,
    errorCode?: number,
  ): void {
    if (!connection && !hasQr && errorCode === undefined) return;

    const key = `${connection ?? 'none'}:qr=${hasQr}:err=${errorCode ?? ''}`;
    if (this.lastWaConnectionLogKey.get(clientId) === key) return;
    this.lastWaConnectionLogKey.set(clientId, key);

    const msg = `WA ${clientId}: ${connection ?? 'sync'}${hasQr ? ', QR' : ''}${
      errorCode != null ? `, code=${errorCode}` : ''
    }`;

    if (connection === 'open' || connection === 'close' || hasQr || errorCode != null) {
      this.serviceLogger.info(msg);
    } else {
      this.serviceLogger.debug(msg);
    }
  }

  private async notifySessionUpdate(
    clientId: string,
    data: {
      status: 'connecting' | 'connected' | 'disconnected' | 'qr-required';
      qrCode?: string;
      qrCodeRaw?: string;
      qrCount?: number;
      statusReason?: number;
      wuid?: string;
      profileName?: string;
      profilePictureUrl?: string;
      waAccountType?: 'web' | 'business';
      deviceInfo?: { platform: string; browser: string; version: string };
      lastActivity?: Date;
      manualDisconnect?: boolean;
    },
  ): Promise<void> {
    if (data.status === 'connected') {
      this.manuallyDisconnectedClients.delete(clientId);
    }

    await this.sessionCache.setWhatsAppSession(clientId, {
      ...data,
      manualDisconnect:
        data.manualDisconnect === true ||
        (data.status === 'disconnected' && this.manuallyDisconnectedClients.has(clientId)),
      lastActivity: data.lastActivity ?? new Date(),
    }, WA_CACHE_TTL_SEC);

    const state = cacheStatusToState(data.status, this.isLiveSession(clientId));
    const now = (data.lastActivity ?? new Date()).toISOString();

    const events: WaSessionEvent[] = [];
    if (data.qrCode) {
      events.push({
        event: 'QRCODE_UPDATED',
        clientId,
        data: {
          qrcode: {
            base64: data.qrCode,
            code: data.qrCodeRaw ?? '',
            count: data.qrCount ?? 1,
          },
        },
        date_time: now,
      });
    }
    events.push({
      event: 'CONNECTION_UPDATE',
      clientId,
      data: {
        state,
        statusReason: data.statusReason,
        wuid: data.wuid,
        profileName: data.profileName,
      },
      date_time: now,
    });

    try {
      const redis = RedisManager.getInstance();
      for (const ev of events) {
        await redis.publish(WA_SESSION_CHANNEL, JSON.stringify(ev));
      }
      // Compat legado para o dashboard
      await redis.publish(
        WA_SESSION_CHANNEL,
        JSON.stringify({
          clientId,
          status: data.status,
          qrCode: data.qrCode,
          qrCount: data.qrCount,
          statusReason: data.statusReason,
          lastActivity: now,
        }),
      );
    } catch {
      // pub/sub optional — dashboard still polls /sessions
    }
  }

  constructor() {
    this.sessionCache = SessionCache.getInstance();
    this.queueManager = QueueManager.getInstance();
    this.rateLimiter = RateLimiter.getInstance();
    this.circuitBreaker = new CircuitBreaker('whatsapp-service', {
      failureThreshold: 3,
      recoveryTimeout: 60000,
      monitorTimeout: 30000
    });
  }

  static getInstance(): WhatsAppService {
    if (!WhatsAppService.instance) {
      WhatsAppService.instance = new WhatsAppService();
    }
    return WhatsAppService.instance;
  }

  /** Busca foto de perfil WA via Baileys (alta resolução, depois preview). */
  private async fetchProfilePicture(socket: WASocket, jid?: string | null): Promise<string | undefined> {
    if (!jid) return undefined;
    for (const picType of ['image', 'preview'] as const) {
      try {
        const url = await socket.profilePictureUrl(jid, picType);
        if (url) return url;
      } catch {
        /* tenta próximo tipo */
      }
    }
    return undefined;
  }

  /** Resolve JID real no WhatsApp (número BR, LID, etc.). */
  private async resolveDestinationJid(
    socket: WASocket,
    identifier: string,
    type: 'contact' | 'group',
  ): Promise<string> {
    const jid = this.formatJid(identifier, type);
    if (type !== 'contact') return jid;
    try {
      const plainNumber = this.plainWhatsAppId(jid);
      const [result] = await socket.onWhatsApp(plainNumber);
      if (result?.exists && result.jid) return result.jid;
    } catch {
      /* usa jid formatado */
    }
    return jid;
  }

  /** Foto de perfil de um contato ou grupo WhatsApp */
  async getDestinationProfilePicture(
    clientId: string,
    identifier: string,
    type: 'contact' | 'group' = 'contact',
  ): Promise<string | undefined> {
    const id = String(clientId);
    if (!this.isClientConnected(id)) {
      try {
        await this.ensureClientReady(id, 10_000);
      } catch {
        return undefined;
      }
    }
    const socket = this.sessions.get(id);
    if (!socket?.user) return undefined;
    const jid = await this.resolveDestinationJid(socket, identifier, type);
    return this.fetchProfilePicture(socket, jid);
  }

  /**
   * Atualiza fotos de perfil em cache nos destinos (rate-limit entre chamadas).
   */
  async syncDestinationProfilePictures(
    clientId: string,
    options: { limit?: number; destinationIds?: string[]; maxAgeDays?: number } = {},
  ): Promise<{ updated: number; skipped: number; failed: number }> {
    const limit = Math.min(Math.max(options.limit ?? 30, 1), 80);
    const maxAgeMs = (options.maxAgeDays ?? 7) * 86_400_000;
    const cutoff = new Date(Date.now() - maxAgeMs);
    const clientOid = new mongoose.Types.ObjectId(clientId);

    const query: Record<string, unknown> = {
      clientId: clientOid,
      isActive: true,
    };

    if (options.destinationIds?.length) {
      query._id = {
        $in: options.destinationIds.map(id => new mongoose.Types.ObjectId(id)),
      };
    } else {
      query.$or = [
        { profilePictureMime: { $exists: false } },
        { profilePictureMime: null },
        { profilePictureMime: '' },
        { profilePictureUpdatedAt: { $lt: cutoff } },
        { profilePictureUpdatedAt: { $exists: false } },
      ];
    }

    const dests = await Destination.find(query).sort({ updatedAt: -1 }).limit(limit).lean();
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    this.serviceLogger.info(
      `Sincronizando fotos de perfil: client=${clientId} destinos=${dests.length}`,
    );

    for (const d of dests) {
      try {
        const url = await this.getDestinationProfilePicture(
          clientId,
          d.identifier,
          d.type as 'contact' | 'group',
        );
        if (!url) {
          await Destination.updateOne(
            { _id: d._id },
            {
              $unset: { profilePictureData: '' },
              profilePictureMime: 'none',
              profilePictureUpdatedAt: new Date(),
            },
          );
          skipped++;
          await this.sleep(280);
          continue;
        }

        const img = await downloadProfilePictureFromUrl(url);
        if (img) {
          await Destination.updateOne(
            { _id: d._id },
            {
              profilePictureData: img.data,
              profilePictureMime: img.mime,
              profilePictureUpdatedAt: new Date(),
            },
          );
          updated++;
        } else {
          this.serviceLogger.warn(
            `Falha ao baixar foto de ${d.identifier} (${d.name}) — URL obtida, download falhou`,
          );
          skipped++;
        }
      } catch (err) {
        failed++;
        this.serviceLogger.warn(
          `Erro ao sincronizar foto de ${d.identifier}: ${(err as Error).message}`,
        );
      }
      await this.sleep(280);
    }

    this.serviceLogger.info(
      `Fotos de perfil: atualizadas=${updated} ignoradas=${skipped} falhas=${failed}`,
    );

    return { updated, skipped, failed };
  }

  /** Sessão ativa no processo (socket, QR ou tentativa de conexão) */
  private isLiveSession(clientId: string): boolean {
    return (
      this.sessions.has(clientId) ||
      this.connectingClients.has(clientId) ||
      this.pendingConnections.has(clientId)
    );
  }

  /** Socket Baileys autenticado e pronto para enviar */
  isClientConnected(clientId: string): boolean {
    const socket = this.sessions.get(String(clientId));
    return Boolean(socket?.user);
  }

  /**
   * Aguarda socket ativo (ou tenta restaurar credenciais salvas).
   */
  async ensureClientReady(clientId: string, timeoutMs = 45_000): Promise<void> {
    const id = String(clientId);
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const socket = this.sessions.get(id);
      if (socket?.user) return;

      if (
        !this.connectingClients.has(id) &&
        !this.reconnectingClients.has(id) &&
        !this.sessions.has(id) &&
        !this.manuallyDisconnectedClients.has(id)
      ) {
        const cached = await this.sessionCache.getWhatsAppSession(id);
        if (cached?.manualDisconnect) {
          this.manuallyDisconnectedClients.add(id);
        } else {
          try {
            await this.restoreSession(id);
          } catch (err) {
            this.serviceLogger.debug('ensureClientReady restore tentativa', {
              clientId: id,
              error: (err as Error).message,
            });
          }
        }
      }

      await new Promise(r => setTimeout(r, 800));
    }

    throw new Error('WhatsApp session not found or not connected');
  }

  /** Envio de teste síncrono (painel web — sem fila) */
  async sendTestMessageFromDashboard(
    clientId: string,
    destination: string,
    message: string,
  ): Promise<{ success: boolean; results: unknown[] }> {
    return this.handleSendTestMessage({
      clientId,
      destination,
      message,
      discordUserId: null,
      channelId: null,
    });
  }

  /** Envia solicitação de consentimento (somente texto — resposta 1 ou 2) */
  async sendConsentRequest(clientId: string, destination: string): Promise<void> {
    const socket = this.sessions.get(clientId);
    if (!socket) {
      throw new Error('WhatsApp session not found or not connected');
    }

    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const destinationDoc = await Destination.findByIdentifier(destination, clientObjectId);
    if (!destinationDoc) {
      throw new Error('Destination not found or not configured');
    }

    const jid = this.formatJid(destination, 'contact');
    let resolvedJid = jid;
    try {
      const plainNumber = this.plainWhatsAppId(jid);
      const [result] = await socket.onWhatsApp(plainNumber);
      if (result?.exists && result.jid) resolvedJid = result.jid;
    } catch {
      /* usa jid formatado */
    }

    const text = await ConsentService.getInstance().getRequestMessage(clientId);

    const intro = await socket.sendMessage(resolvedJid, { text });
    this.storeOutboundMessage(intro ?? undefined);
  }

  private static readonly STATUS_JID_MAX = 500;
  private static readonly STATUS_DEFAULT_BG = '#FFFCF5';
  /** Evolution envia status em lotes de 10 com o mesmo messageId */
  private static readonly STATUS_SEND_BATCH = 10;
  /** Pré-carga device-list na conexão — não resolver centenas de números a cada post */
  private static readonly STATUS_DEVICE_PRELOAD = 80;

  /** Baileys ignora font 0 (falsy). Evolution/WhatsApp exigem 1–5 para status texto. */
  private normalizeStatusFont(font: number | undefined): number {
    const ui = Math.max(0, Math.min(3, font ?? 0));
    return ui + 1;
  }

  private dedupeStatusJids(jids: Iterable<string>): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of jids) {
      if (!raw || !this.isPersonalWaJid(raw)) continue;
      const normalized = jidNormalizedUser(raw);
      const userPart = normalized.split('@')[0] ?? normalized;
      if (seen.has(userPart)) continue;
      seen.add(userPart);
      out.push(normalized);
    }
    return out;
  }

  private orderStatusJidsSelfFirst(list: string[], socket: WASocket): string[] {
    const selfUsers = new Set<string>();
    if (socket.user?.id) {
      selfUsers.add(jidNormalizedUser(socket.user.id).split('@')[0] ?? '');
    }
    const userLid = (socket.user as { lid?: string } | undefined)?.lid;
    if (userLid) {
      const lid = userLid.includes('@') ? userLid : `${userLid}@lid`;
      selfUsers.add(jidNormalizedUser(lid).split('@')[0] ?? '');
    }
    selfUsers.delete('');

    const selfFirst: string[] = [];
    const rest: string[] = [];
    for (const jid of list) {
      const userPart = jidNormalizedUser(jid).split('@')[0] ?? jid;
      if (selfUsers.has(userPart)) selfFirst.push(jid);
      else rest.push(jid);
    }
    return [...selfFirst, ...rest];
  }

  private validateTextStatusPayload(result: WAMessage): void {
    const ext = result.message?.extendedTextMessage;
    if (!ext?.backgroundArgb) {
      this.serviceLogger.error('Status texto sem backgroundArgb — não aparece no app', {
        messageId: result.key?.id,
      });
      throw new Error(
        'WhatsApp não montou o status corretamente. Reconecte em Sessões e tente de novo.',
      );
    }
  }

  private async sendStatusInBatches(
    socket: WASocket,
    content: Record<string, unknown>,
    opts: {
      broadcast: true;
      statusJidList: string[];
      backgroundColor?: string;
      font?: number;
    },
  ): Promise<WAMessage> {
    const fullList = opts.statusJidList;
    if (fullList.length === 0) {
      throw new Error('Lista de audiência vazia para status');
    }

    const batches: string[][] = [];
    for (let i = 0; i < fullList.length; i += WhatsAppService.STATUS_SEND_BATCH) {
      batches.push(fullList.slice(i, i + WhatsAppService.STATUS_SEND_BATCH));
    }

    const { statusJidList: _list, ...baseOpts } = opts;

    const first = await socket.sendMessage('status@broadcast', content as never, {
      ...baseOpts,
      statusJidList: batches[0],
    });

    const msgId = first?.key?.id;
    if (!msgId) {
      throw new Error('WhatsApp não confirmou a publicação do status.');
    }

    for (let b = 1; b < batches.length; b++) {
      try {
        await socket.sendMessage('status@broadcast', content as never, {
          ...baseOpts,
          statusJidList: batches[b],
          messageId: msgId,
        });
      } catch (err) {
        this.serviceLogger.warn(`Status lote ${b + 1}/${batches.length} falhou`, err);
      }
    }

    return first;
  }

  /** Prévia de audiência (painel wa-stories) — leve, sem resync completo. */
  async previewStatusAudience(
    clientId: string,
    audience: 'whatsapp' | 'all_contacts' | 'consented',
  ): Promise<{ count: number; waCache: number; deviceListPhones: number; radarzapContacts: number }> {
    await this.ensureClientReady(clientId, 10_000);
    const socket = this.sessions.get(String(clientId));
    if (!socket?.user) {
      throw new Error('WhatsApp não conectado');
    }
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const radarzapContacts = await Destination.countDocuments({
      clientId: clientOid,
      type: 'contact',
      isActive: true,
      ...(audience === 'consented' ? { consentStatus: ConsentStatus.ACCEPTED } : {}),
    });
    const list = await this.buildStatusJidList(clientId, socket, audience, { sync: false });
    return {
      count: list.length,
      waCache: this.waStatusContactJids.get(clientId)?.size ?? 0,
      deviceListPhones: this.loadDeviceListPhonesFromSession(clientId).length,
      radarzapContacts,
    };
  }

  /** Publica status (stories) no WhatsApp — texto ou imagem */
  async sendStatusUpdate(
    clientId: string,
    input: {
      type: 'text' | 'image';
      text?: string;
      image?: string;
      caption?: string;
      backgroundColor?: string;
      font?: number;
      audience: 'whatsapp' | 'all_contacts' | 'consented';
    },
  ): Promise<{ messageId?: string; statusJidCount: number }> {
    await this.ensureClientReady(clientId, 20_000);
    const socket = this.sessions.get(String(clientId));
    if (!socket?.user) {
      throw new Error('WhatsApp não conectado');
    }

    const statusJidList = this.orderStatusJidsSelfFirst(
      await this.buildStatusJidList(clientId, socket, input.audience),
      socket,
    );
    if (statusJidList.length === 0) {
      throw new Error('Sessão WhatsApp sem identidade — reconecte em Sessões');
    }

    const relayOpts = {
      broadcast: true as const,
      statusJidList,
      ...(input.type === 'text'
        ? {
            backgroundColor: input.backgroundColor || WhatsAppService.STATUS_DEFAULT_BG,
            font: this.normalizeStatusFont(input.font),
          }
        : {}),
    };

    try {
      await socket.sendPresenceUpdate('available');
    } catch {
      /* não bloqueia publicação */
    }

    let result: WAMessage;

    if (input.type === 'image' && input.image) {
      const imagePayload = input.image.startsWith('data:')
        ? Buffer.from(input.image.replace(/^data:image\/[^;]+;base64,/, ''), 'base64')
        : { url: input.image };
      const caption = (input.caption || input.text || '').trim();
      result = await this.sendStatusInBatches(
        socket,
        {
          image: imagePayload,
          ...(caption ? { caption } : {}),
          ...(Buffer.isBuffer(imagePayload) ? { mimetype: 'image/jpeg' } : {}),
        },
        relayOpts,
      );
    } else {
      const text = (input.text ?? '').trim();
      if (!text) throw new Error('Texto do status é obrigatório');
      const msgCheck = validateMessageText(text);
      if (msgCheck.ok === false) throw new Error(msgCheck.error);
      result = await this.sendStatusInBatches(socket, { text }, relayOpts);
      this.validateTextStatusPayload(result);
    }

    this.serviceLogger.info('Status WhatsApp publicado', {
      clientId,
      type: input.type,
      statusJidCount: statusJidList.length,
      messageId: result.key?.id,
      batches: Math.ceil(statusJidList.length / WhatsAppService.STATUS_SEND_BATCH),
      hasBackground: !!result.message?.extendedTextMessage?.backgroundArgb,
    });

    if (!result?.key?.id) {
      throw new Error(
        'WhatsApp não confirmou a publicação do status. Reconecte em Sessões e tente novamente.',
      );
    }

    return {
      messageId: result.key.id,
      statusJidCount: statusJidList.length,
    };
  }

  private isPersonalWaJid(jid: string | undefined | null): boolean {
    if (!jid || jid === 'status@broadcast') return false;
    return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid');
  }

  private cacheWaStatusContactJid(clientId: string, jid: string | undefined | null): void {
    if (!this.isPersonalWaJid(jid)) return;
    let set = this.waStatusContactJids.get(clientId);
    if (!set) {
      set = new Set();
      this.waStatusContactJids.set(clientId, set);
    }
    set.add(jid!);
    if (set.size > WhatsAppService.STATUS_JID_MAX * 2) {
      const trimmed = [...set].slice(-WhatsAppService.STATUS_JID_MAX);
      this.waStatusContactJids.set(clientId, new Set(trimmed));
    }
  }

  private addSelfToStatusJidList(jids: Set<string>, socket: WASocket): void {
    if (socket.user?.id) {
      jids.add(socket.user.id);
      jids.add(jidNormalizedUser(socket.user.id));
    }
    const userLid = (socket.user as { lid?: string } | undefined)?.lid;
    if (userLid) {
      jids.add(userLid.includes('@') ? userLid : `${userLid}@lid`);
    }
  }

  private loadDeviceListPhonesFromSession(clientId: string): string[] {
    const sessionDir = path.join(process.cwd(), 'sessions', clientId);
    if (!fs.existsSync(sessionDir)) return [];
    const phones: string[] = [];
    for (const name of fs.readdirSync(sessionDir)) {
      const match = /^device-list-(\d+)\.json$/i.exec(name);
      if (match?.[1]) phones.push(match[1]);
    }
    return phones;
  }

  private async resolvePhonesToStatusJids(socket: WASocket, phones: string[]): Promise<string[]> {
    const jids: string[] = [];
    const BATCH = 40;
    for (let i = 0; i < phones.length; i += BATCH) {
      const batch = phones.slice(i, i + BATCH);
      try {
        const results = await socket.onWhatsApp(...batch);
        for (const r of results ?? []) {
          if (r?.exists && r.jid) jids.push(r.jid);
        }
      } catch (err) {
        this.serviceLogger.warn('onWhatsApp falhou ao resolver telefones para status', err);
        for (const p of batch) {
          jids.push(this.formatJid(p, 'contact'));
        }
      }
    }
    return jids;
  }

  private async syncWaStatusContactsBeforePublish(_clientId: string, socket: WASocket): Promise<void> {
    if (typeof socket.resyncAppState !== 'function') return;
    try {
      await Promise.race([
        socket.resyncAppState(['regular', 'regular_high'], false),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('resyncAppState timeout')), 8_000),
        ),
      ]);
    } catch (err) {
      this.serviceLogger.debug('resyncAppState antes do status', err);
    }
  }

  private async preloadDeviceListContacts(clientId: string, socket: WASocket): Promise<void> {
    const phones = this.loadDeviceListPhonesFromSession(clientId).slice(
      0,
      WhatsAppService.STATUS_DEVICE_PRELOAD,
    );
    if (phones.length === 0) return;
    const resolved = await this.resolvePhonesToStatusJids(socket, phones);
    for (const jid of resolved) this.cacheWaStatusContactJid(clientId, jid);
    this.serviceLogger.debug('Device-list pré-carregado para status', {
      clientId,
      phones: phones.length,
      resolved: resolved.length,
    });
  }

  private async appendDestinationContactJids(
    clientId: string,
    socket: WASocket,
    jids: Set<string>,
    consentedOnly: boolean,
  ): Promise<void> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const query: Record<string, unknown> = {
      clientId: clientOid,
      type: 'contact',
      isActive: true,
    };
    if (consentedOnly) {
      query.consentStatus = ConsentStatus.ACCEPTED;
    }

    const contacts = await Destination.find(query)
      .select('identifier')
      .limit(WhatsAppService.STATUS_JID_MAX)
      .lean();

    const phones: string[] = [];
    for (const c of contacts) {
      const plain = this.plainWhatsAppId(c.identifier);
      if (plain.length >= 8) phones.push(plain);
    }

    const resolved = await this.resolvePhonesToStatusJids(socket, phones);
    for (const jid of resolved) {
      if (jids.size >= WhatsAppService.STATUS_JID_MAX) break;
      jids.add(jid);
    }
  }

  private async buildStatusJidList(
    clientId: string,
    socket: WASocket,
    audience: 'whatsapp' | 'all_contacts' | 'consented',
    options: { sync?: boolean } = {},
  ): Promise<string[]> {
    if (options.sync !== false) {
      await this.syncWaStatusContactsBeforePublish(clientId, socket);
    }

    const jids = new Set<string>();
    this.addSelfToStatusJidList(jids, socket);

    const cached = this.waStatusContactJids.get(clientId);
    if (cached) {
      for (const jid of cached) {
        if (jids.size >= WhatsAppService.STATUS_JID_MAX) break;
        jids.add(jid);
      }
    }

    const phones = this.loadDeviceListPhonesFromSession(clientId);

    if (audience !== 'whatsapp') {
      await this.appendDestinationContactJids(
        clientId,
        socket,
        jids,
        audience === 'consented',
      );
    }

    const list = this.dedupeStatusJids(jids).slice(0, WhatsAppService.STATUS_JID_MAX);
    this.serviceLogger.info(`statusJidList: ${list.length} destinatário(s)`, {
      clientId,
      audience,
      waCached: cached?.size ?? 0,
      deviceListPhones: phones.length,
      sample: list.slice(0, 4),
    });
    return list;
  }

  /** Envio manual / campanha (sem prefixo de teste) */
  async sendManualMessage(
    clientId: string,
    destination: string,
    text: string,
    image?: string,
    options?: { skipRateLimit?: boolean; skipConsentCheck?: boolean; consentOrigin?: string },
  ): Promise<{ success: boolean; messageId?: string }> {
    return this.handleSendMessage({
      clientId,
      destination,
      content: { text, ...(image ? { image } : {}) },
      messageId: `manual-${Date.now()}`,
      skipRateLimit: options?.skipRateLimit === true,
      skipConsentCheck: options?.skipConsentCheck === true,
      consentOrigin: options?.consentOrigin ?? 'dashboard-send',
    });
  }

  /** Detecta WhatsApp Business pela sessão Baileys */
  detectAccountType(user: { verifiedName?: string | null; lid?: string | null; id?: string } | undefined): 'web' | 'business' {
    if (!user) return 'web';
    if (user.verifiedName) return 'business';
    if (user.lid) return 'business';
    return 'web';
  }

  /** Evolution API: GET /instance/connectionState/:instanceName */
  async getConnectionState(clientId: string): Promise<{ instance: WaInstanceState }> {
    const socket = this.sessions.get(clientId);
    if (socket?.user) {
      const wuid = socket.user.id;
      return {
        instance: {
          clientId,
          state: 'open',
          statusReason: 200,
          wuid,
          profileName: socket.user.name ?? undefined,
        },
      };
    }

    const cached = await this.sessionCache.getWhatsAppSession(clientId);
    if (!this.isLiveSession(clientId) && (cached?.status === 'connecting' || cached?.status === 'qr-required')) {
      return {
        instance: { clientId, state: 'close', statusReason: cached?.statusReason },
      };
    }

    const state = cacheStatusToState(cached?.status, false);
    return {
      instance: {
        clientId,
        state,
        statusReason: cached?.statusReason,
        wuid: cached?.wuid,
        profileName: cached?.profileName,
      },
    };
  }

  /** Evolution API: QR getter */
  async getInstanceQrCode(clientId: string): Promise<{ qrcode?: WaQrCodePayload }> {
    const cached = await this.sessionCache.getWhatsAppSession(clientId);
    if (!cached?.qrCode) return {};
    return {
      qrcode: {
        base64: cached.qrCode,
        code: cached.qrCodeRaw ?? '',
        count: cached.qrCount ?? this.qrCounts.get(clientId) ?? 1,
      },
    };
  }

  /** Evolution API: connect idempotente — retorna estado + QR sem bloquear até open */
  async connectInstance(
    clientId: string,
    options?: { discordUserId?: string; channelId?: string; forceQr?: boolean },
  ): Promise<{ instance: WaInstanceState; qrcode?: WaQrCodePayload }> {
    this.manuallyDisconnectedClients.delete(clientId);

    const current = await this.getConnectionState(clientId);
    if (current.instance.state === 'open') {
      return { instance: current.instance };
    }

    await this.abortClientConnection(clientId);

    if (options?.forceQr) {
      await this.clearCredentials(clientId);
    }

    let result = await this.startConnectAndWaitForQr(clientId, options);

    const credsPath = path.join(process.cwd(), 'sessions', clientId, 'creds.json');
    const hasCreds = fs.existsSync(credsPath);
    if (!result.qrcode && result.instance.state !== 'open' && hasCreds && !options?.forceQr) {
      this.serviceLogger.info(`No QR with existing creds for ${clientId} — clearing for fresh scan`);
      await this.clearCredentials(clientId);
      await this.abortClientConnection(clientId);
      result = await this.startConnectAndWaitForQr(clientId, options);
    }

    return result;
  }

  private async startConnectAndWaitForQr(
    clientId: string,
    options?: { discordUserId?: string; channelId?: string },
  ): Promise<{ instance: WaInstanceState; qrcode?: WaQrCodePayload }> {
    const cachedQr = await this.getInstanceQrCode(clientId);
    const current = await this.getConnectionState(clientId);
    if (cachedQr.qrcode && current.instance.state === 'connecting') {
      return { instance: current.instance, qrcode: cachedQr.qrcode };
    }

    if (!this.sessions.has(clientId) && !this.connectingClients.has(clientId) && !this.reconnectingClients.has(clientId)) {
      this.pendingConnections.set(clientId, {
        discordUserId: options?.discordUserId ?? '',
        channelId: options?.channelId ?? '',
      });
      this.connectingClients.add(clientId);
      await this.notifySessionUpdate(clientId, { status: 'connecting', statusReason: 200 });
      this.createWhatsAppSession(clientId)
        .then(() => {
          this.connectingClients.delete(clientId);
        })
        .catch((err) => {
          this.connectingClients.delete(clientId);
          this.pendingConnections.delete(clientId);
          this.serviceLogger.error(`Background connect failed for ${clientId}: ${err.message}`);
        });
    }

    const waitMs = Math.max(config.WHATSAPP.CONNECT_QR_WAIT_MS, 20_000);
    const steps = Math.ceil(waitMs / 500);
    for (let i = 0; i < steps; i++) {
      await delay(500);
      const state = await this.getConnectionState(clientId);
      if (state.instance.state === 'open') {
        return { instance: state.instance };
      }
      const qr = await this.getInstanceQrCode(clientId);
      if (qr.qrcode) {
        return { instance: state.instance, qrcode: qr.qrcode };
      }
    }

    const finalState = await this.getConnectionState(clientId);
    const finalQr = await this.getInstanceQrCode(clientId);
    return {
      instance: finalState.instance,
      qrcode: finalQr.qrcode,
    };
  }

  /** Encerra sockets/tentativas em andamento sem apagar credenciais */
  private async abortClientConnection(clientId: string): Promise<void> {
    const socket = this.sessions.get(clientId);
    if (socket) {
      try {
        socket.end(undefined);
      } catch {
        /* ignore */
      }
    }
    this.sessions.delete(clientId);
    this.sessionStates.delete(clientId);
    this.connectingClients.delete(clientId);
    this.reconnectingClients.delete(clientId);
    this.pendingConnections.delete(clientId);

    const interval = this.sessionIntervals.get(clientId);
    if (interval) {
      clearInterval(interval);
      this.sessionIntervals.delete(clientId);
    }
  }

  /** Remove credenciais locais para forçar novo QR */
  private async clearCredentials(clientId: string): Promise<void> {
    const sessionDir = path.join(process.cwd(), 'sessions', clientId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    this.qrCounts.delete(clientId);
    await this.sessionCache.deleteSession(`whatsapp:${clientId}`).catch(() => {});
  }

  /** Desconecta sem invalidar credenciais no disco */
  private async softDisconnect(clientId: string, statusReason = 503): Promise<void> {
    await this.abortClientConnection(clientId);
    await this.notifySessionUpdate(clientId, {
      status: 'disconnected',
      statusReason,
      lastActivity: new Date(),
    });
  }

  /** Evolution API: DELETE /instance/logout — limpa credenciais WhatsApp */
  async logoutInstance(clientId: string): Promise<{ success: boolean; message: string }> {
    await this.disconnectSession(clientId);
    return { success: true, message: 'Logged out successfully' };
  }

  /** Evolution API: disconnect temporário — fecha socket, mantém credenciais */
  async temporaryDisconnect(clientId: string): Promise<{ success: boolean; message: string }> {
    this.manuallyDisconnectedClients.add(clientId);

    const socket = this.sessions.get(clientId);
    if (socket) {
      socket.end(undefined);
      this.sessions.delete(clientId);
      this.sessionStates.delete(clientId);
    }

    const interval = this.sessionIntervals.get(clientId);
    if (interval) {
      clearInterval(interval);
      this.sessionIntervals.delete(clientId);
    }

    this.connectingClients.delete(clientId);
    this.pendingConnections.delete(clientId);

    await this.notifySessionUpdate(clientId, {
      status: 'disconnected',
      statusReason: 200,
      lastActivity: new Date(),
      manualDisconnect: true,
    });

    return { success: true, message: 'Disconnected temporarily' };
  }

  /** Evolution API: POST /instance/restart */
  async restartInstance(clientId: string): Promise<{ success: boolean; message: string }> {
    await this.temporaryDisconnect(clientId);
    await this.connectInstance(clientId);
    return { success: true, message: 'Restart initiated' };
  }

  /** Lê perfil WA dos creds locais (quando socket não está ativo) */
  private readProfileFromCreds(clientId: string): { wuid?: string; profileName?: string } {
    const credsPath = path.join(process.cwd(), 'sessions', clientId, 'creds.json');
    if (!fs.existsSync(credsPath)) return {};
    try {
      const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8')) as {
        me?: { id?: string; lid?: string; name?: string };
      };
      const wuid = creds.me?.id ?? creds.me?.lid;
      const profileName = creds.me?.name;
      return { wuid, profileName };
    } catch {
      return {};
    }
  }

  /** Dados completos da instância para o dashboard (live + cache + Mongo) */
  async getSessionDetails(clientId: string): Promise<{
    clientId: string;
    state: WaConnectionState;
    status: 'connected' | 'disconnected' | 'connecting' | 'qr-required';
    statusReason?: number;
    wuid?: string;
    profileName?: string;
    phoneNumber?: string;
    profilePictureUrl?: string;
    qrCode?: string;
    qrCount?: number;
    lastActivity?: Date;
    hasPersistedSession: boolean;
    waAccountType?: 'web' | 'business';
  }> {
    const { instance } = await this.getConnectionState(clientId);
    const cached = await this.sessionCache.getWhatsAppSession(clientId);
    const doc = await WhatsAppSession.findOne({ clientId }).lean();

    const socket = this.sessions.get(clientId);
    const credsProfile = this.readProfileFromCreds(clientId);
    let wuid =
      socket?.user?.id ??
      instance.wuid ??
      cached?.wuid ??
      doc?.whatsappProfile?.wuid ??
      credsProfile.wuid;
    let profileName =
      socket?.user?.name ??
      instance.profileName ??
      cached?.profileName ??
      doc?.whatsappProfile?.profileName ??
      credsProfile.profileName;

    const phoneNumber =
      wuidToPhone(wuid) ??
      doc?.whatsappProfile?.phoneNumber;

    let profilePictureUrl =
      cached?.profilePictureUrl ??
      doc?.whatsappProfile?.profilePictureUrl;

    if (socket?.user?.id && !profilePictureUrl) {
      profilePictureUrl = await this.fetchProfilePicture(socket, socket.user.id);
    }

    let status = liveStateToStatus(instance.state, cached?.status);

    // Cache antigo sem socket ativo → tratar como desconectado
    if (
      (status === 'connected' || status === 'connecting' || status === 'qr-required') &&
      !this.isLiveSession(clientId)
    ) {
      status = 'disconnected';
      await this.sessionCache.deleteSession(`whatsapp:${clientId}`).catch(() => {});
    }

    const lastActivity = cached?.lastActivity
      ? new Date(cached.lastActivity)
      : doc?.lastActivity
        ? new Date(doc.lastActivity)
        : status === 'connected'
          ? new Date()
          : undefined;

    const waAccountType: 'web' | 'business' =
      cached?.waAccountType ??
      (doc?.type === 'business' ? 'business' : socket?.user ? this.detectAccountType(socket.user) : 'web');

    if ((wuid || profileName || profilePictureUrl) && !doc?.whatsappProfile?.wuid) {
      this.saveSessionToDatabase(clientId, { wuid, profileName, profilePictureUrl }, waAccountType).catch(err => {
        this.serviceLogger.warn(`Failed to persist session profile for ${clientId}`, err);
      });
    }

    return {
      clientId,
      state: instance.state,
      status,
      statusReason: instance.statusReason ?? cached?.statusReason,
      wuid,
      profileName,
      phoneNumber,
      profilePictureUrl,
      qrCode: cached?.qrCode,
      qrCount: cached?.qrCount,
      lastActivity,
      hasPersistedSession: doc?.status === 'active' || doc?.status === 'inactive',
      waAccountType,
    };
  }

  /**
   * Start WhatsApp service
   */
  async start(): Promise<void> {
    try {
      this.serviceLogger.info('🚀 Starting WhatsApp Service...');

      // Ensure sessions directory exists
      await this.ensureSessionsDirectory();

      // Setup session cleanup
      this.setupSessionCleanup();

      // Setup destination cleanup
      this.setupDestinationCleanup();

      // Fotos de perfil em background (lotes pequenos, não bloqueia envios)
      this.setupProfilePictureBackgroundSync();

      // Sessão WA antes dos workers — evita jobs falhando sem socket no Map
      await this.restoreExistingSessions();

      // Reconecta sessões salvas em disco se caírem (ex.: após restart do dev server)
      this.setupAutoReconnect();

      // Workers só depois do restore (fila whatsapp-sending)
      await this.registerQueueProcessors();

      this.isInitialized = true;
      this.serviceLogger.info('✅ WhatsApp Service started successfully');

    } catch (error) {
      this.serviceLogger.error('❌ Failed to start WhatsApp Service:', error);
      throw error;
    }
  }

  /**
   * Stop WhatsApp service
   */
  async stop(): Promise<void> {
    try {
      this.serviceLogger.info('🛑 Stopping WhatsApp Service...');

      // Clear cleanup intervals
      if (this.sessionCleanupInterval) {
        clearInterval(this.sessionCleanupInterval);
        this.sessionCleanupInterval = null;
      }

      if (this.destinationCleanupInterval) {
        clearInterval(this.destinationCleanupInterval);
        this.destinationCleanupInterval = null;
      }

      if (this.profilePictureSyncInterval) {
        clearInterval(this.profilePictureSyncInterval);
        this.profilePictureSyncInterval = null;
      }

      if (this.autoReconnectInterval) {
        clearInterval(this.autoReconnectInterval);
        this.autoReconnectInterval = null;
      }

      // Clear all session intervals
      for (const [clientId, interval] of this.sessionIntervals) {
        clearInterval(interval);
      }
      this.sessionIntervals.clear();

      // Persist session files before closing sockets
      for (const clientId of this.sessions.keys()) {
        await this.saveSessionToDatabase(clientId);
      }

      // Close all sessions
      await this.closeAllSessions();

      this.isInitialized = false;
      this.serviceLogger.info('✅ WhatsApp Service stopped');

    } catch (error) {
      this.serviceLogger.error('Error stopping WhatsApp Service:', error);
    }
  }

  /**
   * Ensure sessions directory exists
   */
  private async ensureSessionsDirectory(): Promise<void> {
    const sessionsDir = path.join(process.cwd(), 'sessions');

    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
      this.serviceLogger.info('Created sessions directory');
    }
  }

  /**
   * Register queue processors for WhatsApp operations
   */
  private async registerQueueProcessors(): Promise<void> {
    // WhatsApp connection processor — handles connect, disconnect, and list-groups
    await this.queueManager.registerProcessor(
      'whatsapp-connection',
      async (job: any) => {
        const name = job?.name ?? job?.data?.jobName;
        const data = job?.data ?? job;

        switch (name) {
          case 'connect-whatsapp':
            return await this.handleConnectWhatsApp(data);
          case 'disconnect-whatsapp':
            return await this.handleTemporaryDisconnect(data);
          case 'logout-whatsapp':
            return await this.handleLogoutWhatsApp(data);
          case 'restart-whatsapp':
            return await this.handleRestartWhatsApp(data);
          case 'list-groups': {
            const { clientId, resultKey } = data;
            const groups = await this.listGroups(clientId);
            // Store result directly in Redis (bypass SessionCache wrapper)
            const redisManager = (this.sessionCache as any).redisManager;
            await redisManager.setWithTTL(resultKey, JSON.stringify(groups), 30);
            return { ok: true, count: groups.length };
          }
          default:
            throw new Error(`Unknown WhatsApp connection job: ${name}`);
        }
      },
      2 // Concurrency of 2 for connection operations
    );

    // WhatsApp sending processor
    await this.queueManager.registerProcessor(
      'whatsapp-sending',
      async (job: any) => {
        const name = job?.name ?? job?.data?.jobName;
        const data = job?.data ?? job;

        switch (name) {
          case 'send-message':
            return await this.handleSendMessage(data);
          case 'send-test-message':
            return await this.handleSendTestMessage(data);
          case 'send-bulk-messages':
            return await this.handleSendBulkMessages(data);
          default:
            throw new Error(`Unknown WhatsApp sending job: ${name}`);
        }
      },
      3 // Concurrency of 3 for sending operations
    );
  }

  /**
   * Setup automatic session cleanup
   */
  private setupSessionCleanup(): void {
    this.sessionCleanupInterval = setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, config.WHATSAPP.SESSION_TIMEOUT / 2); // Check every 30 minutes

    this.serviceLogger.info('✅ Session cleanup scheduled');
  }

  /**
   * Schedule automatic destination cleanup
   */
  private setupDestinationCleanup(): void {
    // Run cleanup every 24 hours
    this.destinationCleanupInterval = setInterval(async () => {
      try {
        // Get all active clients
        const activeSessions = Array.from(this.sessions.keys());

        for (const clientId of activeSessions) {
          try {
            await this.performDestinationCleanup(clientId);
          } catch (error) {
            this.serviceLogger.error(`Cleanup failed for client ${clientId}:`, error);
          }
        }
      } catch (error) {
        this.serviceLogger.error('Error during scheduled destination cleanup:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours

    this.serviceLogger.info('✅ Destination cleanup scheduled');
  }

  /**
   * Sincroniza fotos de perfil em lotes pequenos, em background.
   * Um cliente conectado por ciclo; ignora tick se o lote anterior ainda estiver rodando.
   */
  private setupProfilePictureBackgroundSync(): void {
    const INTERVAL_MS = 90_000;
    const BATCH_SIZE = 6;
    const INITIAL_DELAY_MS = 45_000;

    const tick = async (): Promise<void> => {
      if (this.profilePictureSyncRunning) return;

      const connected = Array.from(this.sessions.keys()).filter(id =>
        this.isClientConnected(id),
      );
      if (connected.length === 0) return;

      this.profilePictureSyncRunning = true;
      try {
        const idx = this.profilePictureSyncClientCursor % connected.length;
        this.profilePictureSyncClientCursor += 1;
        const clientId = connected[idx]!;
        await this.syncDestinationProfilePictures(clientId, { limit: BATCH_SIZE });
      } catch (error) {
        this.serviceLogger.warn('Background profile picture sync failed:', error);
      } finally {
        this.profilePictureSyncRunning = false;
      }
    };

    setTimeout(() => {
      tick().catch(error => {
        this.serviceLogger.warn('Initial profile picture sync failed:', error);
      });
      this.profilePictureSyncInterval = setInterval(() => {
        tick().catch(error => {
          this.serviceLogger.warn('Scheduled profile picture sync failed:', error);
        });
      }, INTERVAL_MS);
    }, INITIAL_DELAY_MS);

    this.serviceLogger.info('✅ Profile picture background sync scheduled');
  }

  /**
   * Restore existing sessions from database and local disk
   */
  private async restoreExistingSessions(): Promise<void> {
    try {
      const activeSessions = await WhatsAppSession.find({
        status: { $in: ['active', 'inactive'] },
        expiresAt: { $gt: new Date() },
        sessionData: { $nin: ['no-creds', ''] },
      });

      const clientIds = new Set<string>(
        activeSessions.map(s => s.clientId.toString()),
      );
      for (const id of this.discoverLocalSessionClientIds()) {
        clientIds.add(id);
      }

      this.serviceLogger.info(`Found ${clientIds.size} session(s) to restore (db+disk)`);

      for (const clientId of clientIds) {
        try {
          if (this.sessions.has(clientId) || this.connectingClients.has(clientId)) continue;
          const cached = await this.sessionCache.getWhatsAppSession(clientId);
          if (cached?.manualDisconnect) {
            this.manuallyDisconnectedClients.add(clientId);
            continue;
          }
          await this.restoreSession(clientId);
        } catch (error) {
          const msg = (error as Error).message;
          this.serviceLogger.error(`Failed to restore session for client ${clientId}:`, error);
          const sessionDoc = await WhatsAppSession.findOne({ clientId });
          if (sessionDoc && !msg.includes('Session files not found')) {
            await sessionDoc.markAsExpired();
          }
        }
      }

    } catch (error) {
      this.serviceLogger.error('Error restoring existing sessions:', error);
    }
  }

  /** Tenta reconectar sessões com credenciais salvas sem exigir visita manual a /sessions */
  private setupAutoReconnect(): void {
    if (this.autoReconnectInterval) clearInterval(this.autoReconnectInterval);

    const tick = () => {
      this.ensurePersistedSessionsConnected().catch(err => {
        this.serviceLogger.warn('Auto-reconnect tick failed', err);
      });
    };

    tick();
    this.autoReconnectInterval = setInterval(tick, 60_000);
  }

  private async ensurePersistedSessionsConnected(): Promise<void> {
    for (const clientId of this.discoverLocalSessionClientIds()) {
      if (
        this.sessions.has(clientId) ||
        this.connectingClients.has(clientId) ||
        this.reconnectingClients.has(clientId) ||
        this.manuallyDisconnectedClients.has(clientId)
      ) {
        continue;
      }

      const cached = await this.sessionCache.getWhatsAppSession(clientId);
      if (cached?.manualDisconnect) {
        this.manuallyDisconnectedClients.add(clientId);
        continue;
      }

      const state = await this.getConnectionState(clientId);
      if (state.instance.state === 'open') continue;

      this.serviceLogger.info(`Auto-reconnecting WhatsApp session: ${clientId}`);
      this.connectInstance(clientId).catch(err => {
        this.serviceLogger.warn(`Auto-reconnect failed for ${clientId}: ${(err as Error).message}`);
      });
    }
  }

  /**
   * Handle WhatsApp connection request (non-blocking — retorna após QR ou timeout curto)
   */
  private async handleConnectWhatsApp(data: any): Promise<any> {
    const { clientId, discordUserId, channelId } = data;

    try {
      this.serviceLogger.info(`Connecting WhatsApp for client: ${clientId}`);

      if (this.sessions.has(clientId)) {
        const state = await this.getConnectionState(clientId);
        return { success: true, message: 'Already connected', ...state };
      }

      const result = await this.connectInstance(clientId, { discordUserId, channelId });

      return {
        success: true,
        message: result.instance.state === 'open' ? 'Connected successfully' : 'QR code sent',
        instance: result.instance,
        qrcode: result.qrcode,
      };

    } catch (error) {
      this.pendingConnections.delete(clientId);
      this.connectingClients.delete(clientId);
      this.serviceLogger.error(`Failed to connect WhatsApp for client ${clientId}: ${(error as Error).message}`, { stack: (error as Error).stack });
      this.circuitBreaker.recordFailure();
      throw error;
    }
  }

  /** Disconnect temporário (mantém credenciais para reconectar) */
  private async handleTemporaryDisconnect(data: any): Promise<any> {
    const { clientId } = data;
    try {
      this.serviceLogger.info(`Temporary disconnect WhatsApp for client: ${clientId}`);
      return await this.temporaryDisconnect(clientId);
    } catch (error) {
      this.serviceLogger.error(`Failed to disconnect WhatsApp for client ${clientId}:`, error);
      throw error;
    }
  }

  /** Logout completo (limpa credenciais) */
  private async handleLogoutWhatsApp(data: any): Promise<any> {
    const { clientId } = data;
    try {
      this.serviceLogger.info(`Logging out WhatsApp for client: ${clientId}`);
      return await this.logoutInstance(clientId);
    } catch (error) {
      this.serviceLogger.error(`Failed to logout WhatsApp for client ${clientId}:`, error);
      throw error;
    }
  }

  /** Reinicia conexão sem apagar sessão */
  private async handleRestartWhatsApp(data: any): Promise<any> {
    const { clientId } = data;
    try {
      this.serviceLogger.info(`Restarting WhatsApp for client: ${clientId}`);
      return await this.restartInstance(clientId);
    } catch (error) {
      this.serviceLogger.error(`Failed to restart WhatsApp for client ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Create new WhatsApp session
   */
  private async createWhatsAppSession(clientId: string): Promise<{ qrCode?: string; connected: boolean }> {
    this.connectingClients.add(clientId);
    const sessionDir = path.join(process.cwd(), 'sessions', clientId);

    // Ensure session directory exists
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const service = this;

    const socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: this.createBaileysLogger(),
      browser: ['Discord-WhatsApp Bot', 'Chrome', '1.0.0'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      markOnlineOnConnect: false,
      getMessage: async (key) => service.getStoredMessageContent(clientId, key),
    });

    return new Promise((resolve, reject) => {
      let qrCode: string | undefined;
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          socket.end(new Error('Connection timeout'));
          reject(new Error('WhatsApp connection timeout'));
        }
      }, 120000); // 2 minutes timeout

      socket.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        this.logConnectionUpdate(
          clientId,
          connection,
          !!qr,
          (lastDisconnect?.error as Boom)?.output?.statusCode,
        );

        if (qr && !resolved) {
          try {
            const count = (this.qrCounts.get(clientId) ?? 0) + 1;
            this.qrCounts.set(clientId, count);

            if (count > config.WHATSAPP.QRCODE_LIMIT) {
              this.serviceLogger.warn(`QR limit (${config.WHATSAPP.QRCODE_LIMIT}) reached for client: ${clientId}`);
              await this.notifySessionUpdate(clientId, {
                status: 'disconnected',
                statusReason: 408,
              });
              this.connectingClients.delete(clientId);
              this.pendingConnections.delete(clientId);
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                socket.end(undefined);
                reject(new Error('QR code limit reached'));
              }
              return;
            }

            qrCode = await QRCode.toDataURL(qr);
            this.serviceLogger.info(`QR code #${count} generated for client: ${clientId}`);

            await this.notifySessionUpdate(clientId, {
              status: 'qr-required',
              qrCode,
              qrCodeRaw: qr,
              qrCount: count,
              statusReason: 200,
            });

            const pending = this.pendingConnections.get(clientId);
            if (pending?.discordUserId && pending?.channelId) {
              const msgId = await this.sendQRCodeToDiscord(pending.discordUserId, pending.channelId, qrCode);
              if (msgId) {
                this.pendingConnections.set(clientId, { ...pending, qrMessageId: msgId });
              }
            }
          } catch (error) {
            this.serviceLogger.error('Failed to generate QR code:', error);
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== DisconnectReason.forbidden;

          if (!resolved) {
            if (shouldReconnect) {
              this.serviceLogger.info(`WhatsApp connection closed (${statusCode}), reconnecting for client: ${clientId}`);
              // For restartRequired (515), create a new socket
              if (statusCode === DisconnectReason.restartRequired) {
                socket.end(undefined);
                const newResult = await this.createWhatsAppSession(clientId);
                if (!resolved) {
                  resolved = true;
                  clearTimeout(timeout);
                  resolve(newResult);
                }
              }
            } else {
              resolved = true;
              clearTimeout(timeout);
              await this.cleanupSession(clientId);
              reject(new Error('WhatsApp logged out'));
            }
          }
        } else if (connection === 'open') {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);

            // Delete QR code message from Discord now that we're connected
            const pending = this.pendingConnections.get(clientId);
            if (pending?.qrMessageId) {
              await this.deleteDiscordMessage(pending.channelId, pending.qrMessageId);
            }
            this.pendingConnections.delete(clientId);

            // Store session
            this.sessions.set(clientId, socket);
            this.sessionStates.set(clientId, state);

            // Setup event handlers
            this.setupSocketEventHandlers(socket, clientId);
            this.warmWaStatusContactCache(socket, clientId);

            const wuid = socket.user?.id;
            const profileName = socket.user?.name ?? undefined;
            const profilePictureUrl = await this.fetchProfilePicture(socket, wuid);

            // Save session to database (all auth files + perfil WA)
            const waAccountType = this.detectAccountType(socket.user);

            await this.saveSessionToDatabase(clientId, { wuid, profileName, profilePictureUrl }, waAccountType);

            await this.notifySessionUpdate(clientId, {
              status: 'connected',
              statusReason: 200,
              wuid,
              profileName,
              profilePictureUrl,
              waAccountType,
              deviceInfo: {
                platform: waAccountType === 'business' ? 'business' : 'web',
                browser: 'chrome',
                version: '1.0.0',
              },
            });

            this.qrCounts.delete(clientId);
            this.connectingClients.delete(clientId);

            this.serviceLogger.info(`WhatsApp connected successfully for client: ${clientId}`);
            this.circuitBreaker.recordSuccess();

            resolve({ connected: true });
          }
        }
      });

      socket.ev.on('creds.update', async () => {
        saveCreds();
        const profilePictureUrl = await this.fetchProfilePicture(socket, socket.user?.id);
        const waAccountType = this.detectAccountType(socket.user);
        await this.saveSessionToDatabase(clientId, {
          wuid: socket.user?.id,
          profileName: socket.user?.name ?? undefined,
          profilePictureUrl,
        }, waAccountType);
      });
    });
  }

  /** Mantém cache de contatos WA para publicar status (não usa /contact do RadarZap). */
  private setupWaStatusContactSync(socket: WASocket, clientId: string): void {
    const cache = (jid: string | undefined | null) => this.cacheWaStatusContactJid(clientId, jid);
    const cacheContact = (c: { id?: string | null; lid?: string | null; phoneNumber?: string | null }) => {
      cache(c.id);
      if (c.lid) cache(c.lid.includes('@') ? c.lid : `${c.lid}@lid`);
      if (c.phoneNumber) {
        cache(c.phoneNumber.includes('@') ? c.phoneNumber : `${c.phoneNumber}@s.whatsapp.net`);
      }
    };

    socket.ev.on('contacts.upsert', (contacts) => {
      for (const c of contacts) cacheContact(c);
    });
    socket.ev.on('contacts.update', (contacts) => {
      for (const c of contacts) cacheContact(c);
    });
    socket.ev.on('messaging-history.set', ({ contacts, chats }) => {
      for (const c of contacts ?? []) cacheContact(c);
      for (const ch of chats ?? []) cache(ch.id);
    });
    socket.ev.on('chats.upsert', (chats) => {
      for (const ch of chats) cache(ch.id);
    });
    socket.ev.on('messages.upsert', ({ messages }) => {
      for (const msg of messages) {
        cache(msg.key?.remoteJid);
        cache(msg.key?.participant);
      }
    });
  }

  private warmWaStatusContactCache(socket: WASocket, clientId: string): void {
    if (typeof socket.resyncAppState === 'function') {
      socket.resyncAppState(['regular', 'regular_high'], false).catch(err => {
        this.serviceLogger.debug('resyncAppState para contatos de status', err);
      });
    }
    void this.preloadDeviceListContacts(clientId, socket).catch(err => {
      this.serviceLogger.debug('Pré-carga device-list para status', err);
    });
    this.serviceLogger.debug('Cache de contatos WA para status ativo', {
      clientId,
      cached: this.waStatusContactJids.get(clientId)?.size ?? 0,
    });
  }

  /**
   * Setup socket event handlers
   */
  private setupSocketEventHandlers(socket: WASocket, clientId: string): void {
    this.setupWaStatusContactSync(socket, clientId);

    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut ||
                            statusCode === DisconnectReason.forbidden;
        const isReplaced = statusCode === DisconnectReason.connectionReplaced;

        this.serviceLogger.warn(`WhatsApp connection closed for client: ${clientId} (code=${statusCode})`);

        if (this.manuallyDisconnectedClients.has(clientId)) {
          await this.softDisconnect(clientId, statusCode ?? 200);
          return;
        }

        if (isLoggedOut) {
          this.serviceLogger.info(`Client ${clientId} logged out, cleaning up session`);
          await this.handleSessionDisconnect(clientId);
        } else if (isReplaced) {
          this.serviceLogger.warn(
            `Client ${clientId}: conexão substituída (440) — pare outras sessões WhatsApp Web`,
          );
          await this.softDisconnect(clientId, 440);
        } else if (this.reconnectingClients.has(clientId)) {
          /* reconexão já em andamento */
        } else {
          this.serviceLogger.info(`Transient disconnect for client ${clientId}, attempting reconnect...`);
          this.sessions.delete(clientId);
          this.sessionStates.delete(clientId);
          await this.sessionCache.setWhatsAppSession(clientId, {
            status: 'connecting',
            lastActivity: new Date(),
          }, WA_CACHE_TTL_SEC);

          this.reconnectingClients.add(clientId);
          this.createWhatsAppSession(clientId)
            .then(() => {
              this.serviceLogger.info(`Reconnected successfully for client: ${clientId}`);
            })
            .catch((err) => {
              this.serviceLogger.error(`Reconnect failed for client ${clientId}: ${err.message}`);
              this.softDisconnect(clientId, 503).catch(() => {});
            })
            .finally(() => {
              this.reconnectingClients.delete(clientId);
            });
        }
      }
    });

    socket.ev.on('messages.upsert', async (m) => {
      if (m.type !== 'notify' && m.type !== 'append') return;
      for (const msg of m.messages) {
        if (msg.key.fromMe) continue;
        if (msg.key.remoteJid?.endsWith('@g.us')) continue;

        if (msg.message?.pollUpdateMessage) {
          continue;
        }

        const text = this.extractInboundText(msg);
        if (!text || !msg.key.remoteJid) continue;

        this.serviceLogger.info('WA inbound texto (consent)', {
          text: text.slice(0, 40),
          remoteJid: msg.key.remoteJid,
          remoteJidAlt: msg.key.remoteJidAlt,
          upsertType: m.type,
        });

        try {
          await ConsentService.getInstance().handleInboundMessage(
            clientId,
            msg.key.remoteJid,
            text,
            msg.key.remoteJidAlt,
          );
        } catch (err) {
          this.serviceLogger.warn('Consent inbound handler error', err);
        }
      }
    });

    /* Enquete de consentimento desativada — apenas respostas 1/2 por texto */

    // Keep session alive - store interval reference for cleanup
    const keepAliveInterval = setInterval(async () => {
      try {
        if (this.sessions.has(clientId)) {
          await this.sessionCache.updateWhatsAppActivity(clientId);
        } else {
          // Clear interval if session no longer exists
          clearInterval(keepAliveInterval);
          this.sessionIntervals.delete(clientId);
        }
      } catch (error) {
        this.serviceLogger.error(`Failed to update activity for client ${clientId}:`, error);
      }
    }, 30000); // Every 30 seconds

    // Store interval reference for cleanup
    this.sessionIntervals.set(clientId, keepAliveInterval);
  }

  /**
   * Handle session disconnect
   */
  private async handleSessionDisconnect(clientId: string): Promise<void> {
    try {
      // Remove from active sessions
      this.sessions.delete(clientId);
      this.sessionStates.delete(clientId);

      // Update cache
      await this.notifySessionUpdate(clientId, {
        status: 'disconnected',
        statusReason: 401,
        lastActivity: new Date(),
      });

      // Update database
      const sessionDoc = await WhatsAppSession.findOne({ clientId });
      if (sessionDoc) {
        await sessionDoc.markAsExpired();
      }

      this.serviceLogger.info(`Session disconnected and cleaned up for client: ${clientId}`);

    } catch (error) {
      this.serviceLogger.error(`Error handling session disconnect for client ${clientId}:`, error);
    }
  }

  /**
   * Send QR code to Discord channel
   */
  private async sendQRCodeToDiscord(discordUserId: string | undefined, channelId: string | undefined, qrCode: string): Promise<string | undefined> {
    if (!discordUserId || !channelId) return undefined;
    try {
      const { REST, Routes } = await import('discord.js');
      const token = process.env.DISCORD_TOKEN;

      if (!token) {
        this.serviceLogger.error('DISCORD_TOKEN not set, cannot send QR code');
        return undefined;
      }

      const base64Data = qrCode.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const rest = new REST({ version: '10' }).setToken(token);

      const message: any = await rest.post(Routes.channelMessages(channelId), {
        body: {
          content: `<@${discordUserId}> 📱 **WhatsApp QR Code**\n\nEscaneie com seu WhatsApp:\n1. Abra o WhatsApp\n2. Configurações > Aparelhos conectados\n3. Conectar aparelho\n4. Escaneie o código\n\n⏱️ Expira em 60 segundos.`
        },
        files: [{
          name: 'qrcode.png',
          data: buffer
        }]
      });

      this.serviceLogger.info(`QR code sent to Discord channel ${channelId}`);
      return message?.id;
    } catch (error) {
      this.serviceLogger.error(`Failed to send QR code to Discord: ${(error as Error).message}`);
      return undefined;
    }
  }

  private async deleteDiscordMessage(channelId: string | undefined, messageId: string | undefined): Promise<void> {
    if (!channelId || !messageId) return;
    try {
      const { REST, Routes } = await import('discord.js');
      const token = process.env.DISCORD_TOKEN;
      if (!token) return;
      const rest = new REST({ version: '10' }).setToken(token);
      await rest.delete(Routes.channelMessage(channelId, messageId));
      this.serviceLogger.info(`QR code message deleted from Discord channel ${channelId}`);
    } catch (error) {
      this.serviceLogger.error(`Failed to delete QR code message: ${(error as Error).message}`);
    }
  }

  /**
   * Handle send message request
   */
  private formatJid(identifier: string, type: 'contact' | 'group' = 'contact'): string {
    // Already fully formatted
    if (identifier.includes('@')) return identifier;
    // Strip leading + and any non-digit characters except for group IDs
    const cleaned = type === 'group'
      ? identifier.replace(/[^0-9\-]/g, '')
      : identifier.replace(/[^0-9]/g, '');
    const suffix = type === 'group' ? '@g.us' : '@s.whatsapp.net';
    return `${cleaned}${suffix}`;
  }

  private async handleSendMessage(data: any): Promise<any> {
    const { clientId, destination, content, messageId } = data;

    try {
      const clientObjectId = new mongoose.Types.ObjectId(clientId);

      // Check rate limiting (campanhas com risco aceito podem pular)
      if (!data.skipRateLimit) {
        const rateLimitResult = await this.rateLimiter.checkWhatsAppSendingLimit(clientId);
        if (!rateLimitResult.allowed) {
          throw new Error('Limite de envio do WhatsApp atingido — aguarde alguns segundos e tente novamente.');
        }
      }

      await this.ensureClientReady(clientId);
      const socket = this.sessions.get(String(clientId));
      if (!socket?.user) {
        throw new Error('WhatsApp session not found or not connected');
      }

      const org = await Organization.findById(clientId);
      if (org && !org.canSendMessage()) {
        throw new Error(
          `Limite diário de mensagens atingido (${org.limits.messagesPerDay}/dia no plano).`,
        );
      } else {
        const user = await User.findById(clientId);
        if (user && !user.canSendMessage()) {
          throw new Error(
            `Limite diário de mensagens atingido (${user.limits.messagesPerDay}/dia no plano).`,
          );
        }
      }

      let text = String(content?.text ?? '').trim();
      const hasImage = Boolean(content?.image);

      const extracted = data.extractedData;
      const streamLink = extracted ? streamLinkFromExtracted(extracted) : '';
      if (extracted && streamLink && !extracted.primaryLink) {
        extracted.primaryLink = streamLink;
      }

      if (extracted) {
        const tpl = resolveOutboundTemplate(extracted, {
          text,
          streamLink,
          resolvedTemplate: data.resolvedTemplate,
          fallbackTemplate: data.templateName || 'dw-padrao',
        });
        text = buildFinalWhatsAppBody(tpl, extracted, text);
      }

      let captionFollowUp = '';
      if (hasImage && text) {
        const split = splitImageCaption(text);
        text = split.caption;
        captionFollowUp = split.followUp;
      }

      const previewCheck = `${text}\n${captionFollowUp}`.trim();
      if (
        extracted &&
        hasImage &&
        (!/via radarzap/i.test(previewCheck) || !/https?:\/\//i.test(previewCheck))
      ) {
        const rebuildTpl = extracted
          ? resolveOutboundTemplate(extracted, {
              text,
              streamLink,
              resolvedTemplate: data.resolvedTemplate,
              fallbackTemplate: data.templateName || 'dw-padrao',
            })
          : 'dw-live';
        const full = buildFinalWhatsAppBody(rebuildTpl, extracted);
        const split = splitImageCaption(full);
        text = split.caption;
        captionFollowUp = split.followUp;
      }

      if (!text && hasImage) {
        text = '📷';
      }

      const fullOutbound = `${text}\n${captionFollowUp}`.trim();
      const hasLink = /https?:\/\//i.test(fullOutbound);
      const hasRodape = /via radarzap/i.test(fullOutbound);

      await logPipeline('WhatsAppService', 'send', 'Enviando ao WhatsApp', {
        clientId,
        messageId: data.messageId,
        traceId: data.traceId,
        destination,
        template: data.resolvedTemplate ?? data.templateName,
        ...buildPipelineTrackingMeta(extracted, {
          streamer: data.extractedData?.embedAuthorName,
          streamLink: streamLink || undefined,
          captionLen: text.length,
          followUpLen: captionFollowUp.length,
          hasLink,
          hasRodape,
          hasImage,
          weakCaption: extracted ? shouldUseLiveTemplate(extracted, text, streamLink) : false,
          preview: previewOutbound(`${text}\n${captionFollowUp}`.trim()),
          delay: data.jobDelay,
        }),
      }, clientObjectId, data.traceId);

      this.serviceLogger.info('WA envio preparado', {
        clientId,
        destination,
        template: data.resolvedTemplate ?? data.templateName,
        captionLen: text.length,
        followUpLen: captionFollowUp.length,
        hasLink,
        hasRodape,
        withImage: hasImage,
      });

      if (!hasLink && data.extractedData?.captureKind === 'live') {
        this.serviceLogger.warn('Live sem link na mensagem final', {
          clientId,
          messageId: data.messageId,
          streamer: data.extractedData?.embedAuthorName,
        });
      }

      const textToValidate = captionFollowUp
        ? `${text}\n\n${captionFollowUp}`
        : text;
      const msgCheck = validateMessageText(textToValidate);
      if (msgCheck.ok === false) {
        throw new Error(msgCheck.error);
      }

      // Validate destination and consent before sending
      const destinationDoc = await Destination.findByIdentifier(destination, clientObjectId);
      if (!destinationDoc) {
        throw new Error('Destination not found or not configured');
      }

      if (!data.skipConsentCheck) {
        const consentErr = ConsentService.getInstance().assertCanSend(destinationDoc);
        if (consentErr) throw new Error(consentErr);
        if (!destinationDoc.hasValidConsent()) {
          throw new Error('Destino sem consentimento válido para envio');
        }
      } else if (!destinationDoc.isActive && destinationDoc.type === 'group') {
        throw new Error('Destino inativo');
      }

      if (destinationDoc.type === 'group') {
        const groupErr = await this.validateGroupMembershipForSend(
          clientId,
          [{ identifier: destinationDoc.identifier, name: destinationDoc.name }],
        );
        if (groupErr) throw new Error(groupErr);
      }

      // Format JID correctly for Baileys
      const jid = this.formatJid(destination, destinationDoc.type as 'contact' | 'group');

      // For contacts, resolve the actual JID via onWhatsApp (handles BR 9-digit quirk)
      let resolvedJid = jid;
      if (destinationDoc.type === 'contact') {
        try {
          const plainNumber = jid.replace('@s.whatsapp.net', '');
          const [result] = await socket.onWhatsApp(plainNumber);
          if (result?.exists && result.jid) {
            resolvedJid = result.jid;
            this.serviceLogger.debug(`Resolved JID for ${destination}: ${resolvedJid}`);
          } else {
            this.serviceLogger.warn(`Number ${destination} not found on WhatsApp, attempting send anyway`);
          }
        } catch {
          // onWhatsApp failed — fall back to formatted JID
        }
      }

      // Send message (imagem com legenda; imagens extras em mensagens seguintes)
      let result: Awaited<ReturnType<typeof socket.sendMessage>> | undefined;
      if (content.image) {
        try {
          result = await socket.sendMessage(resolvedJid, {
            image: { url: content.image },
            caption: text,
          });
          this.storeOutboundMessage(result ?? undefined);
          if (captionFollowUp) {
            await new Promise(r => setTimeout(r, 600));
            try {
              const follow = await socket.sendMessage(resolvedJid, { text: captionFollowUp });
              this.storeOutboundMessage(follow ?? undefined);
              await logPipeline('WhatsAppService', 'send_ok', 'Legenda extra (link/rodapé)', {
                clientId,
                messageId: data.messageId,
                traceId: data.traceId,
                destination,
                followUpLen: captionFollowUp.length,
              }, clientObjectId, data.traceId);
            } catch (followErr) {
              await logPipeline('WhatsAppService', 'send_fail', 'Falha legenda extra', {
                clientId,
                messageId: data.messageId,
                traceId: data.traceId,
                destination,
                error: (followErr as Error).message,
                followUpLen: captionFollowUp.length,
              }, clientObjectId, data.traceId);
              const merged = [text, captionFollowUp].filter(Boolean).join('\n\n').trim();
              const retry = await socket.sendMessage(resolvedJid, { text: merged });
              this.storeOutboundMessage(retry ?? undefined);
            }
          }
        } catch (imgErr) {
          const errMsg = (imgErr as Error).message;
          await logPipeline('WhatsAppService', 'send_fail', 'Imagem falhou — fallback texto', {
            clientId,
            messageId: data.messageId,
            traceId: data.traceId,
            destination,
            error: errMsg,
          }, clientObjectId, data.traceId);
          let fallbackText = [text, captionFollowUp].filter(Boolean).join('\n\n').trim();
          if (data.extractedData && streamLink) {
            const fbTpl = resolveOutboundTemplate(data.extractedData, {
              text: fallbackText,
              streamLink,
              resolvedTemplate: data.resolvedTemplate,
              fallbackTemplate: data.templateName || 'dw-padrao',
            });
            fallbackText = buildFinalWhatsAppBody(fbTpl, data.extractedData, fallbackText);
          }
          result = await socket.sendMessage(resolvedJid, {
            text: fallbackText || content.text || '_(imagem indisponível)_',
          });
          this.storeOutboundMessage(result ?? undefined);
        }
      } else {
        const outbound = captionFollowUp ? `${text}\n\n${captionFollowUp}` : text;
        result = await socket.sendMessage(resolvedJid, { text: outbound });
        this.storeOutboundMessage(result ?? undefined);
      }

      const extraImages: string[] = Array.isArray(content.extraImages)
        ? content.extraImages.filter((u: string) => u && u !== content.image).slice(0, 3)
        : [];
      for (const imgUrl of extraImages) {
        await new Promise(r => setTimeout(r, 800));
        const extra = await socket.sendMessage(resolvedJid, { image: { url: imgUrl } });
        this.storeOutboundMessage(extra ?? undefined);
      }

      // Update destination last message sent
      await destinationDoc.updateLastMessageSent();

      if (!data.skipConsentCheck && destinationDoc.type === 'contact') {
        try {
          await ConsentService.getInstance().afterOutboundSend(
            clientId,
            destinationDoc,
            (data.consentOrigin as 'dashboard-send' | 'campaign') ?? 'dashboard-send',
          );
        } catch (consentErr) {
          this.serviceLogger.error('Falha ao enviar mensagem de consentimento (mensagem principal já enviada)', {
            clientId,
            destination,
            error: (consentErr as Error).message,
          });
        }
      }

      // Update user usage
      const orgDoc = await Organization.findById(clientId);
      if (orgDoc) {
        await orgDoc.incrementUsage();
      } else {
        const user = await User.findById(clientId);
        if (user) await user.incrementUsage();
      }

      if (data.dedupKey) {
        try {
          const redis = (await import('@/cache/RedisManager')).RedisManager.getInstance();
          await redis.setWithTTL(data.dedupKey, '1', data.dedupTtlSeconds ?? 6 * 3600);
        } catch {
          /* dedup opcional */
        }
      }

      this.serviceLogger.info(`Message sent successfully`, {
        clientId,
        destination,
        messageId: result?.key?.id,
        traceId: data.traceId,
      });

      await logPipeline('WhatsAppService', 'send_ok', 'Mensagem enviada', {
        clientId,
        destination,
        waMessageId: result?.key?.id,
        traceId: data.traceId,
        template: data.resolvedTemplate ?? data.templateName,
        ...buildPipelineTrackingMeta(extracted, {
          streamer: data.extractedData?.embedAuthorName,
          streamLink: streamLink || undefined,
          hasLink,
          hasRodape,
          captionLen: text.length,
          followUpLen: captionFollowUp.length,
          preview: previewOutbound(fullOutbound),
        }),
      }, clientObjectId, data.traceId);

      this.circuitBreaker.recordSuccess();

      return {
        success: true,
        messageId: result?.key?.id,
        timestamp: new Date()
      };

    } catch (error) {
      const errMsg = (error as Error).message || 'Unknown error during send';
      this.serviceLogger.error(`Failed to send message: ${errMsg}`, {
        stack: (error as Error).stack,
        destination,
        clientId,
        traceId: data?.traceId,
      });
      await logPipeline(
        'WhatsAppService',
        'send_fail',
        errMsg,
        {
          clientId,
          destination,
          traceId: data?.traceId,
          messageId: data?.messageId,
          template: data?.resolvedTemplate ?? data?.templateName,
        },
        clientId,
        data?.traceId
      );
      this.circuitBreaker.recordFailure();
      throw new Error(errMsg);
    }
  }

  /**
   * Handle send test message request
   */
  private async handleSendTestMessage(data: any): Promise<any> {
    const { clientId, message, destination, discordUserId, channelId } = data;
    const clientObjectId = new mongoose.Types.ObjectId(clientId);

    try {
      // Get destinations — specific one or all active
      let destinations;
      if (destination) {
        const doc = await Destination.findByIdentifier(destination, clientObjectId);
        if (!doc) {
          const anyDoc = await Destination.findByIdentifier(destination);
          if (anyDoc) {
            throw new Error(`Destination "${destination}" exists but belongs to a different user`);
          }
          const allDests = await Destination.find({ clientId: clientObjectId });
          const identifiers = allDests.map((d: any) => d.identifier).join(', ') || 'none';
          this.serviceLogger.warn(`Destination not found. clientId=${clientId}, requested="${destination}", existing=[${identifiers}]`);
          throw new Error(`Destination "${destination}" not found. Your registered destinations: [${identifiers}]`);
        }
        destinations = [doc];
      } else {
        destinations = await Destination.findByClientId(clientObjectId, true);
      }

      if (destinations.length === 0) {
        throw new Error('No WhatsApp destinations configured');
      }

      const results = [];
      for (const dest of destinations) {
        const result = await this.handleSendMessage({
          clientId,
          destination: dest.identifier,
          content: { text: `🧪 Test Message: ${message}` },
          messageId: `test-${Date.now()}`
        });
        results.push({ name: dest.name, ...result });
      }

      const names = destinations.map((d: any) => `**${d.name}**`).join(', ');

      if (discordUserId && channelId) {
        await this.queueManager.addJob(
          'discord-notifications',
          'send-notification',
          {
            discordUserId,
            channelId,
            message: `✅ Test message sent to ${names}!`,
          },
          { priority: 7 },
        );
      }

      return { success: true, results };

    } catch (error) {
      if (discordUserId && channelId) {
        await this.queueManager.addJob(
          'discord-notifications',
          'send-notification',
          {
            discordUserId,
            channelId,
            message: `❌ Failed to send test message: ${(error as Error).message}`,
          },
          { priority: 7 },
        );
      }
      throw error;
    }
  }

  /**
   * Handle bulk message sending
   */
  private async handleSendBulkMessages(data: any): Promise<any> {
    const { clientId, messages } = data;

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const messageData of messages) {
      try {
        const result = await this.handleSendMessage({
          clientId,
          ...messageData
        });

        results.push({ ...messageData, result, success: true });
        successCount++;

        // Add delay between messages to respect rate limits
        await this.sleep(3000); // 3 seconds between messages

      } catch (error) {
        results.push({
          ...messageData,
          error: error.message,
          success: false
        });
        failureCount++;
      }
    }

    return {
      success: true,
      totalMessages: messages.length,
      successCount,
      failureCount,
      results
    };
  }

  /**
   * Disconnect session
   */
  private async disconnectSession(clientId: string): Promise<void> {
    const socket = this.sessions.get(clientId);

    if (socket) {
      await socket.logout();
      socket.end(undefined);
    }

    await this.cleanupSession(clientId);
  }

  /**
   * Cleanup session data
   */
  private async cleanupSession(clientId: string): Promise<void> {
    // Remove from memory
    this.sessions.delete(clientId);
    this.sessionStates.delete(clientId);
    this.waStatusContactJids.delete(clientId);

    // Clear session interval if exists
    const interval = this.sessionIntervals.get(clientId);
    if (interval) {
      clearInterval(interval);
      this.sessionIntervals.delete(clientId);
    }

    // Clean up session files
    const sessionDir = path.join(process.cwd(), 'sessions', clientId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }

    // Update cache
    await this.sessionCache.deleteSession(`whatsapp:${clientId}`);
    this.qrCounts.delete(clientId);
    this.connectingClients.delete(clientId);

    // Update database
    const sessionDoc = await WhatsAppSession.findOne({ clientId });
    if (sessionDoc) {
      await sessionDoc.markAsExpired();
    }

    this.serviceLogger.info(`Session cleaned up for client: ${clientId}`);
  }

  /**
   * Close all sessions
   */
  private async closeAllSessions(): Promise<void> {
    const closePromises = Array.from(this.sessions.keys()).map(async (clientId) => {
      try {
        await this.disconnectSession(clientId);
      } catch (error) {
        this.serviceLogger.error(`Error closing session ${clientId}:`, error);
      }
    });

    await Promise.allSettled(closePromises);
    this.serviceLogger.info('All WhatsApp sessions closed');
  }

  /**
   * Cleanup expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      // Clean up expired sessions from database
      const expiredCount = await WhatsAppSession.cleanupExpiredSessions();

      // Clean up expired sessions from cache
      const cacheCleanedCount = await this.sessionCache.cleanupExpiredSessions();

      if (expiredCount > 0 || cacheCleanedCount > 0) {
        this.serviceLogger.info(`Cleaned up expired sessions: ${expiredCount} from DB, ${cacheCleanedCount} from cache`);
      }

    } catch (error) {
      this.serviceLogger.error('Error during session cleanup:', error);
    }
  }

  /**
   * Restore session from database
   */
  private async restoreSession(clientId: string): Promise<void> {
    const sessionDir = path.join(process.cwd(), 'sessions', clientId);

    if (!fs.existsSync(sessionDir) || !fs.existsSync(path.join(sessionDir, 'creds.json'))) {
      // Try to restore from database first
      const restored = await this.restoreSessionFromDatabase(clientId);
      if (!restored) {
        this.serviceLogger.warn(`Session files not found for client ${clientId}, marking as expired`);
        throw new Error('Session files not found');
      }
    }

    // Try to restore the session
    await this.createWhatsAppSession(clientId);
  }

  /**
   * Save all session auth files to database (encrypted bundle — survives restarts)
   */
  private async saveSessionToDatabase(
    clientId: string,
    profile?: { wuid?: string; profileName?: string; profilePictureUrl?: string },
    waAccountType: 'web' | 'business' = 'web',
  ): Promise<void> {
    try {
      const sessionDir = path.join(process.cwd(), 'sessions', clientId);
      const files = this.readSessionDirectory(sessionDir);

      if (!files['creds.json']) {
        return;
      }

      const tempDoc = new WhatsAppSession();
      const sessionData = tempDoc.encrypt(JSON.stringify(files));

      const deviceInfo = {
        platform: waAccountType === 'business' ? 'business' : 'web',
        browser: 'chrome',
        version: '1.0.0',
      };

      const wuid = profile?.wuid;
      const whatsappProfile = wuid || profile?.profileName || profile?.profilePictureUrl
        ? {
            wuid,
            profileName: profile?.profileName,
            phoneNumber: wuidToPhone(wuid),
            profilePictureUrl: profile?.profilePictureUrl,
          }
        : undefined;

      const expiresAt = new Date(Date.now() + WA_DB_EXPIRY_MS);

      await WhatsAppSession.findOneAndUpdate(
        { clientId: new mongoose.Types.ObjectId(clientId) },
        {
          clientId: new mongoose.Types.ObjectId(clientId),
          type: waAccountType,
          sessionData,
          status: 'active',
          deviceInfo,
          ...(whatsappProfile ? { whatsappProfile } : {}),
          lastActivity: new Date(),
          expiresAt,
        },
        { upsert: true, new: true },
      );

      const now = Date.now();
      const last = this.lastSessionSaveLogAt.get(clientId) ?? 0;
      if (now - last >= 10_000) {
        this.lastSessionSaveLogAt.set(clientId, now);
        this.serviceLogger.info(
          `Sessao salva no banco: ${clientId} (${Object.keys(files).length} arquivos)`,
        );
      }
    } catch (error) {
      this.serviceLogger.error('Failed to save session to database:', error);
    }
  }

  /**
   * Restore all session auth files from database to local disk
   */
  private async restoreSessionFromDatabase(clientId: string): Promise<boolean> {
    try {
      const sessionDoc = await WhatsAppSession.findOne({
        clientId,
        status: { $in: ['active', 'inactive'] },
        expiresAt: { $gt: new Date() },
      });

      if (!sessionDoc || sessionDoc.sessionData === 'no-creds') {
        return false;
      }

      const sessionDir = path.join(process.cwd(), 'sessions', clientId);
      const decrypted = sessionDoc.decrypt();

      let files: Record<string, string>;
      try {
        files = JSON.parse(decrypted) as Record<string, string>;
      } catch {
        // Legacy: only creds.json was stored
        files = { 'creds.json': decrypted };
      }

      if (!files['creds.json']) {
        return false;
      }

      this.writeSessionDirectory(sessionDir, files);

      this.serviceLogger.info(
        `Session credentials restored from database for client: ${clientId} (${Object.keys(files).length} files)`,
      );
      return true;
    } catch (error) {
      this.serviceLogger.error(`Failed to restore session from database for client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Create Baileys logger
   */
  private createBaileysLogger(): any {
    // Baileys requires a Pino-compatible logger with .child() support
    // Use silent level to suppress all Baileys internal logs
    const pino = require('pino');
    return pino({ level: 'silent' });
  }

  /**
   * Get service status
   */
  getStatus(): any {
    return {
      initialized: this.isInitialized,
      activeSessions: this.sessions.size,
      circuitBreakerState: this.circuitBreaker.getState(),
      lastActivity: new Date()
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const activeSessions = this.sessions.size;
      const circuitBreakerHealthy = this.circuitBreaker.getState() !== 'open';

      return {
        healthy: this.isInitialized && circuitBreakerHealthy,
        details: {
          initialized: this.isInitialized,
          activeSessions,
          circuitBreakerState: this.circuitBreaker.getState(),
          circuitBreakerHealthy,
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: { error: error.message }
      };
    }
  }

  /** Número/grupo para checagem via onWhatsApp (sem +, @ ou sufixos). */
  private plainWhatsAppId(destination: string): string {
    return destination
      .replace(/@s\.whatsapp\.net|@g\.us/g, '')
      .replace(/^\+/, '')
      .replace(/\D/g, '');
  }

  /**
   * Validate destination (contact or group) on WhatsApp
   */
  async validateDestination(clientId: string, destination: string): Promise<boolean> {
    try {
      const socket = this.sessions.get(clientId);
      if (!socket) {
        throw new Error('WhatsApp session not found');
      }

      // Check if destination exists on WhatsApp
      try {
        const plainNumber = this.plainWhatsAppId(destination);
        const [result] = await socket.onWhatsApp(plainNumber);
        return Boolean(result?.exists) || false;
      } catch (error) {
        this.serviceLogger.warn(`Failed to validate destination ${destination}:`, error);
        return false;
      }
    } catch (error) {
      this.serviceLogger.error(`Error validating destination ${destination}:`, error);
      return false;
    }
  }

  /**
   * Get contact information from WhatsApp
   */
  async getContactInfo(clientId: string, destination: string): Promise<any> {
    try {
      const socket = this.sessions.get(clientId);
      if (!socket) {
        throw new Error('WhatsApp session not found');
      }

      // Get contact info
      const contactInfo = await socket.getBusinessProfile(destination);

      return {
        exists: true,
        businessProfile: contactInfo,
        lastSeen: null // WhatsApp Web doesn't provide last seen for privacy
      };
    } catch (error) {
      this.serviceLogger.error(`Error getting contact info for ${destination}:`, error);
      return { exists: false };
    }
  }

  /**
   * Auto-cleanup invalid destinations
   */
  async performDestinationCleanup(clientId: string): Promise<{ cleaned: number; errors: string[] }> {
    try {
      this.serviceLogger.info(`Starting destination cleanup for client: ${clientId}`);

      const destinations = await Destination.findByClientId(clientId as any, true);
      let cleanedCount = 0;
      const errors: string[] = [];

      for (const destination of destinations) {
        try {
          // Contatos em fluxo de consentimento não são desativados automaticamente —
          // onWhatsApp pode falhar intermitente e bloquearia envios legítimos.
          if (destination.type === 'contact') continue;

          const isValid = await this.validateDestination(clientId, destination.identifier);

          if (!isValid) {
            await destination.deactivate();
            cleanedCount++;
            this.serviceLogger.info(`Deactivated invalid destination: ${destination.identifier}`);
          }
        } catch (error) {
          const errorMsg = `Failed to validate destination ${destination.identifier}: ${error.message}`;
          errors.push(errorMsg);
          this.serviceLogger.error(errorMsg);
        }

        // Add delay to avoid rate limiting
        await this.sleep(1000);
      }

      this.serviceLogger.info(`Destination cleanup completed: ${cleanedCount} destinations cleaned`);

      return { cleaned: cleanedCount, errors };
    } catch (error) {
      this.serviceLogger.error('Error during destination cleanup:', error);
      throw error;
    }
  }

  /**
   * Add new destination with validation
   */
  async addDestination(
    clientId: string,
    type: 'group' | 'contact',
    identifier: string,
    name: string,
    consentSource: string = 'manual',
    ipAddress: string = '127.0.0.1'
  ): Promise<any> {
    try {
      // Validate destination exists on WhatsApp
      const isValid = await this.validateDestination(clientId, identifier);
      if (!isValid) {
        throw new Error('Destination does not exist on WhatsApp');
      }

      // Create destination in database
      const destination = await Destination.createDestination(
        clientId as any,
        type,
        identifier,
        name,
        consentSource,
        ipAddress
      );

      this.serviceLogger.info(`New destination added and validated`, {
        clientId,
        destinationId: destination._id,
        type,
        identifier,
        name
      });

      return {
        success: true,
        destination: {
          id: destination._id,
          type: destination.type,
          identifier: destination.identifier,
          name: destination.name,
          isActive: destination.isActive,
          hasConsent: destination.hasValidConsent()
        }
      };
    } catch (error) {
      this.serviceLogger.error(`Failed to add destination:`, error);
      throw error;
    }
  }

  /**
   * Remove destination (revoke consent and deactivate)
   */
  async removeDestination(clientId: string, identifier: string): Promise<void> {
    try {
      const destination = await Destination.findByIdentifier(identifier, clientId as any);
      if (!destination) {
        throw new Error('Destination not found');
      }

      await destination.revokeConsent();

      this.serviceLogger.info(`Destination removed`, {
        clientId,
        destinationId: destination._id,
        identifier
      });
    } catch (error) {
      this.serviceLogger.error(`Failed to remove destination ${identifier}:`, error);
      throw error;
    }
  }

  /**
   * Valida envio para grupos: sessão conectada (e contatos selecionados) devem ser participantes.
   * Retorna mensagem de erro ou null se OK.
   */
  private normalizeGroupJid(identifier: string): string {
    return this.formatJid(identifier, 'group');
  }

  private groupJidMatches(a: string, b: string): boolean {
    const strip = (id: string) => id.replace(/@g\.us$/i, '').replace(/\D/g, '');
    return strip(a) === strip(b);
  }

  /** Carrega participantes ou mensagem amigável (ex.: número fora do grupo). */
  private async loadGroupParticipantsForValidation(
    clientId: string,
    group: { identifier: string; name: string },
  ): Promise<{ participants: Array<{ id: string }>; error: string | null }> {
    const socket = this.sessions.get(clientId);
    if (!socket?.user) {
      return { participants: [], error: 'WhatsApp não conectado' };
    }

    const groupJid = this.normalizeGroupJid(group.identifier);
    const sessionPhone = wuidToPhone(socket.user.id);
    const phoneHint = sessionPhone ?? 'Seu número WhatsApp';

    try {
      const metadata = await socket.groupMetadata(groupJid);
      return { participants: metadata.participants ?? [], error: null };
    } catch {
      try {
        const participating = await socket.groupFetchAllParticipating();
        const stillMember = Object.values(participating).some(g =>
          this.groupJidMatches(g.id, groupJid) || this.groupJidMatches(g.id, group.identifier),
        );
        if (!stillMember) {
          return {
            participants: [],
            error:
              `Número não cadastrado no grupo "${group.name}". ` +
              `${phoneHint} não participa deste grupo — entre pelo celular ou remova o grupo dos destinos.`,
          };
        }
      } catch {
        /* fall through */
      }

      return {
        participants: [],
        error:
          `Não foi possível verificar o grupo "${group.name}". ` +
          'Confirme que seu WhatsApp ainda participa dele e tente reconectar.',
      };
    }
  }

  async validateGroupMembershipForSend(
    clientId: string,
    groups: Array<{ identifier: string; name: string }>,
    contacts: Array<{ identifier: string; name: string }> = [],
  ): Promise<string | null> {
    const result = await this.validateGroupMembershipDetailed(clientId, groups, contacts);
    return result.error;
  }

  /** Valida participação em grupos; retorna IDs de destinos com falha (contatos ou grupos). */
  async validateGroupMembershipDetailed(
    clientId: string,
    groups: Array<{ identifier: string; name: string; destinationId?: string }>,
    contacts: Array<{ identifier: string; name: string; destinationId?: string }> = [],
  ): Promise<{ error: string | null; invalidDestinationIds: string[] }> {
    if (groups.length === 0) {
      return { error: null, invalidDestinationIds: [] };
    }

    const socket = this.sessions.get(clientId);
    if (!socket?.user) {
      return { error: 'WhatsApp não conectado', invalidDestinationIds: [] };
    }

    const sessionPhone = wuidToPhone(socket.user.id);
    if (!sessionPhone) {
      return { error: 'Número da sessão WhatsApp indisponível', invalidDestinationIds: [] };
    }

    const invalidIds = new Set<string>();

    for (const group of groups) {
      const { participants, error: loadErr } = await this.loadGroupParticipantsForValidation(
        clientId,
        group,
      );
      if (loadErr) {
        if (group.destinationId) invalidIds.add(group.destinationId);
        return { error: loadErr, invalidDestinationIds: [...invalidIds] };
      }

      if (!isPhoneInParticipants(sessionPhone, participants)) {
        if (group.destinationId) invalidIds.add(group.destinationId);
        return {
          error:
            `Número não cadastrado no grupo "${group.name}". ` +
            'Seu WhatsApp conectado não participa deste grupo.',
          invalidDestinationIds: [...invalidIds],
        };
      }

      for (const contact of contacts) {
        if (!isPhoneInParticipants(contact.identifier, participants)) {
          if (contact.destinationId) invalidIds.add(contact.destinationId);
          return {
            error:
              `${contact.name}: número não cadastrado no grupo "${group.name}". ` +
              'Este contato precisa estar no grupo para enviar junto com ele.',
            invalidDestinationIds: [...invalidIds],
          };
        }
      }
    }

    return { error: null, invalidDestinationIds: [] };
  }

  /** Contatos que não participam de algum dos grupos (só quando participantes foram carregados). */
  async listContactIdsNotInGroups(
    clientId: string,
    groups: Array<{ identifier: string; name: string }>,
    contacts: Array<{ identifier: string; destinationId?: string }>,
  ): Promise<string[]> {
    if (groups.length === 0 || contacts.length === 0) return [];

    const socket = this.sessions.get(clientId);
    if (!socket?.user) return [];

    const notIn: string[] = [];

    for (const group of groups) {
      const { participants, error } = await this.loadGroupParticipantsForValidation(
        clientId,
        group,
      );
      // Erro de sessão/grupo — não marcar contatos individualmente
      if (error || participants.length === 0) {
        continue;
      }

      for (const contact of contacts) {
        if (!contact.destinationId) continue;
        if (!isPhoneInParticipants(contact.identifier, participants)) {
          notIn.push(contact.destinationId);
        }
      }
    }

    return [...new Set(notIn)];
  }

  /**
   * Get group information
   */
  async getGroupInfo(clientId: string, groupId: string): Promise<any> {
    try {
      const socket = this.sessions.get(clientId);
      if (!socket) {
        throw new Error('WhatsApp session not found');
      }

      const groupMetadata = await socket.groupMetadata(groupId);

      return {
        id: groupMetadata.id,
        subject: groupMetadata.subject,
        description: groupMetadata.desc,
        participantsCount: groupMetadata.participants.length,
        isAdmin: groupMetadata.participants.some(p =>
          p.id === socket.user?.id && (p.admin === 'admin' || p.admin === 'superadmin')
        ),
        createdAt: new Date(groupMetadata.creation * 1000)
      };
    } catch (error) {
      this.serviceLogger.error(`Error getting group info for ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * List all groups the WhatsApp session is part of
   */
  async listGroups(clientId: string): Promise<Array<{ id: string; name: string; participantsCount: number; isAdmin: boolean }>> {
    const socket = this.sessions.get(clientId);
    if (!socket) throw new Error('WhatsApp session not found');

    const groups = await socket.groupFetchAllParticipating();

    return Object.values(groups).map(g => ({
      id: g.id,
      name: g.subject,
      participantsCount: g.participants.length,
      isAdmin: g.participants.some(p =>
        p.id === socket.user?.id && (p.admin === 'admin' || p.admin === 'superadmin')
      ),
    }));
  }

  /**
   * Monitor health of a specific WhatsApp session.
   * A session is considered stale when there has been no activity for > 10 minutes.
   */
  async monitorSessionHealth(clientId: string): Promise<{
    healthy: boolean;
    details: { connected: boolean; isStale: boolean; lastActivity?: Date; error?: string };
  }> {
    try {
      const socket = this.sessions.get(clientId);

      if (!socket) {
        return {
          healthy: false,
          details: { connected: false, isStale: false, error: 'Session not found' }
        };
      }

      const isConnected = this.sessions.has(clientId); // session is removed on disconnect

      const cached = await this.sessionCache.getWhatsAppSession(clientId);
      const lastActivity: Date | undefined = cached?.lastActivity;

      const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
      const isStale = lastActivity
        ? Date.now() - lastActivity.getTime() > STALE_THRESHOLD_MS
        : false;

      return {
        healthy: isConnected && !isStale,
        details: { connected: isConnected, isStale, lastActivity }
      };
    } catch (error) {
      return {
        healthy: false,
        details: { connected: false, isStale: false, error: (error as Error).message }
      };
    }
  }

  /**
   * Return aggregated statistics for the service: sessions, destinations and circuit breaker.
   */
  async getServiceStats(): Promise<{
    sessions: { total: number; healthy: number };
    destinations: any;
    circuitBreaker: any;
    uptime: number;
  }> {
    const startTime = (this as any).startTime as number | undefined;
    const uptime = startTime ? Date.now() - startTime : process.uptime() * 1000;

    // Count healthy sessions
    let healthy = 0;
    for (const clientId of this.sessions.keys()) {
      const { healthy: h } = await this.monitorSessionHealth(clientId);
      if (h) healthy++;
    }

    const destinations = await Destination.getDestinationStats();

    return {
      sessions: { total: this.sessions.size, healthy },
      destinations,
      circuitBreaker: this.circuitBreaker.getState(),
      uptime
    };
  }

  /**
   * Sleep utility function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}