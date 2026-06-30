import type { Page } from '@playwright/test';
import { MOCK_INBOX_USER } from './mock-inbox-api';

export const MOCK_LGPD_LOOKUP = [
  {
    id: 'dest-lgpd-1',
    name: 'Maria Titular',
    identifierMasked: '55***66',
    consentStatus: 'ACCEPTED',
    isActive: true,
  },
];

export const MOCK_LGPD_EVENTS = [
  {
    id: 'ev-lgpd-1',
    kind: 'lgpd.export_requested',
    createdAt: new Date().toISOString(),
    actorUserId: 'e2e-user',
    meta: { destinationId: 'dest-lgpd-1', identifierMasked: '55***66' },
  },
];

const LGPD_USER = {
  ...MOCK_INBOX_USER,
  capabilities: [...MOCK_INBOX_USER.capabilities, 'consent:manual-block'],
};

export async function setupLgpdMocks(page: Page): Promise<void> {
  await page.route('**/auth/me', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(LGPD_USER),
    }),
  );

  await page.route('**/api/lgpd/lookup**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: MOCK_LGPD_LOOKUP }),
    }),
  );

  await page.route('**/api/lgpd/events**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ events: MOCK_LGPD_EVENTS }),
    }),
  );

  await page.route('**/api/lgpd/destinations/*/export', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        schema: 'radarchat-lgpd-export-v1',
        exportedAt: new Date().toISOString(),
        destination: { id: 'dest-lgpd-1', name: 'Maria Titular' },
        consentHistory: [],
      }),
    }),
  );

  await page.route('**/api/lgpd/destinations/*/anonymize', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, destinationId: 'dest-lgpd-1' }),
    }),
  );
}
