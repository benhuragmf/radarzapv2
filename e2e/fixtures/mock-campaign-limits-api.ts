import type { Page } from '@playwright/test';
import { MOCK_AUTH_USER } from './mock-panel-api';

export const MOCK_CAMPAIGN_DELAYS = {
  protectedTiers: [
    { id: 'minimum', label: 'Mínimo', baseSec: 30, jitterMinSec: 30, jitterMaxSec: 39, enabled: true },
    { id: 'normal', label: 'Normal', baseSec: 40, jitterMinSec: 40, jitterMaxSec: 59, enabled: true },
    { id: 'optimal', label: 'Ótimo', baseSec: 60, jitterMinSec: 60, jitterMaxSec: 80, enabled: true },
  ],
  protectedDefaultTierId: 'normal',
  riskDelaysSec: [3, 10, 20],
  riskMinSec: 3,
};

export const MOCK_SEND_POLICY = {
  canDisableProtection: true,
  isOwner: true,
  allowMembersDisableProtection: false,
  campaignDelays: MOCK_CAMPAIGN_DELAYS,
  defaultProtectedDelayMs: 40_000,
  defaultRiskDelayMs: 3_000,
  system: {
    marketingDefaultMaxPerMinute: 2,
    marketingCapMaxPerMinute: 10,
    humanizeEnabled: true,
    composingEnabled: true,
  },
  org: {
    marketingMaxPerMinute: 2,
    marketingEnabled: true,
    limitsDisabled: false,
    humanizeEnabled: true,
    composingEnabled: true,
  },
  effective: {
    marketingMaxPerMinute: 2,
    marketingMinIntervalMs: 30_000,
    marketingMinIntervalSec: 30,
    humanizeEnabled: true,
    composingEnabled: true,
    protectedMode: true,
    avgDelayMs: 49_500,
    avgDelaySec: 50,
  },
  protectedDelayOptionsMs: [30_000, 40_000, 60_000],
  riskDelayOptionsMs: [3_000, 10_000, 20_000],
  delayJitterHint: 'Cada envio aguarda 40–59s (aleatório, não fixo em 40s).',
};

const MOCK_ADMIN_POLICY = {
  policy: {
    humanizeEnabled: true,
    composingEnabled: true,
    defaults: {
      conversation: { enabled: true, maxPerMinute: 10 },
      marketing: { enabled: true, maxPerMinute: 2 },
      alert: { enabled: true, maxPerMinute: 30 },
    },
    caps: { conversation: 30, marketing: 10, alert: 60 },
    campaignDelays: MOCK_CAMPAIGN_DELAYS,
  },
};

const MOCK_TENANT_WA_LIMITS = {
  humanizeEnabled: true,
  composingEnabled: true,
  limitsDisabled: false,
  allowMembersDisableCampaignProtection: false,
  caps: { conversation: 30, marketing: 10, alert: 60 },
  conversation: { enabled: true, maxPerMinute: 10 },
  marketing: { enabled: true, maxPerMinute: 2 },
  alert: { enabled: true, maxPerMinute: 30 },
};

const SEND_CAPABILITIES = [
  'dashboard:view',
  'send:test',
  'send:destination:manage',
  'send:schedule:manage',
  'whatsapp:session:manage',
  'billing:view',
];

const ADMIN_CAPABILITIES = [
  ...SEND_CAPABILITIES,
  'system:settings:manage',
];

export async function setupSendMocks(page: Page): Promise<void> {
  const user = { ...MOCK_AUTH_USER, capabilities: SEND_CAPABILITIES };

  await page.route('**/auth/me', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }),
  );

  await page.route('**/api/billing/me', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        usage: { messagesUsed: 10 },
        limits: { messagesPerDay: 500, groupsMax: 50, templatesMax: 20 },
        plan: 'pro',
      }),
    }),
  );

  await page.route(/\/api\/campaigns\/send-policy\/?$/, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SEND_POLICY) }),
  );

  await page.route(/\/api\/sessions\/?$/, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { clientId: 'org-e2e', status: 'connected', waAccountType: 'standard' },
      ]),
    }),
  );

  await page.route('**/api/destinations**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          _id: 'dest-1',
          name: 'Contato QA',
          identifier: '5511999887766',
          type: 'contact',
          consentStatus: 'accepted',
          contactGroupIds: [],
        },
      ]),
    }),
  );

  for (const path of [
    '**/api/contact-groups**',
    '**/api/leads/segments-summary**',
    '**/api/destinations/smart-segments**',
    '**/api/platform/templates**',
  ]) {
    await page.route(path, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
  }

  await page.route('**/api/campaigns/validate-destinations', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, eligible: ['dest-1'], blocked: [] }),
    }),
  );
}

export async function setupAdminSettingsMocks(page: Page): Promise<void> {
  const user = {
    ...MOCK_AUTH_USER,
    isInternalStaff: true,
    systemRole: 'SYSTEM_ADMIN',
    capabilities: ADMIN_CAPABILITIES,
  };

  await page.route('**/auth/me', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }),
  );

  await page.route('**/api/admin/whatsapp-send-policy', async route => {
    if (route.request().method() === 'PATCH') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ADMIN_POLICY),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ADMIN_POLICY),
    });
  });
}

export async function setupWaLimitsMocks(page: Page): Promise<void> {
  const user = { ...MOCK_AUTH_USER, capabilities: SEND_CAPABILITIES };

  await page.route('**/auth/me', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }),
  );

  await page.route('**/api/platform/whatsapp-send-limits', async route => {
    if (route.request().method() === 'PATCH') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TENANT_WA_LIMITS),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_TENANT_WA_LIMITS),
    });
  });
}
