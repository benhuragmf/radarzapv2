import { isDevelopment } from '@/config/environment';
import type { WebChatActionLink } from '@/types/webchat';

export function sanitizeWebChatActionUrl(url: string): string | null {
  if (!url?.trim()) return null;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol === 'https:') return parsed.href;
  if (parsed.protocol === 'http:' && isDevelopment()) return parsed.href;
  return null;
}

export function sanitizeWebChatActionLinks(
  links: Array<{ label?: string; url?: string; openInNewTab?: boolean }> | undefined,
): WebChatActionLink[] {
  if (!links?.length) return [];
  const out: WebChatActionLink[] = [];
  for (const raw of links) {
    const url = sanitizeWebChatActionUrl(raw.url ?? '');
    const label = String(raw.label ?? '')
      .trim()
      .slice(0, 80);
    if (!url || !label) continue;
    out.push({
      label,
      url,
      openInNewTab: raw.openInNewTab !== false,
    });
  }
  return out;
}
