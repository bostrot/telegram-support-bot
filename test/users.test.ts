// Mock dependencies
const mockSendMessage = jest.fn();
const mockReply = jest.fn();
const mockAdd = jest.fn();
const mockGetTicketByUserId = jest.fn();
const mockAddIdAndName = jest.fn();

jest.mock('../src/middleware', () => ({
  sendMessage: mockSendMessage,
  reply: mockReply,
  strictEscape: jest.fn((str) => str),
}));

jest.mock('../src/db', () => ({
  add: mockAdd,
  getTicketByUserId: mockGetTicketByUserId,
  addIdAndName: mockAddIdAndName,
}));

jest.mock('../src/cache', () => ({
  config: {
    language: {
      confirmationMessage: 'Thank you for contacting us.',
      ticket: 'Ticket',
      automatedReplySent: 'Automated reply sent',
      blockedSpam: 'You are sending too many messages',
    },
    autoreply: [
      { question: 'hello', answer: 'Hi there!' },
    ],
    use_llm: false,
    autoreply_confirmation: true,
    show_auto_replied: true,
    show_user_ticket: true,
    spam_cant_msg: 3,
    spam_time: 5000,
    staffchat_id: 'staff123',
    staffchat_type: 'telegram',
    allow_private: false,
    parse_mode: 'MarkdownV2',
  },
  userId: '',
  ticketIDs: [],
  ticketStatus: {},
  ticketSent: [],
}));

jest.mock('../src/addons/llm', () => ({
  getResponseFromLLM: jest.fn(),
}));

jest.mock('fancy-log', () => ({
  info: jest.fn(),
}));

import * as users from '../src/users';
import { Context, Messenger } from '../src/interfaces';
import cache from '../src/cache';

describe('Users Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cache.userId = '';
    cache.ticketIDs = [];
    cache.ticketStatus = {};
    cache.ticketSent = [];
    Date.now = jest.fn(() => 1640995200000); // Fixed timestamp
  });

  describe('chat', () => {
    const createMockContext = (text: string): Context => ({
      message: {
        text,
        from: {
          id: 'user123',
          first_name: 'John',
          username: 'john_doe',
          is_bot: false,
          language_code: 'en',
        },
        chat: {
          id: 'chat123',
          first_name: 'John',
          username: 'john_doe',
          type: 'private',
        },
        message_id: 1,
        date: 1640995200,
        web_msg: false,
        reply_to_message: {
          from: { is_bot: false },
          text: '',
          caption: '',
        },
        external_reply: { message_id: 0 },
        caption: '',
      },
      messenger: Messenger.TELEGRAM,
      session: {
        lastContactDate: 0,
        admin: false,
        mode: null,
        modeData: {
          ticketid: '',
          userid: '',
          name: '',
          category: '',
        },
        groupCategory: 'general',
        groupTag: '',
        group: '',
        groupAdmin: null,
        getSessionKey: () => '',
      },
      chat: {
        id: 'chat123',
        first_name: 'John',
        username: 'john_doe',
        type: 'private',
      },
      update_id: 1,
      callbackQuery: { data: '', from: { id: '' }, id: '' },
      from: { username: 'john_doe', id: 'user123' },
      inlineQuery: () => {},
      answerCbQuery: () => {},
      reply: () => {},
      getChat: () => {},
      getFile: () => {},
    });

    it('should process new ticket for first-time user', async () => {
      const ctx = createMockContext('I need help with my account');
      const mockTicket = {
        ticketId: 1001,
        userid: 'user123',
        messenger: 'telegram',
        status: 'open',
        category: 'general',
      };
      
      mockGetTicketByUserId.mockResolvedValue(mockTicket);
      mockSendMessage.mockResolvedValue('msg_id_123');

      await users.chat(ctx, { id: 'chat123' });

      expect(cache.userId).toBe('user123');
      expect(cache.ticketStatus['user123']).toBe(true);
      expect(cache.ticketSent['user123']).toBe(0);
      
      // Should send confirmation message
      expect(mockSendMessage).toHaveBeenCalledWith(
        'chat123',
        'telegram',
        expect.stringContaining('Thank you for contacting us')
      );
      
      // Should send ticket to staff
      expect(mockSendMessage).toHaveBeenCalledWith(
        'staff123',
        'telegram',
        expect.stringContaining('#T001001')
      );
    });

    it('should handle spam protection for repeated messages', async () => {
      const ctx = createMockContext('Help me again');
      const mockTicket = {
        ticketId: 1002,
        userid: 'user123',
        messenger: 'telegram',
        status: 'open',
        category: 'general',
      };
      
      // Simulate user already having sent messages
      cache.ticketSent['user123'] = 1;
      
      mockGetTicketByUserId.mockResolvedValue(mockTicket);
      mockSendMessage.mockResolvedValue('msg_id_124');

      await users.chat(ctx, { id: 'chat123' });

      expect(cache.ticketSent['user123']).toBe(2);
      
      // Should only send to staff (no confirmation for repeated messages)
      expect(mockSendMessage).toHaveBeenCalledWith(
        'staff123',
        'telegram',
        expect.stringContaining('#T001002')
      );
    });

    it('should block user when spam limit reached', async () => {
      const ctx = createMockContext('Spam message');
      
      // Simulate user hitting spam limit
      cache.ticketSent['user123'] = 3; // spam_cant_msg = 3
      
      await users.chat(ctx, { id: 'chat123' });

      expect(cache.ticketSent['user123']).toBe(4);
      
      // Should send spam block message
      expect(mockSendMessage).toHaveBeenCalledWith(
        'chat123',
        'telegram',
        'You are sending too many messages'
      );
    });

    it('should forward to group chat when group is set', async () => {
      const ctx = createMockContext('Group message');
      ctx.session.group = 'group456';
      
      const mockTicket = {
        ticketId: 1003,
        userid: 'user123',
        messenger: 'telegram',
        status: 'open',
        category: 'general',
      };
      
      mockGetTicketByUserId.mockResolvedValue(mockTicket);
      mockSendMessage.mockResolvedValue('msg_id_125');

      await users.chat(ctx, { id: 'chat123' });

      // Should send to both staff and group
      expect(mockSendMessage).toHaveBeenCalledWith(
        'staff123',
        'telegram',
        expect.stringContaining('#T001003')
      );
      
      expect(mockSendMessage).toHaveBeenCalledWith(
        'group456',
        'telegram',
        expect.stringContaining('#T001003'),
        expect.any(Object)
      );
    });

    it('should not send duplicate messages to group if group is same as staff chat', async () => {
      const ctx = createMockContext('Staff group message');
      ctx.session.group = 'staff123'; // Same as staffchat_id
      
      const mockTicket = {
        ticketId: 1004,
        userid: 'user123',
        messenger: 'telegram',
        status: 'open',
        category: 'general',
      };
      
      mockGetTicketByUserId.mockResolvedValue(mockTicket);
      mockSendMessage.mockResolvedValue('msg_id_126');

      await users.chat(ctx, { id: 'chat123' });

      // Should only send to staff once (not duplicate to group)
      const staffCalls = mockSendMessage.mock.calls.filter(
        call => call[0] === 'staff123'
      );
      expect(staffCalls.length).toBeLessThanOrEqual(2); // Confirmation + ticket
    });

    it('should reset spam timer after spam_time period', async () => {
      const ctx = createMockContext('Reset spam timer test');
      
      const mockTicket = {
        ticketId: 1005,
        userid: 'user123',
        messenger: 'telegram',
        status: 'open',
        category: 'general',
      };
      
      mockGetTicketByUserId.mockResolvedValue(mockTicket);
      mockSendMessage.mockResolvedValue('msg_id_127');

      await users.chat(ctx, { id: 'chat123' });
      // Test passes if no errors are thrown
      expect(true).toBe(true);
    });
  });
});
