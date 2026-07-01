import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { MOCK_AUTH_USER } from './mock-panel-api';

/** Inbox — título no header global (banner) e na coluna central. */
export async function expectInboxLoaded(page: Page): Promise<void> {
  await expect(page.getByRole('banner').getByRole('heading', { name: 'Caixa de Entrada' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('main').getByText('Maria Cliente')).toBeVisible({ timeout: 15_000 });
}

/** Leads — aguarda auth + capturas mockadas. */
export async function expectLeadsLoaded(page: Page): Promise<void> {
  await expect(page.getByRole('main').getByRole('heading', { name: 'Leads' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('main').getByText('Ana Lead')).toBeVisible({ timeout: 15_000 });
}

const INBOX_CAPABILITIES = [
  'dashboard:view',
  'inbox:view',
  'inbox:reply',
  'inbox:transfer',
  'inbox:supervise',
  'inbox:department:manage',
  'inbox:reports:view',
  'inbox:ai:manage',
  'webchat:view',
  'webchat:manage',
  'webchat:reply',
  'consent:view',
  'leads:view',
  'send:destination:manage',
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

const MOCK_DEPARTMENTS_FULL = [
  {
    _id: 'dept-1',
    name: 'Comercial',
    description: 'Vendas',
    menuKey: '1',
    clientVisible: true,
    internalRank: 0,
    memberUserIds: ['e2e-user'],
    isActive: true,
    sortOrder: 1,
  },
  {
    _id: 'dept-2',
    name: 'Suporte',
    description: 'Técnico',
    menuKey: '3',
    clientVisible: true,
    internalRank: 0,
    memberUserIds: [],
    isActive: true,
    sortOrder: 2,
  },
];

const MOCK_TEAM_MEMBERS = [
  {
    memberId: 'mem-e2e',
    userId: 'e2e-user',
    email: 'e2e@test.com',
    companyRole: 'OWNER',
    displayName: 'E2E User',
    linked: true,
  },
];

const MOCK_TICKET_STATS = {
  total: 3,
  open: 1,
  inProgress: 1,
  clientReplied: 0,
  waitingTeam: 0,
  slaBreached: 0,
  closed: 1,
};

const MOCK_TICKETS = {
  items: [
    {
      _id: 'ticket-1',
      ticketRef: 'TK-E2E-001',
      ticketStatus: 'in_progress',
      displayStatusLabel: 'Em andamento',
      conversationId: 'conv-wa-active-1',
      contactName: 'João Ativo',
      contactIdentifier: '5511888776655',
      departmentName: 'Suporte',
      assignedUserName: 'E2E User',
      lastMessageAt: new Date().toISOString(),
    },
    {
      _id: 'ticket-2',
      ticketRef: 'TK-E2E-002',
      ticketStatus: 'open',
      displayStatusLabel: 'Aberto',
      conversationId: 'conv-wa-queue-1',
      contactName: 'Maria Cliente',
      contactIdentifier: '5511999887766',
      departmentName: 'Comercial',
      lastMessageAt: new Date(Date.now() - 3600_000).toISOString(),
    },
  ],
  total: 2,
  page: 1,
  limit: 15,
};

const MOCK_INBOX_SETTINGS = {
  welcomeWithCompany: 'Olá! Bem-vindo à {company}.',
  welcomeGeneric: 'Olá! Como podemos ajudar?',
  menuIntro: 'Escolha uma opção:',
  menuFooter: 'Digite o número do setor.',
  queueMessage: 'Aguarde na fila {department}.',
  waitingMessage: 'Posição {waiting}.',
  outsideHoursMessage: 'Fora do horário.',
  invalidMenuHint: 'Opção inválida.',
  resolvedMessage: 'Atendimento encerrado.',
  transferMessage: 'Transferindo…',
  businessHoursEnabled: false,
  timezone: 'America/Sao_Paulo',
  schedule: {
    monday: { enabled: true, start: '09:00', end: '18:00' },
    tuesday: { enabled: true, start: '09:00', end: '18:00' },
    wednesday: { enabled: true, start: '09:00', end: '18:00' },
    thursday: { enabled: true, start: '09:00', end: '18:00' },
    friday: { enabled: true, start: '09:00', end: '18:00' },
    saturday: { enabled: false, start: '09:00', end: '13:00' },
    sunday: { enabled: false, start: '09:00', end: '13:00' },
  },
  roundRobinEnabled: true,
  roundRobinPullTimeoutSeconds: 120,
  maxConcurrentChatsPerAgent: 1,
  queuePositionMessage: 'Posição {position} na fila.',
  queueAllBusyMessage: 'Atendentes ocupados — aguarde na fila.',
  alertSoundEnabled: true,
  alertOnNewChat: true,
  alertOnNewMessage: true,
  inactivityAutoCloseEnabled: false,
  inactivityCloseMinutes: 60,
  inactivityWarningMinutes: 45,
  queueSlaAlertMinutes: 15,
  ticketTeamResponseHours: 4,
  csatEnabled: true,
  csatPrompt: 'De 1 a 5, como avalia?',
  csatThankYou: 'Obrigado!',
  whatsappFallbackEnabled: true,
  whatsappFallbackAlertPhones: ['5511999999999'],
  whatsappFallbackVisitorMessage: 'Encaminhamos para WhatsApp.',
  whatsappFallbackAcceptTimeoutSeconds: 60,
  agentPresenceTimeoutSeconds: 90,
  presenceIdleTimeoutSeconds: 300,
};

const MOCK_INBOX_REPORT = {
  period: { from: new Date(Date.now() - 30 * 86400_000).toISOString(), to: new Date().toISOString() },
  summary: {
    totalConversations: 42,
    resolvedCount: 30,
    inProgressCount: 5,
    waitingCount: 7,
    avgQueueTimeSec: 120,
    avgFirstResponseTimeSec: 45,
    avgResolutionTimeSec: 600,
  },
  byDepartment: [
    {
      departmentId: 'dept-1',
      departmentName: 'Comercial',
      conversations: 20,
      avgQueueTimeSec: 90,
      avgResolutionTimeSec: 500,
    },
  ],
  byAgent: [
    {
      userId: 'e2e-user',
      agentName: 'E2E User',
      conversations: 15,
      avgFirstResponseTimeSec: 40,
      avgResolutionTimeSec: 550,
    },
  ],
};

const MOCK_WEBCHAT_WIDGETS = [
  {
    id: 'widget-e2e-1',
    name: 'Widget E2E',
    publicKey: 'pk_e2e_test_key',
    active: true,
    allowedDomains: ['localhost'],
    appearance: {
      primaryColor: '#2563eb',
      position: 'right' as const,
      title: 'Suporte',
      subtitle: 'Online',
      greeting: 'Olá! Como podemos ajudar?',
      askName: true,
      askPhone: false,
      askEmail: false,
      prechatMode: 'steps' as const,
      previewTemplateId: 'chatbox-compact',
    },
    defaultDepartmentId: 'dept-1',
    aiEscalationPolicy: { mode: 'inherit' as const },
  },
];

const MOCK_WEBCHAT_CONVERSATIONS = [
  {
    id: 'wc-conv-e2e-1',
    status: 'open' as const,
    visitorName: 'Visitante E2E',
    lastMessagePreview: 'Preciso de ajuda',
    lastMessageAt: new Date().toISOString(),
    unreadCount: 1,
    widgetName: 'Widget E2E',
    queueStatus: 'with_agent' as const,
    departmentName: 'Comercial',
    assignedUserName: 'E2E User',
  },
];

const MOCK_LEAD_FORMS = [
  {
    id: 'form-e2e-1',
    name: 'Formulário E2E',
    publicKey: 'lfm_e2e_test_key',
    active: true,
    allowedDomains: ['localhost'],
    appearance: {
      title: 'Fale conosco',
      description: 'Deixe seus dados',
      buttonText: 'Enviar',
      successMessage: 'Obrigado!',
      primaryColor: '#25D366',
      askEmail: true,
      requireEmail: false,
      askMessage: true,
      requireMessage: false,
    },
  },
];

const MOCK_LEAD_CAPTURES = {
  items: [
    {
      id: 'lead-e2e-1',
      formId: 'form-e2e-1',
      formName: 'Formulário E2E',
      name: 'Ana Lead',
      phone: '+5511999887766',
      email: 'ana@exemplo.com',
      message: 'Quero saber mais sobre o produto',
      sourceUrl: 'https://meusite.com/contato',
      origin: 'site',
      status: 'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  total: 1,
};

const MOCK_LEAD_CLASSIFICATION_STATS = {
  totalLeads: 1,
  linkedLeads: 0,
  unlinkedLeads: 1,
  withOptIn: 0,
  pendingConsent: 0,
  blockedCampaign: 0,
  hotWarm: 0,
  byKind: { lead: 1 },
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
      const list = url.searchParams.get('all') === '1' ? MOCK_DEPARTMENTS_FULL : MOCK_DEPARTMENTS_FULL;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(list),
      });
    }

    if (path === '/inbox/members') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TEAM_MEMBERS),
      });
    }

    if (path === '/inbox/tickets/stats') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TICKET_STATS),
      });
    }

    if (path === '/inbox/tickets') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TICKETS),
      });
    }

    if (path === '/inbox/settings') {
      if (req.method() === 'PATCH') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_INBOX_SETTINGS),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_INBOX_SETTINGS),
      });
    }

    if (path === '/inbox/reports' || path.startsWith('/inbox/reports')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_INBOX_REPORT),
      });
    }

    if (path === '/inbox/quick-replies') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { code: 'ola', label: 'Saudação', template: 'Olá [user]!' },
          { code: 'ag', label: 'Aguarde', template: 'Aguarde um momento, [user].' },
        ]),
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
      const convId = decodeURIComponent(detailMatch[1]);
      if (convId.includes('foreign-org')) {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Conversa não encontrada' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildConversationDetail(convId)),
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

  await page.route('**/api/webchat/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api/, '');

    if (path === '/webchat/stats') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          openCount: 1,
          waitingQueueCount: webchatQueueCount,
          myWaitingQueueCount: 1,
          unreadCount: 2,
        }),
      });
    }

    if (path === '/webchat/live-visitors') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ visitors: [], total: 0 }),
      });
    }

    if (path === '/webchat/widgets') {
      if (req.method() === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_WEBCHAT_WIDGETS[0], id: 'widget-new' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_WEBCHAT_WIDGETS),
      });
    }

    if (path === '/webchat/conversations' || path.startsWith('/webchat/conversations?')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_WEBCHAT_CONVERSATIONS),
      });
    }

    const convDetail = path.match(/^\/webchat\/conversations\/([^/]+)$/);
    if (convDetail) {
      const conv = MOCK_WEBCHAT_CONVERSATIONS[0];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversation: conv,
          messages: [
            {
              id: 'wmsg-1',
              direction: 'inbound',
              body: conv.lastMessagePreview,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    }

    if (req.method() === 'PATCH' && path.startsWith('/webchat/widgets/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_WEBCHAT_WIDGETS[0]),
      });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/contact-groups', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );

  await page.route('**/api/leads/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api/, '');

    if (path === '/leads/forms') {
      if (req.method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_LEAD_FORMS[0], id: 'form-new' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_LEAD_FORMS),
      });
    }

    if (path.startsWith('/leads/forms/') && req.method() === 'PATCH') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_LEAD_FORMS[0]),
      });
    }

    if (path === '/leads/captures' && req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_LEAD_CAPTURES),
      });
    }

    if (path === '/leads/classification-stats') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_LEAD_CLASSIFICATION_STATS),
      });
    }

    if (path === '/leads/stats') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: MOCK_LEAD_CAPTURES.total,
          newToday: 1,
          inProgress: 0,
          converted: 0,
          lost: 0,
          topOrigin: 'site',
          topOriginCount: 1,
          byStatus: { new: 1, in_review: 0, in_progress: 0, qualified: 0, converted: 0, lost: 0, spam: 0 },
          funnel: [],
          operational: {
            newOpen: 1,
            whatsappWaiting: 0,
            siteWaiting: 1,
            convertedToday: 0,
            unassigned: 1,
          },
        }),
      });
    }

    if (path === '/leads/segments-summary') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'grp-1', name: 'Lead', leadCount: 2, convertedCount: 1, conversionRate: 50 },
        ]),
      });
    }

    if (path === '/leads/assignees') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ userId: 'user-e2e', displayName: 'E2E User' }]),
      });
    }

    const convertMatch = path.match(/^\/leads\/captures\/([^/]+)\/convert$/);
    if (convertMatch && req.method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...MOCK_LEAD_CAPTURES.items[0], status: 'converted' }),
      });
    }

    const addGroupsMatch = path.match(/^\/leads\/captures\/([^/]+)\/add-to-groups$/);
    if (addGroupsMatch && req.method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_LEAD_CAPTURES.items[0]),
      });
    }

    if (path.startsWith('/leads/forms/') && path.endsWith('/duplicate') && req.method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ...MOCK_LEAD_FORMS[0], id: 'form-dup', name: 'Formulário E2E (cópia)' }),
      });
    }

    const captureMatch = path.match(/^\/leads\/captures\/([^/]+)$/);
    if (captureMatch && req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_LEAD_CAPTURES.items[0]),
      });
    }

    if (captureMatch && req.method() === 'PATCH') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...MOCK_LEAD_CAPTURES.items[0], status: 'in_review' }),
      });
    }

    const openInboxMatch = path.match(/^\/leads\/captures\/([^/]+)\/open-inbox$/);
    if (openInboxMatch && req.method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversationId: 'conv-lead-e2e',
          created: true,
          assigned: true,
        }),
      });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}
