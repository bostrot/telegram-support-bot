import { mapSignalMessageToContext } from '../src/addons/signal/mapper';
import { SignalMessage, Envelope, DataMessage } from '../src/addons/signal/models';
import { Context } from '../src/interfaces';

describe('Signal Mapper', () => {
  describe('mapSignalMessageToContext', () => {
    const createSignalMessage = (overrides: Partial<{
      envelope: Partial<Envelope>;
      dataMessage: Partial<DataMessage>;
    }> = {}): SignalMessage => {
      const defaultDataMessage: DataMessage = {
        timestamp: 1640995200000,
        message: 'Hello, I need help',
        expiresInSeconds: 0,
        viewOnce: false,
        attachments: [],
        quote: undefined,
        groupInfo: undefined,
        ...overrides.dataMessage,
      };

      const defaultEnvelope: Envelope = {
        source: '+1234567890',
        sourceNumber: '+1234567890',
        sourceUuid: 'uuid-123',
        sourceName: 'John Doe',
        sourceDevice: 1,
        timestamp: 1640995200000,
        serverReceivedTimestamp: 1640995200100,
        serverDeliveredTimestamp: 1640995200200,
        dataMessage: defaultDataMessage,
        ...overrides.envelope,
      };

      if (overrides.envelope?.dataMessage) {
        defaultEnvelope.dataMessage = { ...defaultDataMessage, ...overrides.envelope.dataMessage };
      }

      return {
        envelope: defaultEnvelope,
        account: '+0987654321',
      };
    };

    it('should map basic Signal message to context', () => {
      const signalMsg = createSignalMessage();
      const context = mapSignalMessageToContext(signalMsg);

      expect(context.update_id).toBe(1640995200000);
      expect(context.message.message_id).toBe(1640995200000);
      expect(context.message.from.id).toBe('+1234567890');
      expect(context.message.from.first_name).toBe('John Doe');
      expect(context.message.from.username).toBe('johndoe');
      expect(context.message.text).toBe('Hello, I need help');
      expect(context.message.date).toBe(Math.floor(1640995200000 / 1000));
      expect(context.chat.id).toBe('+1234567890');
      expect(context.chat.type).toBe('private');
    });

    it('should handle group messages correctly', () => {
      const signalMsg = createSignalMessage({
        dataMessage: {
          groupInfo: {
            groupId: 'group-123',
            groupName: 'Support Group',
            revision: 1,
            type: 'DELIVER',
          },
        },
      });

      const context = mapSignalMessageToContext(signalMsg);

      expect(context.chat.id).toBe('group-123');
      expect(context.chat.type).toBe('group');
      expect(context.message.chat.id).toBe('group-123');
      expect(context.message.chat.type).toBe('group');
    });

    it('should handle quoted messages (replies)', () => {
      const signalMsg = createSignalMessage({
        dataMessage: {
          quote: {
            id: 987654321,
            author: '+0987654321',
            authorNumber: '+0987654321',
            authorUuid: 'uuid-456',
            text: 'Original message',
            attachments: [],
          },
        },
      });

      const context = mapSignalMessageToContext(signalMsg);

      expect(context.message.reply_to_message).toBeDefined();
      expect(context.message.reply_to_message.text).toBe('Original message');
      expect(context.message.reply_to_message.from.is_bot).toBe(false);
    });

    it('should create username from source name by removing spaces and lowercasing', () => {
      const signalMsg = createSignalMessage({
        envelope: {
          sourceName: 'John Smith Doe',
        },
      });

      const context = mapSignalMessageToContext(signalMsg);

      expect(context.message.from.username).toBe('johnsmithdoe');
      expect(context.chat.username).toBe('johnsmithdoe');
    });

    it('should handle messages with attachments', () => {
      const signalMsg = createSignalMessage({
        dataMessage: {
          attachments: [
            {
              contentType: 'image/jpeg',
              filename: 'photo.jpg',
              id: 'attachment-123',
              size: 12345,
              width: 800,
              height: 600,
              caption: 'A nice photo',
              uploadTimestamp: 1640995100000,
            },
          ],
        },
      });

      const context = mapSignalMessageToContext(signalMsg);

      expect(context.message.caption).toBe('');
      // Note: The actual attachment handling might require additional context mapping
      // depending on how the application processes Signal attachments
    });

    it('should handle empty source name gracefully', () => {
      const signalMsg = createSignalMessage({
        envelope: {
          sourceName: '',
        },
      });

      const context = mapSignalMessageToContext(signalMsg);

      expect(context.message.from.first_name).toBe('');
      expect(context.message.from.username).toBe('');
      expect(context.chat.first_name).toBe('');
      expect(context.chat.username).toBe('');
    });

    it('should handle source name with special characters', () => {
      const signalMsg = createSignalMessage({
        envelope: {
          sourceName: 'José María O\'Connor',
        },
      });

      const context = mapSignalMessageToContext(signalMsg);

      expect(context.message.from.first_name).toBe('José María O\'Connor');
      expect(context.message.from.username).toBe('josémariaoconnor');
    });

    it('should set correct message timestamp and date', () => {
      const timestamp = 1640995200000; // 2022-01-01T00:00:00.000Z
      const signalMsg = createSignalMessage({
        envelope: {
          timestamp,
        },
        dataMessage: {
          timestamp,
        },
      });

      const context = mapSignalMessageToContext(signalMsg);

      expect(context.message.date).toBe(1640995200); // Timestamp in seconds
      expect(context.update_id).toBe(timestamp);
      expect(context.message.message_id).toBe(timestamp);
    });

    it('should handle missing dataMessage gracefully', () => {
      const signalMsg = createSignalMessage();
      
      // Remove dataMessage to test error handling
      const signalMsgWithoutData = {
        ...signalMsg,
        envelope: {
          ...signalMsg.envelope,
          dataMessage: undefined as any,
        },
      };

      // This should not throw an error but might return a context with default values
      expect(() => mapSignalMessageToContext(signalMsgWithoutData)).not.toThrow();
    });

    it('should set correct chat type for private messages', () => {
      const signalMsg = createSignalMessage({
        dataMessage: {
          groupInfo: undefined, // Explicitly no group info = private chat
        },
      });

      const context = mapSignalMessageToContext(signalMsg);

      expect(context.chat.type).toBe('private');
      expect(context.message.chat.type).toBe('private');
      expect(context.chat.id).toBe('+1234567890'); // Should use source as chat ID
    });

    it('should map all required Context properties', () => {
      const signalMsg = createSignalMessage();
      const context = mapSignalMessageToContext(signalMsg);

      // Verify all required Context properties are present
      expect(context).toHaveProperty('update_id');
      expect(context).toHaveProperty('message');
      expect(context).toHaveProperty('chat');
      expect(context).toHaveProperty('from');
      expect(context).toHaveProperty('messenger');
      
      expect(context.message).toHaveProperty('message_id');
      expect(context.message).toHaveProperty('from');
      expect(context.message).toHaveProperty('chat');
      expect(context.message).toHaveProperty('date');
      expect(context.message).toHaveProperty('text');
      expect(context.message).toHaveProperty('reply_to_message');
      expect(context.message).toHaveProperty('external_reply');
      expect(context.message).toHaveProperty('caption');

      expect(context.chat).toHaveProperty('id');
      expect(context.chat).toHaveProperty('type');
      expect(context.chat).toHaveProperty('first_name');
      expect(context.chat).toHaveProperty('username');

      expect(context.from).toHaveProperty('id');
      expect(context.from).toHaveProperty('username');
    });
  });
});
