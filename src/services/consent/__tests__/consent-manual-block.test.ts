import { ConsentService } from '@/services/consent/ConsentService';
import { Destination } from '@/models/Destination';
import { ConsentStatus } from '@/types/consent';
import mongoose from 'mongoose';

jest.mock('@/models/Destination', () => ({
  Destination: {
    findOne: jest.fn(),
  },
}));

jest.mock('@/models/AuditLog', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));

describe('ConsentService.manualBlock — isolamento por clientId', () => {
  const svc = ConsentService.getInstance();
  const findOne = Destination.findOne as jest.Mock;

  beforeEach(() => {
    findOne.mockReset();
  });

  it('filtra por clientId quando informado (anti-IDOR)', async () => {
    findOne.mockResolvedValue(null);
    await expect(
      svc.manualBlock('507f1f77bcf86cd799439011', 'admin-user-id', '507f1f77bcf86cd799439012'),
    ).rejects.toThrow('Contato não encontrado');

    expect(findOne).toHaveBeenCalledWith({
      _id: '507f1f77bcf86cd799439011',
      clientId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'),
    });
  });

  it('não inclui clientId na query quando omitido (rotas admin legadas)', async () => {
    findOne.mockResolvedValue(null);
    await expect(svc.manualBlock('507f1f77bcf86cd799439011', 'admin-user-id')).rejects.toThrow(
      'Contato não encontrado',
    );
    expect(findOne).toHaveBeenCalledWith({ _id: '507f1f77bcf86cd799439011' });
  });

  it('aplica MANUALLY_BLOCKED quando contato existe', async () => {
    const dest = {
      consentStatus: ConsentStatus.ACCEPTED,
      save: jest.fn(),
    };
    findOne.mockResolvedValue(dest);
    const applySpy = jest.spyOn(svc as unknown as { applyStatus: (...args: unknown[]) => Promise<void> }, 'applyStatus');
    applySpy.mockResolvedValue(undefined);

    await svc.manualBlock('507f1f77bcf86cd799439011', 'admin-user-id', '507f1f77bcf86cd799439012');

    expect(applySpy).toHaveBeenCalledWith(
      dest,
      ConsentStatus.MANUALLY_BLOCKED,
      'system-block',
      expect.objectContaining({ requestedByUserId: 'admin-user-id' }),
    );
    applySpy.mockRestore();
  });
});
