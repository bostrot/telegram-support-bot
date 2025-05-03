import cache from './cache';
import * as middleware from './middleware';
import * as db from './db';
import { Context } from './interfaces';
import { ISupportee } from './db';
import * as log from 'fancy-log';

/**
 * Generates a ticket message.
 *
 * @param name - The name to include in the message.
 * @param message - The message object.
 * @returns The formatted ticket message.
 */
function ticketMsg(
  name: string,
  message: { text: any; from: { first_name: any } },
): string {
  const esc = middleware.strictEscape;
  const { config } = cache;
  if (config.clean_replies) {
    return esc(message.text);
  }
  if (config.anonymous_replies) {
    return `${config.language.dear} ${esc(name)},\n\n${esc(message.text)}\n\n${config.language.regards}\n${config.language.regardsGroup}`;
  }
  return `${config.language.dear} ${esc(name)},\n\n${esc(message.text)}\n\n${config.language.regards}\n${esc(message.from.first_name)}`;
}

/**
 * Sends a private reply to a user.
 *
 * @param ctx - The bot context.
 * @param msg - The message object (defaults to ctx.message if empty).
 */
function privateReply(ctx: Context, msg: any = {}) {
  if (Object.keys(msg).length === 0) {
    msg = ctx.message;
  }

  const { session, messenger, from, message, chat } = ctx;
  const { modeData } = session;
  middleware.sendMessage(
    modeData.userid,
    messenger,
    ticketMsg(`${modeData.name}`, msg),
    {
      parse_mode: cache.config.parse_mode,
      reply_markup: {
        html: '',
        inline_keyboard: [
          [
            cache.config.direct_reply
              ? {
                text: cache.config.language.replyPrivate,
                url: `https://t.me/${from.username}`,
              }
              : {
                text: cache.config.language.replyPrivate,
                callback_data: `${from.id}---${message.from.first_name}---${modeData.category}---${modeData.ticketid}`,
              },
          ],
        ],
      },
    },
  );
  // Send confirmation message
  middleware.sendMessage(chat.id, messenger, cache.config.language.msg_sent, {});
}

/**
 * Extracts the ticket ID from the reply text.
 *
 * @param replyText - The text from which to extract the ticket ID.
 * @returns The extracted ticket ID or null if not found.
 */
async function extractTicketId(replyText: string, ctx: Context): Promise<string | null> {
  const { language } = cache.config;
  let match = replyText.match(new RegExp(`#T(.*) ${language.from}`));
  if (!match) {
    match = replyText.match(new RegExp(`#T(.*)\n${language.from}`));
  }
  return match ? match[1].trim() : null;
}

/**
 * Extracts the name from the reply text.
 *
 * @param replyText - The text from which to extract the name.
 * @returns The extracted name or null if not found.
 */
function extractName(replyText: string): string | null {
  const { language } = cache.config;
  const match = replyText.match(new RegExp(`${language.from} (.*) ${language.language}`));
  return match ? match[1].trim() : null;
}

/**
 * Handles staff chat replies to tickets.
 *
 * @param ctx - The bot context.
 */
async function chat(ctx: Context) {
  if (!ctx.session.admin) {
    return;
  }

  const replyMsg = ctx.message?.reply_to_message;
  if (!replyMsg) return;

  const replyText = replyMsg.text || replyMsg.caption;
  const replyMessageId = ctx.message.external_reply?.message_id;
  if (!replyText && !replyMessageId) return;

  var ticket;
  var ticketId;
  if (replyMessageId) {
    ticket = await db.getTicketByInternalId(replyMessageId);
  } else {
    ticketId = parseInt(await extractTicketId(replyText, ctx));
    if (!ticketId) return;
    ticket = await db.getTicketById(ticketId, ctx.session.groupCategory);
  }

  if (!ticket) {
    middleware.reply(ctx, cache.config.language.ticketClosedError);
    return;
  }

  var name;
  if (ticket.name) {
    name = ticket.name;
  } else {
    name = extractName(replyText);
  }
  if (!name) return;

  // Mark ticket as no longer active
  cache.ticketStatus[ticketId] = false;

  // Reply to web users differently
  if (ticket.userid.includes('WEB')) {
    try {
      const socketId = ticket.userid.split('WEB')[1];
      cache.io.to(socketId).emit('chat_staff', ticketMsg(name, ctx.message));
    } catch (e) {
      middleware.sendMessage(
        ctx.chat.id,
        ticket.messenger,
        `Web chat already closed.`,
      );
      log.error(e);
    }
  } else {
    middleware.sendMessage(ticket.userid, ticket.messenger, ticketMsg(name, ctx.message));
  }

  // Save staff message to database
  await db.addMessage({
    ticketId: ticket.ticketId,
    userId: String(ctx.message.from.id),
    name: ctx.message.from.first_name || null,
    messageId: ctx.message.message_id,
    messenger: ticket.messenger,
    message: ctx.message.text,
    date: new Date(ctx.message.date * 1000),
    type: 'staff'
  });

  const esc = middleware.strictEscape;
  middleware.sendMessage(
    ctx.chat.id,
    cache.config.staffchat_type,
    `${cache.config.language.msg_sent} ${esc(name)}`,
  );
  log.info(`Answer: ${ticketMsg(name, ctx.message)}`);
  cache.ticketSent[ticketId] = null;

  // Auto-close the ticket if enabled
  if (cache.config.auto_close_tickets) {
      db.add(ticket.ticketId, 'closed', null, ticket.messenger);
  }
}

export { privateReply, chat, ticketMsg };
