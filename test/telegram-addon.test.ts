// Tests for the Telegram addon: staffchat_thread_id injection (#183) and sticker, voice, audio and video note sending
const mockApi = {
  sendMessage: jest.fn().mockResolvedValue({ message_id: 5 }),
  sendPhoto: jest.fn().mockResolvedValue({ message_id: 6 }),
  sendDocument: jest.fn().mockResolvedValue({ message_id: 7 }),
  sendVideo: jest.fn().mockResolvedValue({ message_id: 8 }),
  sendSticker: jest.fn().mockResolvedValue({ message_id: 9 }),
  sendVoice: jest.fn().mockResolvedValue({ message_id: 10 }),
  sendAudio: jest.fn().mockResolvedValue({ message_id: 11 }),
  sendVideoNote: jest.fn().mockResolvedValue({ message_id: 12 }),
  setMyCommands: jest.fn().mockResolvedValue(true),
  config: { use: jest.fn() },
};

jest.mock('grammy', () => ({
  Bot: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue({}),
    api: mockApi,
    botInfo: { username: 'dummy_bot' },
    use: jest.fn(),
    command: jest.fn(),
    on: jest.fn(),
    hears: jest.fn(),
    catch: jest.fn(),
    start: jest.fn(),
  })),
  session: jest.fn(() => (_ctx: unknown, next: () => unknown) => next()),
}));
jest.mock('@grammyjs/transformer-throttler', () => ({ apiThrottler: () => jest.fn() }));
jest.mock('../src/middleware', () => ({ reply: jest.fn() }));
jest.mock('../src/permissions', () => ({ checkPermissions: jest.fn() }));
jest.mock('../src/inline', () => ({ initInline: jest.fn().mockReturnValue([]) }));
jest.mock('../src/handlers', () => ({ registerCommonHandlers: jest.fn() }));
jest.mock('../src/cache', () => ({
  __esModule: true,
  default: {
    config: {
      staffchat_id: '-100123',
      staffchat_type: 'telegram',
      staffchat_thread_id: null,
      dev_mode: false,
      register_commands: false,
    },
  },
}));

import cache from '../src/cache';
import TelegramAddon from '../src/addons/telegram';

describe('TelegramAddon', () => {
  const addon = TelegramAddon.getInstance('token');

  beforeEach(() => {
    jest.clearAllMocks();
    cache.config.staffchat_thread_id = null;
    cache.config.register_commands = false;
  });

  it('sends plain messages without a thread id by default', async () => {
    const id = await addon.sendMessage('-100123', 'hi', { parse_mode: 'HTML' });
    expect(id).toBe('5');
    expect(mockApi.sendMessage).toHaveBeenCalledWith('-100123', 'hi', expect.not.objectContaining({ message_thread_id: expect.anything() }));
  });

  it('adds message_thread_id for the staff chat when staffchat_thread_id is set (#183)', async () => {
    cache.config.staffchat_thread_id = 42;
    await addon.sendMessage('-100123', 'hi');
    expect(mockApi.sendMessage.mock.calls[0][2]).toMatchObject({ message_thread_id: 42 });

    await addon.sendPhoto('-100123', 'photo', { caption: 'c' });
    expect(mockApi.sendPhoto.mock.calls[0][2]).toMatchObject({ message_thread_id: 42, caption: 'c' });

    await addon.sendDocument('-100123', 'doc', {});
    expect(mockApi.sendDocument.mock.calls[0][2]).toMatchObject({ message_thread_id: 42 });

    await addon.sendVideo('-100123', 'vid', {});
    expect(mockApi.sendVideo.mock.calls[0][2]).toMatchObject({ message_thread_id: 42 });
  });

  it('leaves user chats and explicit thread ids untouched', async () => {
    cache.config.staffchat_thread_id = 42;
    await addon.sendMessage('555', 'hi');
    expect(mockApi.sendMessage.mock.calls[0][2]).not.toHaveProperty('message_thread_id');

    await addon.sendMessage('-100123', 'hi', { message_thread_id: 7 });
    expect(mockApi.sendMessage.mock.calls[1][2]).toMatchObject({ message_thread_id: 7 });
  });

  it('converts legacy Markdown to HTML', async () => {
    await addon.sendMessage('555', 'hi', { parse_mode: 'Markdown' });
    expect(mockApi.sendMessage.mock.calls[0][2]).toMatchObject({ parse_mode: 'HTML' });
  });

  it('sends stickers and returns the message id (#107)', async () => {
    cache.config.staffchat_thread_id = 42;
    const id = await addon.sendSticker('-100123', 'file-1');
    expect(id).toBe('9');
    expect(mockApi.sendSticker).toHaveBeenCalledWith('-100123', 'file-1', { message_thread_id: 42 });
  });

  it('swallows sticker errors', async () => {
    mockApi.sendSticker.mockRejectedValueOnce(new Error('boom'));
    await expect(addon.sendSticker('555', 'file-1')).resolves.toBeNull();
  });

  it('sends voice notes, audio and round videos to the staff topic and returns the message id', async () => {
    cache.config.staffchat_thread_id = 42;
    expect(await addon.sendVoice('-100123', 'voice-1', { caption: 'c' })).toBe('10');
    expect(mockApi.sendVoice).toHaveBeenCalledWith('-100123', 'voice-1', { caption: 'c', message_thread_id: 42 });
    expect(await addon.sendAudio('-100123', 'audio-1', {})).toBe('11');
    expect(mockApi.sendAudio).toHaveBeenCalledWith('-100123', 'audio-1', { message_thread_id: 42 });
    expect(await addon.sendVideoNote('555', 'note-1')).toBe('12');
    expect(mockApi.sendVideoNote).toHaveBeenCalledWith('555', 'note-1', {});
  });

  it('swallows voice, audio and video note errors', async () => {
    mockApi.sendVoice.mockRejectedValueOnce(new Error('boom'));
    mockApi.sendAudio.mockRejectedValueOnce(new Error('boom'));
    mockApi.sendVideoNote.mockRejectedValueOnce(new Error('boom'));
    await expect(addon.sendVoice('555', 'voice-1')).resolves.toBeNull();
    await expect(addon.sendAudio('555', 'audio-1')).resolves.toBeNull();
    await expect(addon.sendVideoNote('555', 'note-1')).resolves.toBeNull();
  });

  it('leaves the command menu alone unless register_commands is set', async () => {
    await addon.registerCommands();
    expect(mockApi.setMyCommands).not.toHaveBeenCalled();
  });

  it('registers user commands for private chats and staff commands for the staff chat', async () => {
    cache.config.register_commands = true;
    await addon.registerCommands();
    expect(mockApi.setMyCommands).toHaveBeenCalledTimes(2);
    const [userCommands, userOptions] = mockApi.setMyCommands.mock.calls[0];
    expect(userOptions).toEqual({ scope: { type: 'all_private_chats' } });
    expect(userCommands.map((c: { command: string }) => c.command)).toContain('start');
    expect(userCommands.map((c: { command: string }) => c.command)).not.toContain('open');
    const [staffCommands, staffOptions] = mockApi.setMyCommands.mock.calls[1];
    expect(staffOptions).toEqual({ scope: { type: 'chat', chat_id: '-100123' } });
    expect(staffCommands.map((c: { command: string }) => c.command)).toContain('open');
  });

  it('skips the staff scope when the staff chat is not on Telegram', async () => {
    cache.config.register_commands = true;
    (cache.config as any).staffchat_type = 'signal';
    await addon.registerCommands();
    (cache.config as any).staffchat_type = 'telegram';
    expect(mockApi.setMyCommands).toHaveBeenCalledTimes(1);
  });

  it('does not throw when Telegram rejects the command menu', async () => {
    cache.config.register_commands = true;
    mockApi.setMyCommands.mockRejectedValueOnce(new Error('chat not found'));
    await expect(addon.registerCommands()).resolves.toBeUndefined();
  });
});
