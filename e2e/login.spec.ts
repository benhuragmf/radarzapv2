import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('exibe título e botões de autenticação', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'RadarZap' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Entrar no painel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar com Google' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar com Discord' })).toBeVisible();
  });

  test('viewport mobile mantém conteúdo acessível', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    const googleBtn = page.getByRole('button', { name: 'Entrar com Google' });
    await expect(googleBtn).toBeVisible();
    const box = await googleBtn.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
  });
});
