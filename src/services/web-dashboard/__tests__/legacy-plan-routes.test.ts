describe('legacy plan routes (AH-R03/R04)', () => {
  it('rotas legadas delegam changeAdminOpsOrganizationPlan com Deprecation', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../DashboardService.ts'),
      'utf8',
    ) as string;
    expect(src).toMatch(/r\.put\('\/users\/:id\/plan'[\s\S]*?changeAdminOpsOrganizationPlan/);
    expect(src).toMatch(
      /\/admin\/organizations\/:id\/plan[\s\S]*?changeAdminOpsOrganizationPlan/,
    );
    expect(src).not.toMatch(/await user\.upgradePlan\(/);
    expect(src).toContain("res.setHeader('Deprecation', 'true')");
  });
});
