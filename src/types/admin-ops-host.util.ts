import type { AdminOpsHostDataStatus } from './admin-ops-host';

export function hostDataStatusLabel(status: AdminOpsHostDataStatus): string {
  switch (status) {
    case 'ok':
      return 'OK';
    case 'stale':
      return 'Desatualizado';
    case 'not_configured':
      return 'Não configurado';
    case 'unreachable':
      return 'Indisponível';
    default:
      return status;
  }
}

export function hostDataStatusVariant(
  status: AdminOpsHostDataStatus,
): 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'ok':
      return 'success';
    case 'stale':
      return 'warning';
    case 'not_configured':
      return 'info';
    case 'unreachable':
      return 'danger';
    default:
      return 'info';
  }
}

export function formatHostCpuPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatHostMemMb(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value)} MB`;
}
