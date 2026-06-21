import { test, expect } from '@playwright/test';
import { setupAiAtendimentoMocks } from './fixtures/mock-panel-api';

const IA_ROUTE = '/platform/inbox/ia';

test.describe('Modos de atendimento — IA Atendimento (mock auth)', () => {
  test.beforeEach(async ({ page }) => {
    await setupAiAtendimentoMocks(page, { attendanceMode: 'disabled' });
    await page.goto(IA_ROUTE);
    await expect(page.getByTestId('attendance-mode-disabled')).toBeVisible({ timeout: 15_000 });
  });

  test('exibe os 4 modos de atendimento', async ({ page }) => {
    await expect(page.getByTestId('attendance-mode-disabled')).toBeVisible();
    await expect(page.getByTestId('attendance-mode-robotic')).toBeVisible();
    await expect(page.getByTestId('attendance-mode-basic_triage')).toBeVisible();
    await expect(page.getByTestId('attendance-mode-premium_assistant')).toBeVisible();
  });

  test('modo Robotizado mostra banner e link Triagem e Bot', async ({ page }) => {
    await page.getByTestId('attendance-mode-robotic').click();
    await expect(page.getByText('O modo robotizado não ativa IA generativa')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Triagem e Bot' }).first()).toBeVisible();
  });

  test('modo IA Básica mostra banner de triagem local', async ({ page }) => {
    await page.getByTestId('attendance-mode-basic_triage').click();
    await expect(page.getByText(/IA Básica usa classificador local/)).toBeVisible();
  });

  test('modo IA Premium habilita provedor RadarZap', async ({ page }) => {
    await page.getByTestId('attendance-mode-premium_assistant').click();
    await expect(page.getByText(/Usar IA Premium no widget/)).toBeVisible();
    const radarzapRadio = page.getByRole('radio', { name: /RadarZap/ });
    await expect(radarzapRadio).toBeEnabled();
    await expect(radarzapRadio).toBeChecked();
  });

  test('aba Logs exibe breakdown por modo', async ({ page }) => {
    await page.getByRole('button', { name: 'Logs e custos' }).click();
    await expect(page.getByRole('heading', { name: /Uso e custos estimados/ })).toBeVisible();
    const logsCard = page.locator('.bg-brand-500\\/10').filter({ hasText: 'IA Premium' });
    await expect(logsCard.getByText('5')).toBeVisible();
    const basicCard = page.locator('.bg-amber-500\\/10').filter({ hasText: 'IA Básica (LLM)' });
    await expect(basicCard.getByText('7')).toBeVisible();
  });

  test('salvar envia attendanceMode no PATCH', async ({ page }) => {
    const patchPromise = page.waitForRequest(
      req => req.method() === 'PATCH' && req.url().includes('/platform/ai/settings'),
    );
    await page.getByTestId('attendance-mode-robotic').click();
    await page.getByRole('button', { name: 'Salvar configurações' }).click();
    const req = await patchPromise;
    const body = req.postDataJSON() as { settings: { attendanceMode: string } };
    expect(body.settings.attendanceMode).toBe('robotic');
    await expect(page.getByText('Configurações salvas')).toBeVisible();
  });
});
