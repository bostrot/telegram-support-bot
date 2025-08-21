// Mock dependencies first
const mockSendMessage = jest.fn();
const mockReply = jest.fn();
const mockGetTicketByUserId = jest.fn();
const mockAdd = jest.fn();

jest.mock('../src/middleware', () => ({
  sendMessage: mockSendMessage,
  reply: mockReply,
}));

jest.mock('../src/db', () => ({
  getTicketByUserId: mockGetTicketByUserId,
  add: mockAdd,
}));

jest.mock('../src/cache', () => ({
  config: {
    language: {
      from: 'From:',
      language: 'Language:',
    },
    spam_time: 60000,
    spam_cant_msg: 5,
  },
  ticketSent: {},
  userId: '',
}));

import * as files from '../src/files';
import { Context, Messenger } from '../src/interfaces';
import cache from '../src/cache';

describe('Files Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cache.ticketSent = {};
    cache.userId = '';
    mockGetTicketByUserId.mockResolvedValue(null);
  });

  const createMockContext = (
    chatType: string = 'private',
    hasFile: boolean = true,
    fileType: string = 'document'
  ): Context => ({
    message: {
      text: fileType === 'document' ? '' : 'File with caption',
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
      caption: fileType === 'photo' ? 'Photo caption' : '',
      getFile: jest.fn(),
    },
    messenger: Messenger.TELEGRAM,
    session: {
      lastContactDate: 0,
      admin: false,
      mode: null,
      modeData: {
        ticketid: '1001',
        userid: 'user123',
        name: 'John Doe',
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

  describe('forwardFile', () => {
    it('should forward file when user is in private chat', async () => {
      const ctx = createMockContext('private', true, 'document');
      
      await files.forwardFile(ctx);

      // Should call the appropriate database check
      expect(mockGetTicketByUserId).toHaveBeenCalledWith(
        'user123',
        'support'
      );
    });

    it('should not crash for group chats', async () => {
      const ctx = createMockContext('group', true, 'document');
      
      await expect(files.forwardFile(ctx)).resolves.not.toThrow();
    });
  });

  describe('forwardHandler', () => {
    it('should return user info for private chats', () => {
      const ctx = createMockContext('private', true, 'document');
      
      const result = files.forwardHandler(ctx);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('John');
      expect(cache.userId).toBe('user123');
    });

    it('should return undefined for non-private chats', () => {
      const ctx = createMockContext('group', true, 'document');
      
      const result = files.forwardHandler(ctx);
      expect(result).toBeUndefined();
    });
  });
});
