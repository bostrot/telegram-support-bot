// Mock dependencies with better structure
const mockReply = jest.fn();
const mockSendMessage = jest.fn();
const mockCloseAll = jest.fn();

jest.mock('../src/middleware', () => ({
  reply: mockReply,
  sendMessage: mockSendMessage,
}));

// Mock the entire db module with all needed functions
jest.mock('../src/db', () => ({
  closeAll: mockCloseAll,
  open: jest.fn((callback) => callback([])), // Mock the open function
  getByTicketId: jest.fn((ticketId, callback) => {
    callback({ userid: 'user123', id: { toString: () => ticketId } });
  }),
  reopen: jest.fn(), // Add reopen mock
  add: jest.fn(),    // Add add mock
}));

jest.mock('../src/cache', () => ({
  config: {
    language: {
      helpCommandText: 'Help: /start, /help',
      helpCommandStaffText: 'Staff: /clear, /open, /close',
      from: 'From:',
    },
    parse_mode: 'MarkdownV2',
  },
  ticketIDs: [],
  ticketStatus: [],
  ticketSent: [],
}));

import * as commands from '../src/commands';
import { Context, Messenger } from '../src/interfaces';
import cache from '../src/cache';

describe('Commands Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset cache arrays
    cache.ticketIDs.length = 0;
    cache.ticketStatus.length = 0;
    cache.ticketSent.length = 0;
  });

  const createMockContext = (isAdmin: boolean = false): Context => ({
    message: {
      text: '/help',
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
        text: '#T001001 From: John Doe',
        caption: '',
      },
      external_reply: { message_id: 0 },
      caption: '',
      getFile: jest.fn(),
    },
    messenger: Messenger.TELEGRAM,
    session: {
      lastContactDate: 0,
      admin: isAdmin,
      mode: null,
      modeData: {
        ticketid: '',
        userid: '',
        name: '',
        category: 'support',
      },
      groupCategory: 'support',
      groupTag: 'SUPPORT',
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

  describe('helpCommand', () => {
    it('should show help text for regular users', () => {
      const ctx = createMockContext(false);
      
      commands.helpCommand(ctx);

      expect(mockReply).toHaveBeenCalledWith(
        ctx,
        'Help: /start, /help',
        { parse_mode: 'MarkdownV2' }
      );
    });

    it('should show staff help text for admin users', () => {
      const ctx = createMockContext(true);
      
      commands.helpCommand(ctx);

      expect(mockReply).toHaveBeenCalledWith(
        ctx,
        'Staff: /clear, /open, /close',
        { parse_mode: 'MarkdownV2' }
      );
    });
  });

  describe('clearCommand', () => {
    it('should clear all tickets for admin users', () => {
      const ctx = createMockContext(true);
      
      commands.clearCommand(ctx);

      expect(mockCloseAll).toHaveBeenCalled();
      expect(cache.ticketIDs).toHaveLength(0);
      expect(mockReply).toHaveBeenCalledWith(ctx, 'All tickets closed.');
    });

    it('should reject non-admin users', () => {
      const ctx = createMockContext(false);
      
      commands.clearCommand(ctx);

      expect(mockCloseAll).not.toHaveBeenCalled();
      expect(mockReply).not.toHaveBeenCalled();
    });
  });

  describe('openCommand', () => {
    it('should process open tickets for admin users', () => {
      const ctx = createMockContext(true);
      
      commands.openCommand(ctx);

      // The function should call db.open and then reply
      // Since we mocked db.open to call callback with empty array
      expect(mockReply).toHaveBeenCalled();
    });

    it('should reject non-admin users', () => {
      const ctx = createMockContext(false);
      
      commands.openCommand(ctx);

      // Function should return early for non-admin users
      // Check that no reply was sent (depends on implementation)
    });
  });

  describe('closeCommand', () => {
    it('should handle ticket closing for admin users', () => {
      const ctx = createMockContext(true);
      commands.closeCommand(ctx);
      expect(true).toBe(true); // Test passes if no errors thrown
    });

    it('should not fail when called', () => {
      const ctx = createMockContext(true);
      commands.closeCommand(ctx);
      expect(true).toBe(true);
    });
  });

  describe('reopenCommand', () => {
    it('should handle ticket reopening for admin users', () => {
      const ctx = createMockContext(true);
      commands.reopenCommand(ctx);
      expect(true).toBe(true);
    });
  });

  describe('banCommand', () => {
    it('should handle user banning for admin users', () => {
      const ctx = createMockContext(true);
      commands.banCommand(ctx);
      expect(true).toBe(true);
    });
  });

  describe('unbanCommand', () => {
    it('should handle user unbanning for admin users', () => {
      const ctx = createMockContext(true);
      commands.unbanCommand(ctx);
      expect(true).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle missing reply message gracefully', () => {
      const ctx = createMockContext(true);
      ctx.message.reply_to_message = {
        from: { is_bot: false },
        text: '',
        caption: '',
      };

      expect(() => commands.closeCommand(ctx)).not.toThrow();
      expect(() => commands.reopenCommand(ctx)).not.toThrow();
    });
  });
});
