import { test, expect } from '@playwright/test';
import { setupLgpdMocks } from './fixtures/mock-lgpd-api';

test.describe('Portal LGPD — tenant (mock)', () => {
  test.beforeEach(async ({ page }) => {
    await setupLgpdMocks(page);
    await page.goto('/platform/lgpd');
  });

  test('carrega página e feed de eventos', async ({ page }) => {
    await expect(
      page.getByRole('main').getByRole('heading', { name: /Portal LGPD/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Exportação solicitada')).toBeVisible();
  });

  test('busca por telefone lista contato', async ({ page }) => {
    await page.getByPlaceholder('5511999999999').fill('5511999887766');
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.getByText('Maria Titular')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('55***66')).toBeVisible();
  });

  test('painel anonimizar exibe confirmação', async ({ page }) => {
    await page.getByPlaceholder('5511999999999').fill('5511999887766');
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.getByText('Maria Titular')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Anonimizar/i }).click();
    await expect(page.getByText(/Anonimização irreversível/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar anonimização' })).toBeVisible();
  });
});
