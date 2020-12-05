const db = require('./db');
const cache = require('./cache');
const config = require('../config/config');
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
    link = `tg://user?id=${cache.tickedID}`;
  }
  return `${config.lang_ticket} ` +
          `#T${ticket.toString().padStart(6, '0')} ${config.lang_from} ` +
          `<a href="${link}">` +
          `${message.from.first_name}</a> ${config.lang_language}: ` +
          `${message.from.language_code}\n\n` +
          `${message.text}`;
}

/**
 * Ticket handling and spam protection.
 * @param {context} ctx Bot context.
 * @param {bot} bot Bot object.
 * @param {chat} chat Bot chat.
 */
function chat(ctx, bot, chat) {
  cache.tickedID = ctx.message.from.id;
  if (cache.ticketIDs[cache.ticketID] === undefined) {
    cache.ticketIDs.push(cache.tickedID);
  }
  cache.ticketStatus[cache.tickedID] = true;
  if (cache.ticketSent[cache.tickedID] === undefined) {
    // Get Ticket ID from DB
    // eslint-disable-next-line new-cap
    bot.telegram.sendMessage(chat.id, config.lang_contactMessage, Extra.HTML());
    // Get Ticket ID from DB
    db.check(chat.id, function(ticket) {
      bot.telegram.sendMessage(config.staffchat_id,
          ticketMsg(ticket.id, ctx.message),
          // eslint-disable-next-line new-cap
          Extra.HTML()
      );
      if (ctx.session.group !== undefined) {
        bot.telegram.sendMessage(
            ctx.session.group,
            ticketMsg(ticket.id, ctx.message),
            {
              parse_mode: 'html',
              reply_markup: {
                html: '',
                inline_keyboard: [
                  [
                    {
                      'text': 'Reply in private',
                      'callback_data': ticket.id.toString().padStart(6, '0')}],
                ],
              },
            }
        );
      }
    });
    // wait 5 minutes before this message appears again and do not
    // send notificatoin sounds in that time to avoid spam
    setTimeout(function() {
      cache.ticketSent[cache.tickedID] = undefined;
    }, config.spam_time);
    cache.ticketSent[cache.tickedID] = 0;
  } else if (cache.ticketSent[cache.tickedID] < 4) {
    cache.ticketSent[cache.tickedID]++;
    db.check(cache.tickedID, function(ticket) {
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
  } else if (cache.ticketSent[cache.tickedID] === 4) {
    cache.ticketSent[cache.tickedID]++;
    // eslint-disable-next-line new-cap
    bot.telegram.sendMessage(chat.id, config.lang_blockedSpam, Extra.HTML());
  }
  db.check(cache.tickedID, function(ticket) {
    console.log(ticketMsg(ticket.id, ctx.message));
  });
}

module.exports = {
  chat,
};
