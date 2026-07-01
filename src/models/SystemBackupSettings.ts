import mongoose, { Schema, Document } from 'mongoose';
import { DEFAULT_SYSTEM_BACKUP_SETTINGS, SYSTEM_BACKUP_SETTINGS_KEY } from '@/constants/system-backup-defaults';

export interface ISystemBackupSettings extends Document {
  key: typeof SYSTEM_BACKUP_SETTINGS_KEY;
  enabled: boolean;
  timezone: string;
  hourly: { enabled: boolean; keep: number; intervalHours: number };
  daily: { enabled: boolean; keep: number; hour: number };
  every3d: { enabled: boolean; keep: number; intervalDays: number };
  weekly: { enabled: boolean; keep: number; dayOfWeek: number };
  atlas: { enabled: boolean };
  minOrganizations: number;
  updatedByUserId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const tierSchema = {
  enabled: { type: Boolean, default: true },
  keep: { type: Number, default: 3, min: 1, max: 30 },
};

const SystemBackupSettingsSchema = new Schema<ISystemBackupSettings>(
  {
    key: { type: String, required: true, unique: true, default: SYSTEM_BACKUP_SETTINGS_KEY },
    enabled: { type: Boolean, default: DEFAULT_SYSTEM_BACKUP_SETTINGS.enabled },
    timezone: { type: String, default: DEFAULT_SYSTEM_BACKUP_SETTINGS.timezone, maxlength: 64 },
    hourly: {
      enabled: { type: Boolean, default: DEFAULT_SYSTEM_BACKUP_SETTINGS.hourly.enabled },
      keep: { type: Number, default: DEFAULT_SYSTEM_BACKUP_SETTINGS.hourly.keep, min: 1, max: 24 },
      intervalHours: {
        type: Number,
        default: DEFAULT_SYSTEM_BACKUP_SETTINGS.hourly.intervalHours,
        min: 1,
        max: 24,
      },
    },
    daily: {
      ...tierSchema,
      hour: { type: Number, default: DEFAULT_SYSTEM_BACKUP_SETTINGS.daily.hour, min: 0, max: 23 },
    },
    every3d: {
      ...tierSchema,
      intervalDays: {
        type: Number,
        default: DEFAULT_SYSTEM_BACKUP_SETTINGS.every3d.intervalDays,
        min: 2,
        max: 14,
      },
    },
    weekly: {
      ...tierSchema,
      dayOfWeek: {
        type: Number,
        default: DEFAULT_SYSTEM_BACKUP_SETTINGS.weekly.dayOfWeek,
        min: 1,
        max: 7,
      },
    },
    atlas: {
      enabled: { type: Boolean, default: DEFAULT_SYSTEM_BACKUP_SETTINGS.atlas.enabled },
    },
    minOrganizations: {
      type: Number,
      default: DEFAULT_SYSTEM_BACKUP_SETTINGS.minOrganizations,
      min: 0,
      max: 1000,
    },
    updatedByUserId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true, collection: 'systemBackupSettings' },
);

export const SystemBackupSettings = mongoose.model<ISystemBackupSettings>(
  'SystemBackupSettings',
  SystemBackupSettingsSchema,
);
