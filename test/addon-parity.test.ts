// Feature parity across addons: the handlers registered by registerCommonHandlers must
// fit every platform — Telegram-only extras (stickers, reply keyboard) stay off elsewhere,
// while the shared commands (#84, #85, #159, #112) reach all of them.
const mockReply = jest.fn().mockResolvedValue(undefined);

jest.mock('../src/middleware', () => ({
  reply: mockReply,
  sendMessage: jest.fn().mockResolvedValue(undefined),
  strictEscape: jest.fn((str: string) => str),
  buildInlineKeyboard: jest.fn().mockReturnValue({}),
}));
jest.mock('../src/db', () => ({
  getTicketByUserId: jest.fn().mockResolvedValue(null),
  getByTicketId: jest.fn().mockResolvedValue(null),
  getTicketByInternalId: jest.fn().mockResolvedValue(null),
  getAllUsers: jest.fn().mockResolvedValue([]),
  add: jest.fn().mockResolvedValue(0),
  addTicketMessage: jest.fn().mockResolvedValue(undefined),
  addIdAndName: jest.fn().mockResolvedValue(undefined),
  open: jest.fn().mockResolvedValue([]),
  recordAnalyticsEvent: jest.fn().mockResolvedValue(undefined),
  setClosedAt: jest.fn().mockResolvedValue(undefined),
  getInternalNotes: jest.fn().mockResolvedValue([]),
  getConversationHistory: jest.fn().mockResolvedValue([]),
}));
jest.mock('../src/users', () => ({ chat: jest.fn() }));
jest.mock('../src/team', () => ({
  getStaffRole: jest.fn().mockReturnValue(null),
  addInternalNoteCommand: jest.fn(),
  canPerformAction: jest.fn().mockReturnValue(true),
}));
jest.mock('../src/webhooks', () => ({ webhooks: { ticketReplied: jest.fn(), ticketClosed: jest.fn() } }));
jest.mock('../src/analytics', () => ({ sendCSATSurvey: jest.fn(), handleCSATCallback: jest.fn(), showStatsCommand: jest.fn() }));
jest.mock('../src/inline', () => ({
  replyKeyboard: (keys: string[][]) => ({ reply_markup: { keyboard: keys } }),
  callbackQuery: jest.fn(),
}));
jest.mock('../src/cache', () => ({
  __esModule: true,
  default: {
    config: {
      language: { back: 'Back', startCommandText: 'Welcome!', services: 'Services', prvChatOnly: 'Private only' },
      parse_mode: 'MarkdownV2',
      staffchat_id: '-100123',
      staffchat_type: 'telegram',
      categories: [],
      pass_start: false,
      forward_stickers: true,
      forward_edited_messages: true,
      start_keyboard: ['FAQ'],
      user_commands: [{ command: 'pricing', text: 'Plans start at 5 EUR' }],
      canned_responses: [],
    },
    ticketIDs: {},
    ticketStatus: {},
    ticketSent: {},
  },
}));

import cache from '../src/cache';
import { Addon, Context, Messenger } from '../src/interfaces';
import { registerCommonHandlers } from '../src/handlers';

type Handler = (ctx: Context) => unknown;

interface Captured {
  commands: Map<string, Handler>;
  hears: Array<{ trigger: unknown; cb: Handler }>;
  on: unknown[];
}

/** Registers the common handlers on a stub addon and records what was asked for. */
const register = (platform: string, supportsStickers: boolean): Captured => {
  const captured: Captured = { commands: new Map(), hears: [], on: [] };
  const addon = {
    platform,
    command: (name: string, cb: Handler) => captured.commands.set(name, cb),
    hears: (trigger: unknown, cb: Handler) => captured.hears.push({ trigger, cb }),
    on: (filter: unknown) => captured.on.push(filter),
    catch: jest.fn(),
    sendMessage: jest.fn(),
    sendPhoto: jest.fn(),
    sendDocument: jest.fn(),
    sendVideo: jest.fn(),
    ...(supportsStickers ? { sendSticker: jest.fn() } : {}),
  } as unknown as Addon;
  registerCommonHandlers(addon);
  return captured;
};

const userCommandHandler = (captured: Captured): Handler =>
  captured.hears.find((h) => h.trigger instanceof RegExp && h.trigger.source.startsWith('^\\/(\\w+)'))!.cb;

const makeCtx = (messenger: Messenger, overrides: Record<string, unknown> = {}): Context =>
  ({
    message: {
      text: '/pricing',
      message_id: 1,
      from: { id: '42', first_name: 'Alice', username: 'alice', is_bot: false },
      chat: { id: '42', type: 'private' },
      caption: '',
      reply_to_message: { from: { is_bot: false }, text: '', caption: '' },
    },
    messenger,
    session: { admin: false, modeData: {}, group: '', groupTag: '', groupCategory: null },
    chat: { id: '42', type: 'private' },
    from: { id: '42', username: 'alice' },
    ...overrides,
  } as unknown as Context);

// The platforms the bot ships with; only Telegram implements stickers today.
const platforms: Array<[string, Messenger, boolean]> = [
  ['telegram', Messenger.TELEGRAM, true],
  ['signal', Messenger.SIGNAL, false],
  ['slack', Messenger.SLACK, false],
  ['discord', Messenger.DISCORD, false],
];

describe.each(platforms)('registerCommonHandlers on %s', (platform, messenger, supportsStickers) => {
  let captured: Captured;

  beforeAll(() => {
    captured = register(platform, supportsStickers);
  });

  beforeEach(() => jest.clearAllMocks());

  it('registers the shared commands', () => {
    for (const command of ['open', 'close', 'ticket', 'broadcast', 'id', 'help']) {
      expect(captured.commands.has(command)).toBe(true);
    }
  });

  it('registers the sticker handler only where the addon can send stickers (#107)', () => {
    expect(captured.on.some((f) => Array.isArray(f) && f[0] === ':sticker')).toBe(supportsStickers);
    // photos, documents and videos work everywhere
    expect(captured.on).toContainEqual([':photo']);
    expect(captured.on).toContainEqual([':document']);
  });

  it('answers custom user commands (#84)', async () => {
    // Telegram/Slack/Discord hand over a RegExp match array, Signal a plain string
    const match: unknown = platform === 'signal' ? 'pricing' : ['/pricing', 'pricing'];
    await userCommandHandler(captured)(makeCtx(messenger, { match }));
    expect(mockReply).toHaveBeenCalledWith(expect.anything(), 'Plans start at 5 EUR', { parse_mode: 'MarkdownV2' });
  });

  it('only offers the /start reply keyboard on Telegram (#142)', async () => {
    cache.config.categories = [];
    await captured.commands.get('start')!(makeCtx(messenger));
    if (platform === 'telegram') {
      expect(mockReply).toHaveBeenCalledWith(expect.anything(), 'Welcome!', {
        parse_mode: 'MarkdownV2',
        reply_markup: { keyboard: [['FAQ']], resize_keyboard: true },
      });
    } else {
      expect(mockReply).toHaveBeenCalledWith(expect.anything(), 'Welcome!');
    }
  });
});
