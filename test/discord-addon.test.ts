// Tests for the Discord addon dispatch: command arguments and RegExp matches handed to
// handlers the same way grammY does, so the shared commands work on Discord too.
const axiosInstance = {
  post: jest.fn().mockResolvedValue({ data: { id: '55' } }),
  get: jest.fn().mockResolvedValue({ data: [] }),
};

jest.mock('axios', () => ({ create: jest.fn(() => axiosInstance) }));
jest.mock('../src/handlers', () => ({ registerCommonHandlers: jest.fn() }));
jest.mock('../src/cache', () => ({
  __esModule: true,
  default: { config: { discord_bot_token: 'token', discord_channel_id: '', discord_enabled: true } },
}));

import DiscordAddon from '../src/addons/discord';
import { Context } from '../src/interfaces';

const message = (content: string) => ({
  id: '1',
  channel_id: '99',
  channel_type: 0,
  content,
  timestamp: new Date().toISOString(),
  author: { id: '7', username: 'alice', bot: false },
});

describe('DiscordAddon dispatch', () => {
  const addon = DiscordAddon.getInstance();
  const commandHandlers = (addon as unknown as { commandHandlers: Map<string, unknown> }).commandHandlers;
  const hears = (addon as unknown as { hearsHandlers: unknown[] }).hearsHandlers;
  const deliver = (content: string) =>
    (addon as unknown as { handleMessageCreate: (msg: unknown) => void }).handleMessageCreate(message(content));

  beforeEach(() => {
    jest.clearAllMocks();
    commandHandlers.clear();
    hears.length = 0;
  });

  it('passes the text behind a command as ctx.match', () => {
    const ticket = jest.fn();
    addon.command('ticket', ticket);
    deliver('/ticket 1234');

    expect((ticket.mock.calls[0][0] as Context).match).toBe('1234');
  });

  it('hands RegExp triggers the match array instead of a stringified one (#84)', () => {
    const canned = jest.fn();
    addon.hears(/^\/(\w+)(?:@\w+)?$/, canned);
    deliver('/faq');

    const match = (canned.mock.calls[0][0] as Context).match;
    expect(Array.isArray(match)).toBe(true);
    expect((match as RegExpMatchArray)[1]).toBe('faq');
  });

  it('prefers a registered command over the hears fall-through', () => {
    const close = jest.fn();
    const canned = jest.fn();
    addon.command('close', close);
    addon.hears(/^\/(\w+)$/, canned);
    deliver('/close');

    expect(close).toHaveBeenCalledTimes(1);
    expect(canned).not.toHaveBeenCalled();
  });

  it('ignores messages sent by bots', () => {
    const canned = jest.fn();
    addon.hears(/^\/(\w+)$/, canned);
    (addon as unknown as { handleMessageCreate: (msg: unknown) => void }).handleMessageCreate({
      ...message('/faq'),
      author: { id: '7', username: 'bot', bot: true },
    });

    expect(canned).not.toHaveBeenCalled();
  });

  it('has no sticker support, so the sticker handler is never registered', () => {
    expect((addon as { sendSticker?: unknown }).sendSticker).toBeUndefined();
  });
});
