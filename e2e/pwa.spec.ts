import { test, expect } from '@playwright/test';

test.describe('PWA', () => {
  test('manifest e meta theme-color presentes', async ({ page }) => {
    await page.goto('/login');
    const manifest = page.locator('link[rel="manifest"]');
    await expect(manifest).toHaveAttribute('href', '/manifest.webmanifest');

    const theme = page.locator('meta[name="theme-color"]');
    await expect(theme).toHaveAttribute('content', '#07111f');
  });

  test('manifest.webmanifest é JSON válido', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.name).toBe('Radar Chat');
    expect(body.display).toBe('standalone');
    expect(body.start_url).toBe('/platform/inbox');
    expect(Array.isArray(body.icons)).toBeTruthy();
  });

  test('service worker registrável', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toContain('radar-chat-shell');
  });
});
