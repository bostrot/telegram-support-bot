import cache from './cache';
import * as middleware from './middleware';
import * as db from './db';
import { Context } from './interfaces';

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
  middleware.msg(
    ctx.session.modeData.userid,
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
  middleware.msg(ctx.chat.id, cache.config.language.msg_sent, {});
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

    let userid = replyText.match(
      new RegExp('#T' + '(.*)' + ' ' + cache.config.language.from),
    );
    if (userid === null || userid === undefined) {
      userid = replyText.match(
        new RegExp('#T' + '(.*)' + '\n' + cache.config.language.from),
      );
    }

    // replying to non-ticket
    if (userid === null || userid === undefined) {
      return;
    }

    db.getOpen(
      userid[1],
      ctx.session.groupCategory,
      function (ticket: { userid: string }) {
        if (userid === null || userid === undefined) {
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
        if (userid === null || ticket == undefined) {
          middleware.reply(ctx, cache.config.language.ticketClosedError);
        }

        // replying to non-ticket
        if (ticket == undefined || name == null || name == undefined) {
          return;
        }
        cache.ticketStatus[userid[1]] = false;

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
            middleware.msg(
              ctx.chat.id,
              `Web chat already closed.`,
              {
                parse_mode: cache.config.parse_mode,
              }, /* .notifications(false) */
            );
            console.log(e);
          }
        } else {
          middleware.msg(
            ticket.userid,
            ticketMsg(name[1], ctx.message),
            // eslint-disable-next-line new-cap
            { parse_mode: cache.config.parse_mode },
          );
        }
        const esc: any = middleware.strictEscape;
        // To staff msg sent
        middleware.msg(
          ctx.chat.id,
          `${cache.config.language.msg_sent} ${esc(name[1])}`,
          // eslint-disable-next-line new-cap
          { parse_mode: cache.config.parse_mode }, /* .notifications(false) */
        );
        console.log(`Answer: ` + ticketMsg(name[1], ctx.message));
        cache.ticketSent[userid[1]] = null;
        // Check if auto close ticket
        if (cache.config.auto_close_tickets) {
          db.add(userid[1], 'closed', null);
        }
      },
    );
  } catch (e) {
    console.log(e);
    middleware.msg(
      cache.config.staffchat_id,
      `An error occured, please 
          report this to your admin: \n\n ${e}`,
      // eslint-disable-next-line new-cap
      { parse_mode: cache.config.parse_mode }, /* .notifications(false) */
    );
  }
}

export { privateReply, chat };
