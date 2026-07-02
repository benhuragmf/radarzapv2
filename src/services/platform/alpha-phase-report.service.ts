import mongoose, { type Document } from 'mongoose';
import {
  AlphaPhaseReport,
  type AlphaPhaseReportSeverity,
  type AlphaPhaseReportStatus,
  type IAlphaPhaseReport,
} from '@/models/AlphaPhaseReport';
import { Organization } from '@/models/Organization';

const TITLE_MAX = 160;
const SUMMARY_MAX = 4000;
const EXPECTED_MAX = 2000;
const STEPS_MAX = 4000;
const AREA_MAX = 200;
const PAGE_URL_MAX = 500;
const ADMIN_NOTES_MAX = 2000;

function trimOrUndefined(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function trimRequired(value: unknown, max: number, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} é obrigatório`);
  }
  return value.trim().slice(0, max);
}

function parseSeverity(value: unknown): AlphaPhaseReportSeverity {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return 'medium';
}

function parseStatus(value: unknown): AlphaPhaseReportStatus | null {
  if (value === 'open' || value === 'reviewing' || value === 'resolved' || value === 'dismissed') {
    return value;
  }
  return null;
}

export interface CreateAlphaPhaseReportInput {
  title?: string;
  summary?: string;
  expectedBehavior?: string;
  stepsToReproduce?: string;
  affectedArea?: string;
  severity?: AlphaPhaseReportSeverity;
  pageUrl?: string;
}

export type AlphaPhaseReportRecord = Omit<IAlphaPhaseReport, keyof Document> & {
  _id: mongoose.Types.ObjectId;
};

export async function createAlphaPhaseReport(params: {
  organizationId: string;
  reporterUserId: string;
  reporterUsername: string;
  reporterEmail?: string;
  input: CreateAlphaPhaseReportInput;
}): Promise<IAlphaPhaseReport> {
  const org = await Organization.findById(params.organizationId).select('name').lean();
  const doc = await AlphaPhaseReport.create({
    organizationId: new mongoose.Types.ObjectId(params.organizationId),
    organizationName: org?.name?.trim() || undefined,
    reporterUserId: new mongoose.Types.ObjectId(params.reporterUserId),
    reporterUsername: params.reporterUsername.trim().slice(0, 120),
    reporterEmail: trimOrUndefined(params.reporterEmail, 200),
    title: trimRequired(params.input.title, TITLE_MAX, 'title'),
    summary: trimRequired(params.input.summary, SUMMARY_MAX, 'summary'),
    expectedBehavior: trimOrUndefined(params.input.expectedBehavior, EXPECTED_MAX),
    stepsToReproduce: trimOrUndefined(params.input.stepsToReproduce, STEPS_MAX),
    affectedArea: trimOrUndefined(params.input.affectedArea, AREA_MAX),
    severity: parseSeverity(params.input.severity),
    pageUrl: trimOrUndefined(params.input.pageUrl, PAGE_URL_MAX),
    status: 'open',
  });
  return doc;
}

export async function listAlphaPhaseReportsForAdmin(params: {
  status?: AlphaPhaseReportStatus;
  limit?: number;
}): Promise<AlphaPhaseReportRecord[]> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const filter: Record<string, unknown> = {};
  if (params.status) filter.status = params.status;
  return AlphaPhaseReport.find(filter).sort({ createdAt: -1 }).limit(limit).lean() as Promise<
    AlphaPhaseReportRecord[]
  >;
}

export async function updateAlphaPhaseReportStatus(params: {
  reportId: string;
  status: AlphaPhaseReportStatus;
  adminNotes?: string;
}): Promise<AlphaPhaseReportRecord | null> {
  const status = parseStatus(params.status);
  if (!status) throw new Error('status inválido');

  const update: Record<string, unknown> = {
    status,
    adminNotes: trimOrUndefined(params.adminNotes, ADMIN_NOTES_MAX),
  };
  if (status === 'resolved' || status === 'dismissed') {
    update.resolvedAt = new Date();
  } else {
    update.resolvedAt = undefined;
  }

  return AlphaPhaseReport.findByIdAndUpdate(params.reportId, update, { new: true }).lean() as Promise<
    AlphaPhaseReportRecord | null
  >;
}
