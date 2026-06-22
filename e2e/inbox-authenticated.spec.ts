import { test, expect } from '@playwright/test';
import { setupInboxMocks } from './fixtures/mock-inbox-api';

const INBOX_ROUTE = '/platform/inbox';
const SUPERVISOR_ROUTE = '/platform/inbox/supervisor';

test.describe('Inbox — autenticado (mock API)', () => {
  test.beforeEach(async ({ page }) => {
    await setupInboxMocks(page);
    await page.goto(INBOX_ROUTE);
    await expect(page.getByRole('main').getByRole('heading', { name: 'Caixa de Entrada' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('exibe lista de conversas e estado vazio', async ({ page }) => {
    await expect(page.getByText('Maria Cliente')).toBeVisible();
    await expect(page.getByText('João Ativo')).toBeVisible();
    await expect(page.getByText('Visitante Site')).toBeVisible();
    await expect(page.getByText('Selecione uma conversa')).toBeVisible();
  });

  test('filtro Fila mostra apenas conversas aguardando', async ({ page }) => {
    await page.getByRole('button', { name: 'Fila', exact: true }).click();
    await expect(page.getByText('Maria Cliente')).toBeVisible();
    await expect(page.getByText('Visitante Site')).toBeVisible();
    await expect(page.getByText('João Ativo')).not.toBeVisible();
  });

  test('seleciona conversa na fila e exibe thread + Assumir', async ({ page }) => {
    await page.getByText('Maria Cliente').click();
    await expect(page.getByText('Preciso de ajuda com meu pedido')).toBeVisible();
    const assumir = page.getByRole('main').getByRole('button', { name: 'Assumir' });
    await expect(assumir.first()).toBeVisible();
    await expect(page.getByPlaceholder(/Aceite a conversa|Digite sua resposta/i)).toBeVisible();
  });

  test('banner WebChat quando há fila no site', async ({ page }) => {
    await expect(page.getByText(/chat\(s\) do site aguardando atendente/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test('assign POST ao clicar Assumir', async ({ page }) => {
    await page.getByText('Maria Cliente').click();
    const assignPromise = page.waitForRequest(
      req => req.method() === 'POST' && req.url().includes('/inbox/conversations/conv-wa-queue-1/assign'),
    );
    await page.getByRole('main').getByRole('button', { name: 'Assumir' }).first().click();
    await assignPromise;
  });
});

test.describe('Supervisor — autenticado (mock API)', () => {
  test.beforeEach(async ({ page }) => {
    await setupInboxMocks(page);
    await page.goto(SUPERVISOR_ROUTE);
    await expect(page.getByRole('main').getByRole('heading', { name: 'Supervisão' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('exibe métricas e fila ao vivo', async ({ page }) => {
    await expect(page.getByText('Fila ao vivo', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('main').getByText('Em atendimento', { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /^Equipe ao vivo/i })).toBeVisible();
    await page.getByRole('button', { name: /^Fila/i }).click();
    await expect(page.getByText('Maria Cliente')).toBeVisible();
    await page.getByRole('button', { name: /^Em atendimento/i }).click();
    await expect(page.getByText('João Ativo')).toBeVisible();
  });

  test('link volta para Caixa de Entrada', async ({ page }) => {
    await page.getByRole('link', { name: '← Caixa de Entrada' }).click();
    await expect(page.getByRole('main').getByRole('heading', { name: 'Caixa de Entrada' })).toBeVisible();
  });
});
