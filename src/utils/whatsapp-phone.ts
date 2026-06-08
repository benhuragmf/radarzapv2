import fs from 'fs';
import path from 'path';
import { jidDecode } from '@whiskeysockets/baileys';

/**
 * Parte local do JID sem sufixo de dispositivo.
 * Ex.: `5511976904921:29@s.whatsapp.net` → `5511976904921` (não `551197690492129`).
 */
export function userPartFromJid(jid: string): string {
  const decoded = jidDecode(jid);
  const local = decoded?.user ?? jid.split('@')[0] ?? '';
  return local.split(':')[0] ?? local;
}

export function isLidJid(jid?: string | null): boolean {
  return Boolean(jid?.endsWith('@lid'));
}

export function isPhoneJid(jid?: string | null): boolean {
  return Boolean(jid?.endsWith('@s.whatsapp.net'));
}

/** LID WA (contato fora da agenda) — não é telefone E.164. */
export function isLikelyLidDigits(digits: string): boolean {
  const d = digits.replace(/\D/g, '');
  if (!d || d.startsWith('55')) return false;
  return d.length >= 12 && d.length <= 17;
}

export function isLikelyPhoneIdentifier(value: string): boolean {
  if (!value || isLidJid(value)) return false;
  const d = value.replace(/\D/g, '');
  if (!d) return false;
  if (isLikelyLidDigits(d)) return false;
  if (d.startsWith('55')) return d.length >= 12 && d.length <= 13;
  return d.length >= 10 && d.length <= 15;
}

/** Extrai dígitos do JID de telefone (@s.whatsapp.net). */
export function digitsFromJid(jid: string): string {
  if (isLidJid(jid)) {
    return userPartFromJid(jid).replace(/\D/g, '');
  }
  const digits = userPartFromJid(jid).replace(/\D/g, '');
  return normalizeBrazilPhoneDigits(digits);
}

/** BR móvel: 55 + DDD (2) + 9 dígitos = 13. Corta lixo quando :device vira dígito extra. */
export function normalizeBrazilPhoneDigits(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (!d.startsWith('55')) return d;
  if (d.length > 13) return d.slice(0, 13);
  return d;
}

/** Número E.164 a partir do wuid Baileys (`5511...@s.whatsapp.net` ou `5511...:29@...`). */
export function wuidToPhone(wuid?: string): string | undefined {
  if (!wuid || isLidJid(wuid)) return undefined;
  if (wuid.includes('@') && !isPhoneJid(wuid)) return undefined;
  const digits = normalizeBrazilPhoneDigits(userPartFromJid(wuid).replace(/\D/g, ''));
  if (!digits || !isLikelyPhoneIdentifier(`+${digits}`)) return undefined;
  return `+${digits}`;
}

/** Variantes BR (com/sem 9º dígito) para casar destino cadastrado com JID do WhatsApp */
export function brazilPhoneLookupVariants(digits: string): string[] {
  const d = digits.replace(/\D/g, '');
  if (!d || isLikelyLidDigits(d)) return [];
  const out = new Set<string>([d]);
  if (d.startsWith('55') && d.length === 12) {
    out.add(d.slice(0, 4) + '9' + d.slice(4));
  }
  if (d.startsWith('55') && d.length === 13 && d[4] === '9') {
    out.add(d.slice(0, 4) + d.slice(5));
  }
  return [...out];
}

export function sessionDirForClient(clientId: string): string {
  return path.join(process.cwd(), 'sessions', clientId);
}

/** Resolve telefone a partir do mapeamento Baileys `lid-mapping-{lid}_reverse.json`. */
export function resolvePhoneFromLidMapping(clientId: string, lidJid: string): string | undefined {
  const lid = userPartFromJid(lidJid).replace(/\D/g, '');
  if (!lid) return undefined;
  const reversePath = path.join(sessionDirForClient(clientId), `lid-mapping-${lid}_reverse.json`);
  try {
    if (!fs.existsSync(reversePath)) return undefined;
    const raw = JSON.parse(fs.readFileSync(reversePath, 'utf8'));
    const phoneStr = typeof raw === 'string' ? raw : String(raw);
    return wuidToPhone(`${phoneStr.replace(/\D/g, '')}@s.whatsapp.net`);
  } catch {
    return undefined;
  }
}

/** Preferência: JID de telefone → mapeamento LID → undefined. */
export function resolvePhoneFromJids(
  clientId: string,
  ...jids: (string | undefined | null)[]
): string | undefined {
  const list = jids.filter(Boolean) as string[];
  const phoneFirst = [...list].sort((a, b) => {
    const rank = (j: string) => (isPhoneJid(j) ? 0 : isLidJid(j) ? 1 : 2);
    return rank(a) - rank(b);
  });

  for (const jid of phoneFirst) {
    if (isPhoneJid(jid)) {
      const phone = wuidToPhone(jid);
      if (phone) return phone;
    }
  }

  for (const jid of phoneFirst) {
    if (isLidJid(jid)) {
      const phone = resolvePhoneFromLidMapping(clientId, jid);
      if (phone) return phone;
    }
  }

  return undefined;
}

export function identifierCandidatesFromJids(...jids: (string | undefined)[]): string[] {
  const ids = new Set<string>();
  const ordered = [...jids].filter(Boolean).sort((a, b) => {
    const rank = (j: string) => (isPhoneJid(j) ? 0 : 2);
    return rank(a) - rank(b);
  });

  for (const jid of ordered) {
    if (!jid || !isPhoneJid(jid)) continue;
    for (const digits of brazilPhoneLookupVariants(digitsFromJid(jid))) {
      if (!digits.startsWith('55') || digits.length < 12) continue;
      ids.add(`+${digits}`);
      ids.add(digits);
    }
  }
  return [...ids];
}

/** Identificador estável para destino quando só há LID (sem telefone na agenda). */
export function lidIdentifierFromJid(jid: string): string {
  const user = userPartFromJid(jid).replace(/\D/g, '');
  return user ? `${user}@lid` : jid;
}
