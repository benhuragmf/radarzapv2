import { Message } from 'discord.js';
import crypto from 'crypto';
import { createServiceLogger } from '@/utils/logger';

export interface ExtractedMessage {
  // Origem
  messageId: string;
  guildId: string;
  guildName: string;
  channelId: string;
  channelName: string;

  // Autor
  authorId: string;
  authorName: string;
  authorTag: string;
  isBot: boolean;

  // Conteúdo
  text: string;
  hasEmbed: boolean;
  hasLink: boolean;
  hasImage: boolean;
  links: string[];
  imageUrls: string[];
  embedTitles: string[];
  embedDescriptions: string[];

  // Dados enriquecidos do embed (Twitch/YouTube/etc)
  embedAuthorName?: string;   // ex: "SkulksGamer"
  embedAuthorUrl?: string;    // ex: "https://twitch.tv/skulksgamer"
  embedGame?: string;         // campo "Game" do embed Twitch
  embedViewers?: string;      // campo "Viewers" do embed Twitch
  embedThumbnail?: string;    // thumbnail/imagem do embed
  embedType?: string;         // 'twitch' | 'youtube' | 'generic'

  // Metadados
  timestamp: Date;
  hash: string;
}

/**
 * Extrai dados relevantes de mensagens Discord para o pipeline RadarZap.
 * Suporta texto, embeds, links, imagens e mensagens de bots.
 */
export class MessageExtractor {
  private serviceLogger = createServiceLogger('MessageExtractor');

  private static readonly URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

  /**
   * Extrai todos os dados relevantes de uma mensagem Discord.
   */
  extract(message: Message): ExtractedMessage {
    const links = this.extractLinks(message.content);
    const imageUrls = this.extractImageUrls(message);
    const embedTitles = message.embeds.map(e => e.title || '').filter(Boolean);
    const embedDescriptions = message.embeds.map(e => e.description || '').filter(Boolean);

    // Adiciona links de embeds também
    for (const embed of message.embeds) {
      if (embed.url) links.push(embed.url);
      for (const field of embed.fields) {
        const fieldLinks = this.extractLinks(field.value);
        links.push(...fieldLinks);
      }
    }

    const uniqueLinks = [...new Set(links)];

    const extracted: ExtractedMessage = {
      messageId: message.id,
      guildId: message.guildId ?? '',
      guildName: message.guild?.name ?? '',
      channelId: message.channelId,
      channelName: (message.channel as any).name ?? '',
      authorId: message.author.id,
      authorName: message.author.username,
      authorTag: message.author.tag,
      isBot: message.author.bot,
      text: message.content,
      hasEmbed: message.embeds.length > 0,
      hasLink: uniqueLinks.length > 0,
      hasImage: imageUrls.length > 0,
      links: uniqueLinks,
      imageUrls,
      embedTitles,
      embedDescriptions,
      timestamp: message.createdAt,
      hash: '',
    };

    // Enrich with embed-specific data (Twitch, YouTube, etc)
    if (message.embeds.length > 0) {
      const embed = message.embeds[0];

      extracted.embedAuthorName = embed.author?.name ?? undefined;
      extracted.embedAuthorUrl  = embed.author?.url  ?? undefined;
      extracted.embedThumbnail  = embed.thumbnail?.url ?? embed.image?.url ?? imageUrls[0] ?? undefined;

      // Detect embed type from URL
      const embedUrl = embed.url ?? uniqueLinks[0] ?? '';
      if (embedUrl.includes('twitch.tv'))  extracted.embedType = 'twitch';
      else if (embedUrl.includes('youtu')) extracted.embedType = 'youtube';
      else if (embedUrl.includes('twitch') || embedUrl.includes('live')) extracted.embedType = 'live';
      else extracted.embedType = 'generic';

      // Extract structured fields (Twitch embeds have Game / Viewers fields)
      for (const field of embed.fields) {
        const key = field.name.toLowerCase().trim();
        if (key === 'game' || key === 'jogo')       extracted.embedGame    = field.value;
        if (key === 'viewers' || key === 'watching') extracted.embedViewers = field.value;
      }

      // Fallback: try to extract game from embed description (Twitch format: "Playing GameName" or "está jogando GameName")
      if (!extracted.embedGame) {
        const desc = embed.description ?? '';
        const playingMatch = desc.match(/playing\s+(.+)/i) ||
                             desc.match(/jogando\s+(.+)/i) ||
                             desc.match(/está jogando\s+(.+)/i);
        if (playingMatch) extracted.embedGame = playingMatch[1].trim();
      }

      // Fallback: extract streamer from embed title (format: "StreamerName - Twitch")
      if (!extracted.embedAuthorName && embed.title) {
        const twitchMatch = embed.title.match(/^(.+?)\s*[-–]\s*Twitch$/i);
        if (twitchMatch) extracted.embedAuthorName = twitchMatch[1].trim();
      }

      // If title is "StreamerName - Twitch", use description as the real title
      if (embed.title && /[-–]\s*Twitch$/i.test(embed.title)) {
        // The real stream title is in the description or author
        const realTitle = embed.author?.name ?? embed.description?.split('\n')[0] ?? embed.title;
        // Keep original title but also expose the clean streamer name
        if (!extracted.embedAuthorName) {
          extracted.embedAuthorName = embed.title.replace(/\s*[-–]\s*Twitch$/i, '').trim();
        }
      }
    }

    extracted.hash = this.generateHash(extracted);

    this.serviceLogger.debug('Message extracted', {
      messageId: extracted.messageId,
      channelId: extracted.channelId,
      isBot: extracted.isBot,
      hasEmbed: extracted.hasEmbed,
      hasLink: extracted.hasLink,
      hasImage: extracted.hasImage,
    });

    return extracted;
  }

  /**
   * Gera hash SHA-256 para deduplicação.
   * Baseado em: channelId + authorId + texto + primeiro link.
   */
  private generateHash(msg: ExtractedMessage): string {
    const content = [
      msg.channelId,
      msg.authorId,
      msg.text.trim(),
      msg.links[0] ?? '',
    ].join(':');

    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Extrai todos os URLs de um texto.
   */
  private extractLinks(text: string): string[] {
    if (!text) return [];
    return Array.from(text.matchAll(MessageExtractor.URL_PATTERN), m => m[0]);
  }

  /**
   * Extrai URLs de imagens de attachments e embeds.
   */
  private extractImageUrls(message: Message): string[] {
    const urls: string[] = [];

    // Attachments
    for (const attachment of message.attachments.values()) {
      if (attachment.contentType?.startsWith('image/')) {
        urls.push(attachment.url);
      }
    }

    // Embeds
    for (const embed of message.embeds) {
      if (embed.image?.url) urls.push(embed.image.url);
      if (embed.thumbnail?.url) urls.push(embed.thumbnail.url);
    }

    return [...new Set(urls)];
  }
}
