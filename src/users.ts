import * as db from './db';
import cache from './cache';
import config from '../config/config';
import strings from '../config/strings';
import * as middleware from './middleware';
const {Extra} = require('telegraf');

/** Message template helper
 * @param {String} ticket
 * @param {Object} message
 * @param {Boolean} anon
 * @return {String} text
 */
function ticketMsg(ticket, message, anon = true, autoReplyInfo) {
  let link = '';
  if (!anon) {
    link = `tg://user?id=${cache.ticketID}`;
  }
  return `${config.language.ticket} ` +
          `#T${ticket.toString().padStart(6, '0')} ${config.language.from} ` +
          `<a href="${link}">` +
          `${message.from.first_name}</a> ${config.language.language}: ` +
          `${message.from.language_code}\n\n` +
          `${middleware.escapeText(message.text)}\n\n` + 
          `<i>${autoReplyInfo}</i>`;
}

/** Ticket auto reply for common questions
 * @param {context} ctx Bot context.
 * @param {bot} bot Bot object.
 * @param {chat} chat Bot chat.
 */
function autoReply(ctx, bot, chat) {
  for (let i in strings) {
    if (ctx.message.text.toString().indexOf(strings[i][0]) > -1) {
      // Define message
      let msg = `${config.language.dear} <b>`+
        `${ctx.message.from.first_name}</b>,\n\n`+
        `${middleware.escapeText(strings[i][1])}\n\n`+
        `${config.language.regards}\n`+
        `${config.language.automatedReplyAuthor}\n\n`+
        `<i>${config.language.automatedReply}</i>`;

      // Send message with keyboard
      ctx.reply(msg, Extra.HTML())
      return true;
    }
  }
  return false;
}

/**
 * Ticket handling and spam protection.
 * @param {context} ctx Bot context.
 * @param {bot} bot Bot object.
 * @param {chat} chat Bot chat.
 */
function chat(ctx, bot, chat) {
  cache.ticketID = ctx.message.from.id;
  // Check if auto reply works
  let isAutoReply = false;
  if (autoReply(ctx, bot, chat))
    isAutoReply = true;
  const autoReplyInfo = isAutoReply ? `<i>${config.language.automatedReplySent}</i>` : ''

  if (cache.ticketIDs[cache.ticketID] === undefined) {
    cache.ticketIDs.push(cache.ticketID);
  }
  cache.ticketStatus[cache.ticketID] = true;
  if (cache.ticketSent[cache.ticketID] === undefined) {
    // Get Ticket ID from DB
    // eslint-disable-next-line new-cap
    if (!isAutoReply)
      middleware.message(bot, chat.id, config.language.contactMessage, Extra.HTML());
    // Get Ticket ID from DB1
    db.getOpen(chat.id, ctx.session.groupCategory, function(ticket) {
      
      // To staff
      middleware.message(bot, config.staffchat_id, ticketMsg(ticket.id, ctx.message, config.anonymous_tickets, autoReplyInfo),
      Extra.HTML());
      
      // Check if group flag is set and is not admin chat
      if (ctx.session.group !== undefined &&
        ctx.session.group != config.staffchat_id) {
        // Send to group-staff chat
      middleware.message(bot, ctx.session.group, ticketMsg(ticket.id, ctx.message, config.anonymous_tickets, autoReplyInfo), config.allow_private ? {
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
      });

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
      middleware.message(bot, config.staffchat_id, 
        ticketMsg(ticket.id, ctx.message, config.anonymous_tickets, autoReplyInfo),
        Extra.HTML());
      if (ctx.session.group !== undefined) {
        middleware.message(bot, ctx.session.group, ticketMsg(ticket.id, ctx.message, config.anonymous_tickets, autoReplyInfo),
          Extra.HTML());
      }
    });
  } else if (cache.ticketSent[cache.ticketID] === 4) {
    cache.ticketSent[cache.ticketID]++;
    // eslint-disable-next-line new-cap
    
    middleware.message(bot, chat.id, config.language.blockedSpam, Extra.HTML());
  }
  db.getOpen(cache.ticketID, ctx.session.groupCategory, function(ticket) {
    console.log(ticketMsg(ticket.id, ctx.message, config.anonymous_tickets, autoReplyInfo));
  });
}

export {
  chat,
};
