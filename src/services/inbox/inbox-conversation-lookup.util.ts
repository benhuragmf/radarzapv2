import { InboxConversationStatus } from '@/types/inbox';
import type { IInboxConversation } from '@/models/InboxConversation';
import { normalizeContactPhoneE164 } from '@/utils/contact-csv-import';

/** Variantes de telefone para achar conversa/contato já aberto pelo operador (Leads → Inbox). */
export function contactIdentifierLookupVariants(identifier: string): string[] {
  const out = new Set<string>();
  const trimmed = identifier.trim();
  if (!trimmed) return [];

  out.add(trimmed);
  const e164 = normalizeContactPhoneE164(trimmed);
  if (e164) {
    out.add(e164);
    const digits = e164.replace(/\D/g, '');
    out.add(digits);
    out.add(`+${digits}`);
    if (digits.startsWith('55') && digits.length >= 12) {
      const ddd = digits.slice(2, 4);
      const rest = digits.slice(4);
      if (rest.length === 8) {
        out.add(`+55${ddd}9${rest}`);
        out.add(`55${ddd}9${rest}`);
      } else if (rest.length === 9 && rest.startsWith('9')) {
        out.add(`+55${ddd}${rest.slice(1)}`);
        out.add(`55${ddd}${rest.slice(1)}`);
      }
    }
  }
  return [...out];
}

const STATUS_RANK: Record<InboxConversationStatus, number> = {
  [InboxConversationStatus.IN_PROGRESS]: 0,
  [InboxConversationStatus.TRANSFERRED]: 1,
  [InboxConversationStatus.WAITING_QUEUE]: 2,
  [InboxConversationStatus.BOT_TRIAGE]: 3,
  [InboxConversationStatus.RESOLVED]: 99,
  [InboxConversationStatus.CLOSED]: 99,
};

/** Prioriza atendimento humano ativo sobre nova triagem automática. */
export function pickPreferredOpenConversation(
  conversations: IInboxConversation[],
): IInboxConversation | null {
  if (!conversations.length) return null;
  const sorted = [...conversations].sort((a, b) => {
    const rank =
      (STATUS_RANK[a.status] ?? 50) - (STATUS_RANK[b.status] ?? 50);
    if (rank !== 0) return rank;
    const aAssigned = a.assignedUserId ? 0 : 1;
    const bAssigned = b.assignedUserId ? 0 : 1;
    if (aAssigned !== bAssigned) return aAssigned - bAssigned;
    const aTs = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTs = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTs - aTs;
  });
  return sorted[0] ?? null;
}
