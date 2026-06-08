import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ROOT = path.join(process.cwd(), 'data', 'inbox-media');

export function getInboxMediaRoot(): string {
  return ROOT;
}

export function saveInboxMedia(clientId: string, buffer: Buffer, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
  const dir = path.join(ROOT, clientId);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${safeExt}`;
  fs.writeFileSync(path.join(dir, name), buffer);
  return `${clientId}/${name}`;
}

export function resolveInboxMediaPath(relative: string): string | null {
  if (!relative || relative.includes('..')) return null;
  const full = path.join(ROOT, relative);
  const normalizedRoot = path.resolve(ROOT);
  const normalizedFull = path.resolve(full);
  if (!normalizedFull.startsWith(normalizedRoot + path.sep)) return null;
  if (!fs.existsSync(normalizedFull)) return null;
  return normalizedFull;
}

export const INBOX_MEDIA_LABEL: Record<string, string> = {
  image: '🖼 Imagem',
  video: '🎬 Vídeo',
  audio: '🎵 Áudio',
  sticker: '🎭 Sticker',
  document: '📎 Documento',
};
