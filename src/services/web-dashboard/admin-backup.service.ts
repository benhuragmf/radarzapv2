import {
  DEFAULT_SYSTEM_BACKUP_SETTINGS,
  SYSTEM_BACKUP_SETTINGS_KEY,
} from '@/constants/system-backup-defaults';
import crypto from 'crypto';
import { SystemBackupRun } from '@/models/SystemBackupRun';
import { SystemBackupSettings } from '@/models/SystemBackupSettings';
import type {
  RecordSystemBackupRunInput,
  SystemBackupRunDto,
  SystemBackupSettingsDto,
  SystemBackupStatusResponse,
  UpdateSystemBackupSettingsInput,
} from '@/types/admin-backup';
import {
  isSystemBackupAutomationAvailable,
  systemBackupLocalDevMessage,
} from '@/utils/system-backup-environment';

const MAX_RUNS_LIST = 50;
const MAX_RUNS_STORED = 200;

const DAY_NAMES = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function toSettingsDto(doc: {
  key: typeof SYSTEM_BACKUP_SETTINGS_KEY;
  enabled: boolean;
  timezone: string;
  hourly: { enabled: boolean; keep: number; intervalHours: number };
  daily: { enabled: boolean; keep: number; hour: number };
  every3d: { enabled: boolean; keep: number; intervalDays: number };
  weekly: { enabled: boolean; keep: number; dayOfWeek: number };
  atlas: { enabled: boolean };
  minOrganizations: number;
  updatedAt?: Date;
  updatedByUserId?: { toString(): string };
}): SystemBackupSettingsDto {
  return {
    key: doc.key,
    enabled: doc.enabled,
    timezone: doc.timezone,
    hourly: { ...doc.hourly },
    daily: { ...doc.daily },
    every3d: { ...doc.every3d },
    weekly: { ...doc.weekly },
    atlas: { ...doc.atlas },
    minOrganizations: doc.minOrganizations,
    updatedAt: doc.updatedAt?.toISOString(),
    updatedByUserId: doc.updatedByUserId?.toString(),
  };
}

function toRunDto(doc: {
  _id: { toString(): string };
  status: 'success' | 'failed' | 'skipped';
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  organizations: number;
  tiers: SystemBackupRunDto['tiers'];
  retentionCounts: SystemBackupRunDto['retentionCounts'];
  message?: string;
  error?: string;
}): SystemBackupRunDto {
  return {
    id: doc._id.toString(),
    status: doc.status,
    startedAt: doc.startedAt.toISOString(),
    finishedAt: doc.finishedAt.toISOString(),
    durationMs: doc.durationMs,
    organizations: doc.organizations,
    tiers: { ...doc.tiers },
    retentionCounts: { ...doc.retentionCounts },
    message: doc.message,
    error: doc.error,
  };
}

function buildScheduleHint(settings: SystemBackupSettingsDto): string {
  const parts: string[] = [];
  if (settings.hourly.enabled) {
    parts.push(
      settings.hourly.intervalHours === 1
        ? `a cada hora (mantém ${settings.hourly.keep})`
        : `a cada ${settings.hourly.intervalHours} h (mantém ${settings.hourly.keep})`,
    );
  }
  if (settings.daily.enabled) {
    parts.push(`diário às ${String(settings.daily.hour).padStart(2, '0')}:00 (mantém ${settings.daily.keep})`);
  }
  if (settings.every3d.enabled) {
    parts.push(
      `a cada ${settings.every3d.intervalDays} dias à meia-noite (mantém ${settings.every3d.keep})`,
    );
  }
  if (settings.weekly.enabled) {
    const day = DAY_NAMES[settings.weekly.dayOfWeek] ?? `dia ${settings.weekly.dayOfWeek}`;
    parts.push(`semanal (${day}) (mantém ${settings.weekly.keep})`);
  }
  if (settings.atlas.enabled) {
    parts.push('espelho Atlas após backup horário');
  }
  const tz = settings.timezone || 'America/Sao_Paulo';
  return parts.length ? `${parts.join(' · ')} · fuso ${tz}` : 'Nenhuma camada ativa';
}

export async function ensureSystemBackupSettings(): Promise<SystemBackupSettingsDto> {
  const doc = await SystemBackupSettings.findOne({ key: SYSTEM_BACKUP_SETTINGS_KEY }).lean();
  if (!doc) {
    const created = await SystemBackupSettings.create({ ...DEFAULT_SYSTEM_BACKUP_SETTINGS });
    return toSettingsDto(created.toObject());
  }
  return toSettingsDto(doc as Parameters<typeof toSettingsDto>[0]);
}

export async function getSystemBackupStatus(): Promise<SystemBackupStatusResponse> {
  const settings = await ensureSystemBackupSettings();
  const [runs, counts, lastSuccess] = await Promise.all([
    SystemBackupRun.find().sort({ startedAt: -1 }).limit(MAX_RUNS_LIST).lean(),
    SystemBackupRun.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    SystemBackupRun.findOne({ status: 'success' }).sort({ startedAt: -1 }).select('startedAt').lean(),
  ]);

  const countMap = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  const runDtos = runs.map((r) => toRunDto(r as Parameters<typeof toRunDto>[0]));

  return {
    settings,
    lastRun: runDtos[0] ?? null,
    runs: runDtos,
    summary: {
      totalRuns: counts.reduce((sum, c) => sum + c.count, 0),
      successRuns: countMap.success ?? 0,
      failedRuns: countMap.failed ?? 0,
      skippedRuns: countMap.skipped ?? 0,
      lastSuccessAt: lastSuccess?.startedAt?.toISOString() ?? null,
      atlasConfigured: Boolean(process.env.MONGODB_BACKUP_URL?.trim()),
    },
    scheduleHint: buildScheduleHint(settings),
    automationAvailable: isSystemBackupAutomationAvailable(),
    localDevMessage: systemBackupLocalDevMessage(),
  };
}

export async function patchSystemBackupSettings(
  input: UpdateSystemBackupSettingsInput,
  updatedByUserId?: string,
): Promise<SystemBackupSettingsDto> {
  const current = await SystemBackupSettings.findOne({ key: SYSTEM_BACKUP_SETTINGS_KEY });
  const base = current?.toObject() ?? DEFAULT_SYSTEM_BACKUP_SETTINGS;

  const hourly = { ...base.hourly, ...input.hourly };
  const daily = { ...base.daily, ...input.daily };
  const every3d = { ...base.every3d, ...input.every3d };
  const weekly = { ...base.weekly, ...input.weekly };
  const atlas = { ...base.atlas, ...input.atlas };

  hourly.keep = clampInt(hourly.keep, 1, 24, DEFAULT_SYSTEM_BACKUP_SETTINGS.hourly.keep);
  hourly.intervalHours = clampInt(
    hourly.intervalHours,
    1,
    24,
    DEFAULT_SYSTEM_BACKUP_SETTINGS.hourly.intervalHours,
  );
  daily.keep = clampInt(daily.keep, 1, 30, DEFAULT_SYSTEM_BACKUP_SETTINGS.daily.keep);
  daily.hour = clampInt(daily.hour, 0, 23, DEFAULT_SYSTEM_BACKUP_SETTINGS.daily.hour);
  every3d.keep = clampInt(every3d.keep, 1, 30, DEFAULT_SYSTEM_BACKUP_SETTINGS.every3d.keep);
  every3d.intervalDays = clampInt(
    every3d.intervalDays,
    2,
    14,
    DEFAULT_SYSTEM_BACKUP_SETTINGS.every3d.intervalDays,
  );
  weekly.keep = clampInt(weekly.keep, 1, 30, DEFAULT_SYSTEM_BACKUP_SETTINGS.weekly.keep);
  weekly.dayOfWeek = clampInt(weekly.dayOfWeek, 1, 7, DEFAULT_SYSTEM_BACKUP_SETTINGS.weekly.dayOfWeek);

  const timezone =
    typeof input.timezone === 'string' && input.timezone.trim().length > 0
      ? input.timezone.trim().slice(0, 64)
      : base.timezone;

  const payload = {
    key: SYSTEM_BACKUP_SETTINGS_KEY,
    enabled: input.enabled ?? base.enabled,
    timezone,
    hourly: {
      enabled: input.hourly?.enabled ?? hourly.enabled,
      keep: hourly.keep,
      intervalHours: hourly.intervalHours,
    },
    daily: {
      enabled: input.daily?.enabled ?? daily.enabled,
      keep: daily.keep,
      hour: daily.hour,
    },
    every3d: {
      enabled: input.every3d?.enabled ?? every3d.enabled,
      keep: every3d.keep,
      intervalDays: every3d.intervalDays,
    },
    weekly: {
      enabled: input.weekly?.enabled ?? weekly.enabled,
      keep: weekly.keep,
      dayOfWeek: weekly.dayOfWeek,
    },
    atlas: {
      enabled: input.atlas?.enabled ?? atlas.enabled,
    },
    minOrganizations: clampInt(
      input.minOrganizations ?? base.minOrganizations,
      0,
      1000,
      DEFAULT_SYSTEM_BACKUP_SETTINGS.minOrganizations,
    ),
    ...(updatedByUserId ? { updatedByUserId } : {}),
  };

  const saved = await SystemBackupSettings.findOneAndUpdate(
    { key: SYSTEM_BACKUP_SETTINGS_KEY },
    { $set: payload },
    { upsert: true, new: true },
  ).lean();

  return toSettingsDto(saved as Parameters<typeof toSettingsDto>[0]);
}

export async function recordSystemBackupRun(input: RecordSystemBackupRunInput): Promise<SystemBackupRunDto> {
  const startedAt = new Date(input.startedAt);
  const finishedAt = new Date(input.finishedAt);
  const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());

  const doc = await SystemBackupRun.create({
    status: input.status,
    startedAt,
    finishedAt,
    durationMs,
    organizations: clampInt(input.organizations, 0, 1_000_000, 0),
    tiers: input.tiers,
    retentionCounts: input.retentionCounts,
    message: input.message?.slice(0, 500),
    error: input.error?.slice(0, 2000),
  });

  const total = await SystemBackupRun.countDocuments();
  if (total > MAX_RUNS_STORED) {
    const excess = total - MAX_RUNS_STORED;
    const oldest = await SystemBackupRun.find().sort({ startedAt: 1 }).limit(excess).select('_id').lean();
    const ids = oldest.map((o) => o._id);
    if (ids.length) await SystemBackupRun.deleteMany({ _id: { $in: ids } });
  }

  return toRunDto(doc.toObject());
}

/** Token interno para o cron VPS registrar execuções sem sessão de painel. */
export function isSystemBackupInternalToken(provided: string | undefined): boolean {
  const expected = process.env.SYSTEM_BACKUP_INTERNAL_TOKEN?.trim();
  if (!expected || expected.length < 16 || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export { buildScheduleHint };
