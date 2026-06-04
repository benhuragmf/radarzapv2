/**
 * Classifica URLs e posts Discord: live, vídeo, Shorts, notícia.
 */

function cleanUrl(url: string): string {
  return url.trim().replace(/[)\],.]+$/, '');
}

export type LinkContentType = 'live' | 'video' | 'short' | 'news' | 'unknown';

export type CaptureContentKind = 'live' | 'video' | 'short' | 'news';

const NEWS_HOST_HINTS = [
  'globo.com',
  'g1.globo',
  'uol.com',
  'folha.uol',
  'estadao.com',
  'bbc.co',
  'bbc.com',
  'cnn.com',
  'reuters.com',
  'ign.com',
  'eurogamer',
  'kotaku.com',
  'adrenaline.com',
  'techtudo',
  'tecmundo',
  'theverge.com',
  'polygon.com',
  'gamespot.com',
  'gamevicio',
  'omelete',
  'dexerto',
  'maisgeek',
  'voxel',
  'flowgames',
  'criticalhits',
  'playstation.blog',
  'xbox.com',
  'nintendolife',
  'steamdeckhq',
];

const NEWS_PATH_HINTS =
  /\/(noticia|noticias|news|article|artigo|materia|post|story|amp)\//i;

function normalizeUrl(url: string): string {
  try {
    return new URL(cleanUrl(url)).href.toLowerCase();
  } catch {
    return cleanUrl(url).toLowerCase();
  }
}

export function isTwitchUrl(url: string): boolean {
  return /twitch\.tv/i.test(url ?? '');
}

export function isYoutubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/i.test(url ?? '');
}

export function isNewsUrl(url: string): boolean {
  const u = normalizeUrl(url);
  if (!/^https?:\/\//i.test(u)) return false;
  if (isTwitchUrl(u) || isYoutubeUrl(u)) return false;
  if (/discord\.com|discordapp\.com|cdn\.discordapp/i.test(u)) return false;
  if (NEWS_PATH_HINTS.test(u)) return true;
  if (/\/forums?\//i.test(u) || /\/topic\//i.test(u)) return true;
  return NEWS_HOST_HINTS.some(h => u.includes(h));
}

/** Classifica uma URL isolada. */
export function classifyLinkUrl(url: string): LinkContentType {
  const u = normalizeUrl(url);
  if (!u || !/^https?:\/\//i.test(u)) return 'unknown';

  if (isTwitchUrl(u)) {
    if (/\/videos\/\d+/i.test(u)) return 'video';
    if (/\/clip\//i.test(u) || /clips\.twitch\./i.test(u)) return 'short';
    return 'live';
  }

  if (isYoutubeUrl(u)) {
    if (/\/shorts\//i.test(u)) return 'short';
    if (/\/live\b|youtube\.com\/live/i.test(u)) return 'live';
    if (/[?&]live(?:=|_)/i.test(u)) return 'live';
    if (/youtu\.be\//i.test(u) && !/\/shorts\//i.test(u)) {
      return 'video';
    }
    if (/youtube\.com\/watch|youtube\.com\/v\//i.test(u)) return 'video';
    return 'video';
  }

  if (/tiktok\.com/i.test(u)) {
    if (/\/live\b/i.test(u)) return 'live';
    if (/\/video\//i.test(u)) return 'video';
    return 'short';
  }

  if (/kick\.com/i.test(u)) {
    if (/\/videos\//i.test(u)) return 'video';
    if (/\/clips\//i.test(u)) return 'short';
    return 'live';
  }

  if (isNewsUrl(u)) return 'news';

  return 'unknown';
}

export function linkTypeToCaptureKind(type: LinkContentType): CaptureContentKind | null {
  if (type === 'unknown') return null;
  return type;
}

/** Escolhe o tipo pelo link principal (prioridade: live > short > video > news). */
export function classifyLinksInMessage(
  urls: string[],
  textBlob: string
): { linkType: LinkContentType; captureKind: CaptureContentKind | null } {
  const unique = [...new Set(urls.map(cleanUrl).filter(Boolean))];
  const types = unique
    .map(classifyLinkUrl)
    .filter((t): t is CaptureContentKind => t !== 'unknown');

  const blob = textBlob.toLowerCase();

  if (/ao\s+vivo|está\s+ao\s+vivo|live\s+now|🔴\s*live|está transmitindo|went live/i.test(blob)) {
    if (types.includes('short') && !types.includes('live')) {
      return { linkType: 'short', captureKind: 'short' };
    }
    const strongLive = /está\s+ao\s+vivo|live\s+now|went live|está transmitindo/i.test(blob);
    const allVod = unique.length > 0 && unique.every(u => {
      const t = classifyLinkUrl(u);
      return t === 'video' || t === 'short';
    });
    if (allVod && types.includes('video') && !strongLive) {
      return { linkType: 'video', captureKind: 'video' };
    }
    return { linkType: 'live', captureKind: 'live' };
  }
  if (/shorts?|#shorts|\bshort\b/i.test(blob) && types.includes('short')) {
    return { linkType: 'short', captureKind: 'short' };
  }
  if (/postou um vídeo|novo vídeo|uploaded a video|posted a video/i.test(blob)) {
    return { linkType: 'video', captureKind: 'video' };
  }

  const priority: CaptureContentKind[] = ['live', 'short', 'video', 'news'];
  for (const p of priority) {
    if (types.includes(p)) {
      return { linkType: p, captureKind: linkTypeToCaptureKind(p) };
    }
  }

  if (types.length > 0) {
    const t = types[0];
    return { linkType: t, captureKind: linkTypeToCaptureKind(t) };
  }

  return { linkType: 'unknown', captureKind: null };
}

/** Embed de artigo / notícia (sem URL de stream). */
export function isArticleEmbed(opts: {
  embedUrl?: string;
  providerName?: string;
  embedTypeRaw?: string;
  titles: string[];
  descriptions: string[];
}): boolean {
  if (opts.embedTypeRaw === 'article') return true;
  const url = opts.embedUrl ?? '';
  if (url && classifyLinkUrl(url) === 'news') return true;
  const blob = `${opts.providerName ?? ''} ${opts.titles.join(' ')} ${opts.descriptions.join(' ')}`;
  if (/notícia|noticia|news|reportagem|matéria|artigo/i.test(blob)) return true;
  if (url && isNewsUrl(url)) return true;
  return false;
}
