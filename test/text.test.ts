// Mock dependencies
const mockReply = jest.fn();
const mockSendMessage = jest.fn();
const mockAdd = jest.fn();
const mockCheckBan = jest.fn();
const mockGetTicketByUserId = jest.fn();
const mockChat = jest.fn();
const mockPrivateReply = jest.fn();
const mockStaffChat = jest.fn();

jest.mock('../src/middleware', () => ({
  reply: mockReply,
  sendMessage: mockSendMessage,
}));

jest.mock('../src/db', () => ({
  add: mockAdd,
  checkBan: mockCheckBan,
  getTicketByUserId: mockGetTicketByUserId,
}));

jest.mock('../src/users', () => ({
  chat: mockChat,
}));

jest.mock('../src/staff', () => ({
  privateReply: mockPrivateReply,
  chat: mockStaffChat,
}));

jest.mock('../src/cache', () => ({
  config: {
    categories: [
      {
        name: 'Support',
        msg: 'Support',
        tag: 'SUPPORT',
        group_id: 'group1',
        subgroups: []
      },
      {
        name: 'Sales',
        msg: 'Sales',
        tag: 'SALES',
        group_id: 'group2',
        subgroups: []
      }
    ],
    parse_mode: 'MarkdownV2',
    language: {
      services: 'Please select a service:',
      prvChatOnly: 'This bot only works in private chat',
    },
  },
}));

import * as text from '../src/text';
import { Context, Messenger } from '../src/interfaces';

describe('Text Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockContext = (
    messageText: string, 
    chatType: string = 'private',
    mode: string | null = null,
    isAdmin: boolean = false,
    group: string = ''
  ): Context => ({
    message: {
      text: messageText,
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
        type: chatType,
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
      admin: isAdmin,
      mode: mode,
      modeData: {
        ticketid: '',
        userid: '',
        name: '',
        category: '',
      },
      groupCategory: null,
      groupTag: '',
      group: group,
      groupAdmin: null,
      getSessionKey: () => '',
    },
    chat: {
      id: 'chat123',
      first_name: 'John',
      username: 'john_doe',
      type: chatType,
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

  describe('handleText', () => {
    it('should handle private reply mode', () => {
      const ctx = createMockContext('Response message', 'private', 'private_reply');
      const mockAddon = { platform: 'telegram' };

      text.handleText(mockAddon as any, ctx, []);

      expect(mockPrivateReply).toHaveBeenCalledWith(ctx);
      expect(mockReply).not.toHaveBeenCalled();
    });

    it('should show category keyboard for regular messages when conditions are met', () => {
      const ctx = createMockContext('I need help with something');
      const mockAddon = { platform: 'telegram' };
      const keys = [['Support'], ['Sales']];

      text.handleText(mockAddon as any, ctx, keys);

      expect(mockReply).toHaveBeenCalledWith(
        ctx,
        'Please select a service:',
        expect.objectContaining({
          reply_markup: { keyboard: keys }
        })
      );
    });

    it('should not show keyboard for admin users', () => {
      const ctx = createMockContext('Any message', 'private', null, true);
      const mockAddon = { platform: 'telegram' };
      const keys = [['Support'], ['Sales']];
      
      mockGetTicketByUserId.mockResolvedValue(null);
      mockAdd.mockResolvedValue(1);

      text.handleText(mockAddon as any, ctx, keys);

      // Should not show keyboard for admin users
      expect(mockReply).not.toHaveBeenCalled();
    });

    it('should not show keyboard for users in group mode', () => {
      const ctx = createMockContext('Any message', 'private', null, false, 'some_group');
      const mockAddon = { platform: 'telegram' };
      const keys = [['Support'], ['Sales']];
      
      mockGetTicketByUserId.mockResolvedValue(null);
      mockAdd.mockResolvedValue(1);

      text.handleText(mockAddon as any, ctx, keys);

      // Should not show keyboard for users in group mode
      expect(mockReply).not.toHaveBeenCalled();
    });

    it('should proceed to ticket handler for category messages', () => {
      const ctx = createMockContext('Support');
      const mockAddon = { platform: 'telegram' };
      
      mockGetTicketByUserId.mockResolvedValue(null);
      mockAdd.mockResolvedValue(1);

      text.handleText(mockAddon as any, ctx, []);

      // Should not show keyboard for category messages
      expect(mockReply).not.toHaveBeenCalled();
    });
  });

  describe('ticketHandler', () => {
    const mockAddon = { platform: 'telegram' };

    it('should handle private chat and create new ticket if none exists', async () => {
      const ctx = createMockContext('Help me');
      mockGetTicketByUserId.mockResolvedValue(null);
      mockAdd.mockResolvedValue(1);

      const result = await text.ticketHandler(mockAddon as any, ctx);

      expect(mockAdd).toHaveBeenCalledWith(
        'user123',
        'open',
        null,
        'telegram'
      );
      expect(mockChat).toHaveBeenCalledWith(ctx, ctx.message.chat);
      expect(result).toBeNull();
    });

    it('should handle private chat with existing ticket', async () => {
      const ctx = createMockContext('Follow up message');
      const existingTicket = {
        ticketId: 1001,
        userid: 'user123',
        status: 'open',
        category: null,
      };
      mockGetTicketByUserId.mockResolvedValue(existingTicket);

      const result = await text.ticketHandler(mockAddon as any, ctx);

      expect(mockAdd).not.toHaveBeenCalled(); // No new ticket created
      expect(mockChat).toHaveBeenCalledWith(ctx, ctx.message.chat);
      expect(result).toEqual(existingTicket);
    });

    it('should handle group chat by calling staff chat handler', async () => {
      const ctx = createMockContext('Group message', 'group');

      await text.ticketHandler(mockAddon as any, ctx);

      expect(mockStaffChat).toHaveBeenCalledWith(ctx);
      expect(mockAdd).not.toHaveBeenCalled();
      expect(mockChat).not.toHaveBeenCalled();
    });

    it('should handle supergroup chat by calling staff chat handler', async () => {
      const ctx = createMockContext('Supergroup message', 'supergroup');

      await text.ticketHandler(mockAddon as any, ctx);

      expect(mockStaffChat).toHaveBeenCalledWith(ctx);
      expect(mockAdd).not.toHaveBeenCalled();
      expect(mockChat).not.toHaveBeenCalled();
    });

    it('should pass group category to database calls', async () => {
      const ctx = createMockContext('Help me');
      ctx.session.groupCategory = 'support';
      mockGetTicketByUserId.mockResolvedValue(null);
      mockAdd.mockResolvedValue(1);

      await text.ticketHandler(mockAddon as any, ctx);

      expect(mockGetTicketByUserId).toHaveBeenCalledWith('user123', 'support');
      expect(mockAdd).toHaveBeenCalledWith(
        'user123',
        'open',
        'support',
        'telegram'
      );
    });
  });
});
