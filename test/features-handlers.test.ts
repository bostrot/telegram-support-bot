// Tests for: thread confinement (#183), ticket_per_message (#172), edited messages (#147),
// start keyboard (#142), stickers (#107), parent forwarding (#79), user commands in hears (#84)
// and the canned-response match fix.
const mockReply = jest.fn().mockResolvedValue(undefined);
const mockSendMessage = jest.fn().mockResolvedValue(undefined);
const mockGetTicketByUserId = jest.fn();
const mockAdd = jest.fn().mockResolvedValue(0);
const mockAddNewTicket = jest.fn().mockResolvedValue(2);
const mockAddTicketMessage = jest.fn().mockResolvedValue(undefined);
const mockAddIdAndName = jest.fn().mockResolvedValue(undefined);
const mockUsersChat = jest.fn().mockResolvedValue(undefined);

jest.mock('../src/middleware', () => ({
  reply: mockReply,
  sendMessage: mockSendMessage,
  strictEscape: jest.fn((str: string) => str),
  buildInlineKeyboard: jest.fn().mockReturnValue({}),
}));

jest.mock('../src/db', () => ({
  getTicketByUserId: mockGetTicketByUserId,
  add: mockAdd,
  addNewTicket: mockAddNewTicket,
  addTicketMessage: mockAddTicketMessage,
  addIdAndName: mockAddIdAndName,
  getTicketByInternalId: jest.fn().mockResolvedValue(null),
  getTicketById: jest.fn().mockResolvedValue(null),
  checkBan: jest.fn().mockResolvedValue(null),
  recordAnalyticsEvent: jest.fn().mockResolvedValue(undefined),
  setFirstResponseAt: jest.fn().mockResolvedValue(undefined),
  setClosedAt: jest.fn().mockResolvedValue(undefined),
  open: jest.fn().mockResolvedValue([]),
}));

jest.mock('../src/users', () => ({ chat: mockUsersChat }));
jest.mock('../src/team', () => ({
  getStaffRole: jest.fn().mockReturnValue(null),
  addInternalNoteCommand: jest.fn(),
  canPerformAction: jest.fn().mockReturnValue(true),
}));
jest.mock('../src/webhooks', () => ({ webhooks: { ticketReplied: jest.fn(), ticketClosed: jest.fn() } }));
jest.mock('../src/analytics', () => ({ sendCSATSurvey: jest.fn(), handleCSATCallback: jest.fn(), showStatsCommand: jest.fn() }));
jest.mock('../src/inline', () => ({ replyKeyboard: (keys: string[][]) => ({ reply_markup: { keyboard: keys } }), callbackQuery: jest.fn() }));

jest.mock('../src/cache', () => ({
  __esModule: true,
  default: {
    config: {
      language: {
        ticket: 'Ticket',
        from: 'from',
        language: 'Language',
        editedMessage: 'edited their message',
        startCommandText: 'Welcome!',
        services: 'Services',
        prvChatOnly: 'Private only',
        back: 'Back',
        acceptedBy: 'was accepted by',
        textFirst: 'Text first',
        ticketClosedError: 'closed',
        confirmationMessage: 'Thanks',
        file_sent: 'File sent to user',
        yourTicketId: 'Your Ticket ID',
      },
      parse_mode: 'MarkdownV2',
      staffchat_id: '-100123',
      staffchat_type: 'telegram',
      staffchat_thread_id: null,
      anonymous_tickets: false,
      forward_edited_messages: true,
      ticket_per_message: false,
      forward_stickers: true,
      forward_replies_to_parent: false,
      start_keyboard: [],
      user_commands: [],
      canned_responses: [],
      categories: [],
      pass_start: false,
      spam_time: 60000,
      spam_cant_msg: 5,
      autoreply_confirmation: false,
      show_user_ticket: false,
    },
    ticketIDs: {},
    ticketStatus: {},
    ticketSent: {},
    userId: '',
  },
}));

import cache from '../src/cache';
import { Addon, Context, Messenger } from '../src/interfaces';
import * as permissions from '../src/permissions';
import { handleEditedMessage } from '../src/edited';
import * as text from '../src/text';
import * as staff from '../src/staff';
import * as files from '../src/files';
import { registerCommonHandlers, matchedCommand, startKeyboardMarkup } from '../src/handlers';

const makeCtx = (overrides: Record<string, unknown> = {}): Context =>
  ({
    message: {
      text: 'hello',
      message_id: 10,
      from: { id: '42', first_name: 'Alice', username: 'alice', is_bot: false, language_code: 'de' },
      chat: { id: '42', first_name: 'Alice', username: 'alice', type: 'private' },
      date: 0,
      web_msg: false,
      reply_to_message: { from: { is_bot: true }, text: '', caption: '' },
      caption: '',
    },
    messenger: Messenger.TELEGRAM,
    session: {
      admin: false,
      mode: null,
      modeData: {},
      lastContactDate: 0,
      groupCategory: null,
      groupTag: '',
      group: '',
      groupAdmin: null,
      getSessionKey: () => '',
    },
    chat: { id: '42', first_name: 'Alice', username: 'alice', type: 'private' },
    from: { id: '42', username: 'alice' },
    update_id: 1,
    callbackQuery: { data: '', from: { id: '' }, id: '' },
    getFile: jest.fn().mockResolvedValue({ file_id: 'file-1' }),
    answerCbQuery: jest.fn(),
    ...overrides,
  } as unknown as Context);

// ---------------------------------------------------------------- #183
describe('staffchat_thread_id confinement (#183)', () => {
  const config = { categories: [], staffchat_id: '-100123' };
  const staffCtx = (threadId?: number, edited = false) =>
    makeCtx({
      chat: { id: '-100123', type: 'supergroup' },
      message: edited ? {} : { message_id: 5, message_thread_id: threadId, from: { id: '1' } },
      editedMessage: edited ? { message_id: 6, message_thread_id: threadId, from: { id: '1' } } : undefined,
    });

  beforeEach(() => {
    cache.config.staffchat_thread_id = null;
  });

  it('accepts every topic when no thread is configured', async () => {
    expect(await permissions.checkRights(staffCtx(undefined), config)).toBe(true);
    expect(await permissions.checkRights(staffCtx(99), config)).toBe(true);
  });

  it('only grants staff rights inside the configured thread', async () => {
    cache.config.staffchat_thread_id = 77;
    expect(await permissions.checkRights(staffCtx(77), config)).toBe(true);
    expect(await permissions.checkRights(staffCtx(78), config)).toBe(false);
    expect(await permissions.checkRights(staffCtx(undefined), config)).toBe(false);
  });

  it('applies to edited messages as well', async () => {
    cache.config.staffchat_thread_id = 77;
    expect(permissions.isOutsideStaffThread(staffCtx(77, true), '-100123')).toBe(false);
    expect(permissions.isOutsideStaffThread(staffCtx(1, true), '-100123')).toBe(true);
  });

  it('never affects private chats or other groups', () => {
    cache.config.staffchat_thread_id = 77;
    expect(permissions.isOutsideStaffThread(makeCtx(), '-100123')).toBe(false);
    expect(permissions.isOutsideStaffThread(makeCtx({ chat: { id: '-100999', type: 'supergroup' } }), '-100123')).toBe(false);
  });
});

// ---------------------------------------------------------------- #147
describe('edited messages (#147)', () => {
  const editedCtx = (extra: Record<string, unknown> = {}) =>
    makeCtx({
      message: {},
      editedMessage: { message_id: 11, text: 'corrected text', from: { id: '42', first_name: 'Alice' } },
      ...extra,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    cache.config.forward_edited_messages = true;
    cache.config.anonymous_tickets = false;
  });

  it('posts the edited text to the staff chat and stores it in the history', async () => {
    mockGetTicketByUserId.mockResolvedValue({ ticketId: 12, status: 'open', messenger: 'telegram' });
    expect(await handleEditedMessage(editedCtx())).toBe(true);
    expect(mockSendMessage).toHaveBeenCalledWith(
      '-100123',
      'telegram',
      'Ticket #T000012 from [Alice](tg://user?id=42) edited their message:\n\ncorrected text',
    );
    expect(mockAddTicketMessage).toHaveBeenCalledWith(12, 'user', '42', '[edited their message] corrected text');
  });

  it('also mirrors to the category group and respects anonymous_tickets', async () => {
    cache.config.anonymous_tickets = true;
    mockGetTicketByUserId.mockResolvedValue({ ticketId: 12, status: 'open', messenger: 'telegram' });
    const ctx = editedCtx();
    ctx.session.group = '-100555';
    await handleEditedMessage(ctx);
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
    expect(mockSendMessage.mock.calls[1][0]).toBe('-100555');
    expect(mockSendMessage.mock.calls[0][2]).toContain('from Alice edited');
    expect(mockSendMessage.mock.calls[0][2]).not.toContain('tg://user');
  });

  it('is skipped when disabled, for staff, for closed tickets and without text', async () => {
    mockGetTicketByUserId.mockResolvedValue({ ticketId: 12, status: 'open' });
    cache.config.forward_edited_messages = false;
    expect(await handleEditedMessage(editedCtx())).toBe(false);
    cache.config.forward_edited_messages = true;

    const staffCtx = editedCtx();
    staffCtx.session.admin = true;
    expect(await handleEditedMessage(staffCtx)).toBe(false);

    mockGetTicketByUserId.mockResolvedValue({ ticketId: 12, status: 'closed' });
    expect(await handleEditedMessage(editedCtx())).toBe(false);

    mockGetTicketByUserId.mockResolvedValue({ ticketId: 12, status: 'open' });
    expect(await handleEditedMessage(editedCtx({ editedMessage: { from: { id: '42' } } }))).toBe(false);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------- #172
describe('ticket_per_message (#172)', () => {
  const bot = {} as Addon;
  beforeEach(() => {
    jest.clearAllMocks();
    cache.config.ticket_per_message = false;
  });

  it('reuses the existing ticket by default', async () => {
    mockGetTicketByUserId.mockResolvedValue({ ticketId: 1, status: 'open' });
    await text.ticketHandler(bot, makeCtx());
    expect(mockAdd).not.toHaveBeenCalled();
    expect(mockUsersChat).toHaveBeenCalled();
  });

  it('opens an additional ticket for every message when enabled, keeping the old one', async () => {
    cache.config.ticket_per_message = true;
    mockGetTicketByUserId
      .mockResolvedValueOnce({ ticketId: 1, status: 'open' })
      .mockResolvedValueOnce({ ticketId: 2, status: 'open' });
    const ticket = await text.ticketHandler(bot, makeCtx());
    expect(mockAddNewTicket).toHaveBeenCalledWith('42', null, 'telegram');
    // add() replaces the user's document and would drop ticket #1 — must not be used here
    expect(mockAdd).not.toHaveBeenCalled();
    expect(ticket?.ticketId).toBe(2);
  });

  it('still uses add() for a user without any ticket', async () => {
    cache.config.ticket_per_message = true;
    mockGetTicketByUserId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ticketId: 1, status: 'open' });
    await text.ticketHandler(bot, makeCtx());
    expect(mockAdd).toHaveBeenCalledWith('42', 'open', null, 'telegram');
    expect(mockAddNewTicket).not.toHaveBeenCalled();
  });

  it('never re-opens a banned user', async () => {
    cache.config.ticket_per_message = true;
    mockGetTicketByUserId.mockResolvedValue({ ticketId: 1, status: 'banned' });
    await text.ticketHandler(bot, makeCtx());
    expect(mockAdd).not.toHaveBeenCalled();
    expect(mockAddNewTicket).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------- #79
describe('forward_replies_to_parent (#79)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cache.config.categories = [
      {
        name: 'Product',
        group_id: '-100PARENT',
        subgroups: [
          { name: 'Bugs', group_id: '-100BUGS' },
          { name: 'Billing', group_id: '-100BILL' },
        ],
      },
      { name: 'Flat', group_id: '-100FLAT', subgroups: [] },
    ] as never;
  });
  afterAll(() => {
    cache.config.categories = [];
  });

  it('finds the parent by subcategory name or by the group the reply came from', () => {
    expect(staff.findParentCategory('Bugs', '-100BUGS')?.name).toBe('Product');
    expect(staff.findParentCategory(null, '-100BILL')?.name).toBe('Product');
    expect(staff.findParentCategory('Flat', '-100FLAT')).toBeNull();
    expect(staff.findParentCategory('Bugs', '-100PARENT')).toBeNull(); // reply already in parent
  });

  it('mirrors the reply only when enabled', async () => {
    const ctx = makeCtx({ chat: { id: '-100BUGS', type: 'supergroup' }, message: { from: { first_name: 'Bob' } } });
    const ticket = { ticketId: 5, category: 'Bugs' } as never;

    await staff.forwardReplyToParent(ctx, ticket, 'Fixed in v5');
    expect(mockSendMessage).not.toHaveBeenCalled();

    cache.config.forward_replies_to_parent = true;
    await staff.forwardReplyToParent(ctx, ticket, 'Fixed in v5');
    expect(mockSendMessage).toHaveBeenCalledWith('-100PARENT', 'telegram', 'Ticket #T000005 was accepted by Bob:\n\nFixed in v5');
    cache.config.forward_replies_to_parent = false;
  });
});

// ---------------------------------------------------------------- #107
describe('stickers (#107)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cache.ticketSent = {};
  });

  it('forwards a user sticker to the staff chat followed by the ticket header', async () => {
    mockGetTicketByUserId.mockResolvedValue({ ticketId: 3, userid: '42', status: 'open', messenger: 'telegram' });
    const bot = { sendSticker: jest.fn().mockResolvedValue('501') } as unknown as Addon;

    await files.fileHandler('sticker', bot, makeCtx());

    expect(bot.sendSticker).toHaveBeenCalledWith('-100123', 'file-1');
    expect(mockSendMessage).toHaveBeenCalledWith('-100123', 'telegram', expect.stringContaining('Ticket #T000003 from Alice'));
    expect(mockAddIdAndName).toHaveBeenCalledWith(3, '501', 'Alice');
  });

  it('does nothing on platforms without sticker support', async () => {
    mockGetTicketByUserId.mockResolvedValue({ ticketId: 3, userid: '42', status: 'open', messenger: 'telegram' });
    await files.fileHandler('sticker', {} as Addon, makeCtx());
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------- handlers
describe('handler registration and command matching', () => {
  type Handler = (ctx: Context) => unknown;
  const captured = { commands: new Map<string, Handler>(), hears: [] as Array<{ trigger: unknown; cb: Handler }>, on: [] as unknown[] };
  const fakeAddon = {
    platform: 'telegram',
    sendSticker: jest.fn(),
    command: (name: string, cb: Handler) => captured.commands.set(name, cb),
    hears: (trigger: unknown, cb: Handler) => captured.hears.push({ trigger, cb }),
    on: (filter: unknown) => captured.on.push(filter),
    catch: jest.fn(),
    sendMessage: jest.fn(),
    sendPhoto: jest.fn(),
    sendDocument: jest.fn(),
    sendVideo: jest.fn(),
  } as unknown as Addon;

  const commandHears = () =>
    captured.hears.find((h) => h.trigger instanceof RegExp && h.trigger.source.startsWith('^\\/(\\w+)'))!.cb;

  beforeAll(() => {
    cache.config.user_commands = [{ command: 'pricing', text: 'Plans start at 5 EUR' }];
    cache.config.canned_responses = [{ key: 'shipping', text: '3-5 days' }];
    registerCommonHandlers(fakeAddon);
  });

  beforeEach(() => jest.clearAllMocks());

  it('normalises grammY match values', () => {
    expect(matchedCommand('/open')).toBe('open');
    expect(matchedCommand(['/shipping', 'shipping'] as unknown as RegExpMatchArray)).toBe('shipping');
    expect(matchedCommand(['/shipping'] as unknown as RegExpMatchArray)).toBe('shipping');
    expect(matchedCommand(undefined)).toBeNull();
  });

  it('registers /ticket, /broadcast, sticker and edited_message handlers', () => {
    expect(captured.commands.has('ticket')).toBe(true);
    expect(captured.commands.has('broadcast')).toBe(true);
    expect(captured.on).toContainEqual([':sticker']);
    expect(captured.on).toContain('edited_message');
  });

  it('answers custom user commands for users', async () => {
    await commandHears()(makeCtx({ match: ['/pricing', 'pricing'] }));
    expect(mockReply).toHaveBeenCalledWith(expect.anything(), 'Plans start at 5 EUR', { parse_mode: 'MarkdownV2' });
  });

  it('shows a canned response to staff (RegExp match array, previously crashed)', async () => {
    const ctx = makeCtx({ match: ['/shipping', 'shipping'], chat: { id: '-100123', type: 'supergroup' } });
    ctx.session.admin = true;
    await commandHears()(ctx);
    expect(mockReply).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('3-5 days'), { parse_mode: 'MarkdownV2' });
  });

  it('ignores unknown commands silently', async () => {
    await commandHears()(makeCtx({ match: ['/nothing', 'nothing'] }));
    expect(mockReply).not.toHaveBeenCalled();
  });

  it('adds the start keyboard to /start when configured (#142)', async () => {
    cache.config.categories = [];
    const start = captured.commands.get('start')!;
    await start(makeCtx());
    expect(mockReply).toHaveBeenCalledWith(expect.anything(), 'Welcome!');

    jest.clearAllMocks();
    cache.config.start_keyboard = ['FAQ', 'Talk to a human'];
    await start(makeCtx());
    expect(mockReply).toHaveBeenCalledWith(expect.anything(), 'Welcome!', {
      parse_mode: 'MarkdownV2',
      reply_markup: { keyboard: [['FAQ'], ['Talk to a human']], resize_keyboard: true },
    });
    expect(startKeyboardMarkup()).not.toBeNull();
    cache.config.start_keyboard = [];
    expect(startKeyboardMarkup()).toBeNull();
  });
});
