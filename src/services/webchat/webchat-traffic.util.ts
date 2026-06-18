export function resolveTrafficSource(referrer?: string | null, pageUrl?: string | null): string {
  const ref = referrer?.trim();
  if (!ref) return 'Direto';
  try {
    const refUrl = new URL(ref);
    if (pageUrl) {
      try {
        const page = new URL(pageUrl);
        if (refUrl.hostname === page.hostname) return 'Mesmo site';
      } catch {
        /* ignore */
      }
    }
    const host = refUrl.hostname.toLowerCase().replace(/^www\./, '');
    if (host.includes('google.')) return 'Google';
    if (host.includes('facebook.') || host === 'fb.com' || host === 'l.facebook.com') return 'Facebook';
    if (host.includes('instagram.')) return 'Instagram';
    if (host.includes('linkedin.')) return 'LinkedIn';
    if (host.includes('twitter.') || host === 't.co' || host.includes('x.com')) return 'X / Twitter';
    if (host.includes('bing.')) return 'Bing';
    return host;
  } catch {
    return 'Direto';
  }
}
