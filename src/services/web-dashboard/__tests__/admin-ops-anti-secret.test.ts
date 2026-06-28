import { containsSensitiveOpsContent, sanitizeOpsDisplayText } from '@/types/admin-ops-summary.util';
import { assertSafeOrganizationRow } from '@/services/web-dashboard/admin-ops-organizations.service';
import {
  assertSafeSecurityEventRow,
  mapAttendanceEventToAdminOpsSecurityEvent,
  mapSystemLogToAdminOpsSecurityEvent,
  sanitizeAdminOpsSecurityEventText,
} from '@/services/web-dashboard/admin-ops-security-events.service';
import type { AdminOpsOrganizationRow } from '@/types/admin-ops-organizations';
import type { AdminOpsSecurityEventRow } from '@/types/admin-ops-security-events';
import mongoose from 'mongoose';

/** Padrões mínimos — espelho do checklist Etapa 6. */
export const ADMIN_OPS_SENSITIVE_PATTERNS = [
  'sk_test_',
  'sk_live_',
  'whsec_',
  'Bearer',
  'Authorization',
  'Cookie',
  'SESSION_ENCRYPTION_KEY',
  'JWT_SECRET',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'STRIPE_SECRET_KEY',
  'publicAccessToken',
  'sessionData',
  'qr',
] as const;

function assertJsonHasNoSensitiveKeys(json: string): void {
  const forbiddenKeys = ['meta', 'payload', 'details', 'metadata', 'sessionData', 'job.data'];
  for (const key of forbiddenKeys) {
    expect(json).not.toContain(`"${key}"`);
  }
  for (const pattern of ADMIN_OPS_SENSITIVE_PATTERNS) {
    if (pattern.length <= 3) continue; // 'qr' pode aparecer em palavras — checado via containsSensitiveOpsContent
    expect(json.toLowerCase()).not.toContain(pattern.toLowerCase());
  }
}

describe('admin ops anti-secret (Etapa 6)', () => {
  describe('sanitizeOpsDisplayText — summary / organizations UI', () => {
    it.each(ADMIN_OPS_SENSITIVE_PATTERNS.filter(p => p.length > 3))(
      'omite padrão %s',
      pattern => {
        expect(sanitizeOpsDisplayText(`valor ${pattern}xxx`)).toBe('[conteúdo omitido]');
        expect(containsSensitiveOpsContent(`valor ${pattern}xxx`)).toBe(true);
      },
    );
  });

  describe('sanitizeAdminOpsSecurityEventText — security-events', () => {
    it.each(['sk_test_abc', 'whsec_xyz', 'sessionData', 'Authorization header', 'Bearer token'])(
      'omite %s',
      sample => {
        expect(sanitizeAdminOpsSecurityEventText(sample)).toBe('[conteúdo omitido]');
      },
    );
  });

  describe('assertSafeOrganizationRow', () => {
    it('rejeita row com stripeSubscriptionId', () => {
      const row = {
        id: '1',
        name: 'Acme',
        plan: 'starter',
        billingStatus: 'active',
        planExpiresAt: null,
        createdAt: new Date().toISOString(),
        waConnected: false,
        stripeSubscriptionId: 'sub_xxx',
      } as AdminOpsOrganizationRow & { stripeSubscriptionId: string };
      expect(() => assertSafeOrganizationRow(row)).toThrow(/stripeSubscriptionId/);
    });

    it('aceita row sanitizada', () => {
      const row: AdminOpsOrganizationRow = {
        id: '1',
        name: 'Acme',
        plan: 'starter',
        billingStatus: 'trialing',
        planExpiresAt: null,
        createdAt: new Date().toISOString(),
        stripeModeHint: 'test',
        waConnected: true,
        membersCount: 2,
      };
      assertSafeOrganizationRow(row);
      assertJsonHasNoSensitiveKeys(JSON.stringify(row));
    });
  });

  describe('assertSafeSecurityEventRow', () => {
    it('aceita evento mapeado sem meta', () => {
      const row = mapAttendanceEventToAdminOpsSecurityEvent({
        _id: new mongoose.Types.ObjectId(),
        clientId: new mongoose.Types.ObjectId(),
        kind: 'form.blocked',
        meta: { secret: 'sk_test_leak', payload: { token: 'x' } },
        createdAt: new Date(),
      });
      assertSafeSecurityEventRow(row);
      assertJsonHasNoSensitiveKeys(JSON.stringify(row));
    });

    it('rejeita row com sk_test na serialização', () => {
      const row: AdminOpsSecurityEventRow = {
        id: 'evil',
        source: 'system',
        level: 'critical',
        kind: 'evil',
        title: 'sk_test_leak',
        message: 'ok',
        createdAt: new Date().toISOString(),
      };
      expect(() => assertSafeSecurityEventRow(row)).toThrow();
    });
  });

  describe('mappers não vazam meta bruto', () => {
    it('SystemLog com secrets na message', () => {
      const row = mapSystemLogToAdminOpsSecurityEvent({
        _id: new mongoose.Types.ObjectId(),
        level: 'error',
        service: 'Test',
        message: 'Cookie sessionData publicAccessToken whsec_abc',
        timestamp: new Date(),
      });
      expect(row.message).toBe('[conteúdo omitido]');
      assertSafeSecurityEventRow(row);
    });
  });
});
