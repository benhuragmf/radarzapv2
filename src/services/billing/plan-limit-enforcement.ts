import mongoose from 'mongoose';
import { Organization } from '@/models/Organization';
import { WebChatWidget } from '@/models/WebChatWidget';
import { LeadCapture } from '@/models/LeadCapture';
import { Destination } from '@/models/Destination';
import { InboxTicket } from '@/models/InboxTicket';
import {
  checkPlanResourceLimit,
  PLAN_LIMIT_MESSAGES,
  startOfMonth,
} from '@/services/billing/plan-limit.util';

export class PlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanLimitError';
  }
}

async function resolveOrgPlanId(clientId: string): Promise<string> {
  const org = await Organization.findById(clientId).select('plan').lean();
  return org?.plan ?? 'free';
}

export async function assertCanCreateWebchatWidget(clientId: string): Promise<void> {
  const planId = await resolveOrgPlanId(clientId);
  const clientOid = new mongoose.Types.ObjectId(clientId);
  const count = await WebChatWidget.countDocuments({ clientId: clientOid });
  const check = checkPlanResourceLimit(
    count,
    planId,
    'webchatWidgets',
    PLAN_LIMIT_MESSAGES.webchatWidgets,
  );
  if (check.ok === false) throw new PlanLimitError(check.message);
}

export async function assertCanCaptureLead(clientId: string): Promise<void> {
  const planId = await resolveOrgPlanId(clientId);
  const clientOid = new mongoose.Types.ObjectId(clientId);
  const count = await LeadCapture.countDocuments({
    clientId: clientOid,
    createdAt: { $gte: startOfMonth() },
  });
  const check = checkPlanResourceLimit(
    count,
    planId,
    'leadsPerMonth',
    PLAN_LIMIT_MESSAGES.leadsPerMonth,
  );
  if (check.ok === false) throw new PlanLimitError(check.message);
}

export async function assertCanCreateContact(clientId: string): Promise<void> {
  const planId = await resolveOrgPlanId(clientId);
  const clientOid = new mongoose.Types.ObjectId(clientId);
  const count = await Destination.countDocuments({ clientId: clientOid });
  const check = checkPlanResourceLimit(
    count,
    planId,
    'contacts',
    PLAN_LIMIT_MESSAGES.contacts,
  );
  if (check.ok === false) throw new PlanLimitError(check.message);
}

export async function assertCanCreateTicket(clientId: string): Promise<void> {
  const planId = await resolveOrgPlanId(clientId);
  const clientOid = new mongoose.Types.ObjectId(clientId);
  const count = await InboxTicket.countDocuments({
    clientId: clientOid,
    createdAt: { $gte: startOfMonth() },
  });
  const check = checkPlanResourceLimit(
    count,
    planId,
    'ticketsPerMonth',
    PLAN_LIMIT_MESSAGES.ticketsPerMonth,
  );
  if (check.ok === false) throw new PlanLimitError(check.message);
}
