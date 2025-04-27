import * as db from './db';
import cache from './cache';
import * as middleware from './middleware';
import { Addon, Context, ModeData } from './interfaces';
import { ISupportee } from './db';

/**
 * Generates the reply markup for a private reply.
 *
 * @param ctx - The current bot context.
 * @returns The reply markup object.
 */
const replyMarkup = (ctx: Context): object => {
  const { config } = cache;
  const { language, direct_reply } = config;
  const { from, message, session } = ctx;
  const { modeData } = session;
  return {
    html: '',
    inline_keyboard: [
      [
        direct_reply
          ? {
            text: language.replyPrivate,
            url: `https://t.me/${from.username}`,
          }
          : {
            text: language.replyPrivate,
            callback_data: `${from.id}---${message.from.first_name}---${modeData.category}---${modeData.ticketid}`,
          },
      ],
    ],
  };
};

/**
 * Handles forwarding of files (document, photo, video) to staff.
 *
 * @param type - The type of file ('document', 'photo', or 'video').
 * @param bot - The bot addon instance.
 * @param ctx - The bot context.
 */
async function fileHandler(type: string, bot: Addon, ctx: Context) {
  const { message, session } = ctx;
  const { config } = cache;
  let userid: string | null;
  let replyText = '';

  // If replying to a message and if the session is admin, extract ticket info
  if (message && message.reply_to_message?.text && session.admin) {
    replyText = message.reply_to_message.text || message.reply_to_message.caption;
    if (!replyText) return;
    userid = await (await db.getTicketByInternalId(message.external_reply.message_id)).userid;
    if (!userid) return;
  }
  if (!userid) {
    userid = message.from.id;
  }

  const userInfo = await forwardFile(ctx);
  let receiverId: string | number = config.staffchat_id;
  let isPrivate = false;

  const ticket = await db.getTicketByUserId(userid, session.groupCategory);
  if (!ticket) {
    if (session.admin && userInfo === undefined) {
      middleware.reply(ctx, config.language.ticketClosedError);
    } else {
      middleware.reply(ctx, config.language.textFirst);
    }
    return;
  }

  let captionText = `${config.language.ticket} #T${ticket.id
    .toString()
    .padStart(6, '0')} ${userInfo}\n${message.caption || ''}`;
  if (session.admin && userInfo === undefined) {
    receiverId = ticket.userid;
    captionText = message.caption || '';
  }
  if (session.modeData?.userid != null) {
    receiverId = session.modeData.userid;
    isPrivate = true;
  }

  const fileId = (await ctx.getFile()).file_id;
  const commonOptions = {
    caption: captionText,
    reply_markup: isPrivate ? replyMarkup(ctx) : {},
  };

  // Send the file based on its type
  var messageId = null;
  switch (type) {
    case 'document':
      messageId = await bot.sendDocument(receiverId, fileId, commonOptions);
      if (
        session.group !== '' &&
        session.group !== config.staffchat_id &&
        JSON.stringify(session.modeData) !== JSON.stringify({})
      ) {
        bot.sendDocument(session.group, fileId, {
          caption: captionText,
          reply_markup: {
            html: '',
            inline_keyboard: [
              [
                {
                  text: config.language.replyPrivate,
                  callback_data: `${ctx.from.id}---${message.from.first_name}---${session.groupCategory}---${ticket.id}`,
                },
              ],
            ],
          },
        });
      } 
      break;
    case 'photo':
      messageId = await bot.sendPhoto(receiverId, fileId, commonOptions);
      if (
        session.group !== '' &&
        session.group !== config.staffchat_id &&
        JSON.stringify(session.modeData) !== JSON.stringify({})
      ) {
        bot.sendPhoto(session.group, fileId, {
          caption: captionText,
          reply_markup: {
            html: '',
            inline_keyboard: [
              [
                {
                  text: config.language.replyPrivate,
                  callback_data: `${ctx.from.id}---${message.from.first_name}---${session.groupCategory}---${ticket.id}`,
                },
              ],
            ],
          },
        });
      }
      break;
    case 'video':
      messageId = await bot.sendVideo(receiverId, fileId, commonOptions);
      if (
        session.group !== '' &&
        session.group !== config.staffchat_id &&
        JSON.stringify(session.modeData) !== JSON.stringify({})
      ) {
        bot.sendVideo(session.group, fileId, {
          caption: captionText,
          reply_markup: {
            html: '',
            inline_keyboard: [
              [
                {
                  text: config.language.replyPrivate,
                  callback_data: `${ctx.from.id}---${message.from.first_name}---${session.groupCategory}---${ticket.id}`,
                },
              ],
            ],
          },
        });
      }
      break;
  }
  db.addIdAndName(ticket.ticketId, messageId, ctx.message.from.first_name);

  // Send confirmation message if enabled
  if (!config.autoreply_confirmation) return;
  let confirmationMessage = `${config.language.confirmationMessage}${config.show_user_ticket
    ? config.language.yourTicketId + ' #T' + ticket.id.toString().padStart(6, '0')
    : ''
    }`;
  if (session.admin && userInfo === undefined) {
    const nameMatch = replyText.match(
      new RegExp(`${config.language.from} (.*) ${config.language.language}`)
    );
    if (!nameMatch) return;
    confirmationMessage = `${config.language.file_sent} ${nameMatch[1]}`;
  }
  middleware.sendMessage(ctx.chat.id, ticket.messenger, confirmationMessage);
};

/**
 * Handles file forwarding with caching and spam protection.
 *
 * @param ctx - The bot context.
 * @param callback - Callback function receiving user information.
 */
async function forwardFile(ctx: Context) {
  const ticket = await db.getTicketByUserId(ctx.message.from.id, ctx.session.groupCategory);
  let ok = false;
  if (!ticket || !ticket.status || ticket.status === 'closed') {
    db.add(ctx.message.from.id, 'open', null, ctx.messenger);
    ok = true;
  }
  if (ok || (ticket && ticket.status !== 'banned')) {
    if (cache.ticketSent[cache.userId] === undefined) {
      setTimeout(() => {
        cache.ticketSent[cache.userId] = undefined;
      }, cache.config.spam_time);
      cache.ticketSent[cache.userId] = 0;
      return forwardHandler(ctx);
    } else if (cache.ticketSent[cache.userId] < cache.config.spam_cant_msg) {
      cache.ticketSent[cache.userId]++;
      return forwardHandler(ctx);
    } else if (cache.ticketSent[cache.userId] === cache.config.spam_cant_msg) {
      cache.ticketSent[cache.userId]++;
      middleware.sendMessage(ctx.chat.id, ticket.messenger, cache.config.language.blockedSpam, {});
    }
  }
};

/**
 * Determines if the message comes from a private chat and returns user info.
 *
 * @param ctx - The bot context.
 * @param callback - Callback function receiving user info (or undefined).
 */
function forwardHandler(ctx: Context) {
  if (ctx.chat.type === 'private') {
    cache.userId = ctx.message.from.id;
    const userInfo = `${cache.config.language.from} ${ctx.message.from.first_name} ${cache.config.language.language}: ${ctx.message.from.language_code}\n\n`;
    return userInfo;
  } else {
    return undefined;
  }
};

export { fileHandler, forwardFile, forwardHandler };
