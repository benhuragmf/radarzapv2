import { test, expect } from '@playwright/test';
import { setupInboxMocks } from './fixtures/mock-inbox-api';

const MOCK_STATS = {
  total: 3,
  newToday: 1,
  inProgress: 1,
  converted: 1,
  lost: 0,
  topOrigin: 'site',
  topOriginCount: 2,
  byStatus: { new: 1, in_review: 0, in_progress: 1, qualified: 0, converted: 1, lost: 0, spam: 0 },
  funnel: [
    { status: 'new', count: 1, label: 'Novo' },
    { status: 'in_progress', count: 1, label: 'Em atendimento' },
    { status: 'qualified', count: 0, label: 'Qualificado' },
    { status: 'converted', count: 1, label: 'Convertido' },
    { status: 'lost', count: 0, label: 'Perdido' },
  ],
  operational: {
    newOpen: 1,
    whatsappWaiting: 0,
    siteWaiting: 1,
    convertedToday: 0,
    unassigned: 2,
  },
};

/** Leads — stats, kanban, integração (mock API). */
test.describe('Leads — painel expandido (mock)', () => {
  test.beforeEach(async ({ page }) => {
    await setupInboxMocks(page);

    await page.route('**/api/leads/stats', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_STATS),
      }),
    );

    await page.route('**/api/leads/segments-summary', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'grp-1', name: 'Lead', leadCount: 2, convertedCount: 1, conversionRate: 50 },
        ]),
      }),
    );

    await page.route('**/api/leads/assignees', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ userId: 'user-e2e', displayName: 'E2E User' }]),
      }),
    );
  });

  test('carrega métricas e aba Capturas', async ({ page }) => {
    await page.goto('/platform/leads');
    await expect(page.getByText('Novos')).toBeVisible();
    await expect(page.getByText('WhatsApp aguardando')).toBeVisible();
    await expect(page.getByText('Ana Lead')).toBeVisible();
  });

  test('alterna para Kanban', async ({ page }) => {
    await page.goto('/platform/leads');
    await page.getByRole('button', { name: /Kanban/i }).click();
    await expect(page.getByText(/entrada(s)? comercial(is)?/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Ana Lead/i })).toBeVisible();
  });

  test('aba Listas e segmentos', async ({ page }) => {
    await page.goto('/platform/leads');
    await page.getByRole('button', { name: /Listas e segmentos/i }).click();
    await expect(page.getByRole('heading', { name: 'Lead', exact: true })).toBeVisible();
    await expect(page.getByText('50%')).toBeVisible();
  });

  test('aba Integrar mostra prévia', async ({ page }) => {
    await page.goto('/platform/leads');
    await page.getByRole('button', { name: /Integrar no site/i }).click();
    await expect(page.getByText('Pré-visualização ao vivo')).toBeVisible();
    await expect(page.locator('iframe[title*="Preview"]')).toBeVisible();
  });
});
