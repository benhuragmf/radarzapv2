import type { SystemBackupSettingsDto } from '@/types/admin-backup';

export const SYSTEM_BACKUP_SETTINGS_KEY = 'mongo' as const;

export const DEFAULT_SYSTEM_BACKUP_SETTINGS: SystemBackupSettingsDto = {
  key: SYSTEM_BACKUP_SETTINGS_KEY,
  enabled: true,
  timezone: 'America/Sao_Paulo',
  hourly: { enabled: true, keep: 3, intervalHours: 1 },
  daily: { enabled: true, keep: 3, hour: 0 },
  every3d: { enabled: true, keep: 3, intervalDays: 3 },
  weekly: { enabled: true, keep: 3, dayOfWeek: 7 },
  atlas: { enabled: true },
  minOrganizations: 1,
};
