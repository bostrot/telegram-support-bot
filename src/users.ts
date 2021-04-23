import * as db from './db';
import cache from './cache';
import config from '../config/config';
import * as middleware from './middleware';
const {Extra} = require('telegraf');

/** Message template helper
 * @param {String} ticket
 * @param {Object} message
 * @param {Boolean} anon
 * @return {String} text
 */
function ticketMsg(ticket, message, anon = true) {
  let link = '';
  if (!anon) {
    link = `tg://user?id=${cache.ticketID}`;
  }
  return `${config.language.ticket} ` +
          `#T${ticket.toString().padStart(6, '0')} ${config.language.from} ` +
          `<a href="${link}">` +
          `${message.from.first_name}</a> ${config.language.language}: ` +
          `${message.from.language_code}\n\n` +
          `${middleware.escapeText(message.text)}`;
}

/**
 * Ticket handling and spam protection.
 * @param {context} ctx Bot context.
 * @param {bot} bot Bot object.
 * @param {chat} chat Bot chat.
 */
function chat(ctx, bot, chat) {
  cache.ticketID = ctx.message.from.id;
  if (cache.ticketIDs[cache.ticketID] === undefined) {
    cache.ticketIDs.push(cache.ticketID);
  }
  cache.ticketStatus[cache.ticketID] = true;
  if (cache.ticketSent[cache.ticketID] === undefined) {
    // Get Ticket ID from DB
    // eslint-disable-next-line new-cap
    bot.telegram.sendMessage(chat.id, config.language.contactMessage, Extra.HTML());
    // Get Ticket ID from DB
    db.getOpen(chat.id, ctx.session.groupCategory, function(ticket) {
      // To staff
      bot.telegram.sendMessage(config.staffchat_id,
          ticketMsg(ticket.id, ctx.message),
          // eslint-disable-next-line new-cap
          Extra.HTML()
      );
      // Check if group flag is set and is not admin chat
      if (ctx.session.group !== undefined &&
        ctx.session.group != config.staffchat_id) {
        // Send to group-staff chat
        bot.telegram.sendMessage(
            ctx.session.group,
            ticketMsg(ticket.id, ctx.message),
            config.allow_private ? {
              parse_mode: 'html',
              reply_markup: {
                html: '',
                inline_keyboard: [
                  [
                    {
                      'text': config.language.replyPrivate,
                      'callback_data': ctx.from.id +
                      '---' + ctx.message.from.first_name + '---' + ctx.session.groupCategory +
                      '---' + ticket.id 
                    }
                  ],
                ],
              },
            } : {
              parse_mode: 'html',
            }
        );
      }
    });
    // wait 5 minutes before this message appears again and do not
    // send notificatoin sounds in that time to avoid spam
    setTimeout(function() {
      cache.ticketSent[cache.ticketID] = undefined;
    }, config.spam_time);
    cache.ticketSent[cache.ticketID] = 0;
  } else if (cache.ticketSent[cache.ticketID] < 4) {
    cache.ticketSent[cache.ticketID]++;
    db.getOpen(cache.ticketID, ctx.session.groupCategory, function(ticket) {
      bot.telegram.sendMessage(config.staffchat_id,
          ticketMsg(ticket.id, ctx.message),
          // eslint-disable-next-line new-cap
          Extra.HTML()
      );
      if (ctx.session.group !== undefined) {
        bot.telegram.sendMessage(
            ctx.session.group,
            ticketMsg(ticket.id, ctx.message),
            // eslint-disable-next-line new-cap
            Extra.HTML()
        );
      }
    });
  } else if (cache.ticketSent[cache.ticketID] === 4) {
    cache.ticketSent[cache.ticketID]++;
    // eslint-disable-next-line new-cap
    bot.telegram.sendMessage(chat.id, config.language.blockedSpam, Extra.HTML());
  }
  db.getOpen(cache.ticketID, ctx.session.groupCategory, function(ticket) {
    console.log(ticketMsg(ticket.id, ctx.message));
  });
}

export {
  chat,
};
