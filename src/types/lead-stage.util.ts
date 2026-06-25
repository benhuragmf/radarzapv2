import type { LeadCaptureStatus } from '@/types/lead-form';
import { isClosedLeadStatus, isOpenLeadStatus } from '@/types/lead-dedupe.util';

/** Etapas oficiais do funil comercial (TOP 09) — referência de produto. */
export type ProductLeadStage =
  | 'new'
  | 'contact_attempt'
  | 'in_service'
  | 'qualified'
  | 'proposal_sent'
  | 'won'
  | 'lost'
  | 'no_response';

const PERSISTED_STATUSES: ReadonlySet<string> = new Set([
  'new',
  'in_review',
  'in_progress',
  'qualified',
  'converted',
  'lost',
  'spam',
]);

/** Mapeamento persistido → etapa de produto. */
export const LEAD_STATUS_TO_PRODUCT_STAGE: Record<LeadCaptureStatus, ProductLeadStage> = {
  new: 'new',
  in_review: 'contact_attempt',
  in_progress: 'in_service',
  qualified: 'qualified',
  converted: 'won',
  lost: 'lost',
  spam: 'lost',
};

/** Mapeamento etapa de produto → status persistido (adapter). */
export const PRODUCT_STAGE_TO_LEAD_STATUS: Record<ProductLeadStage, LeadCaptureStatus> = {
  new: 'new',
  contact_attempt: 'in_review',
  in_service: 'in_progress',
  qualified: 'qualified',
  proposal_sent: 'qualified',
  won: 'converted',
  lost: 'lost',
  no_response: 'lost',
};

export function isLeadStage(value: string): value is LeadCaptureStatus {
  return PERSISTED_STATUSES.has(value);
}

export function normalizeLeadStage(value: string): LeadCaptureStatus {
  if (isLeadStage(value)) return value;
  const fromProduct = PRODUCT_STAGE_TO_LEAD_STATUS[value as ProductLeadStage];
  if (fromProduct) return fromProduct;
  return 'new';
}

export function mapLeadStatusToProductStage(status: string): ProductLeadStage {
  if (isLeadStage(status)) {
    return LEAD_STATUS_TO_PRODUCT_STAGE[status];
  }
  const mapped = PRODUCT_STAGE_TO_LEAD_STATUS[status as ProductLeadStage];
  if (mapped) return LEAD_STATUS_TO_PRODUCT_STAGE[mapped];
  return 'new';
}

export function isClosedLeadStage(status: string): boolean {
  return isClosedLeadStatus(status);
}

export function isOpenLeadStage(status: string): boolean {
  return isOpenLeadStatus(status);
}
