import type { AttendanceEventKind } from '@/models/AttendanceEvent';

export type BillingAuditKind = Extract<
  AttendanceEventKind,
  | 'billing.checkout.completed'
  | 'billing.invoice.failed'
  | 'billing.ai_credit_pack.purchased'
  | 'billing.limit.blocked'
>;

export async function recordBillingAttendanceEvent(input: {
  clientId: string;
  kind: BillingAuditKind;
  actorUserId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const { recordAttendanceEvent } = await import(
    '@/services/attendance/attendance-audit.service'
  );
  await recordAttendanceEvent({
    clientId: input.clientId,
    kind: input.kind,
    actorUserId: input.actorUserId,
    meta: input.meta,
  });
}
