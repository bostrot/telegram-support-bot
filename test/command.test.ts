import * as middleware from '../src/middleware'; // file utilities module
import {
  helpCommand,
  clearCommand
} from '../src/commands';
import cache from '../src/cache';
import * as db from '../src/db';

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