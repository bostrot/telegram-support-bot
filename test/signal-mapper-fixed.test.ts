// Mock cache for Signal mapper
jest.mock('../src/cache', () => ({
  config: {
    language: {
      from: 'From:',
      language: 'Language:',
    },
  },
}));

import { mapSignalMessageToContext } from '../src/addons/signal/mapper';
import { SignalMessage } from '../src/addons/signal/models';

describe('Signal Mapper', () => {
  describe('mapSignalMessageToContext', () => {
    it('should map basic Signal message to context', () => {
      const signalMsg: SignalMessage = {
        envelope: {
          source: '1234567890',
          sourceName: 'John Doe',
          timestamp: 1640995200000,
        },
        dataMessage: {
          body: 'Hello from Signal',
          timestamp: 1640995200000,
          groupInfo: null,
          quote: null,
          attachments: [],
        },
      };

      const context = mapSignalMessageToContext(signalMsg);

      expect(context.message.text).toBe('Hello from Signal');
      expect(context.message.from.first_name).toBe('John Doe');
      expect(context.message.from.id).toBe('1234567890');
      expect(context.chat.type).toBe('private');
      expect(context.messenger).toBe('signal');
    });

    it('should handle group messages', () => {
      const signalMsg: SignalMessage = {
        envelope: {
          source: '1234567890',
          sourceName: 'John Doe',
          timestamp: 1640995200000,
        },
        dataMessage: {
          body: 'Hello group',
          timestamp: 1640995200000,
          groupInfo: {
            groupId: 'group123',
            type: 'DELIVER',
          },
          quote: null,
          attachments: [],
        },
      };

      const context = mapSignalMessageToContext(signalMsg);

      expect(context.message.text).toBe('Hello group');
      expect(context.chat.type).toBe('group');
      expect(context.chat.id).toBe('group123');
    });

    it('should handle messages with attachments', () => {
      const signalMsg: SignalMessage = {
        envelope: {
          source: '1234567890',
          sourceName: 'John Doe',
          timestamp: 1640995200000,
        },
        dataMessage: {
          body: 'Hello, I need help',
          timestamp: 1640995200000,
          groupInfo: null,
          quote: null,
          attachments: [
            {
              id: 'attachment1',
              contentType: 'image/jpeg',
              filename: 'image.jpg',
              size: 12345,
            },
          ],
        },
      };

      const context = mapSignalMessageToContext(signalMsg);

      expect(context.message.text).toBe('Hello, I need help');
      expect(context.message.caption).toBe('Hello, I need help');
    });

    it('should handle quoted/reply messages', () => {
      const signalMsg: SignalMessage = {
        envelope: {
          source: '1234567890',
          sourceName: 'John Doe',
          timestamp: 1640995200000,
        },
        dataMessage: {
          body: 'This is a reply',
          timestamp: 1640995200000,
          groupInfo: null,
          quote: {
            id: 'original-message-id',
            author: '0987654321',
            text: 'Original message text',
          },
          attachments: [],
        },
      };

      const context = mapSignalMessageToContext(signalMsg);

      expect(context.message.text).toBe('This is a reply');
      expect(context.message.reply_to_message).toBeDefined();
      expect(context.message.reply_to_message.text).toBe('Original message text');
    });

    it('should handle source name with special characters', () => {
      const signalMsg: SignalMessage = {
        envelope: {
          source: '1234567890',
          sourceName: 'José María O\'Connor',
          timestamp: 1640995200000,
        },
        dataMessage: {
          body: 'Hello',
          timestamp: 1640995200000,
          groupInfo: null,
          quote: null,
          attachments: [],
        },
      };

      const context = mapSignalMessageToContext(signalMsg);

      expect(context.message.from.first_name).toBe('José María O\'Connor');
      // Username should be sanitized version
      expect(context.message.from.username).toBe('josémaríaoconnor');
    });

    it('should set correct message timestamp and date', () => {
      const timestamp = 1640995200000; // Jan 1, 2022
      const signalMsg: SignalMessage = {
        envelope: {
          source: '1234567890',
          sourceName: 'John Doe',
          timestamp: timestamp,
        },
        dataMessage: {
          body: 'Timestamp test',
          timestamp: timestamp,
          groupInfo: null,
          quote: null,
          attachments: [],
        },
      };

      const context = mapSignalMessageToContext(signalMsg);

      expect(context.message.date).toBe(Math.floor(timestamp / 1000));
    });

    it('should handle missing dataMessage gracefully', () => {
      const signalMsgWithoutData: any = {
        envelope: {
          source: '1234567890',
          sourceName: 'John Doe',
          timestamp: 1640995200000,
        },
        // missing dataMessage
      };

      // This should not throw an error but might return a context with default values
      expect(() => mapSignalMessageToContext(signalMsgWithoutData)).toThrow();
    });

    it('should set correct chat type for private messages', () => {
      const signalMsg: SignalMessage = {
        envelope: {
          source: '1234567890',
          sourceName: 'John Doe',
          timestamp: 1640995200000,
        },
        dataMessage: {
          body: 'Private message',
          timestamp: 1640995200000,
          groupInfo: null,
          quote: null,
          attachments: [],
        },
      };

      const context = mapSignalMessageToContext(signalMsg);

      expect(context.chat.type).toBe('private');
      expect(context.chat.id).toBe('1234567890');
    });

    it('should handle empty message body', () => {
      const signalMsg: SignalMessage = {
        envelope: {
          source: '1234567890',
          sourceName: 'John Doe',
          timestamp: 1640995200000,
        },
        dataMessage: {
          body: '',
          timestamp: 1640995200000,
          groupInfo: null,
          quote: null,
          attachments: [],
        },
      };

      const context = mapSignalMessageToContext(signalMsg);

      expect(context.message.text).toBe('');
    });

    it('should set messenger type correctly', () => {
      const signalMsg: SignalMessage = {
        envelope: {
          source: '1234567890',
          sourceName: 'John Doe',
          timestamp: 1640995200000,
        },
        dataMessage: {
          body: 'Test message',
          timestamp: 1640995200000,
          groupInfo: null,
          quote: null,
          attachments: [],
        },
      };

      const context = mapSignalMessageToContext(signalMsg);

      expect(context.messenger).toBe('signal');
    });
  });
});
