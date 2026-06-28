import mongoose from 'mongoose';
import {
  assertSafeSecurityEventRow,
  listAdminOpsSecurityEvents,
  mapAttendanceEventToAdminOpsSecurityEvent,
  mapAuditLogToAdminOpsSecurityEvent,
  mapSystemLogToAdminOpsSecurityEvent,
  resolveSecurityEventLevel,
  resolveSecurityEventSource,
  sanitizeAdminOpsSecurityEventText,
} from '@/services/web-dashboard/admin-ops-security-events.service';

jest.mock('@/models/AttendanceEvent', () => ({
  AttendanceEvent: { find: jest.fn() },
}));

jest.mock('@/models/SystemLog', () => ({
  SystemLog: { find: jest.fn() },
}));

jest.mock('@/models/AuditLog', () => ({
  AuditLog: { find: jest.fn() },
}));

jest.mock('@/models/Organization', () => ({
  Organization: { find: jest.fn() },
}));

const { AttendanceEvent } = jest.requireMock('@/models/AttendanceEvent');
const { SystemLog } = jest.requireMock('@/models/SystemLog');
const { AuditLog } = jest.requireMock('@/models/AuditLog');
const { Organization } = jest.requireMock('@/models/Organization');

const orgId = new mongoose.Types.ObjectId();
const attId = new mongoose.Types.ObjectId();
const sysId = new mongoose.Types.ObjectId();
const audId = new mongoose.Types.ObjectId();

function chainLean<T>(docs: T[]) {
  return {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(docs),
  };
}

describe('admin-ops-security-events.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Organization.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ _id: orgId, name: 'Acme Corp' }]),
      }),
    });
  });

  describe('sanitizeAdminOpsSecurityEventText', () => {
    it('oculta secrets conhecidos', () => {
      expect(sanitizeAdminOpsSecurityEventText('key sk_test_abc123')).toBe('[conteúdo omitido]');
      expect(sanitizeAdminOpsSecurityEventText('whsec_abc')).toBe('[conteúdo omitido]');
      expect(sanitizeAdminOpsSecurityEventText('sessionData leak')).toBe('[conteúdo omitido]');
    });

    it('trunca mensagens longas', () => {
      const long = 'a'.repeat(400);
      expect(sanitizeAdminOpsSecurityEventText(long).length).toBeLessThanOrEqual(300);
    });
  });

  describe('resolveSecurityEventLevel', () => {
    it('mapeia billing.invoice.failed como critical', () => {
      expect(resolveSecurityEventLevel('billing.invoice.failed')).toBe('critical');
    });

    it('mapeia form.blocked como warning', () => {
      expect(resolveSecurityEventLevel('form.blocked')).toBe('warning');
    });
  });

  describe('resolveSecurityEventSource', () => {
    it('classifica ticket.* como ticket', () => {
      expect(resolveSecurityEventSource('ticket.public_lookup_failed', 'attendance')).toBe('ticket');
    });

    it('classifica system como system', () => {
      expect(resolveSecurityEventSource('system.error', 'system')).toBe('system');
    });
  });

  describe('mapAttendanceEventToAdminOpsSecurityEvent', () => {
    it('sanitiza e omite meta bruto', () => {
      const row = mapAttendanceEventToAdminOpsSecurityEvent({
        _id: attId,
        clientId: orgId,
        kind: 'billing.invoice.failed',
        meta: {
          ticketRef: 'TK-001',
          secret: 'sk_test_leak',
          sessionData: 'evil',
        },
        createdAt: new Date('2026-06-27T10:00:00Z'),
      });
      expect(row.level).toBe('critical');
      expect(row.source).toBe('billing');
      expect(row.message).toContain('TK-001');
      expect(row.message).not.toContain('sk_test');
      expect(JSON.stringify(row)).not.toContain('meta');
      assertSafeSecurityEventRow(row);
    });
  });

  describe('mapSystemLogToAdminOpsSecurityEvent', () => {
    it('mapeia warn para warning', () => {
      const row = mapSystemLogToAdminOpsSecurityEvent({
        _id: sysId,
        level: 'warn',
        service: 'WebhookDispatcher',
        message: 'Falha entrega webhook',
        clientId: orgId,
        timestamp: new Date('2026-06-27T11:00:00Z'),
      });
      expect(row.level).toBe('warning');
      expect(row.source).toBe('system');
      assertSafeSecurityEventRow(row);
    });

    it('sanitiza secrets na mensagem', () => {
      const row = mapSystemLogToAdminOpsSecurityEvent({
        _id: sysId,
        level: 'error',
        service: 'Billing',
        message: 'Authorization Bearer sk_live_abc',
        timestamp: new Date(),
      });
      expect(row.message).toBe('[conteúdo omitido]');
    });
  });

  describe('mapAuditLogToAdminOpsSecurityEvent', () => {
    it('extrai organizationId de details', () => {
      const row = mapAuditLogToAdminOpsSecurityEvent({
        _id: audId,
        action: 'admin.plan.changed',
        details: { organizationId: String(orgId), plan: 'pro', reason: 'Upgrade comercial' },
        createdAt: new Date('2026-06-27T12:00:00Z'),
      });
      expect(row.organizationId).toBe(String(orgId));
      expect(row.message).toContain('pro');
      expect(JSON.stringify(row)).not.toContain('details');
      assertSafeSecurityEventRow(row);
    });
  });

  describe('listAdminOpsSecurityEvents', () => {
    it('agrega fontes e ordena por createdAt desc', async () => {
      AttendanceEvent.find.mockReturnValue(
        chainLean([
          {
            _id: attId,
            clientId: orgId,
            kind: 'form.blocked',
            meta: {},
            createdAt: new Date('2026-06-27T09:00:00Z'),
          },
        ]),
      );
      SystemLog.find.mockReturnValue(
        chainLean([
          {
            _id: sysId,
            level: 'error',
            service: 'Core',
            message: 'Erro crítico',
            clientId: orgId,
            timestamp: new Date('2026-06-27T12:00:00Z'),
          },
        ]),
      );
      AuditLog.find.mockReturnValue(
        chainLean([
          {
            _id: audId,
            action: 'admin.trial.extended',
            details: { organizationId: String(orgId), days: 7 },
            createdAt: new Date('2026-06-27T10:00:00Z'),
          },
          {
            _id: new mongoose.Types.ObjectId(),
            action: 'user.profile.updated',
            details: {},
            createdAt: new Date('2026-06-27T11:00:00Z'),
          },
        ]),
      );

      const page = await listAdminOpsSecurityEvents({ limit: 25 });
      expect(page.items).toHaveLength(3);
      expect(page.items[0].id).toBe(`sys:${String(sysId)}`);
      expect(page.items[1].id).toBe(`aud:${String(audId)}`);
      expect(page.items[2].id).toBe(`att:${String(attId)}`);
      expect(page.items[0].organizationName).toBe('Acme Corp');
      expect(page.window.from).toBeDefined();
      expect(page.window.to).toBeDefined();
    });

    it('limita máximo 100', async () => {
      AttendanceEvent.find.mockReturnValue(chainLean([]));
      SystemLog.find.mockReturnValue(chainLean([]));
      AuditLog.find.mockReturnValue(chainLean([]));

      const page = await listAdminOpsSecurityEvents({ limit: 500 });
      expect(page.limit).toBe(100);
    });

    it('filtra por level', async () => {
      AttendanceEvent.find.mockReturnValue(
        chainLean([
          {
            _id: attId,
            clientId: orgId,
            kind: 'form.blocked',
            meta: {},
            createdAt: new Date(),
          },
        ]),
      );
      SystemLog.find.mockReturnValue(
        chainLean([
          {
            _id: sysId,
            level: 'error',
            service: 'Core',
            message: 'Erro',
            timestamp: new Date(),
          },
        ]),
      );
      AuditLog.find.mockReturnValue(chainLean([]));

      const page = await listAdminOpsSecurityEvents({ level: 'error' });
      expect(page.items).toHaveLength(1);
      expect(page.items[0].level).toBe('error');
    });

    it('filtra por source ticket', async () => {
      AttendanceEvent.find.mockReturnValue(
        chainLean([
          {
            _id: attId,
            clientId: orgId,
            kind: 'ticket.public_lookup_failed',
            meta: { ticketRef: 'TK-X' },
            createdAt: new Date(),
          },
          {
            _id: new mongoose.Types.ObjectId(),
            clientId: orgId,
            kind: 'form.blocked',
            meta: {},
            createdAt: new Date(),
          },
        ]),
      );
      SystemLog.find.mockReturnValue(chainLean([]));
      AuditLog.find.mockReturnValue(chainLean([]));

      const page = await listAdminOpsSecurityEvents({ source: 'ticket' });
      expect(page.items).toHaveLength(1);
      expect(page.items[0].kind).toBe('ticket.public_lookup_failed');
    });

    it('filtra por kind', async () => {
      AttendanceEvent.find.mockReturnValue(
        chainLean([
          {
            _id: attId,
            clientId: orgId,
            kind: 'ai.credits.exhausted',
            meta: {},
            createdAt: new Date(),
          },
        ]),
      );
      SystemLog.find.mockReturnValue(chainLean([]));
      AuditLog.find.mockReturnValue(chainLean([]));

      const page = await listAdminOpsSecurityEvents({ kind: 'ai.credits.exhausted' });
      expect(page.total).toBe(1);
      expect(page.items[0].level).toBe('critical');
    });

    it('não retorna payload/meta nos items', async () => {
      AttendanceEvent.find.mockReturnValue(
        chainLean([
          {
            _id: attId,
            clientId: orgId,
            kind: 'billing.limit.blocked',
            meta: { payload: { secret: 'whsec_123' }, publicAccessToken: 'tok' },
            createdAt: new Date(),
          },
        ]),
      );
      SystemLog.find.mockReturnValue(chainLean([]));
      AuditLog.find.mockReturnValue(chainLean([]));

      const page = await listAdminOpsSecurityEvents({});
      const json = JSON.stringify(page.items);
      expect(json).not.toContain('payload');
      expect(json).not.toContain('whsec_123');
      expect(json).not.toContain('publicAccessToken');
    });

    it('sanitiza organizationName malicioso', async () => {
      Organization.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: orgId, name: 'Evil sk_test_leak sessionData' },
          ]),
        }),
      });
      AttendanceEvent.find.mockReturnValue(
        chainLean([
          {
            _id: attId,
            clientId: orgId,
            kind: 'form.blocked',
            meta: {},
            createdAt: new Date(),
          },
        ]),
      );
      SystemLog.find.mockReturnValue(chainLean([]));
      AuditLog.find.mockReturnValue(chainLean([]));

      const page = await listAdminOpsSecurityEvents({});
      expect(page.items[0].organizationName).toBe('[conteúdo omitido]');
    });
  });
});
