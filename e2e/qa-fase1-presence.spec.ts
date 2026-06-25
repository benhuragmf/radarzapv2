import { test, expect } from '@playwright/test';
import { expectInboxLoaded, setupInboxMocks } from './fixtures/mock-inbox-api';

const INBOX_ROUTE = '/platform/inbox';

test.describe('QA Fase 1 — presença operacional (mock API)', () => {
  test.beforeEach(async ({ page }) => {
    await setupInboxMocks(page);
    await page.goto(INBOX_ROUTE);
    await expectInboxLoaded(page);
  });

  test('exibe seletor de status no header', async ({ page }) => {
    await expect(page.getByTitle('Online')).toBeVisible({ timeout: 15_000 });
  });

  test('troca status para Ocupado via PATCH', async ({ page }) => {
    await expect(page.getByTitle('Online')).toBeVisible({ timeout: 15_000 });
    const patchPromise = page.waitForRequest(
      req => req.method() === 'PATCH' && req.url().includes('/inbox/presence/me'),
    );
    await page.getByTitle('Online').click();
    await page.getByRole('button', { name: /Ocupado — não receber novos/i }).click();
    await patchPromise;
  });
});
