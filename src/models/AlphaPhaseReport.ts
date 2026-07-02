import mongoose, { Schema, Document } from 'mongoose';

export type AlphaPhaseReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';
export type AlphaPhaseReportSeverity = 'low' | 'medium' | 'high';

export interface IAlphaPhaseReport extends Document {
  organizationId: mongoose.Types.ObjectId;
  organizationName?: string;
  reporterUserId: mongoose.Types.ObjectId;
  reporterUsername: string;
  reporterEmail?: string;
  title: string;
  summary: string;
  expectedBehavior?: string;
  stepsToReproduce?: string;
  affectedArea?: string;
  severity: AlphaPhaseReportSeverity;
  pageUrl?: string;
  status: AlphaPhaseReportStatus;
  adminNotes?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AlphaPhaseReportSchema = new Schema<IAlphaPhaseReport>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    organizationName: { type: String, trim: true, maxlength: 120 },
    reporterUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reporterUsername: { type: String, required: true, trim: true, maxlength: 120 },
    reporterEmail: { type: String, trim: true, maxlength: 200 },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    summary: { type: String, required: true, trim: true, maxlength: 4000 },
    expectedBehavior: { type: String, trim: true, maxlength: 2000 },
    stepsToReproduce: { type: String, trim: true, maxlength: 4000 },
    affectedArea: { type: String, trim: true, maxlength: 200 },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      index: true,
    },
    pageUrl: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ['open', 'reviewing', 'resolved', 'dismissed'],
      default: 'open',
      index: true,
    },
    adminNotes: { type: String, trim: true, maxlength: 2000 },
    resolvedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'alphaPhaseReports',
  },
);

AlphaPhaseReportSchema.index({ createdAt: -1 });

export const AlphaPhaseReport = mongoose.model<IAlphaPhaseReport>(
  'AlphaPhaseReport',
  AlphaPhaseReportSchema,
);
