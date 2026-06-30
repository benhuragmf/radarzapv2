import type { ExtractedMessage } from '@/services/discord-bot/MessageExtractor';
import { buildDiscordWhatsAppVariables } from '@/utils/discord-wa-variables';
import {
  buildRodape,
  extractCreatorSlugFromUrl,
  resolveSenderLabel,
  resolveStreamerIdentity,
} from '@/utils/discord-wa-format';

function baseExtracted(overrides: Partial<ExtractedMessage> = {}): ExtractedMessage {
  return {
    text: '',
    links: [],
    authorName: 'outro_no_discord',
    radarchatSenderLabel: 'skulksgamer',
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
  it('prioriza handle do link TikTok', () => {
    const extracted = baseExtracted({
      primaryLink: 'https://www.tiktok.com/@mcjean7/live',
    });

    expect(resolveStreamerIdentity(extracted)).toBe('mcjean7');
  });
});

describe('buildDiscordWhatsAppVariables', () => {
  it('streamer da URL; rodapé com tenant do painel', () => {
    const extracted = baseExtracted({
      radarchatSenderLabel: 'skulksgamer',
      primaryLink: 'https://www.tiktok.com/@mcjean7/live',
    });

    const { variables } = buildDiscordWhatsAppVariables(extracted);

    expect(variables.streamer).toBe('mcjean7');
    expect(variables.rodape).toContain('skulksgamer via radarchat');
    expect(variables.rodape).not.toContain('mcjean7 via radarchat');
    expect(variables.autor).toBe('skulksgamer');
  });

  it('empresa no rodapé quando radarchatSenderLabel é org', () => {
    const extracted = baseExtracted({
      radarchatSenderLabel: 'SoContabilida',
      primaryLink: 'https://www.twitch.tv/sonycxtv',
      captureKind: 'live',
    });

    const { variables } = buildDiscordWhatsAppVariables(extracted);

    expect(variables.streamer).toBe('sonycxtv');
    expect(variables.rodape).toContain("SoContabilida via radarchat • @");
    expect(variables.canal_rota).toBe('@outro_no_discord > #live-on');
  });
});

describe('buildRodape', () => {
  it('usa tenant, não streamer nem autor do canal', () => {
    const extracted = baseExtracted({
      radarchatSenderLabel: 'skulksgamer',
      primaryLink: 'https://www.twitch.tv/sonycxtv',
    });

    const rodape = buildRodape(extracted, '04/06/2026', '12:11');

    expect(rodape).toBe(
      'skulksgamer via radarchat • @outro_no_discord > #live-on • SK2 Staff • 04/06/2026 12:11',
    );
    expect(rodape).not.toContain('sonycxtv via');
  });

  it('inclui apelido do servidor no trecho @poster > #canal', () => {
    const extracted = baseExtracted({
      radarchatSenderLabel: 'SoContabilida',
      discordPosterLabel: "'Skulks",
      primaryLink: 'https://www.twitch.tv/sonycxtv',
    });

    const rodape = buildRodape(extracted, '04/06/2026', '12:12');

    expect(rodape).toBe(
      "SoContabilida via radarchat • @'Skulks > #live-on • SK2 Staff • 04/06/2026 12:12",
    );
  });

  it('não usa segmento videos da URL Twitch', () => {
    const extracted = baseExtracted({
      radarchatSenderLabel: 'skulksgamer',
      primaryLink: 'https://www.twitch.tv/videos/2780609664',
      captureKind: 'video',
    });

    expect(buildRodape(extracted, '04/06/2026', '12:12')).toMatch(/^skulksgamer via radarchat/);
  });
});
