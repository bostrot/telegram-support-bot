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
  });