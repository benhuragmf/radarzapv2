import { test, expect } from '@playwright/test';
import { setupInboxMocks } from './fixtures/mock-inbox-api';

/** Smoke § B do checklist QA Fase 1 — rotas Atendimento com mock API. */
const PANEL_ROUTES: Array<{
  path: string;
  heading: string;
  content: string;
  waitApi?: string;
}> = [
  {
    path: '/platform/inbox/tickets',
    heading: 'Chamados de atendimento',
    content: 'TK-E2E-001',
  },
  {
    path: '/platform/inbox/setores',
    heading: 'Setores de atendimento',
    content: 'Comercial',
  },
  {
    path: '/platform/inbox/bot',
    heading: 'Triagem e Bot',
    content: 'CSAT — satisfação pós-atendimento',
  },
  {
    path: '/platform/inbox/respostas',
    heading: 'Respostas rápidas',
    content: 'Saudação',
  },
  {
    path: '/platform/inbox/relatorios',
    heading: 'Métricas de atendimento',
    content: 'Conversas',
  },
  {
    path: '/platform/webchat',
    heading: 'Chat do Site',
    content: 'Widget E2E',
  },
] as const;

test.describe('QA Fase 1 — painel Atendimento (mock API)', () => {
  test.beforeEach(async ({ page }) => {
    await setupInboxMocks(page);
  });

  for (const route of PANEL_ROUTES) {
    test(`${route.path} carrega conteúdo principal`, async ({ page }) => {
      await Promise.all([
        page.waitForResponse(r => r.url().includes('/auth/me') && r.status() === 200),
        page.goto(route.path),
      ]);
      const responseWait = route.waitApi
        ? page.waitForResponse(
            r => r.url().includes(route.waitApi!) && r.status() === 200,
            { timeout: 15_000 },
          )
        : null;
      if (responseWait) await responseWait;
      await expect(page.getByRole('main').getByRole('heading', { name: route.heading })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(route.content, { exact: false }).first()).toBeVisible({
        timeout: 15_000,
      });
    });
  }

  test('/platform/inbox/tickets exibe métricas e paginação', async ({ page }) => {
    await page.goto('/platform/inbox/tickets');
    await expect(page.getByText('Abertos', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('TK-E2E-002')).toBeVisible();
    await expect(page.getByPlaceholder(/Buscar ticket/i)).toBeVisible();
  });

  test('/platform/webchat aba Widgets lista widget', async ({ page }) => {
    await page.goto('/platform/webchat?tab=widgets');
    await expect(page.getByRole('main').getByRole('heading', { name: 'Chat do Site' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: /Widget E2E/i }).first()).toBeVisible();
  });
});
