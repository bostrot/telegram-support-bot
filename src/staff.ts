import cache from './cache';
import * as middleware from './middleware';
import * as db from './db';
import { Context } from './interfaces';
import { ISupportee } from './db';

/** Message template helper
 * @param {String} name
 * @param {Object} message
 * @param {Boolean} anon
 * @return {String} text
 */
function ticketMsg(
  name: string,
  message: { text: any; from: { first_name: any } },
) {
  const esc: any = middleware.strictEscape;
  if (cache.config.clean_replies) {
    return esc(message.text)
  }
  if (cache.config.anonymous_replies) {
    return (
      `${cache.config.language.dear} ` +
      `${esc(name)},\n\n` +
      `${esc(message.text)}\n\n` +
      `${cache.config.language.regards}\n` +
      `${cache.config.language.regardsGroup}`
    );
  }
  return (
    `${cache.config.language.dear} ` +
    `${esc(name)},\n\n` +
    `${esc(message.text)}\n\n` +
    `${cache.config.language.regards}\n` +
    `${esc(message.from.first_name)}`
  );
}

/**
 * Private chat
 * @param {Object} ctx
 * @param {Object} msg
 */
function privateReply(ctx: Context, msg: any = {}) {
  if (msg.length === 0) {
    msg = ctx.message;
  }
  // Msg to other end
  middleware.sendMessage(
    ctx.session.modeData.userid,
    ctx.messenger, // TODO: check this
    ticketMsg(` ${ctx.session.modeData.name}`, msg),
    {
      parse_mode: cache.config.parse_mode,
      reply_markup: {
        html: '',
        inline_keyboard: [
          [
            cache.config.direct_reply ?
              {
                text: cache.config.language.replyPrivate,
                url: `https://t.me/${ctx.from.username}`,
              } :
              {
                text: cache.config.language.replyPrivate,
                callback_data:
                  ctx.from.id +
                  '---' +
                  ctx.message.from.first_name +
                  '---' +
                  ctx.session.modeData.category +
                  '---' +
                  ctx.session.modeData.ticketid,
              },
          ],
        ],
      },
    },
  );
  // Confirmation message
  middleware.sendMessage(ctx.chat.id, ctx.messenger, cache.config.language.msg_sent, {});
}

/**
 * Reply to tickets in staff chat.
 * @param {Context} ctx Bot context.
 */
function chat(ctx: Context) {
  let replyText = '';
  // check whether person is an admin
  if (!ctx.session.admin) {
    return;
  }
  // try whether a text or an image/video is replied to
  try {
    // replying to non-ticket
    if (ctx.message == undefined || ctx.message.reply_to_message == undefined) {
      return;
    }
    replyText = ctx.message.reply_to_message.text;
    if (replyText === undefined) {
      replyText = ctx.message.reply_to_message.caption;
    }

    let ticketId = replyText.match(
      new RegExp('#T' + '(.*)' + ' ' + cache.config.language.from),
    );
    if (ticketId === null || ticketId === undefined) {
      ticketId = replyText.match(
        new RegExp('#T' + '(.*)' + '\n' + cache.config.language.from),
      );
    }

    // replying to non-ticket
    if (ticketId === null || ticketId === undefined) {
      return;
    }

    db.getTicketById(
      ticketId[1],
      ctx.session.groupCategory,
      function (ticket: ISupportee) {
        if (ticketId === null || ticketId === undefined) {
          return;
        }
        const name = replyText.match(
          new RegExp(
            cache.config.language.from +
            ' ' +
            '(.*)' +
            ' ' +
            cache.config.language.language,
          ),
        );
        // replying to closed ticket
        if (ticketId === null || ticket == undefined) {
          middleware.reply(ctx, cache.config.language.ticketClosedError);
        }

        // replying to non-ticket
        if (ticket == undefined || name == null || name == undefined) {
          return;
        }
        cache.ticketStatus[ticketId[1]] = false;

        // To user
        // Web user
        if (ticket.userid.indexOf('WEB') > -1) {
          try {
            const socketId = ticket.userid.split('WEB')[1];
            cache.io
              .to(socketId)
              .emit('chat_staff', ticketMsg(name[1], ctx.message));
          } catch (e) {
            // To staff msg error
            middleware.sendMessage(
              ctx.chat.id,
              ticket.messenger,
              `Web chat already closed.`
            );
            console.log(e);
          }
        } else {
          middleware.sendMessage(
            ticket.userid,
            ticket.messenger,
            ticketMsg(name[1], ctx.message)
          );
        }
        const esc: any = middleware.strictEscape;
        // To staff msg sent
        middleware.sendMessage(
          ctx.chat.id,
          cache.config.staffchat_type,
          `${cache.config.language.msg_sent} ${esc(name[1])}`,
        );
        console.log(`Answer: ` + ticketMsg(name[1], ctx.message));
        cache.ticketSent[ticketId[1]] = null;
        // Check if auto close ticket
        if (cache.config.auto_close_tickets) {
          db.add(ticketId[1], 'closed', null, ticket.messenger);
        }
      },
    );
  } catch (e) {
    console.log(e);
    middleware.sendMessage(
      cache.config.staffchat_id,
      cache.config.staffchat_type,
      `An error occured, please report this to your admin: \n\n ${e}`
    );
  }
}

export { privateReply, chat };
