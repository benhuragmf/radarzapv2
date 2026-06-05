import { brazilPhoneLookupVariants, digitsFromJid } from '@/utils/whatsapp-phone';

export type WaParticipantRef = {
  id: string;
  phoneNumber?: string;
  lid?: string;
};

export function phoneDigitVariants(phone: string): string[] {
  return brazilPhoneLookupVariants(phone.replace(/\D/g, ''));
}

export function participantDigitVariants(participantJid: string): string[] {
  if (participantJid.endsWith('@lid')) return [];
  return brazilPhoneLookupVariants(digitsFromJid(participantJid));
}

/** Compara telefone E.164/+ com JID de participante (inclui variantes BR 9º dígito). */
export function phoneMatchesParticipant(phone: string, participantJid: string): boolean {
  if (!participantJid || participantJid.endsWith('@lid')) return false;
  const phoneVariants = phoneDigitVariants(phone);
  const participantVariants = participantDigitVariants(participantJid);
  return phoneVariants.some(p => participantVariants.includes(p));
}

function normalizeLidUser(lid?: string): string | undefined {
  if (!lid) return undefined;
  const user = lid.includes('@') ? lid.split('@')[0] : lid;
  const digits = user?.replace(/\D/g, '');
  return digits || undefined;
}

/** JIDs PN candidatos de um participante (id + phoneNumber do Baileys). */
export function participantPhoneJids(participant: WaParticipantRef): string[] {
  const jids = new Set<string>();
  if (participant.id && !participant.id.endsWith('@lid')) jids.add(participant.id);
  if (participant.phoneNumber) jids.add(participant.phoneNumber);
  return [...jids];
}

export function isPhoneInParticipants(
  phone: string,
  participants: WaParticipantRef[],
): boolean {
  return participants.some(p =>
    participantPhoneJids(p).some(jid => phoneMatchesParticipant(phone, jid)),
  );
}

export function isLidInParticipants(
  lid: string,
  participants: WaParticipantRef[],
): boolean {
  const target = normalizeLidUser(lid);
  if (!target) return false;
  return participants.some(p => {
    const candidates = [p.lid, p.id.endsWith('@lid') ? p.id : undefined].filter(Boolean) as string[];
    return candidates.some(c => normalizeLidUser(c) === target);
  });
}

/** Valida sessão WA (telefone e/ou LID) contra lista de participantes do grupo. */
export function isWaIdentityInParticipants(
  identity: { phone?: string; lid?: string },
  participants: WaParticipantRef[],
): boolean {
  if (identity.phone && isPhoneInParticipants(identity.phone, participants)) return true;
  if (identity.lid && isLidInParticipants(identity.lid, participants)) return true;
  return false;
}
