import * as db from './db';
import cache from './cache';
import { buildInlineKeyboard, reply, sendMessage } from './middleware';
import { Addon, Context, ModeData } from './interfaces';
import { ISupportee } from './db';
import * as log from './logger'

const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Generates the reply markup for a private reply.
 *
 * @param ctx - The current bot context.
 * @returns The reply markup object.
 */
const replyMarkup = (ctx: Context): { html: string; inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>> } => {
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
  let userid: string | null = null;
  let replyText = '';

  // If replying to a message and if the session is admin, extract ticket info
  if (message && message.reply_to_message?.text && session.admin) {
    replyText = message.reply_to_message.text || message.reply_to_message.caption;
    if (!replyText) return;
    const externalReplyId = message.external_reply?.message_id ?? null;
    if (externalReplyId) {
      const ticket = await db.getTicketByInternalId(externalReplyId);
      userid = ticket?.userid ?? null;
    }
  }
  if (!userid) {
    userid = message.from.id;
  }

  const userInfo = await forwardFile(ctx);
  let receiverId: string | number = config.staffchat_id;
  let isPrivate = false;

  const ticket = await db.getTicketByUserId(userid.toString(), session.groupCategory);
  if (!ticket) {
    if (session.admin && userInfo === undefined) {
      reply(ctx, config.language.ticketClosedError);
    } else {
      reply(ctx, config.language.textFirst);
    }
    return;
  }

  let captionText = `${config.language.ticket} #T${(ticket.ticketId ?? ticket.id ?? 0)
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

  const fileResult = await ctx.getFile();
  const fileId = (fileResult as { file_id: string }).file_id;
  const commonOptions = {
    caption: captionText,
    reply_markup: isPrivate ? replyMarkup(ctx) : {},
  };

  // Send the file based on its type
  let messageId: string | null | undefined = undefined;
  const shouldForwardToGroup = (
    session.group !== '' &&
    session.group !== config.staffchat_id &&
    Object.keys(session.modeData).length > 0
  );

  switch (type) {
    case 'document':
      messageId = (await bot.sendDocument(receiverId, fileId, commonOptions)) as string | null;
      if (shouldForwardToGroup) {
        Promise.resolve(bot.sendDocument(session.group, fileId, {
          caption: captionText,
          reply_markup: buildInlineKeyboard(ctx.from.id, message.from.first_name, session.groupCategory, (ticket.ticketId ?? ticket.id ?? 0) as number),
        })).catch(log.error);
      }
      break;
    case 'photo':
      messageId = (await bot.sendPhoto(receiverId, fileId, commonOptions)) as string | null;
      if (shouldForwardToGroup) {
        Promise.resolve(bot.sendPhoto(session.group, fileId, {
          caption: captionText,
          reply_markup: buildInlineKeyboard(ctx.from.id, message.from.first_name, session.groupCategory, (ticket.ticketId ?? ticket.id ?? 0) as number),
        })).catch(log.error);
      }
      break;
    case 'video':
      messageId = (await bot.sendVideo(receiverId, fileId, commonOptions)) as string | null;
      if (shouldForwardToGroup) {
        Promise.resolve(bot.sendVideo(session.group, fileId, {
          caption: captionText,
          reply_markup: buildInlineKeyboard(ctx.from.id, message.from.first_name, session.groupCategory, (ticket.ticketId ?? ticket.id ?? 0) as number),
        })).catch(log.error);
      }
      break;
  }
  if (messageId) {
    db.addIdAndName(ticket.ticketId, messageId, ctx.message.from.first_name);
  }

  // Send confirmation message if enabled
  if (!config.autoreply_confirmation) return;
  let confirmationMessage = `${config.language.confirmationMessage}${config.show_user_ticket
    ? config.language.yourTicketId + ' #T' + (ticket.ticketId ?? ticket.id ?? 0).toString().padStart(6, '0')
    : ''
    }`;
  if (session.admin && userInfo === undefined) {
    const nameMatch = replyText.match(
      new RegExp(`${escapeRegex(config.language.from)} (.*) ${escapeRegex(config.language.language)}`)
    );
    if (!nameMatch) return;
    confirmationMessage = `${config.language.file_sent} ${nameMatch[1]}`;
  }
  sendMessage(ctx.chat.id, ticket.messenger, confirmationMessage).catch(log.error);
};

/**
 * Handles file forwarding with caching and spam protection.
 *
 * @param ctx - The bot context.
 * @param callback - Callback function receiving user information.
 */
async function forwardFile(ctx: Context): Promise<string | undefined> {
  const ticket = await db.getTicketByUserId(ctx.message.from.id.toString(), ctx.session.groupCategory);
  let ok = false;
  if (!ticket || !ticket.status || ticket.status === 'closed') {
    await db.add(ctx.message.from.id.toString(), 'open', null, ctx.messenger);
    ok = true;
  }
  if (ok || (ticket && ticket.status !== 'banned')) {
    const sentCount = cache.ticketSent[cache.userId];
    if (sentCount === undefined) {
      setTimeout(() => {
        delete cache.ticketSent[cache.userId];
      }, cache.config.spam_time);
      cache.ticketSent[cache.userId] = 0;
      return forwardHandler(ctx);
    } else if (sentCount < cache.config.spam_cant_msg) {
      cache.ticketSent[cache.userId] = sentCount + 1;
      return forwardHandler(ctx);
    } else if (sentCount === cache.config.spam_cant_msg) {
      cache.ticketSent[cache.userId] = sentCount + 1;
      sendMessage(ctx.chat.id, ticket?.messenger ?? 'telegram', cache.config.language.blockedSpam, {}).catch(log.error);
    }
  }
};

/**
 * Determines if the message comes from a private chat and returns user info.
 *
 * @param ctx - The bot context.
 * @param callback - Callback function receiving user info (or undefined).
 */
function forwardHandler(ctx: Context): string | undefined {
  if (ctx.chat.type === 'private') {
    cache.userId = ctx.message.from.id;
    const userInfo = `${cache.config.language.from} ${ctx.message.from.first_name} ${cache.config.language.language}: ${ctx.message.from.language_code}\n\n`;
    return userInfo;
  } else {
    return undefined;
  }
};

export { fileHandler, forwardFile, forwardHandler };
