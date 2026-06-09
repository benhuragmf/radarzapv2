import { defineConfig, devices } from '@playwright/test';

const previewPort = 4174;
const previewHost = '127.0.0.1';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://${previewHost}:${previewPort}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: `npm run preview --prefix src/services/web-dashboard/frontend -- --port ${previewPort} --host ${previewHost}`,
    url: `http://${previewHost}:${previewPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
