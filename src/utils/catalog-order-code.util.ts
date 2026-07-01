import crypto from 'crypto';

export const CATALOG_ORDER_CODE_PREFIX = 'DX';

export function generateCatalogOrderCodeCandidate(): string {
  const n = crypto.randomInt(1000, 9999);
  return `${CATALOG_ORDER_CODE_PREFIX}-${n}`;
}

export function normalizeCatalogOrderCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isValidCatalogOrderCode(code: string): boolean {
  return /^[A-Z]{2}-\d{4}$/.test(normalizeCatalogOrderCode(code));
}
