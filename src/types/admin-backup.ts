export type SystemBackupRunStatus = 'success' | 'failed' | 'skipped';

export interface SystemBackupTierSettings {
  enabled: boolean;
  keep: number;
}

export interface SystemBackupHourlySettings extends SystemBackupTierSettings {
  intervalHours: number;
}

export interface SystemBackupDailySettings extends SystemBackupTierSettings {
  hour: number;
}

export interface SystemBackupEvery3dSettings extends SystemBackupTierSettings {
  intervalDays: number;
}

export interface SystemBackupWeeklySettings extends SystemBackupTierSettings {
  dayOfWeek: number;
}

export interface SystemBackupAtlasSettings {
  enabled: boolean;
}

export interface SystemBackupSettingsDto {
  key: 'mongo';
  enabled: boolean;
  timezone: string;
  hourly: SystemBackupHourlySettings;
  daily: SystemBackupDailySettings;
  every3d: SystemBackupEvery3dSettings;
  weekly: SystemBackupWeeklySettings;
  atlas: SystemBackupAtlasSettings;
  minOrganizations: number;
  updatedAt?: string;
  updatedByUserId?: string;
}

export interface SystemBackupRunTiers {
  hourly: boolean;
  daily: boolean;
  every3d: boolean;
  weekly: boolean;
  atlas: boolean;
}

export interface SystemBackupRetentionCounts {
  hourly: number;
  daily: number;
  every3d: number;
  weekly: number;
}

export interface SystemBackupRunDto {
  id: string;
  status: SystemBackupRunStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  organizations: number;
  tiers: SystemBackupRunTiers;
  retentionCounts: SystemBackupRetentionCounts;
  message?: string;
  error?: string;
}

export interface SystemBackupStatusResponse {
  settings: SystemBackupSettingsDto;
  lastRun: SystemBackupRunDto | null;
  runs: SystemBackupRunDto[];
  summary: {
    totalRuns: number;
    successRuns: number;
    failedRuns: number;
    skippedRuns: number;
    lastSuccessAt: string | null;
    atlasConfigured: boolean;
  };
  scheduleHint: string;
  /** false em desenvolvimento local — cron/scripts VPS não rodam. */
  automationAvailable: boolean;
  localDevMessage: string | null;
}

export interface UpdateSystemBackupSettingsInput {
  enabled?: boolean;
  timezone?: string;
  hourly?: Partial<SystemBackupHourlySettings>;
  daily?: Partial<SystemBackupDailySettings>;
  every3d?: Partial<SystemBackupEvery3dSettings>;
  weekly?: Partial<SystemBackupWeeklySettings>;
  atlas?: Partial<SystemBackupAtlasSettings>;
  minOrganizations?: number;
}

export interface RecordSystemBackupRunInput {
  status: SystemBackupRunStatus;
  startedAt: string;
  finishedAt: string;
  organizations: number;
  tiers: SystemBackupRunTiers;
  retentionCounts: SystemBackupRetentionCounts;
  message?: string;
  error?: string;
}
