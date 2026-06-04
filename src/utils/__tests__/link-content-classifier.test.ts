import {
  classifyLinkUrl,
  classifyLinksInMessage,
  isNewsUrl,
} from '../link-content-classifier';

describe('link-content-classifier', () => {
  describe('classifyLinkUrl', () => {
    it('Twitch: canal = live, VOD = video, clip = short', () => {
      expect(classifyLinkUrl('https://twitch.tv/hellfps1')).toBe('live');
      expect(classifyLinkUrl('https://www.twitch.tv/videos/123456789')).toBe('video');
      expect(classifyLinkUrl('https://clips.twitch.tv/Slug/ClipId')).toBe('short');
    });

    it('YouTube: shorts, live e watch', () => {
      expect(classifyLinkUrl('https://youtube.com/shorts/abc123')).toBe('short');
      expect(classifyLinkUrl('https://youtube.com/live/xyz')).toBe('live');
      expect(classifyLinkUrl('https://www.youtube.com/watch?v=abc')).toBe('video');
      expect(classifyLinkUrl('https://youtu.be/abc123')).toBe('video');
    });

    it('TikTok: live, vídeo e short', () => {
      expect(classifyLinkUrl('https://www.tiktok.com/@mcjean7/live')).toBe('live');
      expect(classifyLinkUrl('https://www.tiktok.com/@user/video/7556932735063936270')).toBe('video');
    });

    it('sites de notícia', () => {
      expect(classifyLinkUrl('https://g1.globo.com/tecnologia/noticia/2024/01/01/foo.ghtml')).toBe(
        'news'
      );
      expect(isNewsUrl('https://www.ign.com/articles/some-game-news')).toBe(true);
    });
  });

  describe('classifyLinksInMessage', () => {
    it('prioriza live quando há texto de ao vivo', () => {
      const r = classifyLinksInMessage(
        ['https://youtube.com/watch?v=x'],
        'Gameplay está ao vivo agora'
      );
      expect(r.captureKind).toBe('live');
    });

    it('vídeo YouTube não vira live só por estar no canal live-on', () => {
      const r = classifyLinksInMessage(
        ['https://www.youtube.com/watch?v=J0RnTApyRgA'],
        'História do Episódio Cities Skylines'
      );
      expect(r.captureKind).toBe('video');
    });

    it('escolhe short quando URL é /shorts/', () => {
      const r = classifyLinksInMessage(
        ['https://youtube.com/shorts/abc'],
        'Novo short no canal'
      );
      expect(r.linkType).toBe('short');
      expect(r.captureKind).toBe('short');
    });
  });
});
