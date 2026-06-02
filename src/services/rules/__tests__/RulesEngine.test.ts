import { RulesEngine } from '../RulesEngine';
import { Rule } from '@/models/Rule';
import { ExtractedMessage } from '@/services/discord-bot/MessageExtractor';
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

function makeRule(conditions: any = {}, action: any = {}): any {
  return {
    _id: new mongoose.Types.ObjectId(),
    name: 'Test Rule',
    isActive: true,
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
  });

  describe('evaluate() — sem regras', () => {
    it('retorna array vazio quando não há regras ativas', async () => {
      (Rule.findActiveByClientId as jest.Mock).mockResolvedValue([]);
      const result = await engine.evaluate(makeMessage(), clientId);
      expect(result).toHaveLength(0);
    });
  });

  describe('evaluate() — filtro por canal', () => {
    it('bate quando channelId está na lista', async () => {
      const rule = makeRule({ channelIds: ['channel-456'] });
      (Rule.findActiveByClientId as jest.Mock).mockResolvedValue([rule]);

      const result = await engine.evaluate(makeMessage({ channelId: 'channel-456' }), clientId);
      expect(result).toHaveLength(1);
    });

    it('não bate quando channelId não está na lista', async () => {
      const rule = makeRule({ channelIds: ['outro-canal'] });
      (Rule.findActiveByClientId as jest.Mock).mockResolvedValue([rule]);

      const result = await engine.evaluate(makeMessage({ channelId: 'channel-456' }), clientId);
      expect(result).toHaveLength(0);
    });

    it('bate quando channelIds está vazio (sem restrição)', async () => {
      const rule = makeRule({ channelIds: [] });
      (Rule.findActiveByClientId as jest.Mock).mockResolvedValue([rule]);

      const result = await engine.evaluate(makeMessage(), clientId);
      expect(result).toHaveLength(1);
    });
  });

  describe('evaluate() — filtro bot/usuário', () => {
    it('onlyBots: não bate em mensagem de usuário', async () => {
      const rule = makeRule({ onlyBots: true });
      (Rule.findActiveByClientId as jest.Mock).mockResolvedValue([rule]);

      const result = await engine.evaluate(makeMessage({ isBot: false }), clientId);
      expect(result).toHaveLength(0);
    });

    it('onlyBots: bate em mensagem de bot', async () => {
      const rule = makeRule({ onlyBots: true });
      (Rule.findActiveByClientId as jest.Mock).mockResolvedValue([rule]);

      const result = await engine.evaluate(makeMessage({ isBot: true }), clientId);
      expect(result).toHaveLength(1);
    });

    it('onlyUsers: não bate em mensagem de bot', async () => {
      const rule = makeRule({ onlyUsers: true });
      (Rule.findActiveByClientId as jest.Mock).mockResolvedValue([rule]);

      const result = await engine.evaluate(makeMessage({ isBot: true }), clientId);
      expect(result).toHaveLength(0);
    });
  });

  describe('evaluate() — filtro por keywords', () => {
    it('bate quando texto contém keyword obrigatória', async () => {
      const rule = makeRule({ requireKeywords: ['promoção'] });
      (Rule.findActiveByClientId as jest.Mock).mockResolvedValue([rule]);

      const result = await engine.evaluate(makeMessage({ text: 'Grande promoção hoje!' }), clientId);
      expect(result).toHaveLength(1);
    });

    it('não bate quando texto não contém keyword obrigatória', async () => {
      const rule = makeRule({ requireKeywords: ['promoção'] });
      (Rule.findActiveByClientId as jest.Mock).mockResolvedValue([rule]);

      const result = await engine.evaluate(makeMessage({ text: 'Mensagem normal' }), clientId);
      expect(result).toHaveLength(0);
    });

    it('não bate quando texto contém keyword excluída', async () => {
      const rule = makeRule({ excludeKeywords: ['patrocinado'] });
      (Rule.findActiveByClientId as jest.Mock).mockResolvedValue([rule]);

      const result = await engine.evaluate(makeMessage({ text: 'Conteúdo patrocinado aqui' }), clientId);
      expect(result).toHaveLength(0);
    });

    it('busca keywords em embedTitles e embedDescriptions também', async () => {
      const rule = makeRule({ requireKeywords: ['desconto'] });
      (Rule.findActiveByClientId as jest.Mock).mockResolvedValue([rule]);

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
      (Rule.findActiveByClientId as jest.Mock).mockResolvedValue([rule]);

      const result = await engine.evaluate(makeMessage({ hasLink: false }), clientId);
      expect(result).toHaveLength(0);
    });

    it('requireLink: bate com link', async () => {
      const rule = makeRule({ requireLink: true });
      (Rule.findActiveByClientId as jest.Mock).mockResolvedValue([rule]);

      const result = await engine.evaluate(makeMessage({ hasLink: true }), clientId);
      expect(result).toHaveLength(1);
    });

    it('requireImage: não bate sem imagem', async () => {
      const rule = makeRule({ requireImage: true });
      (Rule.findActiveByClientId as jest.Mock).mockResolvedValue([rule]);

      const result = await engine.evaluate(makeMessage({ hasImage: false }), clientId);
      expect(result).toHaveLength(0);
    });

    it('requireEmbed: não bate sem embed', async () => {
      const rule = makeRule({ requireEmbed: true });
      (Rule.findActiveByClientId as jest.Mock).mockResolvedValue([rule]);

      const result = await engine.evaluate(makeMessage({ hasEmbed: false }), clientId);
      expect(result).toHaveLength(0);
    });
  });

  describe('evaluate() — múltiplas regras', () => {
    it('retorna match para cada regra que bate', async () => {
      const rule1 = makeRule({ channelIds: ['channel-456'] });
      const rule2 = makeRule({ requireKeywords: ['hello'] });
      const rule3 = makeRule({ onlyBots: true }); // não vai bater
      (Rule.findActiveByClientId as jest.Mock).mockResolvedValue([rule1, rule2, rule3]);

      const result = await engine.evaluate(makeMessage({ text: 'hello world', isBot: false }), clientId);
      expect(result).toHaveLength(2);
    });

    it('incrementa matchCount para cada regra que bate', async () => {
      const rule = makeRule();
      (Rule.findActiveByClientId as jest.Mock).mockResolvedValue([rule]);

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
      (Rule.findActiveByClientId as jest.Mock).mockResolvedValue([rule]);

      const [match] = await engine.evaluate(makeMessage(), clientId);
      expect(match.destinationIds).toContain(destId);
      expect(match.templateName).toBe('meu-template');
      expect(match.priority).toBe('high');
      expect(match.addDelay).toBe(5000);
    });
  });
});
