import strings from '../config/strings';
import cache from './cache';
import * as db from './db';
import * as middleware from './middleware';
const { Extra } = require('telegraf');

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
  return `${cache.config.language.ticket} ` +
    `#T${ticket.toString().padStart(6, '0')} ${cache.config.language.from} ` +
    `<a href="${link}">` +
    `${middleware.escapeText(message.from.first_name)}</a> ${cache.config.language.language}: ` +
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
      let msg = `${cache.config.language.dear} ` +
        `${middleware.escapeText(ctx.message.from.first_name)},\n\n` +
        `${middleware.escapeText(strings[i][1])}\n\n` +
        `${cache.config.language.regards}\n` +
        `${cache.config.language.automatedReplyAuthor}\n\n` +
        `<i>${cache.config.language.automatedReply}</i>`;

      // Send message with keyboard
      middleware.reply(ctx, msg);
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
  const autoReplyInfo = isAutoReply ? `<i>${cache.config.language.automatedReplySent}</i>` : ''

  if (cache.ticketIDs[cache.ticketID] === undefined) {
    cache.ticketIDs.push(cache.ticketID);
  }
  cache.ticketStatus[cache.ticketID] = true;
  if (cache.ticketSent[cache.ticketID] === undefined) {
    // Get Ticket ID from DB
    db.getOpen(chat.id, ctx.session.groupCategory, function (ticket) {

      if (!isAutoReply)
        middleware.msg(chat.id, cache.config.language.contactMessage +
          (cache.config.show_user_ticket ? cache.config.language.yourTicketId + ' #T' +
            ticket.id.toString().padStart(6, '0') : ''), Extra.HTML());

      // To staff
      middleware.msg(cache.config.staffchat_id, ticketMsg(ticket.id, ctx.message, cache.config.anonymous_tickets, autoReplyInfo),
        Extra.HTML());

      // Check if group flag is set and is not admin chat
      if (ctx.session.group !== undefined &&
        ctx.session.group != cache.config.staffchat_id) {
        // Send to group-staff chat
        middleware.msg(ctx.session.group, ticketMsg(ticket.id, ctx.message, cache.config.anonymous_tickets, autoReplyInfo), cache.config.allow_private ? {
          parse_mode: 'html',
          reply_markup: {
            html: '',
            inline_keyboard: [
              [
                {
                  'text': cache.config.language.replyPrivate,
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
    // send notification sounds in that time to avoid spam
    setTimeout(function () {
      cache.ticketSent[cache.ticketID] = undefined;
    }, cache.config.spam_time);
    cache.ticketSent[cache.ticketID] = 0;
  } else if (cache.ticketSent[cache.ticketID] < cache.config.spam_cant_msg) {
    cache.ticketSent[cache.ticketID]++;
    db.getOpen(cache.ticketID, ctx.session.groupCategory, function (ticket) {
      middleware.msg(cache.config.staffchat_id,
        ticketMsg(ticket.id, ctx.message, cache.config.anonymous_tickets, autoReplyInfo),
        Extra.HTML());
      if (ctx.session.group !== undefined) {
        middleware.msg(ctx.session.group, ticketMsg(ticket.id, ctx.message, cache.config.anonymous_tickets, autoReplyInfo),
          Extra.HTML());
      }
    });
  } else if (cache.ticketSent[cache.ticketID] === cache.config.spam_cant_msg) {
    cache.ticketSent[cache.ticketID]++;
    // eslint-disable-next-line new-cap

    middleware.msg(chat.id, cache.config.language.blockedSpam, Extra.HTML());
  }
  db.getOpen(cache.ticketID, ctx.session.groupCategory, function (ticket) {
    console.log(ticketMsg(ticket.id, ctx.message, cache.config.anonymous_tickets, autoReplyInfo));
  });
}

export {
  chat,
};

