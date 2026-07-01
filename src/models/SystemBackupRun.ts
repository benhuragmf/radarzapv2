import mongoose, { Schema, Document } from 'mongoose';
import type { SystemBackupRunStatus } from '@/types/admin-backup';

export interface ISystemBackupRun extends Document {
  status: SystemBackupRunStatus;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  organizations: number;
  tiers: {
    hourly: boolean;
    daily: boolean;
    every3d: boolean;
    weekly: boolean;
    atlas: boolean;
  };
  retentionCounts: {
    hourly: number;
    daily: number;
    every3d: number;
    weekly: number;
  };
  message?: string;
  error?: string;
  createdAt: Date;
}

const SystemBackupRunSchema = new Schema<ISystemBackupRun>(
  {
    status: { type: String, required: true, enum: ['success', 'failed', 'skipped'] },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, required: true },
    durationMs: { type: Number, required: true, min: 0 },
    organizations: { type: Number, required: true, min: 0 },
    tiers: {
      hourly: { type: Boolean, default: false },
      daily: { type: Boolean, default: false },
      every3d: { type: Boolean, default: false },
      weekly: { type: Boolean, default: false },
      atlas: { type: Boolean, default: false },
    },
    retentionCounts: {
      hourly: { type: Number, default: 0 },
      daily: { type: Number, default: 0 },
      every3d: { type: Number, default: 0 },
      weekly: { type: Number, default: 0 },
    },
    message: { type: String, maxlength: 500 },
    error: { type: String, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'systemBackupRuns' },
);

SystemBackupRunSchema.index({ startedAt: -1 });

export const SystemBackupRun = mongoose.model<ISystemBackupRun>(
  'SystemBackupRun',
  SystemBackupRunSchema,
);
