import { MessageExtractor } from '../MessageExtractor';
import { Message, User, Guild, TextChannel, Collection } from 'discord.js';

function makeMessage(overrides: Partial<{
  id: string;
  content: string;
  guildId: string;
  guildName: string;
  channelId: string;
  channelName: string;
  authorId: string;
  authorName: string;
  authorTag: string;
  isBot: boolean;
  embeds: any[];
  attachments: any[];
}>): Message {
  const opts = {
    id: 'msg-001',
    content: 'Hello world',
    guildId: 'guild-123',
    guildName: 'Test Guild',
    channelId: 'channel-456',
    channelName: 'general',
    authorId: 'user-789',
    authorName: 'testuser',
    authorTag: 'testuser#0001',
    isBot: false,
    embeds: [],
    attachments: [],
    ...overrides,
  };

  return {
    id: opts.id,
    content: opts.content,
    guildId: opts.guildId,
    channelId: opts.channelId,
    createdAt: new Date('2024-01-01T12:00:00Z'),
    guild: { name: opts.guildName } as Guild,
    channel: { name: opts.channelName } as TextChannel,
    author: {
      id: opts.authorId,
      username: opts.authorName,
      tag: opts.authorTag,
      bot: opts.isBot,
    } as User,
    embeds: opts.embeds,
    attachments: new Collection(opts.attachments.map((a: any) => [a.id, a])),
  } as unknown as Message;
}

describe('MessageExtractor', () => {
  let extractor: MessageExtractor;

  beforeEach(() => {
    extractor = new MessageExtractor();
  });

  describe('extract() — campos básicos', () => {
    it('preenche todos os campos de origem e autor', () => {
      const msg = makeMessage({});
      const result = extractor.extract(msg);

      expect(result.messageId).toBe('msg-001');
      expect(result.guildId).toBe('guild-123');
      expect(result.guildName).toBe('Test Guild');
      expect(result.channelId).toBe('channel-456');
      expect(result.channelName).toBe('general');
      expect(result.authorId).toBe('user-789');
      expect(result.authorName).toBe('testuser');
      expect(result.authorTag).toBe('testuser#0001');
      expect(result.isBot).toBe(false);
      expect(result.text).toBe('Hello world');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('detecta mensagem de bot', () => {
      const msg = makeMessage({ isBot: true });
      const result = extractor.extract(msg);
      expect(result.isBot).toBe(true);
    });
  });

  describe('extract() — links', () => {
    it('extrai links do texto', () => {
      const msg = makeMessage({ content: 'Veja https://example.com e http://outro.com/path' });
      const result = extractor.extract(msg);

      expect(result.hasLink).toBe(true);
      expect(result.links).toContain('https://example.com');
      expect(result.links).toContain('http://outro.com/path');
    });

    it('deduplica links repetidos', () => {
      const msg = makeMessage({ content: 'https://example.com https://example.com' });
      const result = extractor.extract(msg);
      expect(result.links.filter(l => l === 'https://example.com')).toHaveLength(1);
    });

    it('hasLink é false sem links', () => {
      const msg = makeMessage({ content: 'Sem links aqui' });
      const result = extractor.extract(msg);
      expect(result.hasLink).toBe(false);
      expect(result.links).toHaveLength(0);
    });
  });

  describe('extract() — embeds', () => {
    it('extrai títulos e descrições de embeds', () => {
      const msg = makeMessage({
        embeds: [
          { title: 'Título 1', description: 'Desc 1', url: null, image: null, thumbnail: null, fields: [] },
          { title: 'Título 2', description: 'Desc 2', url: null, image: null, thumbnail: null, fields: [] },
        ],
      });
      const result = extractor.extract(msg);

      expect(result.hasEmbed).toBe(true);
      expect(result.embedTitles).toEqual(['Título 1', 'Título 2']);
      expect(result.embedDescriptions).toEqual(['Desc 1', 'Desc 2']);
    });

    it('extrai link da URL do embed', () => {
      const msg = makeMessage({
        embeds: [{ title: 'T', description: null, url: 'https://embed-link.com', image: null, thumbnail: null, fields: [] }],
      });
      const result = extractor.extract(msg);
      expect(result.links).toContain('https://embed-link.com');
    });

    it('extrai links dos fields do embed', () => {
      const msg = makeMessage({
        embeds: [{
          title: null, description: null, url: null, image: null, thumbnail: null,
          fields: [{ name: 'Campo', value: 'Veja https://field-link.com' }],
        }],
      });
      const result = extractor.extract(msg);
      expect(result.links).toContain('https://field-link.com');
    });

    it('hasEmbed é false sem embeds', () => {
      const msg = makeMessage({ embeds: [] });
      const result = extractor.extract(msg);
      expect(result.hasEmbed).toBe(false);
    });
  });

  describe('extract() — imagens', () => {
    it('extrai imagens de attachments', () => {
      const msg = makeMessage({
        attachments: [
          { id: '1', url: 'https://img.com/photo.jpg', contentType: 'image/jpeg' },
        ],
      });
      const result = extractor.extract(msg);
      expect(result.hasImage).toBe(true);
      expect(result.imageUrls).toContain('https://img.com/photo.jpg');
    });

    it('ignora attachments que não são imagens', () => {
      const msg = makeMessage({
        attachments: [
          { id: '1', url: 'https://files.com/doc.pdf', contentType: 'application/pdf' },
        ],
      });
      const result = extractor.extract(msg);
      expect(result.hasImage).toBe(false);
    });

    it('extrai imagens de embeds (image e thumbnail)', () => {
      const msg = makeMessage({
        embeds: [{
          title: null, description: null, url: null, fields: [],
          image: { url: 'https://img.com/embed.jpg' },
          thumbnail: { url: 'https://img.com/thumb.jpg' },
        }],
      });
      const result = extractor.extract(msg);
      expect(result.imageUrls).toContain('https://img.com/embed.jpg');
      expect(result.imageUrls).toContain('https://img.com/thumb.jpg');
    });
  });

  describe('extract() — hash de deduplicação', () => {
    it('gera hash SHA-256 não vazio', () => {
      const msg = makeMessage({});
      const result = extractor.extract(msg);
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('mesma mensagem gera mesmo hash', () => {
      const msg1 = makeMessage({ content: 'Texto igual' });
      const msg2 = makeMessage({ content: 'Texto igual' });
      expect(extractor.extract(msg1).hash).toBe(extractor.extract(msg2).hash);
    });

    it('mensagens diferentes geram hashes diferentes', () => {
      const msg1 = makeMessage({ content: 'Texto A' });
      const msg2 = makeMessage({ content: 'Texto B' });
      expect(extractor.extract(msg1).hash).not.toBe(extractor.extract(msg2).hash);
    });
  });
});
