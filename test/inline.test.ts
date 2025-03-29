import * as middleware from '../src/middleware'; // file utilities module
import cache from '../src/cache';
import { replyKeyboard, removeKeyboard, callbackQuery } from '../src/inline';

// --- Inline Module Tests --- //
describe('Inline Module', () => {

    describe('replyKeyboard', () => {
      it('should return correct keyboard markup', () => {
        const keys = [['Option1'], ['Option2']];
        const result = replyKeyboard(keys);
        expect(result).toEqual({
          parse_mode: cache.config.parse_mode,
          reply_markup: { keyboard: keys },
        });
      });
    });
  
    describe('removeKeyboard', () => {
      it('should return correct remove_keyboard markup', () => {
        const result = removeKeyboard();
        expect(result).toEqual({
          parse_mode: cache.config.parse_mode,
          reply_markup: { remove_keyboard: true },
        });
      });
    });
  
    describe('callbackQuery', () => {
      it('should end callback session when data is "R"', () => {
        const ctx: any = {
          callbackQuery: { data: 'R' },
          session: { modeData: {} },
          chat: { id: 1 },
          message: {},
        };
        jest.spyOn(middleware, 'reply').mockImplementation(jest.fn());
        callbackQuery(ctx);
        expect(middleware.reply).toHaveBeenCalledWith(ctx, cache.config.language.prvChatEnded);
      });
  
      it('should set private_reply mode for other callback data', () => {
        const sampleData = '123---John---Cat---001';
        const ctx: any = {
          callbackQuery: { data: sampleData, from: { id: 100 } },
          chat: { type: 'group', id: 1 },
          message: { from: { first_name: 'Alice' } },
          session: {},
          answerCbQuery: jest.fn(),
        };
        jest.spyOn(middleware, 'sendMessage').mockImplementation(jest.fn());
        callbackQuery(ctx);
        expect(ctx.session.mode).toBe('private_reply');
        expect(ctx.session.modeData).toEqual({
          ticketid: '001',
          userid: '123',
          name: 'John',
          category: 'Cat',
        });
      });
    });
  });