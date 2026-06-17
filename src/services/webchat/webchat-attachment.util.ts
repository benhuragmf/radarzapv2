import { sniffImageMime } from '@/utils/safe-image-upload';
import type { WebChatMessageMediaType } from '@/types/webchat';

export const MAX_WEBCHAT_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_CAPTION_LENGTH = 500;

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PDF_MIME = 'application/pdf';

export type WebChatAttachmentInput = {
  dataBase64: string;
  mimeType?: string;
  fileName?: string;
  caption?: string;
};

export type WebChatAttachmentResult =
  | {
      ok: true;
      data: Buffer;
      mime: string;
      ext: string;
      fileName: string;
      body: string;
      mediaType: WebChatMessageMediaType;
    }
  | { ok: false; error: string };

function mimeToExt(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === PDF_MIME) return 'pdf';
  return 'bin';
}

function sniffPdf(buf: Buffer): boolean {
  return buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-';
}

function sanitizeFileName(name: string, fallback: string): string {
  return (name.trim() || fallback)
    .replace(/[^\w.\- ()áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g, '')
    .slice(0, 120);
}

function resolveBody(
  caption: string | undefined,
  fileName: string,
  mediaType: WebChatMessageMediaType,
): string {
  const text = caption?.trim().slice(0, MAX_CAPTION_LENGTH);
  if (text) return text;
  const label = mediaType === 'document' ? 'Documento' : 'Imagem';
  return `📎 ${fileName || label}`;
}

function decodeBase64Input(input: WebChatAttachmentInput): {
  declaredMime: string;
  data: Buffer;
} | { error: string } {
  const raw = input.dataBase64?.trim();
  if (!raw) return { error: 'Arquivo obrigatório' };

  let declaredMime = input.mimeType?.trim().toLowerCase() ?? '';
  let b64 = raw;

  const dataUrl = /^data:([^;]+);base64,(.+)$/i.exec(raw);
  if (dataUrl) {
    declaredMime = dataUrl[1].trim().toLowerCase();
    b64 = dataUrl[2];
  }

  if (!declaredMime) return { error: 'Tipo de arquivo obrigatório' };

  let data: Buffer;
  try {
    data = Buffer.from(b64, 'base64');
  } catch {
    return { error: 'Arquivo corrompido ou codificação inválida' };
  }

  if (data.length === 0) return { error: 'Arquivo vazio' };
  if (data.length > MAX_WEBCHAT_ATTACHMENT_BYTES) {
    return {
      error: `Arquivo muito grande — máximo ${MAX_WEBCHAT_ATTACHMENT_BYTES / (1024 * 1024)} MB`,
    };
  }

  return { declaredMime, data };
}

/** Valida imagem ou PDF (base64 ou data URL). */
export function parseWebChatAttachment(input: WebChatAttachmentInput): WebChatAttachmentResult {
  const decoded = decodeBase64Input(input);
  if ('error' in decoded) return { ok: false, error: decoded.error };

  const { declaredMime, data } = decoded;

  if (IMAGE_MIMES.has(declaredMime)) {
    const sniffed = sniffImageMime(data);
    if (!sniffed || !IMAGE_MIMES.has(sniffed)) {
      return { ok: false, error: 'Conteúdo não é uma imagem válida (JPEG, PNG ou WebP)' };
    }
    if (sniffed !== declaredMime && !(declaredMime === 'image/jpg' && sniffed === 'image/jpeg')) {
      return { ok: false, error: 'Tipo declarado não corresponde ao conteúdo do arquivo' };
    }
    const fileName = sanitizeFileName(input.fileName ?? '', 'imagem');
    return {
      ok: true,
      data,
      mime: sniffed,
      ext: mimeToExt(sniffed),
      fileName,
      body: resolveBody(input.caption, fileName, 'image'),
      mediaType: 'image',
    };
  }

  if (declaredMime === PDF_MIME) {
    if (!sniffPdf(data)) {
      return { ok: false, error: 'Conteúdo não é um PDF válido' };
    }
    const fileName = sanitizeFileName(input.fileName ?? '', 'documento.pdf');
    const safeName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    return {
      ok: true,
      data,
      mime: PDF_MIME,
      ext: 'pdf',
      fileName: safeName,
      body: resolveBody(input.caption, safeName, 'document'),
      mediaType: 'document',
    };
  }

  return { ok: false, error: 'Tipo não permitido — use JPEG, PNG, WebP ou PDF' };
}

/** @deprecated use parseWebChatAttachment */
export const parseWebChatVisitorAttachment = parseWebChatAttachment;
export const parseWebChatImageAttachment = parseWebChatAttachment;
