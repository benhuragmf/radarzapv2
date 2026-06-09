import type { OrgPlanId } from '@/services/billing/plan-config';

export type SubscriptionStatus = 'free' | 'active' | 'expiring_soon' | 'expired';

export function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

export function computeSubscriptionStatus(
  plan: OrgPlanId,
  expiresAt: Date | null | undefined,
  now = new Date(),
): SubscriptionStatus {
  if (plan === 'free') return 'free';
  if (!expiresAt) return 'active';
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return 'expired';
  if (ms <= 7 * 24 * 60 * 60 * 1000) return 'expiring_soon';
  return 'active';
}

export function formatTimeRemaining(
  expiresAt: Date | null | undefined,
  now = new Date(),
): { label: string; daysRemaining: number | null; hoursRemaining: number | null } {
  if (!expiresAt) {
    return { label: 'Sem data de expiração', daysRemaining: null, hoursRemaining: null };
  }
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) {
    return { label: 'Expirado', daysRemaining: 0, hoursRemaining: 0 };
  }
  const totalHours = Math.floor(ms / (60 * 60 * 1000));
  const daysRemaining = Math.floor(totalHours / 24);
  const hoursRemaining = totalHours % 24;
  if (daysRemaining > 0) {
    return {
      label: `${daysRemaining} dia(s) e ${hoursRemaining}h restantes`,
      daysRemaining,
      hoursRemaining,
    };
  }
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return {
    label: `${hoursRemaining}h ${minutes}min restantes`,
    daysRemaining: 0,
    hoursRemaining,
  };
}

export function formatDatePtBr(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function isPaidPlanActive(
  plan: OrgPlanId,
  expiresAt: Date | null | undefined,
  now = new Date(),
): boolean {
  if (plan === 'free') return true;
  if (!expiresAt) return true;
  return expiresAt.getTime() > now.getTime();
}
