import crypto from 'crypto';
import type { Message } from 'discord.js';
import type { ExtractedMessage } from '@/services/discord-bot/MessageExtractor';
import { WHATSAPP_LIMITS } from '@/config/limits';
import { renderCatalogTemplate } from '@/constants/discord-whatsapp-templates';
import { contentSourceMessage } from '@/utils/discord-forward';
import { buildDiscordWhatsAppVariables } from '@/utils/discord-wa-variables';

const URL_IN_TEXT = /https?:\/\/[^\s<>"{}|\\^`[\])]+/gi;

export function isLiveOnChannel(channelName?: string): boolean {
  return /live-on|live_on/i.test(channelName ?? '');
}

const STREAM_HOST = /twitch\.tv|youtube\.com|youtu\.be/i;

/** Discord monta o embed alguns ms depois do MessageCreate — espera antes de capturar. */
export async function waitForStreamEmbed(message: Message, ms = 2800): Promise<Message> {
  const source = contentSourceMessage(message);
  const content = `${message.content ?? ''} ${source.content ?? ''}`;
  const hasEmbed = message.embeds.length > 0 || source.embeds.length > 0;
  if (!STREAM_HOST.test(content) || hasEmbed) return message;
  await new Promise(r => setTimeout(r, ms));
  try {
    return await message.fetch();
  } catch {
    return message;
  }
}

const STREAM_PATH_BLOCKLIST = new Set([
  'videos',
  'directory',
  'search',
  'clips',
  'watch',
  'live',
  'video',
  'shorts',
  'embed',
  'c',
  'channel',
  'user',
]);

/** Handle @user de TikTok, Twitch, Kick ou @canal do YouTube a partir da URL. */
export function extractCreatorSlugFromUrl(url: string): string {
  const clean = url.trim().replace(/[)\],.]+$/, '');
  if (!clean) return '';

  const tiktok = clean.match(/tiktok\.com\/@([^/?&#]+)/i);
  if (tiktok) return tiktok[1].toLowerCase();

  const youtube = clean.match(/youtube\.com\/@([^/?&#]+)/i);
  if (youtube) return youtube[1].toLowerCase();

  const kick = clean.match(/kick\.com\/([^/?&#]+)/i);
  if (kick) {
    const slug = kick[1].toLowerCase();
    if (!STREAM_PATH_BLOCKLIST.has(slug)) return slug;
  }

  const twitch = clean.match(/twitch\.tv\/([^/?&#]+)/i);
  if (twitch) {
    const slug = twitch[1].toLowerCase();
    if (!STREAM_PATH_BLOCKLIST.has(slug)) return slug;
  }

  return '';
}

export function platformLabelFromLink(link: string): string {
  if (/twitch\.tv/i.test(link)) return 'Twitch';
  if (/youtube\.com|youtu\.be/i.test(link)) return 'YouTube';
  if (/tiktok\.com/i.test(link)) return 'TikTok';
  if (/kick\.com/i.test(link)) return 'Kick';
  return 'Live';
}

/** Nome do streamer/creator: prioriza handle da URL, não o autor Discord. */
export function resolveStreamerIdentity(
  extracted: ExtractedMessage,
  primaryLink?: string
): string {
  const link = primaryLink ?? collectPrimaryLink(extracted);
  const fromLink = extractCreatorSlugFromUrl(link);
  if (fromLink) return fromLink;

  const raw = (extracted.embedAuthorName || '').trim().toLowerCase().replace(/\s+/g, '');
  if (raw && /^[a-z0-9_@]{2,}$/i.test(raw)) return raw.replace(/^@/, '');

  for (const title of extracted.embedTitles ?? []) {
    const m = title.match(/^([a-zA-Z0-9_]{2,})\s*[-–]\s*Twitch/i);
    if (m) return m[1].toLowerCase();
  }

  const isStreamUrl = /twitch\.tv|tiktok\.com|youtube\.com|youtu\.be|kick\.com/i.test(link);
  if (!isStreamUrl) {
    return (extracted.authorName || '').trim().toLowerCase().replace(/\s+/g, '');
  }

  return '';
}

export function extractStreamSlug(extracted: ExtractedMessage): string {
  const link = collectPrimaryLink(extracted);
  return resolveStreamerIdentity(extracted, link);
}

/** Remetente no rodapé: tenant Radar Chat (org/conta do painel), definido na fila. */
export function resolveSenderLabel(extracted: ExtractedMessage): string {
  const label = extracted.radarchatSenderLabel?.trim();
  if (label) return label.replace(/\s+/g, ' ');
  return 'radarchat';
}

/** @usuario que postou no canal Discord (ex.: @'Skulks). */
export function formatDiscordPoster(extracted: ExtractedMessage): string {
  const name =
    extracted.discordPosterLabel?.trim() || extracted.authorName?.trim() || '';
  if (!name) return '';
  return name.startsWith('@') ? name : `@${name}`;
}

/** Trecho @poster > #canal do rodapé. */
export function formatCanalRota(extracted: ExtractedMessage): string {
  const canal = extracted.channelName
    ? `#${extracted.channelName.replace(/^#/, '')}`
    : '#canal';
  const poster = formatDiscordPoster(extracted);
  return poster ? `${poster} > ${canal}` : canal;
}

/** Ignora o 1º post do webhook (só texto+URL) antes do embed completo. */
export function shouldSkipBotWebhookPreamble(opts: {
  isBot: boolean;
  hasEmbed: boolean;
  content: string;
}): boolean {
  if (!opts.isBot || opts.hasEmbed) return false;
  const content = opts.content?.trim() ?? '';
  if (!content || !/https?:\/\//i.test(content)) return false;

  if (/youtube\.com|youtu\.be|twitch\.tv/i.test(content)) return true;
  if (
    /postou um vídeo|publicou um vídeo|uploaded a video|new video|novo vídeo/i.test(content)
  ) {
    return true;
  }
  if (/está ao vivo|is now live|went live|started streaming|ao vivo!/i.test(content)) {
    return true;
  }
  return false;
}

/**
 * No #live-on, bots mandam 2 posts (link/canal + card live).
 * Só processa captureKind live, video ou short (ignora preamble texto/embed).
 */
export function shouldSkipNonPrimaryLivePost(extracted: ExtractedMessage): boolean {
  if (!extracted.isBot || !isLiveOnChannel(extracted.channelName)) return false;

  const link = collectPrimaryLink(extracted);
  if (!/twitch\.tv|youtube\.com|youtu\.be/i.test(link)) return false;

  const kind = extracted.captureKind ?? '';
  if (kind === 'live' || kind === 'video' || kind === 'short') return false;

  return true;
}

function normalizeMediaUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    return `${u.hostname}${u.pathname}`;
  } catch {
    return url.split('?')[0] ?? url;
  }
}

/** Slug do canal Twitch a partir de autor, título "nome - Twitch" ou URL. */
export function inferTwitchSlug(extracted: ExtractedMessage): string {
  const fromAuthor = (extracted.embedAuthorName || '').trim().toLowerCase().replace(/\s+/g, '');
  if (fromAuthor && /^[a-z0-9_]{2,}$/i.test(fromAuthor)) return fromAuthor;

  for (const title of extracted.embedTitles ?? []) {
    const m = title.match(/^([a-zA-Z0-9_]{2,})\s*[-–]\s*Twitch/i);
    if (m) return m[1].toLowerCase();
  }

  const blob = [
    extracted.primaryLink,
    extracted.embedUrl,
    extracted.embedAuthorUrl,
    extracted.text,
    ...(extracted.links ?? []),
  ]
    .filter(Boolean)
    .join(' ');
  const fromUrl = blob.match(/twitch\.tv\/([a-zA-Z0-9_]{2,})/i)?.[1];
  return fromUrl?.toLowerCase() ?? '';
}

function inferStreamLink(extracted: ExtractedMessage): string {
  const slug = inferTwitchSlug(extracted);
  if (!slug) return '';

  const twitchContext =
    extracted.embedType === 'twitch' ||
    extracted.captureKind === 'live' ||
    /twitch/i.test(extracted.embedTitles?.join(' ') ?? '') ||
    /twitch\.tv/i.test(extracted.primaryLink ?? '') ||
    isLiveOnChannel(extracted.channelName);

  if (twitchContext) return `https://www.twitch.tv/${slug}`;
  return '';
}

export function buildContentFingerprint(
  channelId: string,
  extracted: ExtractedMessage
): string {
  const slug = extractStreamSlug(extracted);
  const link = collectPrimaryLink(extracted);
  if (
    slug &&
    extracted.isBot &&
    (/twitch\.tv|tiktok\.com|youtube\.com|kick\.com/i.test(link) ||
      isLiveOnChannel(extracted.channelName))
  ) {
    const norm = `${channelId}|stream|${slug}`;
    return crypto.createHash('sha256').update(norm).digest('hex').slice(0, 24);
  }

  const thumb = extracted.embedThumbnail || extracted.imageUrls?.[0] || '';
  const kind = extracted.captureKind ?? '';

  if (thumb && /^(live|video|embed|mixed)$/.test(kind)) {
    const norm = `${channelId}|${normalizeMediaUrl(thumb)}`;
    return crypto.createHash('sha256').update(norm).digest('hex').slice(0, 24);
  }

  const title =
    extracted.embedTitles?.[0] ||
    (extracted.text ?? '').replace(URL_IN_TEXT, '').trim().slice(0, 120) ||
    '';
  const norm = `${channelId}|${link}|${title.toLowerCase().trim()}`;
  return crypto.createHash('sha256').update(norm).digest('hex').slice(0, 24);
}

/**
 * Rodapé: {empresa/conta painel} via radarchat • @{quem postou} > #canal • servidor • data hora
 * Ex.: SoContabilida via radarchat • @'Skulks > #live-on • SK2 Staff • 04/06/2026 12:12
 */
export function buildRodape(
  extracted: ExtractedMessage,
  data: string,
  hora: string,
  senderOverride?: string
): string {
  const tenant = (senderOverride || resolveSenderLabel(extracted)).trim() || 'radarchat';
  const rota = formatCanalRota(extracted);
  const servidor = extracted.guildName?.trim() || 'Discord';

  return `${tenant} via radarchat • ${rota} • ${servidor} • ${data} ${hora}`;
}

export function collectPrimaryLink(extracted: ExtractedMessage): string {
  const blob = [
    extracted.text,
    extracted.embedDescriptions?.join('\n'),
    extracted.embedTitles?.join('\n'),
    extracted.fullEmbedText,
    extracted.whatsappBody,
    extracted.linksSection,
  ]
    .filter(Boolean)
    .join('\n');

  const fromBlob = blob.match(URL_IN_TEXT) ?? [];
  const candidates = [
    extracted.primaryLink,
    extracted.embedUrl,
    extracted.embedAuthorUrl,
    ...fromBlob,
    ...(extracted.links ?? []),
    inferStreamLink(extracted),
  ].filter((u): u is string => Boolean(u?.trim()));

  const seen = new Set<string>();
  for (const u of candidates) {
    const clean = u.replace(/[)\],.]+$/, '');
    if (!/^https?:\/\//i.test(clean) || seen.has(clean)) continue;
    seen.add(clean);
    if (/twitch\.tv|youtube\.com|youtu\.be/i.test(clean)) return clean;
  }
  for (const u of candidates) {
    const clean = u.replace(/[)\],.]+$/, '');
    if (/^https?:\/\//i.test(clean)) return clean;
  }
  return '';
}

export function formatLinkBlock(link: string): string {
  const u = link?.trim();
  return u ? `🔗 ${u}` : '';
}

/** Remove rodapés antigos do painel (ex.: _live-on • 02:48_). */
function stripLegacyFooters(text: string): string {
  return text
    .replace(/\n_*[^\n]*(?:live-on|#\w+)[^\n]*\d{1,2}:\d{2}[^\n]*_\s*$/gi, '')
    .replace(/\n_*[^\n]*•\s*\d{1,2}:\d{2}\s*_\s*$/g, '')
    .replace(/\n_*[\s—–-]*_\s*$/g, '')
    .trim();
}

/** Limpa linhas vazias, emojis órfãos e garante link + rodapé padrão. */
export function applyStandardWhatsAppLayout(
  text: string,
  rodape: string,
  link: string
): string {
  let out = stripLegacyFooters(text)
    .replace(/^🔗\s*$/gm, '')
    .replace(/^🎮\s*$/gm, '')
    .replace(/^👀\s*$/gm, '')
    .replace(/^📺\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const linkTrim = link?.trim();
  if (linkTrim && !out.includes(linkTrim)) {
    out = `${out}\n\n${formatLinkBlock(linkTrim)}`.trim();
  }

  const rodapeTrim = rodape?.trim();
  if (rodapeTrim && !out.includes(rodapeTrim)) {
    out = `${out}\n\n_${rodapeTrim}_`.trim();
  }

  return out;
}

export function finalizeWhatsAppText(text: string, link: string): string {
  return applyStandardWhatsAppLayout(text, '', link);
}

/** Re-monta texto no envio (template do catálogo + link/rodapé atuais). */
export function buildFinalWhatsAppBody(
  resolvedTemplate: string,
  extracted: ExtractedMessage,
  fallbackText?: string
): string {
  const { variables } = buildDiscordWhatsAppVariables(extracted);
  const fromCatalog =
    resolvedTemplate.startsWith('dw-') || resolvedTemplate.startsWith('radarchat-')
      ? renderCatalogTemplate(resolvedTemplate, variables as Record<string, string>)
      : null;

  const base = (fromCatalog || fallbackText || '').trim();
  const link = collectPrimaryLink(extracted) || variables.link_principal || '';
  const rodape = variables.rodape || buildRodape(
    extracted,
    variables.data,
    variables.hora
  );

  return applyStandardWhatsAppLayout(base, rodape, link);
}

/** Legenda longa: encurta o corpo mas mantém link + rodapé na mesma legenda quando possível. */
export function splitImageCaption(fullText: string): { caption: string; followUp: string } {
  const max = WHATSAPP_LIMITS.MAX_IMAGE_CAPTION_LENGTH;
  const trimmed = fullText.trim();
  if (trimmed.length <= max) {
    return { caption: trimmed, followUp: '' };
  }

  const lines = trimmed.split('\n');
  const tail: string[] = [];
  while (lines.length > 0) {
    const line = lines[lines.length - 1]?.trim() ?? '';
    if (
      /^🔗\s*https?:\/\//i.test(line) ||
      /via radarchat/i.test(line) ||
      /^_.*_$/.test(line)
    ) {
      tail.unshift(lines.pop()!);
    } else {
      break;
    }
  }

  const tailText = tail.join('\n').trim();
  const tailBlock = tailText ? `\n\n${tailText}` : '';
  const tailLen = tailBlock.length;
  const bodyMax = Math.max(120, max - tailLen - 4);
  let body = lines.join('\n').trim();
  if (body.length > bodyMax) {
    body = `${body.slice(0, bodyMax - 1).trim()}…`;
  }

  const combined = `${body}${tailBlock}`.trim();
  if (combined.length <= max) {
    return { caption: combined, followUp: '' };
  }

  const caption = body.length > max ? `${body.slice(0, max - 1)}…` : body;
  return { caption, followUp: tailText };
}
