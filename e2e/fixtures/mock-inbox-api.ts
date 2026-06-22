import type { Page } from '@playwright/test';
import { MOCK_AUTH_USER } from './mock-panel-api';

const INBOX_CAPABILITIES = [
  'dashboard:view',
  'inbox:view',
  'inbox:reply',
  'inbox:transfer',
  'inbox:supervise',
  'inbox:department:manage',
  'inbox:reports:view',
  'inbox:ai:manage',
  'webchat:reply',
];

export const MOCK_INBOX_USER = {
  ...MOCK_AUTH_USER,
  capabilities: INBOX_CAPABILITIES,
};

export const MOCK_INBOX_CONVERSATIONS = [
  {
    _id: 'conv-wa-queue-1',
    channel: 'whatsapp_qr' as const,
    contactName: 'Maria Cliente',
    contactIdentifier: '5511999887766',
    status: 'waiting_queue',
    departmentName: 'Comercial',
    lastMessageAt: new Date().toISOString(),
    lastMessagePreview: 'Preciso de ajuda com meu pedido',
    unreadCount: 1,
    canAccept: true,
    priorityForMe: false,
  },
  {
    _id: 'conv-wa-active-1',
    channel: 'whatsapp_qr' as const,
    contactName: 'João Ativo',
    contactIdentifier: '5511888776655',
    status: 'in_progress',
    departmentName: 'Suporte',
    assignedUserName: 'E2E User',
    lastMessageAt: new Date(Date.now() - 120_000).toISOString(),
    lastMessagePreview: 'Obrigado pelo retorno',
    unreadCount: 0,
  },
  {
    _id: 'wc:conv-webchat-1',
    channel: 'webchat_site' as const,
    contactName: 'Visitante Site',
    contactIdentifier: 'visitor-e2e-1',
    status: 'waiting_queue',
    widgetName: 'Widget E2E',
    departmentName: 'Geral',
    lastMessageAt: new Date(Date.now() - 60_000).toISOString(),
    lastMessagePreview: 'Olá, preciso falar com alguém',
    unreadCount: 2,
  },
];

function buildConversationDetail(conversationId: string) {
  const conversation =
    MOCK_INBOX_CONVERSATIONS.find(c => c._id === conversationId) ??
    MOCK_INBOX_CONVERSATIONS[0];
  return {
    conversation,
    messages: [
      {
        _id: 'msg-in-1',
        direction: 'inbound' as const,
        body: conversation.lastMessagePreview ?? 'Mensagem de teste',
        createdAt: new Date(Date.now() - 90_000).toISOString(),
      },
      {
        _id: 'msg-out-1',
        direction: 'outbound' as const,
        body: 'Olá! Em que posso ajudar?',
        createdAt: new Date(Date.now() - 60_000).toISOString(),
        authorName: 'Bot',
      },
    ],
    quickReplies: [{ _id: 'qr-1', shortcut: '/ola', body: 'Olá! Como posso ajudar?' }],
    contactStats: { totalConversations: 2, openTickets: 0 },
    previousConversations: [],
    contact: null,
  };
}

const MOCK_SUPERVISOR_DASHBOARD = {
  generatedAt: new Date().toISOString(),
  periodDays: 7,
  summary: {
    queueCount: 2,
    triageCount: 0,
    activeCount: 1,
    onlineAgents: 1,
    priorityCount: 0,
    avgHandleTimeSec: 420,
    avgPullTimeSec: 35,
    avgCsatScore: 4.2,
  },
  agents: [
    {
      userId: 'e2e-user',
      displayName: 'E2E User',
      email: 'e2e@test.com',
      linked: true,
      online: true,
      availableForQueue: true,
      operationalStatus: 'online',
      statusLabel: 'Online',
      activity: 'inbox',
      activityLabel: 'No Inbox',
      activeCount: 1,
      activeConversations: [MOCK_INBOX_CONVERSATIONS[1]],
      metrics: {
        periodDays: 7,
        conversationsHandled: 12,
        avgHandleTimeSec: 420,
        avgPullTimeSec: 35,
        avgCsatScore: 4.2,
        csatCount: 5,
      },
    },
  ],
  activeConversations: [MOCK_INBOX_CONVERSATIONS[1]],
  queue: [MOCK_INBOX_CONVERSATIONS[0], MOCK_INBOX_CONVERSATIONS[2]],
};

export interface InboxMockOptions {
  webchatQueueCount?: number;
}

/** Mock de `/auth/me` + APIs do Inbox/Supervisor (preview Vite sem backend). */
export async function setupInboxMocks(
  page: Page,
  options: InboxMockOptions = {},
): Promise<void> {
  const webchatQueueCount = options.webchatQueueCount ?? 2;

  await page.route('**/auth/me', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_INBOX_USER),
    }),
  );

  await page.route('**/api/inbox/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api/, '');

    if (path === '/inbox/departments') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { _id: 'dept-1', name: 'Comercial', menuKey: '1', clientVisible: true },
          { _id: 'dept-2', name: 'Suporte', menuKey: '3', clientVisible: true },
        ]),
      });
    }

    if (path === '/inbox/quick-replies') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ _id: 'qr-1', shortcut: '/ola', body: 'Olá!' }]),
      });
    }

    if (path === '/inbox/presence/config') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          idleTimeoutSeconds: 300,
          heartbeatIntervalSeconds: 30,
          offlineTimeoutSeconds: 90,
          selectableStatuses: ['online', 'ausente', 'ocupado', 'offline'],
        }),
      });
    }

    if (path === '/inbox/presence/me') {
      if (req.method() === 'PATCH') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            operationalStatus: 'online',
            statusSource: 'manual',
            statusLabel: 'Online',
            lastManualStatus: 'online',
            online: true,
            availableForQueue: true,
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          operationalStatus: 'online',
          statusSource: 'manual',
          statusLabel: 'Online',
          lastManualStatus: 'online',
          online: true,
          availableForQueue: true,
        }),
      });
    }

    if (path === '/inbox/supervisor/dashboard') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SUPERVISOR_DASHBOARD),
      });
    }

    if (path === '/inbox/conversations') {
      let list = [...MOCK_INBOX_CONVERSATIONS];
      const status = url.searchParams.get('status');
      const channel = url.searchParams.get('channel');
      if (status) list = list.filter(c => c.status === status);
      if (channel === 'webchat') {
        list = list.filter(c => c.channel === 'webchat_site');
      } else if (channel === 'whatsapp') {
        list = list.filter(c => c.channel !== 'webchat_site');
      }
      if (url.searchParams.get('mine') === '1') {
        list = list.filter(c => c.assignedUserName === 'E2E User');
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(list),
      });
    }

    const detailMatch = path.match(/^\/inbox\/conversations\/([^/]+)$/);
    if (detailMatch) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildConversationDetail(decodeURIComponent(detailMatch[1]))),
      });
    }

    if (req.method() === 'POST' && path.includes('/assign')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/sessions', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ status: 'connected', name: 'E2E Session' }]),
    }),
  );

  await page.route('**/api/webchat/stats', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        waitingQueueCount: webchatQueueCount,
        myWaitingQueueCount: 1,
        unreadCount: 2,
      }),
    }),
  );

  await page.route('**/api/webchat/live-visitors', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ visitors: [], total: 0 }),
    }),
  );

  await page.route('**/api/contact-groups', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );
}
