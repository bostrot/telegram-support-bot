import DiscordAddon, { isValidSnowflake, sanitizeHeartbeatInterval } from '../src/addons/discord/index';
import SignalAddon from '../src/addons/signal/index';
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
