import { test, expect } from '@playwright/test';

test.describe('PWA', () => {
  test('manifest e meta theme-color presentes', async ({ page }) => {
    await page.goto('/login');
    const manifest = page.locator('link[rel="manifest"]');
    await expect(manifest).toHaveAttribute('href', '/manifest.webmanifest');

    const theme = page.locator('meta[name="theme-color"]');
    await expect(theme).toHaveAttribute('content', '#22c55e');
  });

  test('manifest.webmanifest é JSON válido', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.name).toBe('RadarZap');
    expect(body.display).toBe('standalone');
    expect(Array.isArray(body.icons)).toBeTruthy();
  });
});
