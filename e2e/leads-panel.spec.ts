import { test, expect } from '@playwright/test';
import { expectLeadsLoaded, setupInboxMocks } from './fixtures/mock-inbox-api';

/** Leads — stats, kanban, integração (mock API). */
test.describe('Leads — painel expandido (mock)', () => {
  test.beforeEach(async ({ page }) => {
    await setupInboxMocks(page);
    await page.goto('/platform/leads');
    await expectLeadsLoaded(page);
  });

  test('carrega métricas e aba Capturas', async ({ page }) => {
    await expect(page.getByText('Novos')).toBeVisible();
    await expect(page.getByText('WhatsApp aguardando')).toBeVisible();
    await expect(page.getByText('Ana Lead')).toBeVisible();
  });

  test('alterna para Kanban', async ({ page }) => {
    const kanbanBtn = page.getByRole('button', { name: /Kanban/i });
    await expect(kanbanBtn).toBeVisible();
    await kanbanBtn.click();
    await expect(page.getByText(/entrada(s)? comercial(is)?/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Ana Lead/i })).toBeVisible();
  });

  test('aba Listas e segmentos', async ({ page }) => {
    await page.getByRole('button', { name: /Listas e segmentos/i }).click();
    await expect(page.getByRole('heading', { name: 'Lead', exact: true })).toBeVisible();
    await expect(page.getByText('50%')).toBeVisible();
  });

  test('aba Formulários mostra integração e prévia', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.getByRole('button', { name: /Formulários/i }).click();
    await expect(page.getByText('Por onde começar?')).toBeVisible();
    await expect(page.getByText('Pré-visualização')).toBeVisible();
    await page.getByRole('button', { name: /Integrar no site/i }).click();
    await expect(page.locator('iframe[title*="Preview"]')).toBeVisible();
  });
});
