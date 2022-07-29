import {Context} from './interfaces';
import cache from './cache';
import * as db from './db';
import * as middleware from './middleware';

/** Message template helper
 * @param {String} ticket
 * @param {Object} message
 * @param {Boolean} anon
 * @param {String} autoReplyInfo
 * @return {String} text
 */
function ticketMsg(
    ticket: { toString: () => string },
    message: {
    from: { first_name: string | any[]; language_code: any };
    text: string | any[];
  },
    anon = true,
    autoReplyInfo: any,
) {
  let link = '';
  if (!anon) {
    link = `tg://user?id=${cache.ticketID}`;
  }
  const esc: any = middleware.strictEscape;
  return (
    `${cache.config.language.ticket} ` +
    `#T${ticket.toString().padStart(6, '0')} ${cache.config.language.from} ` +
    `[${esc(message.from.first_name)}](${link})` +
    ` ${cache.config.language.language}: ` +
    `${message.from.language_code}\n\n` +
    `${esc(message.text)}\n\n` +
    (autoReplyInfo ? `_${autoReplyInfo}_` : '')
  );
}

/** Ticket auto reply for common questions
 * @param {context} ctx Bot context.
 * @param {bot} bot Bot object.
 * @param {chat} chat Bot chat.
 * @return {boolean}
 */
function autoReply(ctx: Context) {
  const strings = cache.config.autoreply;
  for (const i in strings) {
    if (ctx.message.text.toString().indexOf(strings[i]['question']) > -1) {
      // Define message
      const msg =
        `${cache.config.language.dear} ` +
        `${ctx.message.from.first_name},\n\n` +
        `${strings[i]['answer']}\n\n` +
        `${cache.config.language.regards}\n` +
        `${cache.config.language.automatedReplyAuthor}\n\n` +
        `_${cache.config.language.automatedReply}_`;

      // Send message with keyboard
      middleware.reply(ctx, msg, {parse_mode: cache.config.parse_mode});
      return true;
    }
  }
  return false;
}

/**
 * Ticket handling and spam protection.
 * @param {context} ctx Bot context.
 * @param {chat} chat Bot chat.
 */
function chat(ctx: Context, chat: { id: string }) {
  cache.ticketID = ctx.message.from.id;
  // Check if auto reply works
  let isAutoReply = false;
  if (autoReply(ctx)) {
    isAutoReply = true;
    if (!cache.config.show_auto_replied) {
      return;
    }
  }
  const autoReplyInfo = isAutoReply ?
    cache.config.language.automatedReplySent :
    undefined;

  if (cache.ticketIDs[cache.ticketID] === undefined) {
    cache.ticketIDs.push(cache.ticketID);
  }
  cache.ticketStatus[cache.ticketID] = true;
  if (cache.ticketSent[cache.ticketID] === undefined) {
    // Get Ticket ID from DB
    db.getOpen(
        chat.id,
        ctx.session.groupCategory,
        function(ticket: { id: string }) {
          if (!isAutoReply) {
            middleware.msg(
                chat.id,
                cache.config.language.contactMessage +
              (cache.config.show_user_ticket ?
                cache.config.language.yourTicketId +
                  ' #T' +
                  ticket.id.toString().padStart(6, '0') :
                ''),
                {parse_mode: cache.config.parse_mode},
            );
          }

          // To staff
          middleware.msg(
              cache.config.staffchat_id,
              ticketMsg(
                  ticket.id,
                  ctx.message,
                  cache.config.anonymous_tickets,
                  autoReplyInfo,
              ),
              {parse_mode: cache.config.parse_mode},
          );

          // Check if group flag is set and is not admin chat
          if (
            ctx.session.group !== '' &&
          ctx.session.group != cache.config.staffchat_id
          ) {
          // Send to group-staff chat
            middleware.msg(
                ctx.session.group,
                ticketMsg(
                    ticket.id,
                    ctx.message,
                    cache.config.anonymous_tickets,
                    autoReplyInfo,
                ),
            cache.config.allow_private ?
              {
                parse_mode: 'HTML',
                reply_markup: {
                  html: '',
                  inline_keyboard: [
                    [
                      {
                        text: cache.config.language.replyPrivate,
                        callback_data:
                            ctx.from.id +
                            '---' +
                            ctx.message.from.first_name +
                            '---' +
                            ctx.session.groupCategory +
                            '---' +
                            ticket.id,
                      },
                    ],
                  ],
                },
              } :
              {
                parse_mode: 'HTML',
              },
            );
          }
        },
    );
    // wait 5 minutes before this message appears again and do not
    // send notification sounds in that time to avoid spam
    setTimeout(function() {
      cache.ticketSent[cache.ticketID] = undefined;
    }, cache.config.spam_time);
    cache.ticketSent[cache.ticketID] = 0;
  } else if (cache.ticketSent[cache.ticketID] < cache.config.spam_cant_msg) {
    cache.ticketSent[cache.ticketID]++;
    db.getOpen(
        cache.ticketID,
        ctx.session.groupCategory,
        function(ticket: { id: { toString: () => string } }) {
          middleware.msg(
              cache.config.staffchat_id,
              ticketMsg(
                  ticket.id,
                  ctx.message,
                  cache.config.anonymous_tickets,
                  autoReplyInfo,
              ),
              {parse_mode: cache.config.parse_mode},
          );
          if (ctx.session.group !== '') {
            middleware.msg(
                ctx.session.group,
                ticketMsg(
                    ticket.id,
                    ctx.message,
                    cache.config.anonymous_tickets,
                    autoReplyInfo,
                ),
                {parse_mode: cache.config.parse_mode},
            );
          }
        },
    );
  } else if (cache.ticketSent[cache.ticketID] === cache.config.spam_cant_msg) {
    cache.ticketSent[cache.ticketID]++;
    // eslint-disable-next-line new-cap

    middleware.msg(chat.id, cache.config.language.blockedSpam, {
      parse_mode: cache.config.parse_mode,
    });
  }
  db.getOpen(
      cache.ticketID,
      ctx.session.groupCategory,
      function(ticket: { id: { toString: () => string } }) {
        console.log(
            ticketMsg(
                ticket.id,
                ctx.message,
                cache.config.anonymous_tickets,
                autoReplyInfo,
            ),
        );
      },
  );
}

export {chat};
