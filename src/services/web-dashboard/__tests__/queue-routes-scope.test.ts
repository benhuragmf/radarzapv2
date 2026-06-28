describe('dashboard queue routes scope (AH-R02)', () => {
  it('GET /queue tenant usa buildTenantQueueStats; global exige queue:global', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../routes/dashboardQueueRoutes.ts'),
      'utf8',
    ) as string;
    expect(src).toContain('buildTenantQueueStats');
    expect(src).toContain('can(auth, Cap.QUEUE_GLOBAL)');
    expect(src).not.toMatch(/data:\s*job\.data/);
    expect(src).toContain('sanitizeFailedJob');
    expect(src).toContain('jobBelongsToClient');
  });
});
