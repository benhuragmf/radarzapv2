import { classifyLinkUrl, type LinkContentType } from '@/utils/link-content-classifier';
import type { ExtractedMessage } from '@/services/discord-bot/MessageExtractor';
import {
  collectPrimaryLink,
  inferTwitchSlug,
  isLiveOnChannel,
} from '@/utils/discord-wa-format';
import {
  LEGACY_TEMPLATE_ALIASES,
  resolveTemplateForCapture,
} from '@/constants/discord-whatsapp-templates';

const STREAM_HOST = /twitch\.tv|youtube\.com|youtu\.be|tiktok\.com|kick\.com/i;
const URL_IN_TEXT = /https?:\/\/[^\s<>"{}|\\^`[\])]+/i;

const PADRAO_LIKE = new Set([
  'dw-padrao',
  'dw-texto',
  'dw-embed',
  'dw-misto',
  'radarzap-padrao',
  'radarzap-simples',
  'radarzap-com-embed',
  'custom-message',
]);

const FIXED_LIVE_RULES = new Set(['dw-live', 'radarzap-live']);

function templateForLinkKind(linkKind: LinkContentType): string | null {
  if (linkKind === 'live') return 'dw-live';
  if (linkKind === 'video') return 'dw-video';
  if (linkKind === 'short') return 'dw-short';
  return null;
}

export function streamLinkFromExtracted(extracted: ExtractedMessage): string {
  const direct =
    collectPrimaryLink(extracted) ||
    extracted.primaryLink ||
    (extracted.text?.match(URL_IN_TEXT)?.[0] ?? '').replace(/[)\],.]+$/, '');

  if (direct) {
    const kind = classifyLinkUrl(direct);
    if (kind === 'video' || kind === 'short' || kind === 'news') return direct;
    if (STREAM_HOST.test(direct)) return direct;
  }

  const slug = inferTwitchSlug(extracted);
  const canInferTwitchLive =
    slug &&
    extracted.captureKind === 'live' &&
    !direct?.match(/youtube|youtu\.be|tiktok|kick/i);

  if (canInferTwitchLive) {
    return `https://www.twitch.tv/${slug}`;
  }

  if (slug && isLiveOnChannel(extracted.channelName) && !direct) {
    return `https://www.twitch.tv/${slug}`;
  }

  return direct || '';
}

/** Roteia pelo link/captureKind — #live-on sozinho não vira dw-live. */
export function coerceStreamTemplate(
  resolved: string,
  link: string,
  captureKind?: string,
  _channelName?: string
): string {
  if (captureKind === 'embed_list') return resolved;

  const lk = link ? classifyLinkUrl(link) : 'unknown';
  const fromUrl = templateForLinkKind(lk);
  const streamRule = PADRAO_LIKE.has(resolved) || resolved === 'dw-auto' || FIXED_LIVE_RULES.has(resolved);

  if (fromUrl && streamRule) return fromUrl;

  if (captureKind === 'video') return 'dw-video';
  if (captureKind === 'short') return 'dw-short';
  if (captureKind === 'live' && lk !== 'video' && lk !== 'short') return 'dw-live';

  return resolved;
}

export function resolveStreamTemplate(
  ruleTemplate: string,
  captureKind: string,
  extracted: ExtractedMessage
): { template: string; link: string; linkKind: string } {
  const link = streamLinkFromExtracted(extracted);
  const base = resolveTemplateForCapture(ruleTemplate, captureKind, {
    channelName: extracted.channelName,
    hasTwitchOrYoutubeLink: Boolean(link && classifyLinkUrl(link) !== 'unknown'),
    primaryLink: link,
  });
  const template = coerceStreamTemplate(base, link, captureKind, extracted.channelName);
  const linkKind = link ? classifyLinkUrl(link) : 'unknown';
  return { template, link, linkKind };
}

/** Template final no envio — link (vídeo/short) manda; canal #live-on não força live. */
export function resolveOutboundTemplate(
  extracted: ExtractedMessage,
  options: {
    text?: string;
    streamLink?: string;
    resolvedTemplate?: string;
    fallbackTemplate?: string;
  } = {}
): string {
  const text = options.text ?? '';
  const link = (
    options.streamLink ||
    streamLinkFromExtracted(extracted) ||
    collectPrimaryLink(extracted) ||
    ''
  ).trim();
  const linkKind = link ? classifyLinkUrl(link) : 'unknown';

  const fromLink = templateForLinkKind(linkKind);
  if (fromLink) return fromLink;

  if (extracted.captureKind === 'video') return 'dw-video';
  if (extracted.captureKind === 'short') return 'dw-short';
  if (extracted.captureKind === 'live') return 'dw-live';

  const resolved = options.resolvedTemplate || options.fallbackTemplate || '';
  if (resolved.startsWith('dw-') || resolved.startsWith('radarzap-')) {
    return LEGACY_TEMPLATE_ALIASES[resolved] ?? resolved;
  }

  if (isWeakStreamOutbound(text, link) && linkKind === 'live') {
    return 'dw-live';
  }

  return options.fallbackTemplate || options.resolvedTemplate || 'dw-padrao';
}

/** Só remonta como dw-live quando o conteúdo é live de verdade. */
export function shouldUseLiveTemplate(
  extracted: ExtractedMessage,
  text: string,
  streamLink: string,
  resolvedTemplate?: string
): boolean {
  return resolveOutboundTemplate(extracted, { text, streamLink, resolvedTemplate }) === 'dw-live';
}

export function normalizeStreamTitulo(
  titulo: string,
  streamer: string,
  link: string
): string {
  const t = titulo.trim();
  if (/^https?:\/\//i.test(t)) {
    if (streamer) return `${streamer} - Twitch`;
    const slug = link.match(/twitch\.tv\/([^/?]+)/i)?.[1];
    return slug ? `${slug} - Twitch` : t;
  }
  if (!t && streamer) return `${streamer} - Twitch`;
  return t;
}

export function previewOutbound(text: string, max = 140): string {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length <= max ? one : `${one.slice(0, max - 1)}…`;
}

/** Corpo parece dw-padrao quebrado (📢 sem live completo). */
export function isWeakStreamOutbound(text: string, link: string): boolean {
  if (/🔴\s*\*/.test(text) && /via radarzap/i.test(text) && text.includes('🔗')) {
    return false;
  }
  if (/^▶️|^📱/.test(text.trim())) return false;
  if (/^📢\s*\*?https?:\/\//i.test(text)) return true;
  if (/^📢\s/m.test(text) && !/via radarzap/i.test(text)) return true;
  const linkKind = link ? classifyLinkUrl(link) : 'unknown';
  if (link && linkKind === 'live' && !/🔴/.test(text) && !/via radarzap/i.test(text)) {
    return true;
  }
  return false;
}
