import config from '../config/config';
import cache from './cache';
const {Extra} = require('telegraf');
import * as middleware from './middleware';
import * as db from './db';

/** Message template helper
 * @param {String} name
 * @param {Object} message
 * @param {Boolean} anon
 * @return {String} text
 */
function ticketMsg(name, message) {
  return `${config.language.dear} <b>`+
    `${name}</b>,\n\n`+
    `${middleware.escapeText(message.text)}\n\n`+
    `${config.language.regards}\n`+
    `${message.from.first_name}`;
}

/**
 * Private chat
 * @param {Object} bot
 * @param {Object} ctx
 */
function privateReply(bot, ctx, msg = undefined) {
  if (msg == undefined)
    msg = ctx.message;
  // Msg to other end
  bot.telegram.sendMessage(
    ctx.session.modeData.userid,
    ticketMsg(` ${ctx.session.modeData.name}`, msg),
    {
      parse_mode: 'html',
      reply_markup: {
        html: '',
        inline_keyboard: [
          [
            config.direct_reply ?
            {
              'text': config.language.replyPrivate,
              'url': `https://t.me/${ctx.from.username}`,
            } :
            {
              'text': config.language.replyPrivate,
              'callback_data': ctx.from.id +
              '---' + ctx.message.from.first_name + '---' + ctx.session.modeData.category +
              '---' + ctx.session.modeData.ticketid
            },
          ],
        ],
      },
    }
  );
  // Confirmation message
  bot.telegram.sendMessage(
    ctx.from.id,
    config.language.msg_sent);
}

/**
 * Reply to tickets in staff chat.
 * @param {context} ctx Bot context.
 * @param {bot} bot Bot object.
 */
function chat(ctx, bot) {
  let replyText = '';
  // check whether person is an admin
  if (!ctx.session.admin) {
    return;
  }
  // try whether a text or an image/video is replied to
  try {
    // replying to non-ticket
    if (ctx.message == undefined ||
      ctx.message.reply_to_message == undefined) {
      return;
    }
    replyText = ctx.message.reply_to_message.text;
    if (replyText === undefined) {
      replyText = ctx.message.reply_to_message.caption;
    }

    let userid = replyText.match(new RegExp('#T' +
        '(.*)' + ' ' + config.language.from));
    if (userid === null || userid === undefined) {
      userid = replyText.match(new RegExp('#T' +
          '(.*)' + '\n' + config.language.from));
    }

    // replying to non-ticket
    if (userid === null || userid === undefined) {
        return;
    }

    db.getOpen(userid[1], ctx.session.groupCategory, function(ticket) {
            const name = replyText.match(new RegExp(
          config.language.from + ' ' + '(.*)' + ' ' +
      config.language.language));
      // replying to closed ticket
      if (userid === null || ticket == undefined) {
        ctx.reply(config.language.ticketClosedError);
      }
      
      // replying to non-ticket
      if (ticket == undefined) {
        return;
      }
      cache.ticketStatus[userid[1]] = false;

      // To user
      // Web user
      if (ticket.userid.indexOf('WEB') > -1) {
        try {
          let socket_id = ticket.userid.split('WEB')[1];
          cache.io.to(socket_id).emit('chat_staff', ticketMsg(name[1], ctx.message));
        } catch(e) {
          // To staff msg error
          bot.telegram.sendMessage(ctx.chat.id,
              `Web chat already closed.`,
              // eslint-disable-next-line new-cap
              Extra.HTML().notifications(false)
          );
          console.log(e);
        }
      } else {
        bot.telegram.sendMessage(ticket.userid,
          ticketMsg(name[1], ctx.message),
          // eslint-disable-next-line new-cap
          Extra.HTML()
        );
      }
      
      // To staff msg sent
      bot.telegram.sendMessage(ctx.chat.id,
          `${config.language.msg_sent} ${name[1]}`,
          // eslint-disable-next-line new-cap
          Extra.HTML().notifications(false)
      );
      console.log(`Answer: `+ ticketMsg(name[1], ctx.message));
      cache.ticketSent[userid[1]] = undefined;
      // Check if auto close ticket
      if (config.auto_close_tickets) {
        db.add(userid[1], 'closed', undefined);
      }
    });
  } catch (e) {
    console.log(e);
    bot.telegram.sendMessage(
        config.staffchat_id, `An error occured, please 
          report this to your admin: \n\n ${e}`,
        // eslint-disable-next-line new-cap
        Extra.HTML().notifications(false)
    );
  }
}

export {
  privateReply,
  chat,
};
