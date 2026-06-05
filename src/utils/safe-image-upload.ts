/** Validação segura de imagens enviadas pelo painel (status, avatars, etc.). */

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

export function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
    const webp = buf.subarray(8, 12).toString('ascii');
    if (webp === 'WEBP') return 'image/webp';
  }
  return null;
}

function containsDangerousText(buf: Buffer): boolean {
  const head = buf.subarray(0, Math.min(buf.length, 4096)).toString('utf8').toLowerCase();
  return DANGEROUS_SNIPPETS.some(s => head.includes(s));
}

export type SafeImageResult =
  | { ok: true; data: Buffer; mime: string; dataUrl: string }
  | { ok: false; error: string };

/** Valida data URL ou URL http(s) de imagem — rejeita SVG/HTML disfarçados. */
export function parseAndValidateStatusImage(input: string): SafeImageResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'Selecione uma imagem' };

  if (/^https?:\/\//i.test(trimmed)) {
    return { ok: false, error: 'Envie o arquivo pelo painel — URLs externas não são permitidas' };
  }

  const match = /^data:([^;]+);base64,(.+)$/i.exec(trimmed);
  if (!match) {
    return { ok: false, error: 'Formato de imagem inválido — use JPEG, PNG ou WebP' };
  }

  const declaredMime = match[1].trim().toLowerCase();
  if (!ALLOWED_MIMES.has(declaredMime)) {
    return { ok: false, error: 'Tipo não permitido — use JPEG, PNG ou WebP' };
  }

  let data: Buffer;
  try {
    data = Buffer.from(match[2], 'base64');
  } catch {
    return { ok: false, error: 'Imagem corrompida ou codificação inválida' };
  }

  if (data.length === 0) return { ok: false, error: 'Arquivo vazio' };
  if (data.length > MAX_STATUS_IMAGE_BYTES) {
    return { ok: false, error: `Imagem muito grande — máximo ${MAX_STATUS_IMAGE_BYTES / (1024 * 1024)} MB` };
  }

  const sniffed = sniffImageMime(data);
  if (!sniffed || !ALLOWED_MIMES.has(sniffed)) {
    return { ok: false, error: 'Conteúdo não é uma imagem válida (JPEG, PNG ou WebP)' };
  }

  if (sniffed !== declaredMime && !(declaredMime === 'image/jpg' && sniffed === 'image/jpeg')) {
    return { ok: false, error: 'Tipo declarado não corresponde ao conteúdo real do arquivo' };
  }

  if (containsDangerousText(data)) {
    return { ok: false, error: 'Arquivo rejeitado por segurança — conteúdo suspeito detectado' };
  }

  const mime = sniffed;
  const dataUrl = `data:${mime};base64,${data.toString('base64')}`;
  return { ok: true, data, mime, dataUrl };
}
