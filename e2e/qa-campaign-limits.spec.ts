import { test, expect } from '@playwright/test';
import {
  setupAdminSettingsMocks,
  setupSendMocks,
  setupWaLimitsMocks,
} from './fixtures/mock-campaign-limits-api';

test.describe('QA — limites de campanha v2.12.22 (mock API)', () => {
  test('/admin/settings exibe intervalos de campanha editáveis', async ({ page }) => {
    await setupAdminSettingsMocks(page);
    await page.goto('/admin/settings');
    await expect(page.getByRole('main').getByRole('heading', { name: 'Configurações gerais' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Intervalos de campanha (Enviar agora)')).toBeVisible();
    await expect(page.getByText('Base (s)').first()).toBeVisible();
    await expect(page.getByText('Modo risco (proteção desligada)')).toBeVisible();
    await expect(page.getByText('Opção 1 (s)')).toBeVisible();
  });

  test('/platform/wa-limits exibe liberacao equipe anti-ban', async ({ page }) => {
    await setupWaLimitsMocks(page);
    await page.goto('/platform/wa-limits');
    await expect(page.getByRole('main').getByRole('heading', { name: 'Limites de envio WhatsApp' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText('Permitir que a equipe desative a proteção anti-ban no Enviar agora'),
    ).toBeVisible();
  });

  test('/send exibe hierarquia e tiers 30/40/60', async ({ page }) => {
    await setupSendMocks(page);
    const policyReady = page.waitForResponse(
      res => res.url().includes('/campaigns/send-policy') && res.status() === 200,
    );
    await page.goto('/send');
    await policyReady;
    await expect(page.getByRole('main').getByRole('heading', { name: 'Enviar agora' })).toBeVisible({ timeout: 15_000 });
    await page.getByText('3. Quando e como enviar').scrollIntoViewIfNeeded();
    await expect(page.getByText('Hierarquia de limites (admin → empresa → envio)')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Proteção anti-banimento do WhatsApp')).toBeVisible();
    await expect(page.getByText('Intervalo entre destinos (modo protegido)')).toBeVisible();
    const select = page.locator('select').filter({ has: page.locator('option[value="40000"]') });
    await expect(select).toBeVisible();
    await expect(select.locator('option[value="30000"]')).toHaveCount(1);
    await expect(select.locator('option[value="60000"]')).toHaveCount(1);
  });
});
