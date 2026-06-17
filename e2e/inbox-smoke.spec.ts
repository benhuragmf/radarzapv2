import { test, expect } from '@playwright/test';

test.describe('Inbox — smoke', () => {
  test('deep link inbox exige login para visitante não autenticado', async ({ page }) => {
    await page.goto('/platform/inbox');
    await expect(page.getByRole('heading', { name: 'Entrar no painel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar com Discord' })).toBeVisible();
  });

  test('visitante não autenticado não vê conteúdo do inbox', async ({ page }) => {
    await page.goto('/platform/inbox');
    await expect(page.getByText('Conversas')).not.toBeVisible();
  });
});
