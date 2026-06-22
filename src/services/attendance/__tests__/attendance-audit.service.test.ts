import mongoose from 'mongoose';
import { AttendanceEvent } from '@/models/AttendanceEvent';
import { recordAttendanceEvent } from '@/services/attendance/attendance-audit.service';

jest.mock('@/models/AttendanceEvent', () => ({
  AttendanceEvent: {
    create: jest.fn().mockResolvedValue({}),
  },
}));

const { AttendanceEvent: AttendanceEventMock } = jest.requireMock('@/models/AttendanceEvent');

describe('recordAttendanceEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persiste evento ticket com campos normalizados', async () => {
    const clientId = new mongoose.Types.ObjectId().toString();
    const conversationId = new mongoose.Types.ObjectId().toString();
    const actorUserId = new mongoose.Types.ObjectId().toString();

    await recordAttendanceEvent({
      clientId,
      kind: 'ticket.created',
      ticketRef: 'tk-abc123',
      conversationId,
      actorUserId,
      meta: { status: 'open' },
    });

    expect(AttendanceEventMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'ticket.created',
        ticketRef: 'TK-ABC123',
        meta: { status: 'open' },
      }),
    );
    const call = AttendanceEventMock.create.mock.calls[0][0];
    expect(String(call.clientId)).toBe(clientId);
    expect(String(call.conversationId)).toBe(conversationId);
    expect(String(call.actorUserId)).toBe(actorUserId);
  });

  it('não propaga erro de persistência', async () => {
    AttendanceEventMock.create.mockRejectedValueOnce(new Error('db down'));

    await expect(
      recordAttendanceEvent({
        clientId: new mongoose.Types.ObjectId().toString(),
        kind: 'ticket.closed',
        ticketRef: 'TK-X',
      }),
    ).resolves.toBeUndefined();
  });
});
