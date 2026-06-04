/**
 * Captura e formatação de mensagens Discord → texto WhatsApp.
 * Cobre: conteúdo, embeds (título, descrição, fields, footer, autor), anexos, botões e links.
 */

import type { Message } from 'discord.js';
import { ComponentType } from 'discord.js';
import {
  classifyLinksInMessage,
  classifyLinkUrl,
  isArticleEmbed,
  type LinkContentType,
} from '@/utils/link-content-classifier';

export { isTwitchUrl, isYoutubeUrl } from '@/utils/link-content-classifier';

const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`[\])]+/gi;

export type DiscordCaptureKind =
  | 'text'
  | 'plain'
  | 'embed'
  | 'embed_list'
  | 'embed_article'
  | 'live'
  | 'video'
  | 'short'
  | 'news'
  | 'promo'
  | 'alert'
  | 'log'
  | 'media'
  | 'file'
  | 'poll'
  | 'mixed';

export interface StoreButton {
  label: string;
  url: string;
}

export interface DiscordCaptureResult {
  kind: DiscordCaptureKind;
  title: string;
  /** Corpo principal (sem spam de URLs) */
  whatsappBody: string;
  /** Bloco curto de links (botões da loja + link principal) */
  linksSection: string;
  primaryLink: string;
  storeButtons: StoreButton[];
  usefulLinks: string[];
  imageUrls: string[];
  embedType?: 'twitch' | 'youtube' | 'live' | 'generic';
  embedAuthorName?: string;
  embedGame?: string;
  embedViewers?: string;
  embedThumbnail?: string;
  /** Compatibilidade com pipeline antigo */
  fullEmbedText: string;
  embedFieldsText: string;
  embedStoreLabels: string[];
  embedTitles: string[];
  embedDescriptions: string[];
  attachmentFiles: Array<{ name: string; url: string }>;
  /** Classificação do link principal: live | video | short | news */
  linkContentType?: LinkContentType;
}

function cleanUrl(url: string): string {
  return url.trim().replace(/[)\],.]+$/, '');
}

/** Texto legível a partir de URL quando o embed só traz link cru. */
function humanizeUrl(url: string): string {
  if (!isUsefulLink(url)) return '';
  try {
    const u = new URL(cleanUrl(url));
    const host = u.hostname.replace(/^www\./, '');
    const parts = u.pathname.split('/').filter(Boolean);
    if (host.includes('itch.io') && parts.length >= 1) {
      const slug = parts[parts.length - 1].replace(/\.(rss|xml)$/i, '');
      if (slug && slug !== 'devlog') {
        return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }
    }
    if (parts.length > 0) {
      const last = parts[parts.length - 1].replace(/\.(html?|php)$/i, '');
      if (last.length > 2 && !/^[\da-f-]{20,}$/i.test(last)) {
        return last.replace(/-/g, ' ').slice(0, 80);
      }
    }
    return host;
  } catch {
    return '';
  }
}

function stripFooterNoise(text: string): string {
  return text
    .split('\n')
    .filter(line => {
      const t = line.trim();
      if (!t) return false;
      if (/Total:\s*\d+/i.test(t)) return false;
      if (/Tempo:\s*\d+\s*ms/i.test(t)) return false;
      if (/^(Steam|Epic|Prime|GOG|itch)/i.test(t) && t.includes(',')) return false;
      if (/^#?live-on\s*[•·]\s*\d{1,2}:\d{2}/i.test(t)) return false;
      if (/^[#\w-]+\s*[•·]\s*\d{1,2}:\d{2}\s*$/i.test(t) && !/via radarzap/i.test(t)) {
        return false;
      }
      return true;
    })
    .join('\n');
}

function enrichUrlOnlyLines(text: string): string {
  return text
    .split('\n')
    .map(line => {
      const m = line.match(/^(\s*[-*•]\s*)(.+)$/);
      const prefix = m?.[1] ?? '';
      const content = (m?.[2] ?? line).trim();
      if (!/^https?:\/\//i.test(content)) return line.trim();
      const label = humanizeUrl(content);
      return label ? `${prefix}${label}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

/** URL útil para o usuário final (loja / jogo), não RSS nem giveaway técnico. */
export function isUsefulLink(url: string): boolean {
  const u = cleanUrl(url).toLowerCase();
  if (!/^https?:\/\//i.test(u)) return false;
  if (/\.(js|css|mjs|map|rss|xml|woff2?|ttf|ico|svg)(\?|$)/i.test(u)) return false;
  if (/\/lib\/|\/static\/|jquery|maskMoney|cdn\.discordapp\.com\/attachments/i.test(u)) return false;
  if (u.includes('devlog') || u.includes('/feed') || u.includes('.rss')) return false;
  if (u.includes('alienwarearena.com') && (u.includes('giveaway') || u.includes('/ucf/'))) return false;
  return true;
}

function linkScore(url: string): number {
  const u = url.toLowerCase();
  let s = 0;
  if (u.includes('store.steampowered.com') || u.includes('steamcommunity.com')) s += 50;
  if (u.includes('epicgames.com')) s += 50;
  if (u.includes('primegaming') || u.includes('gaming.amazon') || u.includes('luna.amazon')) s += 45;
  if (u.includes('gog.com')) s += 45;
  if (u.includes('nuuvem.com')) s += 45;
  if (u.includes('ubisoft.com')) s += 40;
  if (u.includes('microsoft.com')) s += 40;
  if (u.includes('itch.io') && !u.includes('static.itch.io')) s += 35;
  if (u.includes('eneba.com')) s += 30;
  if (u.includes('twitch.tv')) s += 25;
  if (u.includes('youtube.com') || u.includes('youtu.be')) s += 25;
  return s;
}

export function pickBestLink(candidates: string[]): string {
  const links = candidates.filter(isUsefulLink);
  if (links.length === 0) return '';
  return [...links].sort((a, b) => linkScore(b) - linkScore(a))[0];
}

/** Converte markdown Discord → WhatsApp; separa links úteis do texto. */
export function discordMarkdownToWhatsApp(raw: string): { text: string; links: string[] } {
  if (!raw?.trim()) return { text: '', links: [] };

  const collected: string[] = [];
  let s = raw;

  // [rótulo](url)
  s = s.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (_, label: string, url: string) => {
    const u = cleanUrl(url);
    if (isUsefulLink(u)) collected.push(u);
    const labelText = label.trim();
    if (labelText && !/^https?:\/\//i.test(labelText)) return labelText;
    return '';
  });

  // <url>
  s = s.replace(/<([^>\s]+)>/g, (_, url: string) => {
    const u = cleanUrl(url);
    if (isUsefulLink(u)) collected.push(u);
    return '';
  });

  // URLs soltas (remove do texto visível)
  s = s.replace(URL_PATTERN, (url: string) => {
    const u = cleanUrl(url);
    if (isUsefulLink(u)) collected.push(u);
    return '';
  });

  s = s
    .replace(/\|\|([^|]+)\|\|/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/<a?:\w+:\d+>/g, '')
    .replace(/<@!?\d+>/g, '')
    .replace(/<@&\d+>/g, '')
    .replace(/<#\d+>/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '*$1*')
    .replace(/__([^_]+)__/g, '*$1*')
    .replace(/~~([^~]+)~~/g, '~$1~')
    .replace(/(?<!_)_([^_]+)_(?!_)/g, '_$1_')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '$1');

  s = enrichUrlOnlyLines(s);

  // Normaliza bullets Discord
  s = s.replace(/^[\s]*[-*•]\s*/gm, '• ');

  const lines = s.split('\n').map(l => l.trimEnd()).filter(l => l.trim().length > 0);
  const text = lines.join('\n').trim();

  return { text, links: [...new Set(collected)] };
}

function formatFieldBlock(name: string, value: string): { block: string; links: string[]; storeLabel?: string } {
  const nameConverted = discordMarkdownToWhatsApp(name);
  const valueConverted = discordMarkdownToWhatsApp(value);
  const links = [...nameConverted.links, ...valueConverted.links];

  const storeLabel = nameConverted.text.replace(/\s*\(\d+\s*jogos?\)\s*/i, '').trim();
  const parts: string[] = [];

  if (nameConverted.text) parts.push(`*${nameConverted.text}*`);
  if (valueConverted.text) parts.push(enrichUrlOnlyLines(valueConverted.text));

  return {
    block: parts.join('\n'),
    links,
    storeLabel: storeLabel || undefined,
  };
}

/** Texto completo para filtros de palavra-chave (conteúdo + embeds). */
export function discordMessageSearchText(message: Message, captured?: DiscordCaptureResult): string {
  const parts: string[] = [message.content ?? ''];
  for (const e of message.embeds) {
    if (e.title) parts.push(e.title);
    if (e.description) parts.push(e.description);
    for (const f of e.fields) {
      parts.push(f.name, f.value);
    }
    if (e.footer?.text) parts.push(e.footer.text);
  }
  if (captured?.whatsappBody) parts.push(captured.whatsappBody);
  return parts.join('\n').toLowerCase();
}

function detectPromo(titles: string[], descriptions: string[], fieldValues: string[]): boolean {
  const blob = [...titles, ...descriptions, ...fieldValues].join(' ').toLowerCase();
  if (/jogos?\s+gratuit|free\s+games?\s+dispon|gratuitos\s+dispon/i.test(blob)) return false;
  return /\d+\s*%\s*(?:off|desconto)?|r\$\s*[\d,.]+|\bdesconto\b|\bpromo[cç][aã]o\b|\bon\s+sale\b|~~.+~~/i.test(
    blob
  );
}

function detectAlert(titles: string[], descriptions: string[], content: string): boolean {
  const blob = [...titles, descriptions, content].join(' ');
  return /🚨|\balerta\b|\burgente\b|\baten[cç][aã]o\b|\baviso\b/i.test(blob);
}

function detectLog(channelName: string, isBot: boolean, content: string, titles: string[]): boolean {
  const ch = channelName.toLowerCase();
  if (/log|audit|mod-?log|registro/.test(ch)) return true;
  if (isBot && /```|\[error\]|\[info\]|status:/i.test(content + titles.join(' '))) return true;
  return false;
}

function isLiveAnnouncement(
  content: string,
  embedTitles: string[],
  embedUrl: string
): boolean {
  const blob = `${embedTitles.join(' ')} ${content} ${embedUrl}`.toLowerCase();
  const normalized = blob.replace(/#?live-on|live_on/gi, ' ');
  if (/ao\s+vivo|está\s+ao\s+vivo|live\s+now|🔴\s*live/i.test(normalized)) return true;
  return false;
}

function twitchSlugFromUrls(...urls: string[]): string {
  for (const raw of urls) {
    const m = cleanUrl(raw).match(/twitch\.tv\/([^/?]+)/i);
    if (m?.[1] && !['videos', 'directory', 'search'].includes(m[1].toLowerCase())) {
      return m[1].toLowerCase();
    }
  }
  return '';
}

export function sanitizeDiscordForWhatsApp(text: string): string {
  return text
    .replace(/@everyone/gi, '@todos')
    .replace(/@here/gi, '@online')
    .replace(/<@!?\d+>/g, '')
    .replace(/<@&\d+>/g, '')
    .replace(/<#\d+>/g, '')
    .trim();
}

function detectEmbedType(url: string): 'twitch' | 'youtube' | 'live' | 'generic' {
  const u = url.toLowerCase();
  if (u.includes('twitch.tv')) return 'twitch';
  if (u.includes('youtu')) return 'youtube';
  if (u.includes('live')) return 'live';
  return 'generic';
}

export function extractStoreButtons(message: Message): StoreButton[] {
  const buttons: StoreButton[] = [];
  for (const row of message.components) {
    if (!('components' in row) || !Array.isArray(row.components)) continue;
    for (const comp of row.components) {
      if (comp.type !== ComponentType.Button) continue;
      const btn = comp as { label?: string | null; url?: string | null };
      if (!btn.url) continue;
      const url = cleanUrl(btn.url);
      if (isUsefulLink(url) || linkScore(url) > 0) {
        buttons.push({ label: (btn.label ?? 'Abrir').trim(), url });
      }
    }
  }
  return buttons;
}

function buildLinksSection(buttons: StoreButton[], primaryLink: string, extraLinks: string[]): string {
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const b of buttons.slice(0, 8)) {
    if (seen.has(b.url)) continue;
    seen.add(b.url);
    lines.push(`🔗 *${b.label}:*\n${b.url}`);
  }

  const best = primaryLink || pickBestLink(extraLinks);
  if (best && !seen.has(best)) {
    lines.push(`🔗 ${best}`);
  }

  return lines.join('\n\n');
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 20).trim()}\n\n_(…continua no Discord)_`;
}

/** Captura completa de uma mensagem Discord para envio ao WhatsApp. */
export function captureDiscordMessage(message: Message): DiscordCaptureResult {
  const bodyParts: string[] = [];
  const allLinks: string[] = [];
  const storeLabels: string[] = [];
  const embedTitles: string[] = [];
  const embedDescriptions: string[] = [];
  const imageUrls: string[] = [];
  const attachmentFiles: Array<{ name: string; url: string }> = [];
  const fieldValues: string[] = [];
  let hasPoll = false;

  if (message.content?.trim()) {
    const c = discordMarkdownToWhatsApp(message.content);
    const clean = sanitizeDiscordForWhatsApp(c.text);
    if (clean) bodyParts.push(clean);
    allLinks.push(...c.links);
  }

  for (const attachment of message.attachments.values()) {
    if (attachment.contentType?.startsWith('image/')) {
      imageUrls.push(attachment.url);
    } else if (attachment.url) {
      const name = attachment.name ?? 'arquivo';
      attachmentFiles.push({ name, url: attachment.url });
      bodyParts.push(`📎 ${name}`);
    }
  }

  let embedAuthorName: string | undefined;
  let embedGame: string | undefined;
  let embedViewers: string | undefined;
  let embedThumbnail: string | undefined;
  let embedType: DiscordCaptureResult['embedType'] = 'generic';
  let hasFields = false;
  const fieldBlocks: string[] = [];
  let firstEmbedProvider: string | undefined;
  let firstEmbedTypeRaw: string | undefined;

  for (const embed of message.embeds) {
    if (!firstEmbedProvider && embed.provider?.name) {
      firstEmbedProvider = embed.provider.name;
    }
    if (embed.title?.trim()) {
      embedTitles.push(embed.title.trim());
      const t = discordMarkdownToWhatsApp(embed.title);
      if (t.text) bodyParts.push(`*${t.text}*`);
      allLinks.push(...t.links);
    }

    const embedTypeRaw = (embed as { type?: string }).type;
    if (!firstEmbedTypeRaw && embedTypeRaw) firstEmbedTypeRaw = embedTypeRaw;
    if (embedTypeRaw === 'poll_result') {
      hasPoll = true;
      if (embed.description) bodyParts.push(`📊 ${embed.description}`);
    }

    if (embed.description?.trim()) {
      embedDescriptions.push(embed.description.trim());
      const d = discordMarkdownToWhatsApp(embed.description);
      if (d.text) bodyParts.push(d.text);
      allLinks.push(...d.links);
    }

    if (embed.url) allLinks.push(cleanUrl(embed.url));
    if (embed.author?.name) embedAuthorName = embed.author.name;
    if (embed.author?.url) allLinks.push(cleanUrl(embed.author.url));
    if (embed.thumbnail?.url) embedThumbnail = embed.thumbnail.url;
    if (embed.image?.url) {
      imageUrls.push(embed.image.url);
      if (!embedThumbnail) embedThumbnail = embed.image.url;
    }

    if (embed.footer?.text) {
      const f = discordMarkdownToWhatsApp(embed.footer.text);
      if (f.text) bodyParts.push(`_${f.text}_`);
    }

    for (const field of embed.fields) {
      hasFields = true;
      fieldValues.push(field.value);
      const fb = formatFieldBlock(field.name, field.value);
      if (fb.block) {
        bodyParts.push(fb.block);
        fieldBlocks.push(fb.block);
      }
      allLinks.push(...fb.links);
      if (fb.storeLabel) storeLabels.push(fb.storeLabel);

      const key = field.name.toLowerCase().trim();
      if (key === 'game' || key === 'jogo') embedGame = field.value;
      if (key === 'viewers' || key === 'watching') embedViewers = field.value;
    }
  }

  const storeButtons = extractStoreButtons(message);
  for (const b of storeButtons) allLinks.push(b.url);

  const usefulLinks = [...new Set(allLinks.filter(isUsefulLink))];
  const primaryLink = pickBestLink([...storeButtons.map(b => b.url), ...usefulLinks]);

  const embedUrl = message.embeds[0]?.url ?? primaryLink ?? '';
  if (embedUrl) embedType = detectEmbedType(embedUrl);

  if (!embedGame && message.embeds[0]?.description) {
    const desc = message.embeds[0].description;
    const m =
      desc.match(/playing\s+(.+)/i) ||
      desc.match(/jogando\s+(.+)/i) ||
      desc.match(/está jogando\s+(.+)/i);
    if (m) embedGame = m[1].trim();
  }

  const dedupedBody = stripFooterNoise(
    bodyParts
      .filter((p, i, arr) => {
        const norm = p.trim();
        return norm && arr.indexOf(p) === i;
      })
      .join('\n\n')
      .trim()
  );

  const embedFieldsText = stripFooterNoise(fieldBlocks.join('\n\n').trim()) || dedupedBody;

  const channelName = (message.channel as { name?: string } | null)?.name ?? '';
  const contentRaw = message.content ?? '';
  const mediaUrls = [embedUrl, primaryLink, ...usefulLinks].filter(Boolean);

  const textBlob = `${contentRaw} ${embedTitles.join(' ')} ${embedDescriptions.join(' ')}`;
  const linkClass = classifyLinksInMessage(mediaUrls, textBlob);
  let linkContentType: LinkContentType = linkClass.linkType;

  let kind: DiscordCaptureKind = 'text';
  if (hasPoll) kind = 'poll';
  else if (linkClass.captureKind) kind = linkClass.captureKind;
  else if (isLiveAnnouncement(contentRaw, embedTitles, embedUrl)) kind = 'live';
  else if (
    message.embeds.length > 0 &&
    isArticleEmbed({
      embedUrl,
      providerName: firstEmbedProvider,
      embedTypeRaw: firstEmbedTypeRaw,
      titles: embedTitles,
      descriptions: embedDescriptions,
    })
  ) {
    kind = 'news';
    linkContentType = 'news';
  } else if (detectLog(channelName, message.author.bot, message.content ?? '', embedTitles)) kind = 'log';
  else if (detectAlert(embedTitles, embedDescriptions, message.content ?? '')) kind = 'alert';
  else if (detectPromo(embedTitles, embedDescriptions, fieldValues)) kind = 'promo';
  else if (hasFields) kind = 'embed_list';
  else if (attachmentFiles.length > 0 && imageUrls.length === 0 && !dedupedBody) kind = 'file';
  else if (message.embeds.length > 0) kind = 'embed';
  else if (imageUrls.length > 0 && !dedupedBody) kind = 'media';
  else if (message.content && (message.embeds.length > 0 || attachmentFiles.length > 0))
    kind = 'mixed';
  else if (!message.content?.trim() && !message.embeds.length) kind = 'text';

  const twitchSlug = twitchSlugFromUrls(embedUrl, primaryLink, ...usefulLinks, contentRaw);
  if (twitchSlug && !embedAuthorName) embedAuthorName = twitchSlug;

  const linkForKind = primaryLink || embedUrl || usefulLinks[0] || '';
  const urlKind = linkForKind ? classifyLinkUrl(linkForKind) : 'unknown';
  if (
    urlKind === 'live' &&
    ['text', 'plain', 'embed', 'mixed'].includes(kind)
  ) {
    kind = 'live';
    linkContentType = 'live';
  } else if (
    (urlKind === 'video' || urlKind === 'short') &&
    ['text', 'plain', 'embed', 'mixed'].includes(kind)
  ) {
    kind = urlKind;
    linkContentType = urlKind;
  }

  const whatsappBody = truncate(dedupedBody, 3800);
  const linksSection = buildLinksSection(storeButtons, primaryLink, usefulLinks);

  const title =
    embedTitles[0] ||
    message.content?.split('\n').find(l => l.trim())?.slice(0, 120) ||
    message.author.username;

  return {
    kind,
    title,
    whatsappBody,
    linksSection,
    primaryLink,
    storeButtons,
    usefulLinks,
    imageUrls: [...new Set(imageUrls)],
    embedType,
    embedAuthorName,
    embedGame,
    embedViewers,
    embedThumbnail,
    fullEmbedText: whatsappBody,
    embedFieldsText,
    embedStoreLabels: storeLabels,
    embedTitles,
    embedDescriptions,
    attachmentFiles,
    linkContentType,
  };
}
