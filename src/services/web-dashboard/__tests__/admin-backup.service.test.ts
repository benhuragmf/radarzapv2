import { buildScheduleHint, patchSystemBackupSettings } from '@/services/web-dashboard/admin-backup.service';
import { DEFAULT_SYSTEM_BACKUP_SETTINGS } from '@/constants/system-backup-defaults';

jest.mock('@/models/SystemBackupSettings', () => ({
  SystemBackupSettings: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('@/models/SystemBackupRun', () => ({
  SystemBackupRun: {
    find: jest.fn(),
    aggregate: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

const { SystemBackupSettings } = jest.requireMock('@/models/SystemBackupSettings');

describe('admin-backup.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('buildScheduleHint descreve camadas padrão', () => {
    const hint = buildScheduleHint(DEFAULT_SYSTEM_BACKUP_SETTINGS);
    expect(hint).toContain('a cada hora');
    expect(hint).toContain('diário');
    expect(hint).toContain('Atlas');
  });

  it('patchSystemBackupSettings limita keep e intervalo', async () => {
    SystemBackupSettings.findOne.mockResolvedValue({
      toObject: () => DEFAULT_SYSTEM_BACKUP_SETTINGS,
    });
    SystemBackupSettings.findOneAndUpdate.mockImplementation((_filter, update) => ({
      lean: () =>
        Promise.resolve({
          ...DEFAULT_SYSTEM_BACKUP_SETTINGS,
          ...update.$set,
        }),
    }));

    const result = await patchSystemBackupSettings({
      hourly: { keep: 99, intervalHours: 48 },
    });

    expect(result.hourly.keep).toBe(24);
    expect(result.hourly.intervalHours).toBe(24);
    const updateArg = SystemBackupSettings.findOneAndUpdate.mock.calls[0][1];
    expect(updateArg.$set.hourly.keep).toBe(24);
    expect(updateArg.$set.hourly.intervalHours).toBe(24);
  });
});
