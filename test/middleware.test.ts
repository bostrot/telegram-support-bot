// Tests for middleware.sendMessage routing: every addon must be reachable, otherwise
// features like /broadcast (#159) silently skip whole platforms.
const telegramSend = jest.fn().mockResolvedValue('1');
const signalSend = jest.fn().mockResolvedValue('2');
const slackSend = jest.fn().mockResolvedValue('3');
const discordSend = jest.fn().mockResolvedValue('4');
const emit = jest.fn();

jest.mock('../src/addons/telegram', () => ({
  __esModule: true,
  default: { getInstance: () => ({ sendMessage: telegramSend }) },
}));
jest.mock('../src/addons/signal', () => ({
  __esModule: true,
  default: { getInstance: () => ({ sendMessage: signalSend }) },
}));
jest.mock('../src/addons/slack', () => ({
  __esModule: true,
  default: { getInstance: () => ({ sendMessage: slackSend }) },
}));
jest.mock('../src/addons/discord', () => ({
  __esModule: true,
  default: { getInstance: () => ({ sendMessage: discordSend }) },
}));
jest.mock('../src/cache', () => ({
  __esModule: true,
  default: {
    config: { parse_mode: 'MarkdownV2', language: { replyPrivate: 'Reply' } },
    io: { to: jest.fn(() => ({ emit })) },
  },
}));

import * as middleware from '../src/middleware';
import { Messenger } from '../src/interfaces';

describe('sendMessage routing', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reaches every messenger addon', async () => {
    await middleware.sendMessage('1', Messenger.TELEGRAM, 'hi');
    await middleware.sendMessage('2', Messenger.SIGNAL, 'hi');
    await middleware.sendMessage('3', Messenger.SLACK, 'hi');
    await middleware.sendMessage('4', Messenger.DISCORD, 'hi');

    expect(telegramSend).toHaveBeenCalledWith('1', 'hi', { parse_mode: 'MarkdownV2' });
    expect(signalSend).toHaveBeenCalledWith('2', 'hi', { parse_mode: 'MarkdownV2' });
    expect(slackSend).toHaveBeenCalledWith('3', 'hi', { parse_mode: 'MarkdownV2' });
    expect(discordSend).toHaveBeenCalledWith('4', 'hi', { parse_mode: 'MarkdownV2' });
  });

  it('emits web chat messages over the socket', async () => {
    await expect(middleware.sendMessage('WEBabc', Messenger.WEB, 'hi')).resolves.toBeNull();
    expect(emit).toHaveBeenCalledWith('chat_staff', 'hi');
  });

  it('collapses repeated spaces', async () => {
    await middleware.sendMessage('1', Messenger.TELEGRAM, 'a    b');
    expect(telegramSend).toHaveBeenCalledWith('1', 'a b', { parse_mode: 'MarkdownV2' });
  });

  it('throws for an unknown messenger', async () => {
    await expect(middleware.sendMessage('1', 'matrix', 'hi')).rejects.toThrow('Invalid messenger type');
  });
});
