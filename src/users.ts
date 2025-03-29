import { Context, Messenger } from './interfaces';
import cache from './cache';
import * as llm from './addons/llm';
import * as db from './db';
import { strictEscape as esc, reply, sendMessage } from './middleware';
import { ISupportee } from './db';

const TIME_BETWEEN_CONFIRMATION_MESSAGES = 86400000; // 24 hours

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
    from: { first_name: string; language_code: any };
    text: string;
  },
  tag: string,
  anon = true,
  autoReplyInfo: any,
) {
  let link = '';
  if (!anon) {
    link = `tg://user?id=${cache.userId}`;
  }
  return (
    `${cache.config.language.ticket} ` +
    `#T${ticket.toString().padStart(6, '0')} ${cache.config.language.from} ` +
    `[${esc(message.from.first_name)}](${link})` +
    ` ${cache.config.language.language}: ` +
    `${message.from.language_code} ${tag}\n\n` +
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
async function autoReply(ctx: Context) {
  const strings = cache.config.autoreply;
  for (const i in strings) {
    if (ctx.message.text.toString().indexOf(strings[i]['question']) > -1) {
      const msg = ticketMessage(strings[i]['answer']);
      // Send message with keyboard
      reply(ctx, msg);
      return true;
    }
  }
  if (cache.config.use_llm) {
    const response = await llm.getResponseFromLLM(ctx)
    if (response !== null) {
      const msg = ticketMessage(response);
      reply(ctx, msg);
      return true
    }
  }
  return false;

  function ticketMessage(msg: string) {
    return cache.config.clean_replies ? msg :
      `${cache.config.language.dear} ` +
      `${esc(ctx.message.from.first_name)},\n\n` +
      `${msg}\n\n` +
      `${cache.config.language.regards}\n` +
      `${cache.config.language.automatedReplyAuthor}\n\n` +
      `_${cache.config.language.automatedReply}_`;
  }
}

/**
 * Ticket handling and spam protection.
 * @param {context} ctx Bot context.
 * @param {chat} chat Bot chat.
 */
async function chat(ctx: Context, chat: { id: string }) {
  cache.userId = ctx.message.from.id;
  // Check if auto reply works
  let isAutoReply = false;
  if (await autoReply(ctx)) {
    isAutoReply = true;
    if (!cache.config.show_auto_replied) {
      return;
    }
  }
  const autoReplyInfo = isAutoReply ?
    cache.config.language.automatedReplySent :
    undefined;

  if (cache.ticketIDs[cache.userId] === undefined) {
    cache.ticketIDs.push(cache.userId);
  }
  cache.ticketStatus[cache.userId] = true;
  if (cache.ticketSent[cache.userId] === undefined) {
    // Get Ticket ID from DB
    db.getTicketByUserId(
      chat.id,
      ctx.session.groupCategory,
      function (ticket: ISupportee) {
        if (!isAutoReply && cache.config.autoreply_confirmation &&
          ctx.session.lastContactDate < Date.now() - TIME_BETWEEN_CONFIRMATION_MESSAGES) {
          ctx.session.lastContactDate = Date.now();
          sendMessage(
            chat.id,
            ticket.messenger,
            cache.config.language.confirmationMessage + '\n' +
            (cache.config.show_user_ticket ?
              cache.config.language.ticket +
              ' #T' +
              ticket.ticketId.toString().padStart(6, '0') :
              '')
          );
        }

        // To staff
        sendMessage(
          cache.config.staffchat_id,
          cache.config.staffchat_type,
          ticketMsg(
            ticket.ticketId,
            ctx.message,
            ctx.session.groupTag,
            cache.config.anonymous_tickets,
            autoReplyInfo,
          )
        );

        // Check if group flag is set and is not admin chat
        if (
          ctx.session.group !== '' &&
          ctx.session.group != cache.config.staffchat_id
        ) {
          // Send to group-staff chat
          sendMessage(
            ctx.session.group,
            ticket.messenger,
            ticketMsg(
              ticket.ticketId,
              ctx.message,
              ctx.session.groupTag,
              cache.config.anonymous_tickets,
              autoReplyInfo,
            ),
            cache.config.allow_private ?
              {
                parse_mode: 'none',
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
                          ticket.ticketId,
                      },
                    ],
                  ],
                },
              } : { parse_mode: cache.config.parse_mode }
          );
        }
      },
    );
    // wait 5 minutes before this message appears again and do not
    // send notification sounds in that time to avoid spam
    setTimeout(function () {
      cache.ticketSent[cache.userId] = undefined;
    }, cache.config.spam_time);
    cache.ticketSent[cache.userId] = 0;
  } else if (cache.ticketSent[cache.userId] < cache.config.spam_cant_msg) {
    cache.ticketSent[cache.userId]++;
    db.getTicketByUserId(
      cache.userId,
      ctx.session.groupCategory,
      function (ticket: ISupportee) {
        sendMessage(
          cache.config.staffchat_id,
          cache.config.staffchat_type,
          ticketMsg(
            ticket.ticketId,
            ctx.message,
            ctx.session.groupTag,
            cache.config.anonymous_tickets,
            autoReplyInfo,
          )
        );
        if (
          ctx.session.group !== '' &&
          ctx.session.group != cache.config.staffchat_id
        ) {
          sendMessage(
            ctx.session.group,
            ticket.messenger,
            ticketMsg(
              ticket.ticketId,
              ctx.message,
              ctx.session.groupTag,
              cache.config.anonymous_tickets,
              autoReplyInfo,
            )
          );
        }
      },
    );
  } else if (cache.ticketSent[cache.userId] === cache.config.spam_cant_msg) {
    cache.ticketSent[cache.userId]++;
    // eslint-disable-next-line new-cap

    sendMessage(chat.id, ctx.messenger, cache.config.language.blockedSpam);
  }
  db.getTicketByUserId(
    cache.userId,
    ctx.session.groupCategory,
    function (ticket: ISupportee) {
      console.log(
        ticketMsg(
          ticket.ticketId,
          ctx.message,
          ctx.session.groupTag,
          cache.config.anonymous_tickets,
          autoReplyInfo,
        ),
      );
    },
  );
}

export { chat };
