import {
  coerceStreamTemplate,
  isWeakStreamOutbound,
  resolveOutboundTemplate,
  shouldUseLiveTemplate,
} from '../stream-template';

describe('stream-template', () => {
  it('coerce dw-padrao → dw-live para canal Twitch', () => {
    expect(
      coerceStreamTemplate('dw-padrao', 'https://www.twitch.tv/felps', 'embed')
    ).toBe('dw-live');
  });

  it('coerce dw-padrao → dw-video para YouTube watch (mesmo em #live-on)', () => {
    expect(
      coerceStreamTemplate(
        'dw-padrao',
        'https://www.youtube.com/watch?v=abc',
        'embed',
        'live-on'
      )
    ).toBe('dw-video');
  });

  it('shouldUseLiveTemplate false para YouTube vídeo no canal live-on', () => {
    expect(
      shouldUseLiveTemplate(
        {
          captureKind: 'video',
          channelName: 'live-on',
          primaryLink: 'https://www.youtube.com/watch?v=abc',
        } as any,
        '',
        'https://www.youtube.com/watch?v=abc'
      )
    ).toBe(false);
  });

  it('resolveOutboundTemplate usa dw-video para TikTok /video/', () => {
    const link = 'https://www.tiktok.com/@user/video/123';
    expect(
      resolveOutboundTemplate(
        { captureKind: 'embed', channelName: 'live-on', primaryLink: link } as any,
        { streamLink: link }
      )
    ).toBe('dw-video');
  });

  it('detecta corpo fraco 📢 sem rodapé (título de live)', () => {
    expect(
      isWeakStreamOutbound('📢 *271 | DINHEIRO!!!*', 'https://www.twitch.tv/pava')
    ).toBe(true);
    expect(
      isWeakStreamOutbound(
        '🔴 *felps está ao vivo!*\n\n🔗 https://www.twitch.tv/felps\n\n_felps via radarzap_',
        'https://www.twitch.tv/felps'
      )
    ).toBe(false);
  });
});
