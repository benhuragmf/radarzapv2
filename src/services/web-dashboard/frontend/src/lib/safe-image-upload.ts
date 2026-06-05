/** Validação de imagem no browser (espelha regras do backend). */

export const MAX_STATUS_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const DANGEROUS_SNIPPETS = [
  '<script',
  '</script',
  'javascript:',
  '<?php',
  '<svg',
  '<html',
  '<iframe',
  'onerror=',
  'onload=',
];

function sniffImageMime(buf: Uint8Array): string | null {
  if (buf.length < 4) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
    const webp = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
    if (webp === 'WEBP') return 'image/webp';
  }
  return null;
}

function containsDangerousText(buf: Uint8Array): boolean {
  const head = new TextDecoder().decode(buf.subarray(0, Math.min(buf.length, 4096))).toLowerCase();
  return DANGEROUS_SNIPPETS.some(s => head.includes(s));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export type SafeImageClientResult =
  | { ok: true; dataUrl: string; mime: string }
  | { ok: false; error: string };

export async function validateImageFileClient(file: File): Promise<SafeImageClientResult> {
  const mime = (file.type || '').toLowerCase();
  if (!ALLOWED_MIMES.has(mime)) {
    return { ok: false, error: 'Tipo não permitido — use JPEG, PNG ou WebP' };
  }
  if (file.size > MAX_STATUS_IMAGE_BYTES) {
    return { ok: false, error: `Imagem muito grande — máximo ${MAX_STATUS_IMAGE_BYTES / (1024 * 1024)} MB` };
  }
  if (file.size === 0) return { ok: false, error: 'Arquivo vazio' };

  const buf = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImageMime(buf);
  if (!sniffed || !ALLOWED_MIMES.has(sniffed)) {
    return { ok: false, error: 'Conteúdo não é uma imagem válida (JPEG, PNG ou WebP)' };
  }
  if (containsDangerousText(buf)) {
    return { ok: false, error: 'Arquivo rejeitado por segurança — conteúdo suspeito detectado' };
  }

  const dataUrl = `data:${sniffed};base64,${bytesToBase64(buf)}`;
  return { ok: true, dataUrl, mime: sniffed };
}
