import {
  anonymizeTitularContact,
  normalizeLgpdPhoneQuery,
} from '../lgpd-portal.service';
import { Destination } from '@/models/Destination';
import { ConsentStatus } from '@/types/consent';

jest.mock('@/models/Destination');
jest.mock('@/models/ConsentHistory', () => ({
  ConsentHistory: { find: jest.fn().mockReturnValue({ sort: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }) }) },
}));
jest.mock('@/models/AttendanceEvent', () => ({
  AttendanceEvent: { find: jest.fn() },
}));
jest.mock('@/services/attendance/attendance-audit.service', () => ({
  recordAttendanceEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/models/AuditLog', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));

describe('lgpd-portal.service', () => {
  it('normalizeLgpdPhoneQuery remove não-dígitos', () => {
    expect(normalizeLgpdPhoneQuery('+55 (11) 98888-7777')).toBe('5511988887777');
  });

  it('anonymizeTitularContact anonimiza e bloqueia reprocesso', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const dest = {
      _id: '507f1f77bcf86cd799439011',
      clientId: '507f1f77bcf86cd799439012',
      type: 'contact',
      identifier: '5511999999999',
      name: 'Maria',
      email: 'a@b.com',
      consent: { granted: true },
      consentStatus: ConsentStatus.ACCEPTED,
      isActive: true,
      save,
    };
    (Destination.findOne as jest.Mock).mockResolvedValue(dest);

    await expect(
      anonymizeTitularContact({
        clientId: '507f1f77bcf86cd799439012',
        destinationId: '507f1f77bcf86cd799439011',
        actorUserId: '507f1f77bcf86cd799439013',
        reason: 'pedido titular',
      }),
    ).resolves.toEqual({ ok: true, destinationId: '507f1f77bcf86cd799439011' });

    expect(dest.name).toBe('Titular anonimizado');
    expect(dest.identifier).toMatch(/^anon:/);
    expect(dest.isActive).toBe(false);
    expect(save).toHaveBeenCalled();

    await expect(
      anonymizeTitularContact({
        clientId: '507f1f77bcf86cd799439012',
        destinationId: '507f1f77bcf86cd799439011',
        actorUserId: '507f1f77bcf86cd799439013',
      }),
    ).rejects.toThrow(/já anonimizado/);
  });
});
