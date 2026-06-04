import { brazilPhoneLookupVariants, digitsFromJid } from '@/utils/whatsapp-phone';

export function phoneDigitVariants(phone: string): string[] {
  return brazilPhoneLookupVariants(phone.replace(/\D/g, ''));
}

export function participantDigitVariants(participantJid: string): string[] {
  return brazilPhoneLookupVariants(digitsFromJid(participantJid));
}

/** Compara telefone E.164/+ com JID de participante (inclui variantes BR 9º dígito). */
export function phoneMatchesParticipant(phone: string, participantJid: string): boolean {
  const phoneVariants = phoneDigitVariants(phone);
  const participantVariants = participantDigitVariants(participantJid);
  return phoneVariants.some(p => participantVariants.includes(p));
}

export function isPhoneInParticipants(
  phone: string,
  participants: Array<{ id: string }>,
): boolean {
  return participants.some(p => phoneMatchesParticipant(phone, p.id));
}
