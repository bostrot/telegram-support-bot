import * as db from './db';
import config from '../config/config';
import * as staff from './staff';
import * as users from './users';

/**
 * Text handler
 * @param {Object} bot
 * @param {Object} ctx
 * @param {Array} keys
 */
function handleText(bot, ctx, keys) {
  if (ctx.session.mode == 'private_reply') {
    staff.privateReply(bot, ctx);
  } else if (!(JSON.stringify(config.categories)
      .indexOf(ctx.message.text) > -1)) {
    if (!ctx.session.admin && config.categories &&
    !ctx.session.group) {
      ctx.reply('Services', {
        reply_markup: {
          keyboard: keys,
        },
      });
    } else {
      ticketHandler(bot, ctx);
    }
  }
};

/**
* Decide whether to forward or stop the message.
* @param {bot} bot Bot object.
* @param {context} ctx Bot context.
*/
function ticketHandler(bot, ctx) {
  if (ctx.chat.type === 'private') {
    db.check(ctx.message.from.id, function(user) {
      if (user == undefined || user.status == undefined ||
           user.status == 'closed') {
        if (ctx.session.group !== undefined) {
          db.add(ctx.message.from.id, 'open', ctx.session.groupCategory);
        } else {
          db.add(ctx.message.from.id, 'open', undefined);
        }
        // TODO: implement type asking
        // customerChat(ctx, bot, chat);
      } else if (user.status !== 'banned') {
        users.chat(ctx, bot, ctx.message.chat);
      }
    });
  } else {
    staff.chat(ctx, bot);
  }
}

export {
  handleText,
  ticketHandler,
};
