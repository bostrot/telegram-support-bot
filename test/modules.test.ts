// test/modules.test.ts

import axios from 'axios';
import WebSocket from 'ws';
import { Bot } from 'grammy';
import {
  ticketMsg,      // from staff.ts refactoring
  privateReply,
  chat as staffChat,
} from '../src/staff'; // adjust import paths as needed
import * as middleware from '../src/middleware'; // file utilities module
import { checkRights, checkPermissions } from '../src/permissions';
import {
  helpCommand,
  clearCommand,
  openCommand,
  closeCommand,
  banCommand,
  reopenCommand,
  unbanCommand,
} from '../src/commands';
import TelegramAddon from '../src/addons/telegram';
import SignalAddon from '../src/addons/signal';
import cache from '../src/cache';
import * as db from '../src/db';

// --- Mocks for Internal Modules --- //
jest.mock('../src/cache', () => ({
  config: {
    parse_mode: 'MarkdownV2',
    language: {
      dear: 'Dear',
      regards: 'Regards',
      ticket: 'Ticket',
      from: 'from',
      language: 'en',
      helpCommandText: 'Help text for users',
      helpCommandStaffText: 'Help text for staff',
      openTickets: 'Open Tickets',
      closed: 'closed',
      ticketClosed: 'Ticket closed.',
      faqCommandText: 'FAQ text',
      links: 'Links',
      startCommandText: 'Start text',
      services: 'Services',
      prvChatOnly: 'Private chat only',
      back: 'Back',
    },
    dev_mode: false,
    autoreply: [],
    direct_reply: true,
    categories: [
      { group_id: 'group1', name: 'Category1' },
      // Add more sample categories if needed
    ],
    pass_start: false,
    show_auto_replied: true,
  },
  ticketIDs: [],
  ticketStatus: [],
  ticketSent: [],
  io: { to: jest.fn().mockReturnValue({ emit: jest.fn() }) },
  userId: 123,
}));

jest.mock('../src/db', () => ({
  closeAll: jest.fn(),
  open: jest.fn((callback, groups) => callback([])),
  add: jest.fn(),
  getTicketById: jest.fn((id, group, callback) =>
    callback({ id: 1, userid: 456, category: 'test' })
  ),
  getByTicketId: jest.fn((ticketId, callback) =>
    callback({ userid: 789, id: { toString: () => ticketId } })
  ),
  reopen: jest.fn(),
}));

// --- Mocks for External Modules --- //
jest.mock('grammy', () => ({
  Bot: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue({}),
    command: jest.fn(),
    on: jest.fn(),
    hears: jest.fn(),
    catch: jest.fn(),
    start: jest.fn(),
    api: {
      sendMessage: jest.fn(),
      sendPhoto: jest.fn(),
      sendDocument: jest.fn(),
      sendVideo: jest.fn(),
      config: { use: jest.fn() },
    },
    botInfo: { username: 'dummy_bot' },
  })),
  // Provide a minimal session middleware so initSession() returns a function
  session: jest.fn().mockImplementation(({ initial }) => {
    return (ctx: any, next: () => any) => next();
  }),
}));

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    post: jest.fn(),
    get: jest.fn(),
  })),
}));

jest.mock('ws', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
  }));
});

// --- Staff Module Tests --- //
describe('Staff Module', () => {
  describe('ticketMsg', () => {
    it('should return the escaped message if clean_replies is enabled', () => {
      // Override config flag for clean_replies
      cache.config.clean_replies = true;
      const name = 'John';
      const message = { text: 'Hello *world*', from: { first_name: 'Alice' } };
      const result = ticketMsg(name, message);
      expect(result).toEqual('Hello \\*world\\*'); // Expect MarkdownV2 escaping
    });

    it('should format message with proper header and footer when anonymous_replies is true', () => {
      cache.config.clean_replies = false;
      cache.config.anonymous_replies = true;
      const name = 'John';
      const message = { text: 'Hello', from: { first_name: 'Alice' } };
      const result = ticketMsg(name, message);
      expect(result).toContain('Dear');
      expect(result).toContain('Regards');
    });
  });
});

// --- Permissions Module Tests --- //
describe('Permissions Module', () => {
  describe('checkRights', () => {
    it('should grant permission when a matching category is found', async () => {
      const ctx = { chat: { id: 'group1', type: 'group' }, session: {}, from: { username: 'user1' } };
      const config = { categories: [{ group_id: 'group1', name: 'Test' }], staffchat_id: 'staff1' };
      const result = await checkRights(ctx, config);
      expect(result).toBe(true);
      expect(ctx.session.groupAdmin).toBe('Test');
    });

    it('should deny permission if no matching group exists', async () => {
      const ctx = { chat: { id: 'group2', type: 'group' }, session: {} };
      const config = { categories: [{ group_id: 'group1', name: 'Test' }], staffchat_id: 'staff1' };
      const result = await checkRights(ctx, config);
      expect(result).toBe(false);
    });
  });
});

// --- File Utilities Tests --- //
describe('File Utilities Module', () => {
  describe('strictEscape', () => {
    it('escapes MarkdownV2 special characters', () => {
      cache.config.parse_mode = 'MarkdownV2';
      const input = 'Hello *world*';
      const output = middleware.strictEscape(input);
      expect(output).toContain('\\*');
    });

    it('escapes HTML characters', () => {
      cache.config.parse_mode = 'HTML';
      const input = '<div>"Hello"</div>';
      const output = middleware.strictEscape(input);
      expect(output).toContain('&lt;');
      expect(output).toContain('&quot;');
    });
  });
});

// --- Commands Module Tests --- //
describe('Commands Module', () => {
  let ctx: any;
  beforeEach(() => {
    ctx = {
      session: { admin: false },
      message: { chat: { id: 1 }, from: { id: 100, username: 'user100' } },
      chat: { id: 1, type: 'private' },
    };
    jest.spyOn(middleware, 'reply').mockImplementation(jest.fn());
    jest.spyOn(middleware, 'sendMessage').mockImplementation(jest.fn());
  });

  describe('helpCommand', () => {
    it('should reply with user help text when not admin', () => {
      ctx.session.admin = false;
      helpCommand(ctx);
      expect(middleware.reply).toHaveBeenCalledWith(
        ctx,
        cache.config.language.helpCommandText,
        { parse_mode: cache.config.parse_mode }
      );
    });

    it('should reply with staff help text when admin', () => {
      ctx.session.admin = true;
      helpCommand(ctx);
      expect(middleware.reply).toHaveBeenCalledWith(
        ctx,
        cache.config.language.helpCommandStaffText,
        { parse_mode: cache.config.parse_mode }
      );
    });
  });

  describe('clearCommand', () => {
    it('should clear ticket arrays when admin', () => {
      ctx.session.admin = true;
      cache.ticketIDs = [1, 2];
      cache.ticketStatus = [true];
      cache.ticketSent = [0];
      clearCommand(ctx);
      expect(db.closeAll).toHaveBeenCalled();
      expect(cache.ticketIDs.length).toBe(0);
      expect(cache.ticketStatus.length).toBe(0);
      expect(cache.ticketSent.length).toBe(0);
      expect(middleware.reply).toHaveBeenCalledWith(ctx, 'All tickets closed.');
    });
  });
});

// --- TelegramAddon Module Tests --- //
describe('TelegramAddon Module', () => {
  it('should return a singleton instance', () => {
    const token = 'dummy-token';
    const instance1 = TelegramAddon.getInstance(token);
    const instance2 = TelegramAddon.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('initSession should return a session middleware function', () => {
    const instance = TelegramAddon.getInstance('dummy-token');
    const sessionMiddleware = instance.initSession();
    expect(typeof sessionMiddleware).toBe('function');
  });
});

// --- SignalAddon Module Tests --- //
describe('SignalAddon Module', () => {
  it('should return a singleton instance', () => {
    const instance1 = SignalAddon.getInstance();
    const instance2 = SignalAddon.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('sendMessage should post payload via axios', async () => {
    const instance = SignalAddon.getInstance();
    const axiosInstance = instance['axiosInstance'];
    const postMock = jest.spyOn(axiosInstance, 'post').mockResolvedValue({ data: {} });
    await instance.sendMessage('123', 'Test message', { recipients: ['123'] });
    expect(postMock).toHaveBeenCalledWith(
      '/v2/send',
      expect.objectContaining({ message: 'Test message', recipients: ['123'] }),
      expect.any(Object)
    );
    postMock.mockRestore();
  });

  it('getGroupId should return external group id if found', async () => {
    const instance = SignalAddon.getInstance();
    const axiosInstance = instance['axiosInstance'];
    const groups: any[] = [{ id: 'external1', internal_id: 'group1' }];
    const getMock = jest.spyOn(axiosInstance, 'get').mockResolvedValue({ data: groups });
    const result = await instance.getGroupId('group1');
    expect(result).toBe('external1');
    getMock.mockRestore();
  });
});
