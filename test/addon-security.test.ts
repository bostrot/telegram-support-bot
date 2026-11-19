import DiscordAddon, { isValidSnowflake, sanitizeHeartbeatInterval } from '../src/addons/discord/index';
import SignalAddon, { isValidAttachmentId } from '../src/addons/signal/index';
import cache from '../src/cache';

describe('Discord addon input validation', () => {
  it('accepts only numeric snowflake IDs', () => {
    expect(isValidSnowflake('123456789012345678')).toBe(true);
    expect(isValidSnowflake('../../users/@me')).toBe(false);
    expect(isValidSnowflake('123456789012345678/../x')).toBe(false);
    expect(isValidSnowflake(123456789012345678)).toBe(false);
    expect(isValidSnowflake(undefined)).toBe(false);
  });

  it('falls back to the default heartbeat for out-of-range intervals', () => {
    expect(sanitizeHeartbeatInterval(41250)).toBe(41250);
    expect(sanitizeHeartbeatInterval(1)).toBe(41250);
    expect(sanitizeHeartbeatInterval(1e12)).toBe(41250);
    expect(sanitizeHeartbeatInterval(Infinity)).toBe(41250);
    expect(sanitizeHeartbeatInterval('5000')).toBe(41250);
  });

  it('does not request guild channels for an invalid guild ID', async () => {
    const addon = DiscordAddon.getInstance() as any;
    addon.axiosInstance.get = jest.fn().mockResolvedValue({ data: [] });

    await addon.fetchGuildChannels('../../users/@me');
    expect(addon.axiosInstance.get).not.toHaveBeenCalled();

    await addon.fetchGuildChannels('123456789012345678');
    expect(addon.axiosInstance.get).toHaveBeenCalledWith('/guilds/123456789012345678/channels');
  });

  it('uses a bounded heartbeat interval and replaces the previous timer', () => {
    jest.useFakeTimers();
    const setSpy = jest.spyOn(global, 'setInterval');
    const clearSpy = jest.spyOn(global, 'clearInterval');
    try {
      const addon = DiscordAddon.getInstance() as any;
      addon.startHeartbeat(1e12);
      expect(setSpy).toHaveBeenLastCalledWith(expect.any(Function), 41250);
      addon.startHeartbeat(30000);
      expect(setSpy).toHaveBeenLastCalledWith(expect.any(Function), 30000);
      expect(clearSpy).toHaveBeenCalled();
      clearInterval(addon.heartbeatTimer);
    } finally {
      setSpy.mockRestore();
      clearSpy.mockRestore();
      jest.useRealTimers();
    }
  });
});

describe('Signal addon group admin lookup', () => {
  // Staff rights are only granted in the configured staff chat (GHSA-wq8w-p5p2-r74c)
  let staffchatId: any;
  beforeAll(() => {
    staffchatId = cache.config.staffchat_id;
    cache.config.staffchat_id = 'group.abc/def';
  });
  afterAll(() => {
    cache.config.staffchat_id = staffchatId;
  });

  it('resolves the group from the group list without putting the chat ID in the URL', async () => {
    const addon = SignalAddon.getInstance() as any;
    addon.axiosInstance.get = jest.fn().mockResolvedValue({
      data: [
        { id: 'group.other', admins: ['+1'] },
        { id: 'group.abc/def', admins: ['+15550001'] },
      ],
    });
    const ctx: any = {
      chat: { id: 'group.abc/def', type: 'group' },
      from: { id: '+15550001' },
      session: {},
    };

    await addon.setGroupAdmin(ctx);

    expect(addon.axiosInstance.get).toHaveBeenCalledTimes(1);
    const url: string = addon.axiosInstance.get.mock.calls[0][0];
    expect(url).not.toContain('group.abc');
    expect(ctx.session.admin).toBe(true);
  });

  it('does not grant admin when the sender is not a group admin', async () => {
    const addon = SignalAddon.getInstance() as any;
    addon.axiosInstance.get = jest.fn().mockResolvedValue({
      data: [{ id: 'group.abc/def', admins: ['+1'] }],
    });
    const ctx: any = { chat: { id: 'group.abc/def', type: 'group' }, from: { id: '+2' }, session: {} };

    await addon.setGroupAdmin(ctx);
    expect(ctx.session.admin).toBeUndefined();
  });
});

describe('Discord channel resolution', () => {
  const addon = DiscordAddon.getInstance() as any;
  let configured: any;
  beforeAll(() => {
    configured = cache.config.discord_channel_id;
  });
  afterAll(() => {
    cache.config.discord_channel_id = configured;
    addon.channels.clear();
  });

  it('only resolves to numeric snowflake IDs', () => {
    addon.channels.set('support', { name: 'support', id: '223456789012345678' });
    addon.channels.set('bogus', { name: 'bogus', id: '../../users/@me' });
    expect(addon.resolveChannelId('123456789012345678')).toBe('123456789012345678');
    expect(addon.resolveChannelId('support')).toBe('223456789012345678');
    expect(addon.resolveChannelId('bogus')).toBeNull();
    expect(addon.resolveChannelId('../../users/@me')).toBeNull();
    expect(addon.resolveChannelId('unknown-channel')).toBeNull();
  });

  it('ignores a configured default channel that is not a snowflake', () => {
    cache.config.discord_channel_id = '123/../../guilds';
    expect(addon.resolveChannelId('default')).toBeNull();
    cache.config.discord_channel_id = '323456789012345678';
    expect(addon.resolveChannelId('default')).toBe('323456789012345678');
  });

  it('does not send a message for an unresolvable chat ID', async () => {
    addon.axiosInstance.post = jest.fn().mockResolvedValue({ data: { id: '1' } });
    expect(await addon.sendMessage('../../users/@me', 'hi')).toBeNull();
    expect(addon.axiosInstance.post).not.toHaveBeenCalled();

    await addon.sendMessage('123456789012345678', 'hi');
    expect(addon.axiosInstance.post).toHaveBeenCalledWith('/channels/123456789012345678/messages', expect.anything());
  });
});

describe('Signal attachment IDs', () => {
  it('accepts only single-segment attachment IDs', () => {
    expect(isValidAttachmentId('Xk2pQ9-_abc.jpg')).toBe(true);
    expect(isValidAttachmentId('../v1/groups')).toBe(false);
    expect(isValidAttachmentId('a/b')).toBe(false);
    expect(isValidAttachmentId('..')).toBe(false);
    expect(isValidAttachmentId('a?x=1')).toBe(false);
    expect(isValidAttachmentId('')).toBe(false);
    expect(isValidAttachmentId(undefined)).toBe(false);
  });

  it('does not fetch an attachment with an invalid ID', async () => {
    const addon = SignalAddon.getInstance() as any;
    addon.axiosInstance.get = jest.fn().mockResolvedValue({ data: Buffer.from(''), headers: {} });
    addon.axiosInstance.post = jest.fn().mockResolvedValue({ data: { timestamp: 1 } });
    addon.axiosInstance.delete = jest.fn().mockResolvedValue({});

    expect(await addon.sendFile('+1', '../v1/groups/+1')).toBeNull();
    expect(addon.axiosInstance.get).not.toHaveBeenCalled();

    await addon.sendFile('+1', 'abc123.jpg');
    expect(addon.axiosInstance.get).toHaveBeenCalledWith('/v1/attachments/abc123.jpg', expect.anything());
    expect(addon.axiosInstance.delete).toHaveBeenCalledWith('/v1/attachments/abc123.jpg');
  });
});
