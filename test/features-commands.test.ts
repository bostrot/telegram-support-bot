// Tests for the issue-batch features in commands.ts:
// /open replied mark (#137), /ticket (#85), /broadcast (#159), user /close (#112), user commands (#84)
const mockReply = jest.fn().mockResolvedValue(undefined);
const mockSendMessage = jest.fn().mockResolvedValue(undefined);
const mockOpen = jest.fn();
const mockGetByTicketId = jest.fn();
const mockGetTicketByUserId = jest.fn();
const mockGetAllUsers = jest.fn();
const mockAdd = jest.fn().mockResolvedValue(0);
const mockSetClosedAt = jest.fn().mockResolvedValue(undefined);
const mockRecordAnalyticsEvent = jest.fn().mockResolvedValue(undefined);
const mockTicketClosedWebhook = jest.fn().mockResolvedValue(undefined);
const mockSendCSATSurvey = jest.fn().mockResolvedValue(undefined);

jest.mock('../src/middleware', () => ({
  reply: mockReply,
  sendMessage: mockSendMessage,
  strictEscape: jest.fn((str: string) => str),
  buildInlineKeyboard: jest.fn().mockReturnValue({}),
}));

jest.mock('../src/db', () => ({
  open: mockOpen,
  getByTicketId: mockGetByTicketId,
  getTicketById: jest.fn().mockResolvedValue(null),
  getTicketByUserId: mockGetTicketByUserId,
  getAllUsers: mockGetAllUsers,
  add: mockAdd,
  setClosedAt: mockSetClosedAt,
  recordAnalyticsEvent: mockRecordAnalyticsEvent,
  getInternalNotes: jest.fn().mockResolvedValue([{ text: 'n1' }]),
  getConversationHistory: jest.fn().mockResolvedValue([
    { sender: 'staff', text: 'Hello back', timestamp: new Date('2026-09-05T10:05:00Z') },
    { sender: 'user', text: 'Hello', timestamp: new Date('2026-09-05T10:00:00Z') },
  ]),
  closeAll: jest.fn(),
  reopen: jest.fn(),
  addTicketMessage: jest.fn(),
}));

jest.mock('../src/webhooks', () => ({
  webhooks: { ticketClosed: mockTicketClosedWebhook },
}));
jest.mock('../src/analytics', () => ({
  sendCSATSurvey: mockSendCSATSurvey,
  showStatsCommand: jest.fn(),
}));
jest.mock('../src/team', () => ({
  canPerformAction: jest.fn().mockReturnValue(true),
}));
jest.mock('../src/workflows', () => ({
  listCannedResponses: jest.fn().mockReturnValue(''),
  getCannedResponse: jest.fn().mockReturnValue(null),
}));

jest.mock('../src/cache', () => ({
  __esModule: true,
  default: {
    config: {
      language: {
        helpCommandText: 'Help: /start, /help',
        helpCommandStaffText: 'Staff: /clear, /open, /close',
        from: 'from',
        openTickets: 'Open Tickets',
        ticket: 'Ticket',
        closed: 'closed',
        ticketClosed: 'Your ticket has been closed.',
        ticketClosedError: 'You cannot reply to a closed ticket.',
        replied: 'replied',
        ticketDetails: 'Ticket details',
        customer: 'customer',
        ticketAssignedTo: 'assigned to',
        triageSummary: 'Summary',
        internalNote: 'Internal Note',
        broadcastSent: 'Broadcast sent to',
        closedByUser: 'closed by the user',
      },
      parse_mode: 'MarkdownV2',
      staffchat_id: '-100123',
      staffchat_type: 'telegram',
      anonymous_tickets: false,
      show_replied_mark: true,
      allow_broadcast: false,
      allow_user_close: false,
      user_commands: [],
      categories: [],
    },
    ticketIDs: {},
    ticketStatus: {},
    ticketSent: {},
    staffMembers: new Map([['999', { telegram_id: '999', role: 'agent', name: 'Agent Smith' }]]),
  },
}));

import * as commands from '../src/commands';
import { Context, Messenger } from '../src/interfaces';
import cache from '../src/cache';

const makeCtx = (isAdmin: boolean, overrides: Partial<Context> = {}): Context =>
  ({
    message: {
      text: '/help',
      from: { id: 'user123', first_name: 'John', username: 'john_doe', is_bot: false, language_code: 'en' },
      chat: { id: 'chat123', first_name: 'John', username: 'john_doe', type: 'private' },
      message_id: 1,
      date: 0,
      web_msg: false,
      reply_to_message: { from: { is_bot: true }, text: '', caption: '' },
      caption: '',
    },
    messenger: Messenger.TELEGRAM,
    session: {
      lastContactDate: 0,
      admin: isAdmin,
      mode: null,
      modeData: { ticketid: '', userid: '', name: '', category: '' },
      groupCategory: null,
      groupTag: '',
      group: '',
      groupAdmin: null,
      getSessionKey: () => '',
    },
    chat: { id: 'chat123', first_name: 'John', username: 'john_doe', type: 'private' },
    from: { username: 'john_doe', id: 'user123' },
    update_id: 1,
    callbackQuery: { data: '', from: { id: '' }, id: '' },
    inlineQuery: () => {},
    answerCbQuery: () => {},
    reply: () => {},
    getChat: () => {},
    getFile: () => {},
    ...overrides,
  } as unknown as Context);

describe('openCommand replied mark (#137)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cache.config.show_replied_mark = true;
  });

  it('marks tickets that already received a staff reply', async () => {
    mockOpen.mockResolvedValue([
      { ticketId: 1, userid: 'u1', first_response_at: new Date() },
      { ticketId: 2, userid: 'u2', first_response_at: null },
    ]);
    await commands.openCommand(makeCtx(true));
    const text = mockReply.mock.calls[0][1] as string;
    expect(text).toContain('#T000001  replied');
    expect(text).toContain('#T000002 ');
    expect(text).not.toContain('#T000002  replied');
  });

  it('omits the mark when show_replied_mark is false', async () => {
    cache.config.show_replied_mark = false;
    mockOpen.mockResolvedValue([{ ticketId: 1, userid: 'u1', first_response_at: new Date() }]);
    await commands.openCommand(makeCtx(true));
    expect(mockReply.mock.calls[0][1]).not.toContain('replied');
  });
});

describe('parseTicketArg', () => {
  it.each([
    ['1234', 1234],
    ['#T001234', 1234],
    ['T1234', 1234],
    [' 000042 ', 42],
    ['abc', null],
    ['', null],
    [undefined, null],
  ])('parses %p as %p', (input, expected) => {
    expect(commands.parseTicketArg(input as string | undefined)).toBe(expected);
  });
});

describe('ticketCommand (#85)', () => {
  beforeEach(() => jest.clearAllMocks());

  const ticket = {
    ticketId: 1234,
    userid: '5551',
    name: 'Alice',
    status: 'open',
    messenger: 'telegram',
    category: 'Billing',
    priority: 'high',
    tags: ['vip'],
    assigned_to: '999',
    first_response_at: new Date('2026-09-05T10:05:00Z'),
    closed_at: null,
    triage_summary: 'Wants a refund',
  };

  it('is staff only', async () => {
    await commands.ticketCommand(makeCtx(false, { match: '1234' } as Partial<Context>));
    expect(mockReply).not.toHaveBeenCalled();
    expect(mockGetByTicketId).not.toHaveBeenCalled();
  });

  it('shows details, assignment, notes and the last messages for /ticket <id>', async () => {
    mockGetByTicketId.mockResolvedValue(ticket);
    await commands.ticketCommand(makeCtx(true, { match: '#T001234' } as Partial<Context>));

    expect(mockGetByTicketId).toHaveBeenCalledWith('1234');
    const text = mockReply.mock.calls[0][1] as string;
    expect(text).toContain('Ticket details #T001234');
    expect(text).toContain('Alice (5551)');
    expect(text).toContain('status: open · telegram');
    expect(text).toContain('category: Billing');
    expect(text).toContain('priority: high');
    expect(text).toContain('tags: #vip');
    expect(text).toContain('assigned to: Agent Smith');
    expect(text).toContain('Summary: Wants a refund');
    expect(text).toContain('Internal Note: 1');
    // history is printed oldest first
    expect(text.indexOf('Hello')).toBeLessThan(text.indexOf('Hello back'));
  });

  it('hides the user id when anonymous_tickets is on', async () => {
    cache.config.anonymous_tickets = true;
    mockGetByTicketId.mockResolvedValue(ticket);
    await commands.ticketCommand(makeCtx(true, { match: '1234' } as Partial<Context>));
    expect(mockReply.mock.calls[0][1]).not.toContain('5551');
    cache.config.anonymous_tickets = false;
  });

  it('prints usage when no ticket can be resolved', async () => {
    mockGetByTicketId.mockResolvedValue(null);
    await commands.ticketCommand(makeCtx(true, { match: '9' } as Partial<Context>));
    expect(mockReply).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('Usage: /ticket'));
  });
});

describe('broadcastCommand (#159)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cache.config.allow_broadcast = false;
  });

  it('is disabled by default', async () => {
    await commands.broadcastCommand(makeCtx(true, { match: 'Maintenance tonight' } as Partial<Context>));
    expect(mockGetAllUsers).not.toHaveBeenCalled();
    expect(mockReply).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('allow_broadcast'));
  });

  it('ignores non-staff even when enabled', async () => {
    cache.config.allow_broadcast = true;
    await commands.broadcastCommand(makeCtx(false, { match: 'hi' } as Partial<Context>));
    expect(mockGetAllUsers).not.toHaveBeenCalled();
    expect(mockReply).not.toHaveBeenCalled();
  });

  it('sends the text to every known user and reports the count', async () => {
    cache.config.allow_broadcast = true;
    mockGetAllUsers.mockResolvedValue([
      { userid: '1', messenger: 'telegram' },
      { userid: '2', messenger: 'signal' },
    ]);
    mockSendMessage.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('blocked'));

    await commands.broadcastCommand(makeCtx(true, { match: 'Maintenance tonight' } as Partial<Context>));

    // Sent as plain text (no parse_mode): staff Markdown must not fail per recipient
    expect(mockSendMessage).toHaveBeenCalledWith('1', 'telegram', 'Maintenance tonight', {});
    expect(mockSendMessage).toHaveBeenCalledWith('2', 'signal', 'Maintenance tonight', {});
    expect(mockReply).toHaveBeenCalledWith(expect.anything(), 'Broadcast sent to 1/2');
  });

  it('prints usage without text', async () => {
    cache.config.allow_broadcast = true;
    await commands.broadcastCommand(makeCtx(true, { match: '  ' } as Partial<Context>));
    expect(mockReply).toHaveBeenCalledWith(expect.anything(), 'Usage: /broadcast <text>');
  });
});

describe('user /close (#112)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cache.config.allow_user_close = false;
  });

  it('does nothing for users unless allow_user_close is set', async () => {
    await commands.closeCommand(makeCtx(false));
    expect(mockGetTicketByUserId).not.toHaveBeenCalled();
    expect(mockReply).not.toHaveBeenCalled();
  });

  it('closes the user\'s own open ticket, notifies staff and sends the CSAT survey', async () => {
    cache.config.allow_user_close = true;
    mockGetTicketByUserId.mockResolvedValue({ ticketId: 7, userid: 'user123', status: 'open', category: null, messenger: 'telegram' });

    await commands.closeCommand(makeCtx(false));

    expect(mockAdd).toHaveBeenCalledWith('user123', 'closed', '', 'telegram');
    expect(mockSetClosedAt).toHaveBeenCalledWith(7);
    expect(mockRecordAnalyticsEvent).toHaveBeenCalledWith('ticket_closed', 7, null, { closed_by: 'user' });
    expect(mockTicketClosedWebhook).toHaveBeenCalledWith(7, 'user123');
    expect(mockReply).toHaveBeenCalledWith(expect.anything(), 'Ticket #T000007 closed');
    expect(mockSendMessage).toHaveBeenCalledWith('-100123', 'telegram', 'Ticket #T000007 closed by the user');
    expect(mockSendCSATSurvey).toHaveBeenCalledWith('user123', 'telegram', 7);
  });

  it('tells the user when there is no open ticket', async () => {
    cache.config.allow_user_close = true;
    mockGetTicketByUserId.mockResolvedValue({ ticketId: 7, status: 'closed' });
    await commands.closeCommand(makeCtx(false));
    expect(mockAdd).not.toHaveBeenCalled();
    expect(mockReply).toHaveBeenCalledWith(expect.anything(), 'You cannot reply to a closed ticket.');
  });

  it('ignores group chats', async () => {
    cache.config.allow_user_close = true;
    const ctx = makeCtx(false);
    ctx.chat.type = 'supergroup';
    await commands.closeCommand(ctx);
    expect(mockGetTicketByUserId).not.toHaveBeenCalled();
  });
});

describe('custom user commands (#84)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cache.config.user_commands = [
      { command: 'pricing', text: 'Plans start at 5 EUR', description: 'Show pricing' },
      { command: '/hours', text: 'Mon-Fri 9-17' },
    ];
  });

  it('finds commands case-insensitively with or without the slash', () => {
    expect(commands.findUserCommand('pricing')?.text).toBe('Plans start at 5 EUR');
    expect(commands.findUserCommand('/Pricing')?.text).toBe('Plans start at 5 EUR');
    expect(commands.findUserCommand('hours')?.text).toBe('Mon-Fri 9-17');
    expect(commands.findUserCommand('nope')).toBeNull();
  });

  it('lists them in /help', () => {
    commands.helpCommand(makeCtx(false));
    const text = mockReply.mock.calls[0][1] as string;
    expect(text).toContain('/pricing — Show pricing');
    expect(text).toContain('/hours');
  });

  it('shows /ticket and /broadcast (when enabled) in the staff help', () => {
    cache.config.allow_broadcast = true;
    commands.helpCommand(makeCtx(true));
    const text = mockReply.mock.calls[0][1] as string;
    expect(text).toContain('/ticket <id>');
    expect(text).toContain('/broadcast <text>');
    cache.config.allow_broadcast = false;
  });
});
