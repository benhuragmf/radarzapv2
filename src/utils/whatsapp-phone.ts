import { jidDecode } from '@whiskeysockets/baileys';

/** Extrai só dígitos do JID (@s.whatsapp.net, @lid, etc.) */
export function digitsFromJid(jid: string): string {
  const decoded = jidDecode(jid);
  if (decoded?.user) return decoded.user.replace(/\D/g, '');
  return jid.replace(/@.+$/, '').replace(/\D/g, '');
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
