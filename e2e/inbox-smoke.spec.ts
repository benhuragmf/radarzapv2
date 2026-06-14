import { test, expect } from '@playwright/test';

test.describe('Inbox — smoke', () => {
  test('rota protegida redireciona visitante não autenticado', async ({ page }) => {
    await page.goto('/platform/inbox');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login permanece acessível a partir de deep link inbox', async ({ page }) => {
    await page.goto('/platform/inbox');
    await expect(page.getByRole('heading', { name: 'Entrar no painel' })).toBeVisible();
  });
});
