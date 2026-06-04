import type { ExtractedMessage } from '@/services/discord-bot/MessageExtractor';
import { buildDiscordWhatsAppVariables } from '@/utils/discord-wa-variables';
import {
  buildRodape,
  extractCreatorSlugFromUrl,
  resolveStreamerIdentity,
} from '@/utils/discord-wa-format';

function baseExtracted(overrides: Partial<ExtractedMessage> = {}): ExtractedMessage {
  return {
    text: '',
    links: [],
    authorName: 'skulksgamer',
    channelName: 'live-on',
    guildName: 'SK2 Staff',
    isBot: true,
    captureKind: 'live',
    ...overrides,
  } as ExtractedMessage;
}

describe('extractCreatorSlugFromUrl', () => {
  it('extrai handle TikTok da URL /live', () => {
    expect(extractCreatorSlugFromUrl('https://www.tiktok.com/@mcjean7/live')).toBe('mcjean7');
  });

  it('extrai slug Twitch ignorando paths reservados', () => {
    expect(extractCreatorSlugFromUrl('https://www.twitch.tv/ninja')).toBe('ninja');
    expect(extractCreatorSlugFromUrl('https://www.twitch.tv/videos/123')).toBe('');
  });
});

describe('resolveStreamerIdentity', () => {
  it('prioriza handle do link TikTok sobre autor Discord', () => {
    const extracted = baseExtracted({
      primaryLink: 'https://www.tiktok.com/@mcjean7/live',
    });

    expect(resolveStreamerIdentity(extracted)).toBe('mcjean7');
  });

  it('usa autor Discord quando não há link de stream', () => {
    const extracted = baseExtracted({ authorName: 'skulksgamer' });

    expect(resolveStreamerIdentity(extracted)).toBe('skulksgamer');
  });
});

describe('buildDiscordWhatsAppVariables — TikTok live', () => {
  it('monta título e rodapé com mcjean7, não skulksgamer', () => {
    const extracted = baseExtracted({
      primaryLink: 'https://www.tiktok.com/@mcjean7/live',
      embedDescriptions: [
        "Rimando e cantando!. | Check out Mc Jean Jc o Brabo da rima's LIVE streams on TikTok!",
      ],
    });

    const { variables } = buildDiscordWhatsAppVariables(extracted);

    expect(variables.streamer).toBe('mcjean7');
    expect(variables.rodape).toContain('mcjean7 via radarzap');
    expect(variables.rodape).not.toContain('skulksgamer');
    expect(variables.plataforma).toBe('TikTok');
  });
});

describe('buildRodape', () => {
  it('usa streamer da URL TikTok', () => {
    const extracted = baseExtracted({
      primaryLink: 'https://www.tiktok.com/@mcjean7/live',
    });

    const rodape = buildRodape(extracted, '04/06/2026', '01:59');

    expect(rodape).toMatch(/^mcjean7 via radarzap/);
  });
});
