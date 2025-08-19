import {
  ticketMsg,      // from staff.ts refactoring
  privateReply,
  chat as staffChat,
} from '../src/staff'; // adjust import paths as needed
import * as middleware from '../src/middleware';
import cache from '../src/cache';

// --- Staff Module Tests --- //
describe('Staff Module', () => {
    describe('ticketMsg', () => {
      it('should return the escaped message if clean_replies is enabled', () => {
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
  
    describe('privateReply', () => {
      it('should call middleware.sendMessage for private reply', () => {
        const ctx: any = {
          session: { modeData: { userid: 'user123', name: 'John' } },
          messenger: 'dummy',
          message: { from: { first_name: 'Alice' }, text: 'Test', chat: { id: 1 } },
          chat: { id: 1 },
          from: { username: 'alice' },
        };
        jest.spyOn(middleware, 'sendMessage').mockImplementation(jest.fn());
        privateReply(ctx);
        expect(middleware.sendMessage).toHaveBeenCalledTimes(2);
      });
    });

    describe('staffChat', () => {
      const mockDb = require('../src/db');
      
      beforeEach(() => {
        jest.clearAllMocks();
        // Reset cache state
        cache.ticketStatus = {};
        cache.ticketSent = {};
      });

      it('should handle reply with external_reply message_id properly', async () => {
        // Set cache config for this test
        cache.config.clean_replies = false;
        cache.config.anonymous_replies = true;
        
        const ctx: any = {
          session: { admin: true, groupCategory: 'test' },
          message: {
            external_reply: { message_id: 12345 },
            reply_to_message: { text: 'Original ticket message', caption: null },
            text: 'Admin reply to user',
            from: { first_name: 'AdminName' },
            chat: { id: 'staff_chat_123' }
          },
          chat: { id: 'staff_chat_123' },
          messenger: 'telegram'
        };

        // Mock the database to return a ticket when queried by internal ID
        const mockTicket = {
          ticketId: 1001,
          userid: 'user456',
          name: 'TestUser',
          messenger: 'telegram',
          status: 'open'
        };
        mockDb.getTicketByInternalId.mockResolvedValue(mockTicket);

        // Spy on middleware.sendMessage
        const sendMessageSpy = jest.spyOn(middleware, 'sendMessage').mockResolvedValue('123');

        await staffChat(ctx);

        // Verify that sendMessage was called to send reply to user
        expect(sendMessageSpy).toHaveBeenCalledWith(
          mockTicket.userid,
          mockTicket.messenger,
          expect.stringContaining('Support Team')
        );

        // Verify confirmation was sent to staff chat  
        expect(sendMessageSpy).toHaveBeenCalledWith(
          ctx.chat.id,
          cache.config.staffchat_type,
          expect.stringContaining('TestUser')
        );

        // Verify that ticket status was properly updated
        expect(cache.ticketStatus[mockTicket.ticketId]).toBe(false);
        expect(cache.ticketSent[mockTicket.ticketId]).toBe(null);
      });

      it('should handle case when external_reply ticket is not found', async () => {
        const ctx: any = {
          session: { admin: true, groupCategory: 'test' },
          message: {
            external_reply: { message_id: 99999 },
            reply_to_message: { text: 'Original ticket message', caption: null },
            text: 'Admin reply to user',
            from: { first_name: 'AdminName' },
            chat: { id: 'staff_chat_123' }
          },
          chat: { id: 'staff_chat_123' },
          messenger: 'telegram'
        };

        // Mock the database to return null when ticket not found
        mockDb.getTicketByInternalId.mockResolvedValue(null);

        const replySpy = jest.spyOn(middleware, 'reply').mockImplementation(jest.fn());

        await staffChat(ctx);

        // Should show error message when ticket not found
        expect(replySpy).toHaveBeenCalledWith(ctx, expect.any(String));
      });
    });
  });