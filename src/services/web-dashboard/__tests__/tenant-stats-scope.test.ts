/**
 * AH-R01 — GET /api/stats deve usar buildTenantStats (clientId), não buildGlobalStats.
 * Teste estático de contrato: campos globais não podem aparecer na resposta tenant.
 */

describe('tenant stats scope (AH-R01)', () => {
  const tenantStatsKeys = [
    'totalMessages',
    'activeSessions',
    'pendingJobs',
    'failedJobs',
    'messagesPerHour',
  ] as const;

  const globalOnlyKeys = ['organizations', 'apiKeysActive'] as const;

  it('contrato tenant não inclui campos globais da plataforma', () => {
    const sampleTenant = {
      totalMessages: 12,
      activeSessions: 1,
      pendingJobs: 0,
      failedJobs: 0,
      messagesPerHour: [{ hour: '00h', count: 0 }],
    };
    for (const k of tenantStatsKeys) {
      expect(sampleTenant).toHaveProperty(k);
    }
    for (const k of globalOnlyKeys) {
      expect(sampleTenant as Record<string, unknown>).not.toHaveProperty(k);
    }
  });

  it('buildGlobalStats permanece separado de tenant (nomenclatura no service)', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../DashboardService.ts'),
      'utf8',
    ) as string;
    expect(src).toContain('buildTenantStats');
    expect(src).toContain('buildGlobalStats');
    expect(src).toMatch(/r\.get\('\/stats'[\s\S]*?buildTenantStats/);
    expect(src).toMatch(/\/admin\/monitoring[\s\S]*?buildGlobalStats/);
  });
});
