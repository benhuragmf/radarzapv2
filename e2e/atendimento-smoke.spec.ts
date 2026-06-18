import { test, expect } from '@playwright/test';

/** Rotas do módulo Atendimento (2.10.18) — smoke sem autenticação. */
const ATENDIMENTO_ROUTES = [
  '/platform/inbox',
  '/platform/inbox/tickets',
  '/platform/inbox/setores',
  '/platform/inbox/bot',
  '/platform/inbox/respostas',
  '/platform/inbox/supervisor',
  '/platform/inbox/ia',
  '/platform/inbox/relatorios',
  '/platform/webchat',
] as const;

test.describe('Atendimento — smoke (não autenticado)', () => {
  for (const route of ATENDIMENTO_ROUTES) {
    test(`${route} exige login`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByRole('heading', { name: 'Entrar no painel' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Entrar com Discord' })).toBeVisible();
    });
  }

  test('deep link inbox não expõe conteúdo protegido', async ({ page }) => {
    await page.goto('/platform/inbox');
    await expect(page.getByText('Conversas')).not.toBeVisible();
    await expect(page.getByText('Tickets de atendimento')).not.toBeVisible();
  });
});
