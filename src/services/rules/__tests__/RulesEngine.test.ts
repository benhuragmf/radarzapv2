import { RulesEngine } from '../RulesEngine';
import { Rule } from '@/models/Rule';
import { ExtractedMessage } from '@/services/discord-bot/MessageExtractor';
import type { DiscordEventPayload } from '@/types/discord-monitor';
import mongoose from 'mongoose';

jest.mock('@/models/Rule');
jest.mock('@/utils/logger', () => ({
  createServiceLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const clientId = new mongoose.Types.ObjectId().toString();

function makeMessage(overrides: Partial<ExtractedMessage> = {}): ExtractedMessage {
  return {
    messageId: 'msg-001',
    guildId: 'guild-123',
    guildName: 'Test Guild',
    channelId: 'channel-456',
    channelName: 'general',
    authorId: 'user-789',
    authorName: 'testuser',
    authorTag: 'testuser#0001',
    isBot: false,
    text: 'Hello world',
    hasEmbed: false,
    hasLink: false,
    hasImage: false,
    links: [],
    imageUrls: [],
    embedTitles: [],
    embedDescriptions: [],
    timestamp: new Date(),
    hash: 'abc123',
    ...overrides,
  };
}

function makeRule(conditions: any = {}, action: any = {}, triggerMeta: any = {}): any {
  return {
    _id: new mongoose.Types.ObjectId(),
    name: 'Test Rule',
    isActive: true,
    trigger: triggerMeta.trigger ?? 'message',
    triggers: triggerMeta.triggers,
    conditions: {
      channelIds: [],
      guildIds: [],
      authorIds: [],
      onlyBots: false,
      onlyUsers: false,
      requireKeywords: [],
      excludeKeywords: [],
      requireLink: false,
      requireImage: false,
      requireEmbed: false,
      ...conditions,
    },
    action: {
      destinationIds: [],
      templateName: 'radarzap-padrao',
      priority: 'medium',
      addDelay: 0,
      ...action,
    },
    matchCount: 0,
    incrementMatchCount: jest.fn().mockResolvedValue(undefined),
  };
}

describe('RulesEngine', () => {
  let engine: RulesEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new RulesEngine();
    (Rule.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockResolvedValue([]),
    });
  });

  function mockMessageRules(rules: any[]) {
    (Rule.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockResolvedValue(rules),
    });
  }

  describe('evaluate() — sem regras', () => {
    it('retorna array vazio quando não há regras ativas', async () => {
      mockMessageRules([]);
      const result = await engine.evaluate(makeMessage(), clientId);
      expect(result).toHaveLength(0);
    });
  });

  describe('evaluate() — filtro por canal', () => {
    it('bate quando channelId está na lista', async () => {
      const rule = makeRule({ channelIds: ['channel-456'] });
      mockMessageRules([rule]);

      const result = await engine.evaluate(makeMessage({ channelId: 'channel-456' }), clientId);
      expect(result).toHaveLength(1);
    });

    it('não bate quando channelId não está na lista', async () => {
      const rule = makeRule({ channelIds: ['outro-canal'] });
      mockMessageRules([rule]);

      const result = await engine.evaluate(makeMessage({ channelId: 'channel-456' }), clientId);
      expect(result).toHaveLength(0);
    });

    it('bate quando channelIds está vazio (sem restrição)', async () => {
      const rule = makeRule({ channelIds: [] });
      mockMessageRules([rule]);

      const result = await engine.evaluate(makeMessage(), clientId);
      expect(result).toHaveLength(1);
    });
  });

  describe('evaluate() — filtro bot/usuário', () => {
    it('onlyBots: não bate em mensagem de usuário', async () => {
      const rule = makeRule({ onlyBots: true });
      mockMessageRules([rule]);

      const result = await engine.evaluate(makeMessage({ isBot: false }), clientId);
      expect(result).toHaveLength(0);
    });

    it('onlyBots: bate em mensagem de bot', async () => {
      const rule = makeRule({ onlyBots: true });
      mockMessageRules([rule]);

      const result = await engine.evaluate(makeMessage({ isBot: true }), clientId);
      expect(result).toHaveLength(1);
    });

    it('onlyUsers: não bate em mensagem de bot', async () => {
      const rule = makeRule({ onlyUsers: true });
      mockMessageRules([rule]);

      const result = await engine.evaluate(makeMessage({ isBot: true }), clientId);
      expect(result).toHaveLength(0);
    });
  });

  describe('evaluate() — filtro por keywords', () => {
    it('bate quando texto contém keyword obrigatória', async () => {
      const rule = makeRule({ requireKeywords: ['promoção'] });
      mockMessageRules([rule]);

      const result = await engine.evaluate(makeMessage({ text: 'Grande promoção hoje!' }), clientId);
      expect(result).toHaveLength(1);
    });

    it('não bate quando texto não contém keyword obrigatória', async () => {
      const rule = makeRule({ requireKeywords: ['promoção'] });
      mockMessageRules([rule]);

      const result = await engine.evaluate(makeMessage({ text: 'Mensagem normal' }), clientId);
      expect(result).toHaveLength(0);
    });

    it('não bate quando texto contém keyword excluída', async () => {
      const rule = makeRule({ excludeKeywords: ['patrocinado'] });
      mockMessageRules([rule]);

      const result = await engine.evaluate(makeMessage({ text: 'Conteúdo patrocinado aqui' }), clientId);
      expect(result).toHaveLength(0);
    });

    it('busca keywords em embedTitles e embedDescriptions também', async () => {
      const rule = makeRule({ requireKeywords: ['desconto'] });
      mockMessageRules([rule]);

      const result = await engine.evaluate(makeMessage({
        text: '',
        embedTitles: ['50% de desconto'],
        embedDescriptions: [],
      }), clientId);
      expect(result).toHaveLength(1);
    });
  });

  describe('evaluate() — filtros de conteúdo', () => {
    it('requireLink: não bate sem link', async () => {
      const rule = makeRule({ requireLink: true });
      mockMessageRules([rule]);

      const result = await engine.evaluate(makeMessage({ hasLink: false }), clientId);
      expect(result).toHaveLength(0);
    });

    it('requireLink: bate com link', async () => {
      const rule = makeRule({ requireLink: true });
      mockMessageRules([rule]);

      const result = await engine.evaluate(makeMessage({ hasLink: true }), clientId);
      expect(result).toHaveLength(1);
    });

    it('requireImage: não bate sem imagem', async () => {
      const rule = makeRule({ requireImage: true });
      mockMessageRules([rule]);

      const result = await engine.evaluate(makeMessage({ hasImage: false }), clientId);
      expect(result).toHaveLength(0);
    });

    it('requireEmbed: não bate sem embed', async () => {
      const rule = makeRule({ requireEmbed: true });
      mockMessageRules([rule]);

      const result = await engine.evaluate(makeMessage({ hasEmbed: false }), clientId);
      expect(result).toHaveLength(0);
    });
  });

  describe('evaluate() — múltiplas regras', () => {
    it('retorna match para cada regra que bate', async () => {
      const rule1 = makeRule({ channelIds: ['channel-456'] });
      const rule2 = makeRule({ requireKeywords: ['hello'] });
      const rule3 = makeRule({ onlyBots: true }); // não vai bater
      mockMessageRules([rule1, rule2, rule3]);

      const result = await engine.evaluate(makeMessage({ text: 'hello world', isBot: false }), clientId);
      expect(result).toHaveLength(2);
    });

    it('incrementa matchCount para cada regra que bate', async () => {
      const rule = makeRule();
      mockMessageRules([rule]);

      await engine.evaluate(makeMessage(), clientId);
      expect(rule.incrementMatchCount).toHaveBeenCalledTimes(1);
    });
  });

  describe('evaluate() — retorno do match', () => {
    it('retorna destinationIds, templateName, priority e addDelay corretos', async () => {
      const destId = new mongoose.Types.ObjectId();
      const rule = makeRule({}, {
        destinationIds: [destId],
        templateName: 'meu-template',
        priority: 'high',
        addDelay: 5000,
      });
      mockMessageRules([rule]);

      const [match] = await engine.evaluate(makeMessage(), clientId);
      expect(match.destinationIds).toContain(destId);
      expect(match.templateName).toBe('meu-template');
      expect(match.priority).toBe('high');
      expect(match.addDelay).toBe(5000);
    });
  });

  describe('evaluateEvent() — voz e membros', () => {
    function makeEvent(overrides: Partial<DiscordEventPayload> = {}): DiscordEventPayload {
      return {
        eventId: 'evt-1',
        trigger: 'voice_join',
        guildId: 'guild-123',
        guildName: 'Test Guild',
        clientId,
        channelId: 'voice-001',
        channelName: 'Geral',
        userId: 'user-789',
        userName: 'testuser',
        userTag: 'testuser#0001',
        timestamp: new Date().toISOString(),
        ...overrides,
      };
    }

    function mockEventRules(rules: any[]) {
      (Rule.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockResolvedValue(rules),
      });
    }

    it('retorna vazio quando não há regras', async () => {
      mockEventRules([]);
      const result = await engine.evaluateEvent(makeEvent(), clientId);
      expect(result).toHaveLength(0);
    });

    it('bate regra voice_join com triggers[]', async () => {
      const rule = makeRule(
        { voiceChannelIds: ['voice-001'] },
        { templateName: 'dw-voice-join' },
        { triggers: ['voice_join', 'voice_leave'] },
      );
      mockEventRules([rule]);

      const result = await engine.evaluateEvent(makeEvent(), clientId);
      expect(result).toHaveLength(1);
      expect(result[0].templateName).toBe('dw-voice-join');
    });

    it('não bate quando voiceChannelIds não inclui o canal', async () => {
      const rule = makeRule(
        { voiceChannelIds: ['outro-voice'] },
        {},
        { trigger: 'voice_join' },
      );
      mockEventRules([rule]);

      const result = await engine.evaluateEvent(makeEvent(), clientId);
      expect(result).toHaveLength(0);
    });

    it('filtra por guildIds e authorIds', async () => {
      const rule = makeRule(
        { guildIds: ['guild-123'], authorIds: ['user-789'] },
        {},
        { trigger: 'member_join' },
      );
      mockEventRules([rule]);

      const result = await engine.evaluateEvent(
        makeEvent({ trigger: 'member_join', channelId: 'guild-123' }),
        clientId,
      );
      expect(result).toHaveLength(1);

      const noMatch = await engine.evaluateEvent(
        makeEvent({ trigger: 'member_join', userId: 'outro-user' }),
        clientId,
      );
      expect(noMatch).toHaveLength(0);
    });

    it('filtra por roleIds em eventos', async () => {
      const rule = makeRule(
        { roleIds: ['role-mod'] },
        {},
        { trigger: 'message_reaction' },
      );
      mockEventRules([rule]);

      const match = await engine.evaluateEvent(
        makeEvent({
          trigger: 'message_reaction',
          roleIds: ['role-mod', 'role-all'],
        }),
        clientId,
      );
      expect(match).toHaveLength(1);

      const noMatch = await engine.evaluateEvent(
        makeEvent({ trigger: 'message_reaction', roleIds: ['role-other'] }),
        clientId,
      );
      expect(noMatch).toHaveLength(0);
    });

    it('usa template automático por trigger quando regra tem vários gatilhos', async () => {
      const rule = makeRule(
        {},
        { templateName: 'dw-voice-join' },
        { triggers: ['voice_join', 'voice_leave'] },
      );
      mockEventRules([rule]);

      const leave = await engine.evaluateEvent(
        makeEvent({ trigger: 'voice_leave' }),
        clientId,
      );
      expect(leave).toHaveLength(1);
      expect(leave[0].templateName).toBe('dw-voice-leave');
    });
  });
});
