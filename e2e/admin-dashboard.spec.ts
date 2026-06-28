import { test, expect } from '@playwright/test';
import {
  MOCK_ADMIN_OPS_SUMMARY,
  MOCK_ADMIN_OPS_SUMMARY_MALICIOUS,
  MOCK_ADMIN_OPS_ORGS_MALICIOUS,
  MOCK_ADMIN_OPS_SECURITY_EVENTS,
  MOCK_ADMIN_OPS_SECURITY_MALICIOUS,
  MOCK_ADMIN_OPS_USER,
  setupAdminDashboardMocks,
} from './fixtures/mock-admin-ops-api';
import { MOCK_AUTH_USER } from './fixtures/mock-panel-api';

test.describe('Admin Dashboard Ops', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminDashboardMocks(page);
  });

  test('admin autenticado abre /admin/dashboard com cards principais', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('admin-ops-main-cards')).toBeVisible();
    await expect(page.getByText('Empresas', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('12', { exact: true }).first()).toBeVisible();
  });

  test('seções Infra, Empresas, Atendimento, Billing e Segurança', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('tab', { name: 'Infra' }).click();
    await expect(page.getByText('Infraestrutura detalhada')).toBeVisible();

    await page.getByRole('tab', { name: 'Empresas' }).click();
    await expect(page.getByTestId('admin-ops-tenants')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('admin-ops-orgs-table')).toBeVisible();
    await expect(page.getByText('Empresa Trial Demo')).toBeVisible();
    await expect(page.getByText('Trialing', { exact: true }).first()).toBeVisible();

    await page.getByRole('tab', { name: 'Atendimento' }).click();
    await expect(page.getByTestId('admin-ops-atendimento')).toBeVisible();
    await expect(page.getByText('WhatsApp global')).toBeVisible();

    await page.getByRole('tab', { name: 'Billing' }).click();
    await expect(page.getByTestId('admin-ops-billing')).toBeVisible();
    await expect(page.getByText('TEST', { exact: true }).first()).toBeVisible();

    await page.getByRole('tab', { name: 'Segurança' }).click();
    await expect(page.getByTestId('admin-ops-security')).toBeVisible();
  });

  test('status TOP20 e alertas na visão geral', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page.getByTestId('admin-ops-top20')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('PRONTO PARA QA MANUAL')).toBeVisible();
    await expect(page.getByTestId('admin-ops-alerts')).toBeVisible();
  });

  test('botão Atualizar chama summary novamente', async ({ page }) => {
    let calls = 0;
    await page.route('**/api/admin/ops/summary**', route => {
      calls += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ADMIN_OPS_SUMMARY),
      });
    });
    await page.goto('/admin/dashboard');
    await expect(page.getByTestId('admin-ops-refresh')).toBeVisible({ timeout: 15_000 });
    const before = calls;
    await page.getByTestId('admin-ops-refresh').click();
    await expect.poll(() => calls).toBeGreaterThan(before);
  });

  test('API 500 mostra error state', async ({ page }) => {
    await setupAdminDashboardMocks(page, { fail: true });
    await page.goto('/admin/dashboard');
    await expect(page.getByText('Não foi possível carregar o Dashboard Ops.')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  });

  test('não renderiza strings sensíveis nos alertas', async ({ page }) => {
    await setupAdminDashboardMocks(page, { summary: MOCK_ADMIN_OPS_SUMMARY_MALICIOUS });
    await page.goto('/admin/dashboard');
    await expect(page.getByTestId('admin-ops-alerts')).toBeVisible({ timeout: 15_000 });
    const html = await page.content();
    expect(html).not.toContain('sk_test_leak');
    expect(html).not.toContain('whsec_abc');
    expect(html).not.toMatch(/sessionData/i);
    expect(html).toContain('[conteúdo omitido]');
  });

  test('tenant comum bloqueado pelo guard', async ({ page }) => {
    await page.route('**/auth/me', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...MOCK_AUTH_USER,
          capabilities: ['dashboard:view'],
          isInternalStaff: false,
          systemRole: 'USER',
          primaryRole: 'USER',
        }),
      }),
    );
    await page.goto('/admin/dashboard');
    await expect(page).not.toHaveURL(/\/admin\/dashboard$/);
  });

  test('aba Empresas — filtro por plano altera request', async ({ page }) => {
    const urls: string[] = [];
    await page.route('**/api/admin/ops/organizations**', route => {
      urls.push(route.request().url());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          page: 1,
          limit: 25,
          total: 0,
          totalPages: 1,
          items: [],
        }),
      });
    });
    await page.goto('/admin/dashboard');
    await page.getByRole('tab', { name: 'Empresas' }).click();
    await page.getByTestId('admin-ops-orgs-plan-filter').selectOption('starter');
    await expect.poll(() => urls.some(u => u.includes('plan=starter'))).toBe(true);
  });

  test('estender trial abre modal e exige motivo', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.getByRole('tab', { name: 'Empresas' }).click();
    await expect(page.getByTestId('admin-ops-orgs-table')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('admin-ops-action-extend').first().click();
    await expect(page.getByTestId('admin-ops-modal-extend')).toBeVisible();
    await expect(page.getByTestId('admin-ops-modal-submit')).toBeDisabled();
    await page.getByTestId('admin-ops-reason-input').fill('Extensão comercial aprovada');
    await expect(page.getByTestId('admin-ops-modal-submit')).toBeEnabled();
  });

  test('moderator sem plans:manage não vê ações', async ({ page }) => {
    await page.route('**/auth/me', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...MOCK_ADMIN_OPS_USER,
          systemRole: 'SYSTEM_MODERATOR',
          primaryRole: 'SYSTEM_MODERATOR',
          capabilities: ['dashboard:global', 'logs:global'],
        }),
      }),
    );
    await page.goto('/admin/dashboard');
    await page.getByRole('tab', { name: 'Empresas' }).click();
    await expect(page.getByTestId('admin-ops-orgs-table')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('admin-ops-action-extend')).toHaveCount(0);
  });

  test('listagem orgs 500 mostra error state na aba Empresas', async ({ page }) => {
    await page.route('**/api/admin/ops/organizations**', route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"fail"}' }),
    );
    await page.goto('/admin/dashboard');
    await page.getByRole('tab', { name: 'Empresas' }).click();
    await expect(page.getByText('Não foi possível carregar empresas.')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('listagem orgs não renderiza strings sensíveis', async ({ page }) => {
    await page.route('**/api/admin/ops/organizations**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ADMIN_OPS_ORGS_MALICIOUS),
      }),
    );
    await page.goto('/admin/dashboard');
    await page.getByRole('tab', { name: 'Empresas' }).click();
    await expect(page.getByTestId('admin-ops-orgs-table')).toBeVisible({ timeout: 15_000 });
    const html = await page.content();
    expect(html).not.toContain('sk_test_leak');
    expect(html).not.toMatch(/sessionData/i);
    expect(html).toContain('[conteúdo omitido]');
  });

  test('aba Segurança — feed de eventos aparece', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.getByRole('tab', { name: 'Segurança' }).click();
    await expect(page.getByTestId('admin-ops-security-feed')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Fatura falhou')).toBeVisible();
    await expect(page.getByText('critical', { exact: true }).first()).toBeVisible();
  });

  test('aba Segurança — filtro level altera query', async ({ page }) => {
    const urls: string[] = [];
    await page.route('**/api/admin/ops/security-events**', route => {
      urls.push(route.request().url());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ADMIN_OPS_SECURITY_EVENTS),
      });
    });
    await page.goto('/admin/dashboard');
    await page.getByRole('tab', { name: 'Segurança' }).click();
    await expect(page.getByTestId('admin-ops-security-feed')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('admin-ops-security-level').selectOption('critical');
    await expect.poll(() => urls.some(u => u.includes('level=critical'))).toBe(true);
  });

  test('aba Segurança — empty state', async ({ page }) => {
    await page.route('**/api/admin/ops/security-events**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...MOCK_ADMIN_OPS_SECURITY_EVENTS, items: [], total: 0 }),
      }),
    );
    await page.goto('/admin/dashboard');
    await page.getByRole('tab', { name: 'Segurança' }).click();
    await expect(page.getByTestId('admin-ops-security-empty')).toBeVisible({ timeout: 15_000 });
  });

  test('aba Segurança — erro 500 mostra error state', async ({ page }) => {
    await page.route('**/api/admin/ops/security-events**', route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"fail"}' }),
    );
    await page.goto('/admin/dashboard');
    await page.getByRole('tab', { name: 'Segurança' }).click();
    await expect(page.getByText('Não foi possível carregar eventos de segurança.')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('aba Segurança — não renderiza strings sensíveis no feed', async ({ page }) => {
    await page.route('**/api/admin/ops/security-events**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ADMIN_OPS_SECURITY_MALICIOUS),
      }),
    );
    await page.goto('/admin/dashboard');
    await page.getByRole('tab', { name: 'Segurança' }).click();
    await expect(page.getByTestId('admin-ops-security-feed')).toBeVisible({ timeout: 15_000 });
    const html = await page.content();
    expect(html).not.toContain('sk_test_leak');
    expect(html).not.toContain('whsec_abc');
    expect(html).not.toMatch(/sessionData/i);
    expect(html).toContain('[conteúdo omitido]');
  });

  test('aba Segurança — botão atualizar refaz request', async ({ page }) => {
    let calls = 0;
    await page.route('**/api/admin/ops/security-events**', route => {
      calls += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ADMIN_OPS_SECURITY_EVENTS),
      });
    });
    await page.goto('/admin/dashboard');
    await page.getByRole('tab', { name: 'Segurança' }).click();
    await expect(page.getByTestId('admin-ops-security-feed')).toBeVisible({ timeout: 15_000 });
    const before = calls;
    await page.getByTestId('admin-ops-security-refresh').click();
    await expect.poll(() => calls).toBeGreaterThan(before);
  });
});
