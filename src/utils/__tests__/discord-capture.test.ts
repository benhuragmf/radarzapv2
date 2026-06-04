import {
  discordMarkdownToWhatsApp,
  isUsefulLink,
  captureDiscordMessage,
} from '../discord-capture';
import { contentSourceMessage } from '../discord-forward';
import { ComponentType, Message } from 'discord.js';
import { MessageReferenceType } from 'discord-api-types/v10';

describe('discord-capture', () => {
  describe('isUsefulLink', () => {
    it('rejeita devlog.rss e giveaways alienware', () => {
      expect(isUsefulLink('https://x.itch.io/foo/devlog.rss?ref=a')).toBe(false);
      expect(
        isUsefulLink(
          'https://www.alienwarearena.com/ucf/show/1/Giveaway/key-giveaway?ref=a'
        )
      ).toBe(false);
    });

    it('aceita lojas conhecidas', () => {
      expect(isUsefulLink('https://store.steampowered.com/app/123')).toBe(true);
      expect(isUsefulLink('https://galengames.itch.io/academy-carols')).toBe(true);
    });
  });

  describe('discordMarkdownToWhatsApp', () => {
    it('mantém nome do jogo e remove URL técnica', () => {
      const { text, links } = discordMarkdownToWhatsApp(
        '• [Mafia II](https://hedi.itch.io/foo/devlog.rss)\n• **Tomb Raider**'
      );
      expect(text).toContain('Mafia II');
      expect(text).toContain('Tomb Raider');
      expect(links.some(l => l.includes('devlog'))).toBe(false);
    });

    it('converte bullet e negrito para WhatsApp', () => {
      const { text } = discordMarkdownToWhatsApp('- **Steam**: jogo');
      expect(text).toContain('•');
      expect(text).toContain('*Steam*');
    });
  });

  describe('captureDiscordMessage', () => {
    it('formata lista de jogos grátis com fields e botões', () => {
      const message = {
        id: 'm1',
        content: '',
        embeds: [
          {
            title: '🆓 Jogos Gratuitos Disponíveis (2/2)',
            description: 'Confira os jogos gratuitos disponíveis agora.',
            fields: [
              {
                name: '💩 Itch.io (5 jogos)',
                value: '• [Madness Inside](https://madness.itch.io/game)\n• https://hedi.itch.io/foo/devlog.rss?ref=x',
              },
            ],
            footer: { text: 'Total: 24 jogos | Tempo: 31106ms' },
          },
        ],
        attachments: { values: () => [] },
        components: [
          {
            components: [
              {
                type: ComponentType.Button,
                label: 'Ver Itch.io',
                url: 'https://itch.io/games/free',
              },
            ],
          },
        ],
        author: { username: 'Radar Gamer', bot: true },
        channel: { name: 'free-games' },
      } as unknown as Message;

      const r = captureDiscordMessage(message);

      expect(r.kind).toBe('embed_list');
      expect(r.whatsappBody).toContain('Itch.io');
      expect(r.whatsappBody).toContain('Madness Inside');
      expect(r.whatsappBody).not.toContain('devlog.rss');
      expect(r.whatsappBody).not.toContain('Total: 24');
      expect(r.linksSection).toContain('Ver Itch.io');
      expect(r.storeButtons.length).toBeGreaterThan(0);
    });

    it('lê conteúdo de mensagem encaminhada via messageSnapshots', () => {
      const snapshot = {
        content:
          '42.19.0 released on unstable branch. https://theindiestone.com/forums/index.php?/topic/95733-build-42190-unstable-released/',
        embeds: [
          {
            title: 'Build 42.19.0 UNSTABLE Released',
            description:
              'As always it is recommended that you create a new save with no mods after updates.',
            url: 'https://theindiestone.com/forums/index.php?/topic/95733-build-42190-unstable-released/',
            provider: { name: 'The Indie Stone Forums' },
          },
        ],
        attachments: { values: () => [] },
        components: [],
      } as unknown as Message;

      const wrapper = {
        id: 'fwd1',
        content: '',
        embeds: [],
        attachments: { values: () => [] },
        components: [],
        reference: {
          type: MessageReferenceType.Forward,
          channelId: 'ch1',
          guildId: 'g1',
          messageId: 'orig1',
        },
        messageSnapshots: {
          size: 1,
          first: () => snapshot,
        },
        author: { username: 'skulksgamer', bot: false },
        channel: { name: 'live-on' },
      } as unknown as Message;

      expect(contentSourceMessage(wrapper)).toBe(snapshot);

      const r = captureDiscordMessage(wrapper);

      expect(r.whatsappBody).toContain('42.19.0');
      expect(r.whatsappBody).toContain('Build 42.19.0 UNSTABLE Released');
      expect(r.primaryLink).toContain('theindiestone.com');
      expect(r.kind).toBe('news');
      expect(r.linksSection).toContain('theindiestone.com');
    });
  });
});
