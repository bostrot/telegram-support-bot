import * as db from './db';
import cache from './cache';
import * as staff from './staff';
import * as users from './users';
import * as middleware from './middleware';
import TelegramAddon from './addons/telegram';
import {Context} from './interfaces';

/**
 * Text handler
 * @param {Object} bot
 * @param {Object} ctx
 * @param {Array} keys
 */
function handleText(bot: TelegramAddon, ctx: any, keys: any[]) {
  if (ctx.session.mode == 'private_reply') {
    staff.privateReply(ctx);
  } else if (
    cache.config.categories &&
    cache.config.categories.length > 0 &&
    !(JSON.stringify(cache.config.categories).indexOf(ctx.message.text) > -1)
  ) {
    if (!ctx.session.admin && cache.config.categories && !ctx.session.group) {
      middleware.reply(ctx, cache.config.language.services, {
        reply_markup: {
          keyboard: keys,
        },
      });
    } else {
      ticketHandler(bot, ctx);
    }
  } else {
    ticketHandler(bot, ctx);
  }
}

/**
 * Decide whether to forward or stop the message.
 * @param {Bot} bot Bot object.
 * @param {Context} ctx Bot context.
 */
function ticketHandler(bot: TelegramAddon, ctx: Context) {
  if (ctx.chat.type === 'private') {
    db.getOpen(
        ctx.message.from.id,
        ctx.session.groupCategory,
        function(ticket: any) {
          if (ticket == undefined) {
            db.add(ctx.message.from.id, 'open', ctx.session.groupCategory);
          }
          users.chat(ctx, ctx.message.chat);
        },
    );
  } else {
    staff.chat(ctx);
  }
}

export {handleText, ticketHandler};
