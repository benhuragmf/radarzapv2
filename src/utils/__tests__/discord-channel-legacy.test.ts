import {
  sanitizeDiscordChannelForApi,
  sanitizeDiscordChannelsForApi,
} from '../discord-channel-legacy.util';

describe('discord-channel-legacy.util', () => {
  it('remove destinationIds e templateName da resposta da API', () => {
    const raw = {
      _id: 'abc',
      channelId: '123',
      destinationIds: ['dest1'],
      templateName: 'old-template',
      rulePriority: 'high',
    };
    expect(sanitizeDiscordChannelForApi(raw)).toEqual({
      _id: 'abc',
      channelId: '123',
      rulePriority: 'high',
    });
  });

  it('sanitiza lista de canais', () => {
    const list = [
      { channelId: '1', destinationIds: [], templateName: 'x' },
      { channelId: '2', templateName: 'y' },
    ];
    const out = sanitizeDiscordChannelsForApi(list);
    expect(out).toHaveLength(2);
    expect(out[0]).not.toHaveProperty('destinationIds');
    expect(out[0]).not.toHaveProperty('templateName');
  });
});
