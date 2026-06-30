import { InboxConversationStatus } from '@/types/inbox';
import type { IInboxConversation } from '@/models/InboxConversation';
import {
  contactIdentifierLookupVariants,
  pickPreferredOpenConversation,
} from '@/services/inbox/inbox-conversation-lookup.util';

describe('inbox-conversation-lookup.util', () => {
  it('contactIdentifierLookupVariants inclui E164 e dígitos BR com/sem 9', () => {
    const v = contactIdentifierLookupVariants('66984240564');
    expect(v).toContain('+5566984240564');
    expect(v.some(x => x.includes('984240564') || x.includes('84240564'))).toBe(true);
  });

  it('pickPreferredOpenConversation prioriza IN_PROGRESS sobre BOT_TRIAGE', () => {
    const human = {
      status: InboxConversationStatus.IN_PROGRESS,
      assignedUserId: 'u1',
      lastMessageAt: new Date('2026-01-01'),
    } as unknown as IInboxConversation;
    const triage = {
      status: InboxConversationStatus.BOT_TRIAGE,
      lastMessageAt: new Date('2026-06-01'),
    } as unknown as IInboxConversation;
    expect(pickPreferredOpenConversation([triage, human])).toBe(human);
  });
});
