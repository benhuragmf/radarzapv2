import {
  assertWebChatVisitorMessage,
  buildWebChatAppearanceConfigSignature,
  canWebChatRunPremiumAi,
  isWebChatWidgetActive,
  publicWebChatConfigOmitsInternalIds,
  resolveWebChatEscalationSystemMessage,
  sanitizeWebChatVisitorMessage,
  shouldEscalateWebChatOnPremiumAiFailure,
  shouldShowWebChatFaq,
  shouldShowWebChatTicketLookup,
  WEBCHAT_QUEUE_WAITING_VISITOR_MESSAGE,
  WEBCHAT_VISITOR_MESSAGE_MAX,
} from '@/types/webchat-public.util';

describe('webchat-public.util', () => {
  it('isWebChatWidgetActive respeita flag active', () => {
    expect(isWebChatWidgetActive({ active: true })).toBe(true);
    expect(isWebChatWidgetActive({ active: false })).toBe(false);
  });

  it('sanitizeWebChatVisitorMessage remove controle e limita tamanho', () => {
    expect(sanitizeWebChatVisitorMessage('  Olá\x00  ')).toBe('Olá');
    expect(sanitizeWebChatVisitorMessage('a'.repeat(WEBCHAT_VISITOR_MESSAGE_MAX + 100)).length).toBe(
      WEBCHAT_VISITOR_MESSAGE_MAX,
    );
  });

  it('assertWebChatVisitorMessage rejeita vazio', () => {
    expect(() => assertWebChatVisitorMessage('   ')).toThrow(/vazia/);
    expect(assertWebChatVisitorMessage('Oi')).toBe('Oi');
  });

  it('buildWebChatAppearanceConfigSignature muda com greeting e FAQ', () => {
    const base = buildWebChatAppearanceConfigSignature({ title: 'Chat' });
    const withGreeting = buildWebChatAppearanceConfigSignature({
      title: 'Chat',
      greeting: 'Bem-vindo',
    });
    expect(base).not.toBe(withGreeting);
  });

  it('shouldShowWebChatFaq exige catálogo disponível', () => {
    expect(shouldShowWebChatFaq({ faqInChatEnabled: true, faqCatalogAvailable: true })).toBe(true);
    expect(shouldShowWebChatFaq({ faqInChatEnabled: true, faqCatalogAvailable: false })).toBe(false);
    expect(shouldShowWebChatFaq({ faqInChatEnabled: false, faqCatalogAvailable: true })).toBe(false);
  });

  it('shouldShowWebChatTicketLookup respeita desligar', () => {
    expect(shouldShowWebChatTicketLookup({})).toBe(true);
    expect(shouldShowWebChatTicketLookup({ ticketLookupEnabled: false })).toBe(false);
  });

  it('canWebChatRunPremiumAi bloqueia modo disabled e sem crédito', () => {
    expect(
      canWebChatRunPremiumAi({
        widgetAutoReplyUseAi: true,
        aiSettings: { mode: 'disabled', attendanceMode: 'disabled' },
      }),
    ).toBe(false);
    expect(
      canWebChatRunPremiumAi({
        widgetAutoReplyUseAi: true,
        aiSettings: { mode: 'radarzap', enabled: true, attendanceMode: 'premium_assistant' },
        premiumAvailability: true,
        hasCredits: false,
      }),
    ).toBe(false);
    expect(
      canWebChatRunPremiumAi({
        widgetAutoReplyUseAi: true,
        aiSettings: { mode: 'radarzap', enabled: true, attendanceMode: 'premium_assistant' },
        premiumAvailability: true,
        hasCredits: true,
      }),
    ).toBe(true);
  });

  it('canWebChatRunPremiumAi bloqueia robotic e basic_triage', () => {
    expect(
      canWebChatRunPremiumAi({
        widgetAutoReplyUseAi: true,
        aiSettings: { mode: 'disabled', attendanceMode: 'robotic' },
      }),
    ).toBe(false);
    expect(
      canWebChatRunPremiumAi({
        widgetAutoReplyUseAi: true,
        aiSettings: { mode: 'disabled', attendanceMode: 'basic_triage' },
      }),
    ).toBe(false);
  });

  it('shouldEscalateWebChatOnPremiumAiFailure quando IA falha', () => {
    expect(shouldEscalateWebChatOnPremiumAiFailure(true, false)).toBe(true);
    expect(shouldEscalateWebChatOnPremiumAiFailure(true, true)).toBe(false);
    expect(shouldEscalateWebChatOnPremiumAiFailure(false, false)).toBe(false);
  });

  it('resolveWebChatEscalationSystemMessage usa mensagem oficial de fila', () => {
    expect(resolveWebChatEscalationSystemMessage({})).toBe(WEBCHAT_QUEUE_WAITING_VISITOR_MESSAGE);
    expect(resolveWebChatEscalationSystemMessage({ reason: 'Motivo custom' })).toBe('Motivo custom');
    expect(resolveWebChatEscalationSystemMessage({ departmentName: 'Comercial' })).toContain(
      'Comercial',
    );
  });

  it('publicWebChatConfigOmitsInternalIds', () => {
    expect(publicWebChatConfigOmitsInternalIds({ title: 'Chat', publicKey: 'wck_x' })).toBe(true);
    expect(publicWebChatConfigOmitsInternalIds({ title: 'Chat', clientId: 'abc' })).toBe(false);
  });
});
