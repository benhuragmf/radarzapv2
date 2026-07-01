import { AiEscalationService } from '../AiEscalationService';
import { DEFAULT_AI_TRANSFER_RULES } from '@/types/ai-assistant';
import type { IAiConversationState } from '@/models/AiConversationState';
import type { IAiPrompt } from '@/models/AiPrompt';
import { AiConversationStatus } from '@/types/ai-assistant';

const baseState = {
  status: AiConversationStatus.AI_COLLECTING,
  confidence: 0.8,
  repeatedQuestionCount: 0,
} as IAiConversationState;

const basePrompt = {
  collectName: true,
  collectEmail: true,
  collectProblem: true,
} as IAiPrompt;

describe('AiEscalationService', () => {
  const svc = AiEscalationService.getInstance();

  it('escalona quando cliente pede humano', () => {
    const r = svc.check({
      clientText: 'quero falar com um atendente',
      hasUninterpretableMedia: false,
      state: baseState,
      prompt: basePrompt,
      rules: DEFAULT_AI_TRANSFER_RULES,
    });
    expect(r.shouldEscalate).toBe(true);
  });

  it('escalona quando cliente pede suporte', () => {
    const r = svc.check({
      clientText: 'falar com suporte',
      hasUninterpretableMedia: false,
      state: baseState,
      prompt: basePrompt,
      rules: DEFAULT_AI_TRANSFER_RULES,
    });
    expect(r.shouldEscalate).toBe(true);
  });

  it('detecta aguardando após promessa de transferência', () => {
    expect(
      svc.isWaitingForPromisedHandoff(
        'aguardando',
        'Entendido. Vou te transferir para o nosso setor de Suporte Técnico.',
      ),
    ).toBe(true);
  });

  it('detecta promessa de encaminhamento para setor comercial', () => {
    const reply =
      'Entendido, Benhur. Vou encaminhar você para o setor Comercial. Por favor, aguarde um momento.';
    expect(svc.aiReplyPromisesTransfer(reply)).toBe(true);
  });

  it('detecta pedido de falar com comercial', () => {
    expect(svc.clientRequestsHuman('Olaa preciso falar com o comercial')).toBe(true);
    expect(svc.check({
      clientText: 'Olaa preciso falar com o comercial',
      hasUninterpretableMedia: false,
      state: baseState,
      prompt: basePrompt,
      rules: DEFAULT_AI_TRANSFER_RULES,
    }).shouldEscalate).toBe(true);
  });

  it('detecta dados mínimos coletados', () => {
    const state = {
      ...baseState,
      collectedName: 'Maria',
      nameConfirmed: true,
      collectedEmail: 'maria@test.com',
      collectedProblem: 'Pedido atrasado',
    } as IAiConversationState;
    expect(svc.hasMinData(state, basePrompt)).toBe(true);
  });

  it('não considera nome válido sem confirmação explícita', () => {
    const state = {
      ...baseState,
      collectedName: 'Maria',
      nameConfirmed: false,
      collectedEmail: 'maria@test.com',
      collectedProblem: 'Pedido atrasado',
    } as IAiConversationState;
    expect(svc.hasMinData(state, basePrompt)).toBe(false);
  });

  it('não escala só com nome e shouldEscalate do modelo', () => {
    const state = {
      ...baseState,
      aiTurnCount: 2,
      collectedName: 'Benhur',
    } as IAiConversationState;
    const r = svc.check({
      clientText: 'Benhur',
      hasUninterpretableMedia: false,
      structured: {
        reply: 'Obrigado, Benhur.',
        collectedName: 'Benhur',
        confidence: 0.9,
        shouldEscalate: true,
        escalationReason: 'IA indicou transferência',
        parseFailed: false,
      },
      state,
      prompt: basePrompt,
      rules: DEFAULT_AI_TRANSFER_RULES,
    });
    expect(r.shouldEscalate).toBe(false);
  });

  it('rejeita problema igual ao nome', () => {
    const state = {
      ...baseState,
      collectedName: 'Benhur',
      collectedEmail: 'b@test.com',
      collectedProblem: 'Benhur',
    } as IAiConversationState;
    expect(svc.hasMinData(state, basePrompt)).toBe(false);
  });

  it('não escala com dados mínimos alucinados no JSON (só nome no WhatsApp)', () => {
    const state = {
      ...baseState,
      aiTurnCount: 2,
      collectedName: 'Benhur',
    } as IAiConversationState;
    const r = svc.check({
      clientText: 'Benhur',
      hasUninterpretableMedia: false,
      structured: {
        reply: 'Obrigado, Benhur. Informe seu e-mail.',
        collectedName: 'Benhur',
        collectedEmail: 'benhur@fake.com',
        collectedProblem: 'Cliente precisa de ajuda geral',
        confidence: 0.95,
        shouldEscalate: true,
        parseFailed: false,
      },
      state,
      prompt: basePrompt,
      rules: { ...DEFAULT_AI_TRANSFER_RULES, onMinDataCollected: true },
    });
    expect(r.shouldEscalate).toBe(false);
  });

  it('isCollectionOnlyTurn detecta nome curto', () => {
    expect(svc.isCollectionOnlyTurn('Benhur')).toBe(true);
    expect(svc.isCollectionOnlyTurn('quero cancelar meu pedido 12345')).toBe(false);
    expect(svc.isCollectionOnlyTurn('📍 Localização enviada (-16.45787, -54.64815)')).toBe(true);
  });

  it('não escala ao receber pin de localização com dados mínimos já coletados', () => {
    const state = {
      ...baseState,
      aiTurnCount: 3,
      collectedName: 'Benhur',
      nameConfirmed: true,
      collectedEmail: 'benhur@example.com',
      collectedProblem: 'Gostaria de comprar o zaad',
    } as IAiConversationState;
    const r = svc.check({
      clientText: '📍 Localização enviada (-16.45787, -54.64815)',
      hasUninterpretableMedia: false,
      structured: {
        reply: 'Obrigado pela localização.',
        confidence: 0.9,
        shouldEscalate: true,
        parseFailed: false,
      },
      state,
      prompt: basePrompt,
      rules: { ...DEFAULT_AI_TRANSFER_RULES, onMinDataCollected: true },
    });
    expect(r.shouldEscalate).toBe(false);
  });

  it('não escala durante pedido catálogo aguardando endereço', () => {
    const state = {
      ...baseState,
      aiTurnCount: 3,
      collectedName: 'Benhur',
      nameConfirmed: true,
      collectedEmail: 'benhur@example.com',
      collectedProblem: 'Compra ZAAd',
    } as IAiConversationState;
    const r = svc.check({
      clientText: '1326',
      hasUninterpretableMedia: false,
      structured: {
        reply: 'Estou transferindo você para um atendente humano.',
        confidence: 0.9,
        shouldEscalate: true,
        parseFailed: false,
      },
      state,
      prompt: basePrompt,
      rules: { ...DEFAULT_AI_TRANSFER_RULES, onMinDataCollected: true },
      catalogAddressPending: true,
    });
    expect(r.shouldEscalate).toBe(false);
  });

  it('não escala em despedida ou agradecimento', () => {
    const state = {
      ...baseState,
      aiTurnCount: 4,
      collectedName: 'Benhur',
      nameConfirmed: true,
      collectedProblem: 'Erro timeout no cadastro Gmail',
    } as IAiConversationState;
    for (const text of [
      'obrigado vou tentar verificar com minha internet',
      'valeu',
      'tchau',
    ]) {
      expect(svc.clientClosingConversation(text)).toBe(true);
      expect(
        svc.check({
          clientText: text,
          hasUninterpretableMedia: false,
          state,
          prompt: basePrompt,
          rules: { ...DEFAULT_AI_TRANSFER_RULES, onMinDataCollected: true },
        }).shouldEscalate,
      ).toBe(false);
    }
  });

  it('nao trata "nao foi resolvido" como despedida', () => {
    expect(svc.clientClosingConversation('Avisar que o problema ainda nao foi resolvido')).toBe(
      false,
    );
    expect(svc.clientClosingConversation('obrigado, problema resolvido')).toBe(true);
    expect(svc.clientClosingConversation('foi resolvido sim')).toBe(true);
  });

  it('detecta recusa de "algo mais?"', () => {
    expect(
      svc.clientDeclinesMoreHelp(
        'nao',
        'Posso te ajudar com algo mais?',
      ),
    ).toBe(true);
    expect(
      svc.clientDeclinesMoreHelp(
        'nao',
        'O erro de timeout pode ser temporário. Posso te ajudar com algo mais?',
      ),
    ).toBe(true);
    expect(
      svc.clientDeclinesMoreHelp('nao', 'Isso resolveu sua dúvida?'),
    ).toBe(false);
  });
});
