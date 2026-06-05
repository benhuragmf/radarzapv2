const MAX_PROFILE_PICTURE_BYTES = 512_000;
const WA_ORIGIN = 'https://web.whatsapp.com';

function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return 'image/webp';
  return null;
}

function resolveMime(contentType: string | null, buf: Buffer): string | null {
  const headerMime = (contentType ?? '').split(';')[0].trim().toLowerCase();
  if (headerMime.startsWith('image/')) return headerMime;
  return sniffImageMime(buf);
}

export async function downloadProfilePictureFromUrl(
  url: string,
): Promise<{ data: Buffer; mime: string } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        Origin: WA_ORIGIN,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
    if (!res.ok) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_PROFILE_PICTURE_BYTES) return null;

    const mime = resolveMime(res.headers.get('content-type'), buf);
    if (!mime) return null;

    return { data: buf, mime };
  } catch {
    return null;
  }
}
