import {
  buildPremiumAiSafetySuffix,
  buildPremiumAiUngroundedReply,
  clientRequestedPremiumHumanHandoff,
  evaluatePremiumAiGate,
  guardPremiumAiFactualReply,
  isKbRequiredFactualInquiry,
  isPremiumAiKnowledgeGrounded,
  isPremiumAiResponseUnsafe,
  isPremiumAiSensitiveIntent,
  looksLikeInventedFactualReply,
  PREMIUM_AI_RESPONSE_LIMIT_WEBCHAT,
  PREMIUM_AI_RESPONSE_LIMIT_WHATSAPP,
  resolvePremiumAiResponseLimit,
  sanitizePremiumAiPromptInput,
  sanitizePremiumAiResponse,
  shouldEscalatePremiumAiBeforeCall,
  shouldSkipPremiumAiForBridge,
} from '@/types/premium-ai.util';

describe('premium-ai.util', () => {
  describe('evaluatePremiumAiGate', () => {
    it('permite premium_assistant com provider e créditos', () => {
      expect(
        evaluatePremiumAiGate({
          attendanceMode: 'premium_assistant',
          providerAvailable: true,
          hasCredits: true,
        }).allowed,
      ).toBe(true);
    });

    it('bloqueia disabled, robotic e basic_triage', () => {
      for (const mode of ['disabled', 'robotic', 'basic_triage'] as const) {
        expect(
          evaluatePremiumAiGate({ attendanceMode: mode, providerAvailable: true }).allowed,
        ).toBe(false);
      }
    });

    it('hybrid permite quando gates OK', () => {
      expect(
        evaluatePremiumAiGate({
          attendanceMode: 'hybrid',
          providerAvailable: true,
          hasCredits: true,
        }).allowed,
      ).toBe(true);
    });

    it('sem provider → no_provider', () => {
      expect(
        evaluatePremiumAiGate({
          attendanceMode: 'premium_assistant',
          providerAvailable: false,
        }),
      ).toEqual({ allowed: false, reason: 'no_provider' });
    });

    it('sem crédito → no_credits', () => {
      expect(
        evaluatePremiumAiGate({
          attendanceMode: 'premium_assistant',
          providerAvailable: true,
          hasCredits: false,
        }),
      ).toEqual({ allowed: false, reason: 'no_credits' });
    });

    it('comando equipe → team_command', () => {
      expect(
        evaluatePremiumAiGate({
          attendanceMode: 'premium_assistant',
          providerAvailable: true,
          isTeamCommand: true,
        }),
      ).toEqual({ allowed: false, reason: 'team_command' });
    });

    it('bridge ativa → bridge_active', () => {
      expect(
        evaluatePremiumAiGate({
          attendanceMode: 'premium_assistant',
          providerAvailable: true,
          bridgeActive: true,
        }),
      ).toEqual({ allowed: false, reason: 'bridge_active' });
    });

    it('cliente pediu humano → human_requested', () => {
      expect(
        evaluatePremiumAiGate({
          attendanceMode: 'premium_assistant',
          providerAvailable: true,
          clientRequestedHuman: true,
        }),
      ).toEqual({ allowed: false, reason: 'human_requested' });
    });
  });

  describe('shouldSkipPremiumAiForBridge', () => {
    it('pula quando bridge ativa', () => {
      expect(shouldSkipPremiumAiForBridge({ whatsappBridgeActive: true })).toBe(true);
      expect(shouldSkipPremiumAiForBridge({})).toBe(false);
    });
  });

  describe('shouldEscalatePremiumAiBeforeCall', () => {
    it('escala em gate bloqueado', () => {
      const gate = evaluatePremiumAiGate({
        attendanceMode: 'premium_assistant',
        hasCredits: false,
        providerAvailable: true,
      });
      expect(shouldEscalatePremiumAiBeforeCall({ gate }).escalate).toBe(true);
    });

    it('escala em pedido humano e sensível', () => {
      expect(
        shouldEscalatePremiumAiBeforeCall({ clientText: 'quero falar com atendente' }).escalate,
      ).toBe(true);
      expect(
        shouldEscalatePremiumAiBeforeCall({ clientText: 'quero cancelar e estorno' }).escalate,
      ).toBe(true);
    });

    it('escala após duas falhas', () => {
      expect(
        shouldEscalatePremiumAiBeforeCall({ consecutiveFailures: 2 }).escalate,
      ).toBe(true);
    });
  });

  describe('isPremiumAiSensitiveIntent', () => {
    it('detecta cancelamento e reclamação', () => {
      expect(isPremiumAiSensitiveIntent('quero cancelar')).toBe(true);
      expect(isPremiumAiSensitiveIntent('isso é um absurdo')).toBe(true);
      expect(isPremiumAiSensitiveIntent('oi')).toBe(false);
    });
  });

  describe('clientRequestedPremiumHumanHandoff', () => {
    it('detecta pedido de humano', () => {
      expect(clientRequestedPremiumHumanHandoff('preciso falar com atendente')).toBe(true);
      expect(clientRequestedPremiumHumanHandoff('qual o horário?')).toBe(false);
    });
  });

  describe('sanitizePremiumAiResponse', () => {
    it('limita WebChat e WhatsApp', () => {
      const long = 'a'.repeat(2000);
      expect(sanitizePremiumAiResponse(long, 'webchat').length).toBeLessThanOrEqual(
        PREMIUM_AI_RESPONSE_LIMIT_WEBCHAT,
      );
      expect(sanitizePremiumAiResponse(long, 'whatsapp').length).toBeLessThanOrEqual(
        PREMIUM_AI_RESPONSE_LIMIT_WHATSAPP,
      );
    });

    it('redige API key e marca unsafe', () => {
      const raw = 'Sua chave é sk-abcdefghijklmnopqrstuvwxyz';
      const out = sanitizePremiumAiResponse(raw, 'whatsapp');
      expect(out).toContain('[redigido]');
      expect(isPremiumAiResponseUnsafe(raw)).toBe(true);
      expect(isPremiumAiResponseUnsafe(out)).toBe(false);
    });

    it('modo esclarecimento usa limite menor', () => {
      const long = 'b'.repeat(400);
      expect(sanitizePremiumAiResponse(long, 'webchat', { clarify: true }).length).toBeLessThanOrEqual(
        300,
      );
    });
  });

  describe('resolvePremiumAiResponseLimit', () => {
    it('retorna limites oficiais por canal', () => {
      expect(resolvePremiumAiResponseLimit('webchat')).toBe(PREMIUM_AI_RESPONSE_LIMIT_WEBCHAT);
      expect(resolvePremiumAiResponseLimit('whatsapp')).toBe(PREMIUM_AI_RESPONSE_LIMIT_WHATSAPP);
    });
  });

  describe('isPremiumAiKnowledgeGrounded', () => {
    it('ancorado em auto-resolve ou KB', () => {
      expect(isPremiumAiKnowledgeGrounded({ autoResolveHit: true })).toBe(true);
      expect(isPremiumAiKnowledgeGrounded({ kbSource: 'faq' })).toBe(true);
      expect(isPremiumAiKnowledgeGrounded({ modelConfidenceLow: true })).toBe(false);
      expect(isPremiumAiKnowledgeGrounded({})).toBe(false);
    });
  });

  describe('buildPremiumAiSafetySuffix', () => {
    it('inclui limite do canal', () => {
      const suffix = buildPremiumAiSafetySuffix('webchat');
      expect(suffix).toContain(String(PREMIUM_AI_RESPONSE_LIMIT_WEBCHAT));
      expect(suffix).toContain('shouldEscalate');
    });
  });

  describe('sanitizePremiumAiPromptInput', () => {
    it('remove controle e limita tamanho', () => {
      expect(sanitizePremiumAiPromptInput('  Olá\x00  ')).toBe('Olá');
      expect(sanitizePremiumAiPromptInput('x'.repeat(9000), 100).length).toBe(100);
    });
  });

  describe('grounding factual (anti-alucinação)', () => {
    it('detecta pergunta comercial que exige KB', () => {
      expect(isKbRequiredFactualInquiry('quero saber sobre planos')).toBe(true);
      expect(isKbRequiredFactualInquiry('Internet', 'planos')).toBe(true);
      expect(isKbRequiredFactualInquiry('oi tudo bem')).toBe(false);
    });

    it('detecta resposta inventada com preço/plano', () => {
      expect(
        looksLikeInventedFactualReply(
          '1. **Plano Básico**: 50 Mbps - R$ 99,90/mês',
        ),
      ).toBe(true);
      expect(looksLikeInventedFactualReply('Posso ajudar em mais alguma coisa?')).toBe(false);
    });

    it('substitui resposta inventada quando KB vazia', () => {
      const emptyPrompt = 'KNOWLEDGE\n(Base de conhecimento do cliente vazia — não invente)';
      const r = guardPremiumAiFactualReply({
        reply: 'Plano 100 Mbps por R$ 129/mês',
        systemPrompt: emptyPrompt,
        companyName: 'Radar Gamer',
      });
      expect(r.blocked).toBe(true);
      expect(r.reply).toContain('Não tenho informações confirmadas');
    });

    it('buildPremiumAiUngroundedReply não promete catálogo', () => {
      expect(buildPremiumAiUngroundedReply('Acme')).toContain('Acme');
      expect(buildPremiumAiUngroundedReply('Acme')).not.toContain('R$');
    });
  });
});
