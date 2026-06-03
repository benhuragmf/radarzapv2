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

/** Extrai só dígitos do JID (@s.whatsapp.net, @lid, etc.) */
export function digitsFromJid(jid: string): string {
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
  if (!wuid) return undefined;
  const digits = normalizeBrazilPhoneDigits(userPartFromJid(wuid).replace(/\D/g, ''));
  if (!digits) return undefined;
  return `+${digits}`;
}

/** Variantes BR (com/sem 9º dígito) para casar destino cadastrado com JID do WhatsApp */
export function brazilPhoneLookupVariants(digits: string): string[] {
  const d = digits.replace(/\D/g, '');
  if (!d) return [];
  const out = new Set<string>([d]);
  if (d.startsWith('55') && d.length === 12) {
    out.add(d.slice(0, 4) + '9' + d.slice(4));
  }
  if (d.startsWith('55') && d.length === 13 && d[4] === '9') {
    out.add(d.slice(0, 4) + d.slice(5));
  }
  return [...out];
}

export function identifierCandidatesFromJids(...jids: (string | undefined)[]): string[] {
  const ids = new Set<string>();
  for (const jid of jids) {
    if (!jid) continue;
    for (const digits of brazilPhoneLookupVariants(digitsFromJid(jid))) {
      ids.add(`+${digits}`);
      ids.add(digits);
    }
  }
  return [...ids];
}
