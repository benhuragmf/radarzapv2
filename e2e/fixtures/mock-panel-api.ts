import type { Page } from '@playwright/test';

type AttendanceMode = 'disabled' | 'robotic' | 'basic_triage' | 'premium_assistant';

export const MOCK_AUTH_USER = {
  userId: 'e2e-user',
  discordId: null,
  username: 'E2E User',
  avatar: null,
  email: 'e2e@test.com',
  authProvider: 'google' as const,
  plan: 'pro',
  systemRole: 'USER',
  primaryRole: 'USER',
  companyRole: 'OWNER' as const,
  organizationId: 'org-e2e',
  organizationName: 'E2E Org',
  organizations: [
    {
      organizationId: 'org-e2e',
      organizationName: 'E2E Org',
      companyRole: 'OWNER' as const,
      ownerEmail: null,
      ownerName: null,
    },
  ],
  needsOrganizationChoice: false,
  hasDiscordAccess: false,
  capabilities: ['inbox:ai:manage', 'dashboard:view', 'inbox:view'],
  guilds: [],
  isInternalStaff: false,
  menuType: 'client' as const,
};

const MODEL_OPTION = {
  id: 'gpt-4o-mini',
  label: 'GPT-4o mini',
  description: 'Modelo econômico para testes E2E',
  inputUsdPer1M: 0.15,
  outputUsdPer1M: 0.6,
  tier: 'economy' as const,
  recommended: true,
  typicalTurnCostUsd: 0.001,
};

const TRANSFER_RULES = {
  onHumanRequest: true,
  onAngryClient: true,
  onCancellation: true,
  onLegal: true,
  onLowConfidence: true,
  onRepeatedQuestion: true,
  onMinDataCollected: true,
  onSensitiveMessage: true,
  onUninterpretableMedia: true,
  lowConfidenceThreshold: 0.45,
  repeatedQuestionCount: 3,
};

function legacyFromMode(mode: AttendanceMode) {
  if (mode === 'premium_assistant') {
    return { mode: 'radarzap' as const, enabled: true };
  }
  return { mode: 'disabled' as const, enabled: false };
}

function buildAiSettingsPayload(attendanceMode: AttendanceMode = 'disabled') {
  const legacy = legacyFromMode(attendanceMode);
  return {
    settings: {
      enabled: legacy.enabled,
      mode: legacy.mode,
      attendanceMode,
      provider: 'openai' as const,
      model: MODEL_OPTION.id,
      temperature: 0.4,
      maxTokens: 800,
      dailyLimit: 100,
      monthlyLimit: 2000,
      perConversationLimit: 20,
      transferRules: { ...TRANSFER_RULES },
    },
    prompt: {
      agentName: 'Assistente E2E',
      greetingKnown: 'Olá!',
      greetingUnknown: 'Olá, bem-vindo!',
      customRules: '',
      useSystemContext: true,
      skipKnownFields: true,
      autoResolveEnabled: false,
      basicTriageLlmFallbackEnabled: true,
      learnSkillsEnabled: false,
      learnMemoryEnabled: true,
      collectName: true,
      collectEmail: false,
      collectProblem: true,
      collectCpfCnpj: false,
      collectAddress: false,
      collectOrderNumber: false,
      collectUrgency: false,
      collectAttachments: false,
    },
    knowledgeBase: [],
    skills: [],
    memories: [],
    usage: {
      dailyUsed: 5,
      monthlyUsed: 42,
      dailyLimit: 100,
      monthlyLimit: 2000,
      perConversationLimit: 20,
      meteringMode: 'radarzap_calls' as const,
      companyCallsToday: 0,
      dailyCreditsSpent: 1.25,
      monthlyCreditsSpent: 8.4,
      moduleCreditEstimates: { basic_triage: 1, premium_assistant: 2 },
      dailyByKind: {
        premium_assistant: { calls: 2, tokens: 900, cost: 0.02, credits: 2 },
        basic_triage: { calls: 1, tokens: 120, cost: 0.001, credits: 0.1 },
      },
      dailyCreditsByKind: {
        premium_assistant: { calls: 2, tokens: 900, cost: 0.02, credits: 2 },
        basic_triage: { calls: 1, tokens: 120, cost: 0.001, credits: 0.1 },
      },
      wallet: {
        monthlyIncluded: 400,
        purchased: 50,
        totalAllowance: 450,
        usedThisMonth: 2.1,
        balance: 447.9,
        learningUsed: 3,
        learningLimit: 30,
        learningBalance: 27,
        depleted: false,
        learningDepleted: false,
        actionHint: null,
      },
    },
    apiKeyMasked: null,
    hasApiKey: false,
    planLimits: { radarzapAllowed: true, dailyLimit: 100, monthlyLimit: 2000 },
    modelCatalog: [MODEL_OPTION],
    modelCatalogs: { gemini: [], openai: [MODEL_OPTION] },
    selectedModelPricing: MODEL_OPTION,
    blueprintInfo: {
      managedBy: 'radarzap' as const,
      version: 1,
      agentName: 'Assistente',
      defaultAgentName: 'Assistente RadarZap',
      defaultGreetingKnown: 'Olá!',
      defaultGreetingUnknown: 'Olá, bem-vindo!',
      updatedAt: new Date().toISOString(),
    },
  };
}

const MOCK_USAGE_DETAIL = {
  rows: [
    {
      id: 'usage-1',
      createdAt: new Date().toISOString(),
      usageKindLabel: 'IA Premium',
      llmModel: 'gpt-4o-mini',
      totalTokens: 450,
      estimatedCost: 0.0012,
    },
    {
      id: 'usage-2',
      createdAt: new Date(Date.now() - 86_400_000).toISOString(),
      usageKindLabel: 'IA Básica',
      llmModel: 'gpt-4o-mini',
      totalTokens: 80,
      estimatedCost: 0.0001,
    },
  ],
  totals: {
    calls: 12,
    tokens: 5400,
    cost: 0.015,
    byKind: {
      premium_assistant: { calls: 5, tokens: 4200, cost: 0.012 },
      basic_triage: { calls: 7, tokens: 1200, cost: 0.003 },
      unknown: { calls: 0, tokens: 0, cost: 0 },
    },
  },
  snapshot: buildAiSettingsPayload('disabled').usage,
};

export interface AiAtendimentoMockOptions {
  attendanceMode?: AttendanceMode;
}

/** Mock de `/auth/me` + APIs da página IA Atendimento (preview Vite sem backend). */
export async function setupAiAtendimentoMocks(
  page: Page,
  options: AiAtendimentoMockOptions = {},
): Promise<void> {
  let currentSettings = buildAiSettingsPayload(options.attendanceMode ?? 'disabled');

  await page.route('**/auth/me', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_AUTH_USER),
    }),
  );

  await page.route('**/api/platform/ai/settings', async route => {
    const method = route.request().method();
    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(currentSettings),
      });
    }
    if (method === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const nextSettings = {
        ...currentSettings.settings,
        ...(body.settings as Record<string, unknown> | undefined),
      };
      currentSettings = {
        ...currentSettings,
        settings: nextSettings,
        prompt: {
          ...currentSettings.prompt,
          ...((body.prompt as Record<string, unknown> | undefined) ?? {}),
        },
        knowledgeBase: (body.knowledgeBase as typeof currentSettings.knowledgeBase) ?? currentSettings.knowledgeBase,
        skills: (body.skills as typeof currentSettings.skills) ?? currentSettings.skills,
        memories: (body.memories as typeof currentSettings.memories) ?? currentSettings.memories,
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(currentSettings),
      });
    }
    return route.continue();
  });

  await page.route('**/api/platform/ai/usage**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_USAGE_DETAIL),
    }),
  );
}
