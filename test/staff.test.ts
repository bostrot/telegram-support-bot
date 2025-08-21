// Mock OpenAI before importing anything else
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Test response' } }]
          })
        }
      }
    }))
  };
});

import * as staff from '../src/staff';
import cache from '../src/cache';
import * as middleware from '../src/middleware';
import * as db from '../src/db';

// Mock dependencies
jest.mock('../src/cache');
jest.mock('../src/middleware');
jest.mock('../src/db');
jest.mock('fancy-log');

const mockSendMessage = jest.fn();
const mockStrictEscape = jest.fn((text) => text);
const mockReply = jest.fn();

(middleware as any).sendMessage = mockSendMessage;
(middleware as any).strictEscape = mockStrictEscape;

describe('Staff Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup cache mock
    (cache as any).config = {
      clean_replies: false,
      anonymous_replies: false,
      language: {
        dear: 'Dear',
        regards: 'Best regards',
        regardsGroup: 'Support Team'
      },
      parse_mode: 'MarkdownV2'
    };
  });

  const createMockContext = (isStaff = true): any => ({
    message: {
      text: 'Test message',
      from: { 
        id: 123, 
        first_name: 'John',
        is_bot: false 
      },
      date: Date.now(),
    },
    chat: { id: 456, type: 'group' },
    update_id: 1,
    messenger: 'telegram',
    session: {
      modeData: {
        userid: 'user123',
        name: 'Jane Doe',
        ticketId: 'T001'
      }
    },
    reply: mockReply,
    from: { id: 123, first_name: 'John' }
  });

  describe('privateReply', () => {
    it('should send message to user with proper formatting', () => {
      const ctx = createMockContext();
      
      (staff as any).privateReply(ctx);
      
      expect(mockSendMessage).toHaveBeenCalledWith(
        'user123',
        'telegram',
        expect.stringContaining('Dear Jane Doe'),
        expect.objectContaining({
          parse_mode: 'MarkdownV2'
        })
      );
    });

    it('should handle clean replies mode', () => {
      const ctx = createMockContext();
      (cache as any).config.clean_replies = true;
      
      (staff as any).privateReply(ctx);
      
      expect(mockSendMessage).toHaveBeenCalledWith(
        'user123',
        'telegram',
        'Test message',
        expect.any(Object)
      );
    });

    it('should handle anonymous replies mode', () => {
      const ctx = createMockContext();
      (cache as any).config.anonymous_replies = true;
      
      (staff as any).privateReply(ctx);
      
      expect(mockSendMessage).toHaveBeenCalledWith(
        'user123',
        'telegram',
        expect.stringContaining('Support Team'),
        expect.any(Object)
      );
    });

    it('should use custom message when provided', () => {
      const ctx = createMockContext();
      const customMsg = {
        text: 'Custom response',
        from: { first_name: 'Staff' }
      };
      
      (staff as any).privateReply(ctx, customMsg);
      
      expect(mockSendMessage).toHaveBeenCalledWith(
        'user123',
        'telegram',
        expect.stringContaining('Custom response'),
        expect.any(Object)
      );
    });
  });

  describe('ticketMsg', () => {
    it('should format normal ticket message', () => {
      const message = {
        text: 'Hello world',
        from: { first_name: 'John' }
      };
      
      const result = (staff as any).ticketMsg('Jane', message);
      
      expect(result).toContain('Dear Jane');
      expect(result).toContain('Hello world');
      expect(result).toContain('John');
    });

    it('should handle clean replies', () => {
      (cache as any).config.clean_replies = true;
      const message = {
        text: 'Clean message',
        from: { first_name: 'John' }
      };
      
      const result = (staff as any).ticketMsg('Jane', message);
      
      expect(result).toBe('Clean message');
    });

    it('should handle anonymous replies', () => {
      (cache as any).config.anonymous_replies = true;
      const message = {
        text: 'Anonymous message',
        from: { first_name: 'John' }
      };
      
      const result = (staff as any).ticketMsg('Jane', message);
      
      expect(result).toContain('Support Team');
      expect(result).not.toContain('John');
    });
  });
});
