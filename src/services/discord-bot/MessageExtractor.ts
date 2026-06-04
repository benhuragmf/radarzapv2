import { Message } from 'discord.js';
import crypto from 'crypto';
import { createServiceLogger } from '@/utils/logger';
import { captureDiscordMessage, discordMessageSearchText } from '@/utils/discord-capture';

export interface ExtractedMessage {
  messageId: string;
  guildId: string;
  guildName: string;
  channelId: string;
  channelName: string;

  authorId: string;
  authorName: string;
  authorTag: string;
  /** Quem postou no canal Discord (apelido global ou @username) */
  discordPosterLabel?: string;
  /** Conta/empresa RadarZap (painel) — preenchido na fila */
  radarzapSenderLabel?: string;
  isBot: boolean;

  text: string;
  hasEmbed: boolean;
  hasLink: boolean;
  hasImage: boolean;
  links: string[];
  imageUrls: string[];
  embedTitles: string[];
  embedDescriptions: string[];

  /** Tipo de conteúdo detectado */
  captureKind?: string;
  /** Texto agregado para filtros de palavra-chave no canal */
  searchText?: string;

  embedAuthorName?: string;
  embedAuthorUrl?: string;
  embedUrl?: string;
  embedGame?: string;
  embedViewers?: string;
  embedThumbnail?: string;
  embedType?: string;

  /** Corpo formatado para WhatsApp (sem spam de URL) */
  whatsappBody?: string;
  linksSection?: string;
  fullEmbedText?: string;
  embedFieldsText?: string;
  embedStoreLabels?: string[];
  storeButtons?: Array<{ label: string; url: string }>;
  primaryLink?: string;
  attachmentFiles?: Array<{ name: string; url: string }>;

  timestamp: Date;
  hash: string;
}

/**
 * Extrai dados de mensagens Discord (texto, embeds, fields, botões, anexos) para o pipeline.
 */
export class MessageExtractor {
  private serviceLogger = createServiceLogger('MessageExtractor');

  extract(message: Message): ExtractedMessage {
    const captured = captureDiscordMessage(message);

    const extracted: ExtractedMessage = {
      messageId: message.id,
      guildId: message.guildId ?? '',
      guildName: message.guild?.name ?? '',
      channelId: message.channelId,
      channelName: (message.channel as any).name ?? '',
      authorId: message.author.id,
      authorName: message.author.username,
      discordPosterLabel:
        message.member?.displayName?.trim() ||
        message.author.globalName?.trim() ||
        message.author.username,
      authorTag: message.author.tag,
      isBot: message.author.bot,
      text: message.content,
      hasEmbed: message.embeds.length > 0,
      hasLink: captured.usefulLinks.length > 0 || captured.storeButtons.length > 0,
      hasImage: captured.imageUrls.length > 0,
      links: captured.usefulLinks,
      imageUrls: captured.imageUrls,
      embedTitles: captured.embedTitles,
      embedDescriptions: captured.embedDescriptions,
      captureKind: captured.kind,
      searchText: discordMessageSearchText(message, captured),
      whatsappBody: captured.whatsappBody,
      linksSection: captured.linksSection,
      fullEmbedText: captured.fullEmbedText,
      embedFieldsText: captured.embedFieldsText,
      embedStoreLabels: captured.embedStoreLabels,
      storeButtons: captured.storeButtons,
      primaryLink: captured.primaryLink || undefined,
      attachmentFiles: captured.attachmentFiles,
      embedAuthorName: captured.embedAuthorName,
      embedThumbnail: captured.embedThumbnail,
      embedGame: captured.embedGame,
      embedViewers: captured.embedViewers,
      embedType: captured.embedType,
      timestamp: message.createdAt,
      hash: '',
    };

    const embed = message.embeds[0];
    if (embed) {
      extracted.embedUrl = embed.url ?? undefined;
      extracted.embedAuthorUrl = embed.author?.url ?? undefined;
      if (embed.title && /[-–]\s*Twitch$/i.test(embed.title) && !extracted.embedAuthorName) {
        extracted.embedAuthorName = embed.title.replace(/\s*[-–]\s*Twitch$/i, '').trim();
      }
    }

    extracted.hash = this.generateHash(extracted);

    this.serviceLogger.debug('Message extracted', {
      messageId: extracted.messageId,
      kind: extracted.captureKind,
      isBot: extracted.isBot,
      hasEmbed: extracted.hasEmbed,
      bodyChars: extracted.whatsappBody?.length ?? 0,
      buttons: captured.storeButtons.length,
    });

    return extracted;
  }

  private generateHash(msg: ExtractedMessage): string {
    const content = [
      msg.channelId,
      msg.authorId,
      msg.whatsappBody?.slice(0, 200) ?? msg.text.trim().slice(0, 200),
      msg.embedTitles.join('|'),
    ].join(':');

    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
