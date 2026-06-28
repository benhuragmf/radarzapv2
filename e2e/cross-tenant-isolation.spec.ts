import { test, expect } from '@playwright/test';
import { expectInboxLoaded, expectLeadsLoaded, setupInboxMocks } from './fixtures/mock-inbox-api';

const FOREIGN_CONV = 'conv-foreign-org-999';

/** E2E mock — simula backend rejeitando recursos de outra organização (AH-M04). */
test.describe('Cross-tenant — painel autenticado (mock API)', () => {
  test.beforeEach(async ({ page }) => {
    await setupInboxMocks(page);
  });

  test('Inbox — deep link conv estrangeira retorna 404 e não exibe thread', async ({ page }) => {
    const detail404 = page.waitForResponse(
      res =>
        res.url().includes(`/inbox/conversations/${FOREIGN_CONV}`) && res.status() === 404,
    );
    await page.goto(`/platform/inbox?conv=${FOREIGN_CONV}`);
    await detail404;
    await expectInboxLoaded(page);
    await expect(page.getByText('Preciso de ajuda com meu pedido')).not.toBeVisible();
  });

  test('Leads — lista mock não expõe captura foreign (escopo tenant)', async ({ page }) => {
    await page.goto('/platform/leads');
    await expectLeadsLoaded(page);
    await expect(page.getByText('Ana Lead')).toBeVisible();
    await expect(page.getByText('Foreign Org Lead')).not.toBeVisible();
  });

  test('WebChat — stats tenant-scoped permanecem visíveis', async ({ page }) => {
    await page.goto('/platform/webchat');
    await expect(page.getByRole('main').getByRole('heading', { name: 'Chat do Site' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Widget E2E')).toBeVisible();
  });
});
