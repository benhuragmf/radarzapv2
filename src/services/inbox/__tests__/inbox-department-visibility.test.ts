import mongoose from 'mongoose';
import { InboxConversationStatus } from '@/types/inbox';
import {
  applyRestrictedWaListVisibility,
  applyRestrictedWebChatListVisibility,
  isUnassignedTriageBlockedForAttendant,
  WA_UNASSIGNED_TRIAGE_CLAUSE,
} from '../inbox-department-visibility.util';

describe('inbox-department-visibility', () => {
  const userOid = new mongoose.Types.ObjectId();
  const deptA = new mongoose.Types.ObjectId();
  const deptB = new mongoose.Types.ObjectId();

  const restricted = {
    restricted: true,
    departmentIds: [deptA],
  };

  it('WA: atendente restrito não vê triagem sem flag', () => {
    const query: Record<string, unknown> = { clientId: 'x' };
    applyRestrictedWaListVisibility(query, restricted, userOid, {}, { attendantTriageVisible: false });
    expect(query.$or).toEqual([
      { departmentId: { $in: [deptA] } },
      { $or: [{ assignedUserId: userOid }, { suggestedUserId: userOid }] },
    ]);
    expect(query.$or).not.toContainEqual(WA_UNASSIGNED_TRIAGE_CLAUSE);
  });

  it('WA: atendente restrito vê triagem quando dono liberou', () => {
    const query: Record<string, unknown> = { clientId: 'x' };
    applyRestrictedWaListVisibility(query, restricted, userOid, {}, { attendantTriageVisible: true });
    expect(query.$or).toContainEqual(WA_UNASSIGNED_TRIAGE_CLAUSE);
  });

  it('WebChat: inclui triagem bot quando liberado', () => {
    const query: Record<string, unknown> = { clientId: 'x' };
    applyRestrictedWebChatListVisibility(query, restricted, userOid, {}, { attendantTriageVisible: true });
    expect(query.$or).toContainEqual({
      queueStatus: 'bot',
      $or: [{ assignedUserId: { $exists: false } }, { assignedUserId: null }],
    });
  });

  it('bloqueia acesso direto à triagem sem liberação', () => {
    expect(
      isUnassignedTriageBlockedForAttendant(restricted, {
        attendantTriageVisible: false,
        status: InboxConversationStatus.BOT_TRIAGE,
      }),
    ).toBe(true);
    expect(
      isUnassignedTriageBlockedForAttendant(restricted, {
        attendantTriageVisible: true,
        status: InboxConversationStatus.BOT_TRIAGE,
      }),
    ).toBe(false);
    expect(
      isUnassignedTriageBlockedForAttendant(
        { restricted: false, departmentIds: [] },
        {
          attendantTriageVisible: false,
          status: InboxConversationStatus.BOT_TRIAGE,
        },
      ),
    ).toBe(false);
  });
});
