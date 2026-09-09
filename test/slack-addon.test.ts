// Tests for the Slack addon dispatch: command arguments and RegExp matches handed to
// handlers the same way grammY does, so the shared commands work on Slack too.
const axiosInstance = {
  post: jest.fn().mockResolvedValue({ data: { ok: true, ts: '1.2' } }),
  get: jest.fn().mockResolvedValue({ data: { ok: true } }),
};

jest.mock('axios', () => ({ create: jest.fn(() => axiosInstance) }));
jest.mock('../src/handlers', () => ({ registerCommonHandlers: jest.fn() }));
jest.mock('../src/cache', () => ({
  __esModule: true,
  default: { config: { slack_bot_token: 'token', slack_channel_id: '', slack_enabled: true } },
}));

import SlackAddon from '../src/addons/slack';
import { Context } from '../src/interfaces';

const message = (text: string) => ({
  type: 'message',
  channel: 'C1',
  user: 'U1',
  ts: '1700000000.000100',
  text,
});

describe('SlackAddon dispatch', () => {
  const addon = SlackAddon.getInstance();
  const commandHandlers = (addon as unknown as { commandHandlers: Map<string, unknown> }).commandHandlers;
  const hears = (addon as unknown as { hearsHandlers: unknown[] }).hearsHandlers;
  const deliver = (text: string) =>
    (addon as unknown as { handleRTMMessage: (msg: unknown) => void }).handleRTMMessage(message(text));

  beforeEach(() => {
    jest.clearAllMocks();
    commandHandlers.clear();
    hears.length = 0;
  });

  it('passes the text behind a command as ctx.match', () => {
    const broadcast = jest.fn();
    addon.command('broadcast', broadcast);
    deliver('/broadcast we are back online');

    expect((broadcast.mock.calls[0][0] as Context).match).toBe('we are back online');
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

  it('ignores bot messages', () => {
    const canned = jest.fn();
    addon.hears(/^\/(\w+)$/, canned);
    (addon as unknown as { handleRTMMessage: (msg: unknown) => void }).handleRTMMessage({
      ...message('/faq'),
      subtype: 'bot_message',
    });

    expect(canned).not.toHaveBeenCalled();
  });

  it('has no sticker support, so the sticker handler is never registered', () => {
    expect((addon as { sendSticker?: unknown }).sendSticker).toBeUndefined();
  });
});
