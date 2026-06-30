import { splitImageCaption } from '../discord-wa-format';

describe('splitImageCaption', () => {
  it('mantém link e rodapé na legenda quando o corpo é longo', () => {
    const body = '🔴 streamer está ao vivo!\n\n' + '📺 '.repeat(200) + 'Título longo';
    const link = '🔗 https://www.twitch.tv/streamer';
    const rodape = '_streamer via radarchat • #live-on • SK2 Staff • 04/06/2026 00:33_';
    const full = `${body}\n\n${link}\n\n${rodape}`;

    const { caption, followUp } = splitImageCaption(full);
    expect(caption).toContain('https://www.twitch.tv/streamer');
    expect(caption).toContain('via radarchat');
    expect(followUp).toBe('');
  });
});
