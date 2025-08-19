import { Context, Messenger, ParseMode } from './interfaces';
import cache from './cache';
import * as llm from './addons/llm';
import * as db from './db';
import { strictEscape as esc, reply, sendMessage } from './middleware';
import { ISupportee } from './db';
import * as log from 'fancy-log'

const TIME_BETWEEN_CONFIRMATION_MESSAGES = 86400000; // 24 hours

/**
 * Generates a ticket message.
 *
 * @param ticket - Ticket object with a toString() method.
 * @param message - Message object containing text and sender info.
 * @param tag - Tag string.
 * @param anonymousUser - Whether the ticket is anonymous (default: true).
 * @param autoReplyInfo - Optional auto-reply info to append.
 * @returns The formatted ticket message.
 */
function formatMessageAsTicket(
  ticket: { toString: () => string },
  ctx: Context,
  autoReplyInfo?: any,
): string {
  const { config, userId } = cache;
  var name = `[${esc(ctx.message.from.first_name,)}](tg://user?id=${userId})`;
  if (config.anonymous_tickets || config.staffchat_parse_mode === ParseMode.PLAINTEXT) {
    name = ctx.message.from.first_name;
  }
  return `${config.language.ticket} #T${ticket
    .toString()
    .padStart(6, '0')} ${config.language.from} ${name} ${config.language.language}: ${ctx.message.from.language_code} ${ctx.session.groupTag}\n\n${esc(
      ctx.message.text,
    )}\n\n${autoReplyInfo ? `*${autoReplyInfo}*` : ''}`;
}

/**
 * Creates a formatted auto-reply ticket message.
 *
 * @param msg - The auto-reply message content.
 * @param ctx - Bot context.
 * @returns The formatted auto-reply message.
 */
function createAutoReplyMessage(msg: string, ctx: Context): string {
  const { config } = cache;
  const senderName = ctx.message.from.first_name;
  return config.clean_replies
    ? msg
    : `${config.language.dear} ${esc(senderName)},\n\n${msg}\n\n${config.language.regards}\n${config.language.automatedReplyAuthor}\n\n*${config.language.automatedReply}*`;
}

/**
 * Checks for common questions and LLM responses to auto-reply.
 *
 * @param ctx - Bot context.
 * @returns True if an auto-reply was sent; otherwise, false.
 */
async function autoReply(ctx: Context): Promise<boolean> {
  const {
    config: { autoreply, use_llm },
  } = cache;
  const messageText = ctx.message.text.toString();

  if (autoreply && autoreply.length > 0 && autoreply[0]?.question) {
    // Check common auto-reply questions
    for (const autoReplyItem of autoreply) {
      if (messageText.includes(autoReplyItem.question)) {
        reply(ctx, createAutoReplyMessage(autoReplyItem.answer, ctx));
        return true;
      }
    }
  }

  // Fallback to LLM response if enabled
  if (use_llm) {
    const response = await llm.getResponseFromLLM(ctx);
    if (response !== null) {
      reply(ctx, createAutoReplyMessage(response, ctx));
      return true;
    }
  }
  return false;
}

/**
 * Processes a ticket by sending confirmation and forwarding it to staff and group chats.
 *
 * @param ticket - The ticket retrieved from the database.
 * @param ctx - Bot context.
 * @param chatId - The chat id for sending confirmation.
 * @param autoReplyInfo - Optional auto-reply info.
 */
async function processTicket(
  ticket: ISupportee,
  ctx: Context,
  chatId: string,
  autoReplyInfo?: string,
) {
  const { config } = cache;
  // Send confirmation if applicable
  if (
    !autoReplyInfo &&
    config.autoreply_confirmation &&
    (ctx.session.lastContactDate === undefined ||
      ctx.session.lastContactDate < Date.now() - TIME_BETWEEN_CONFIRMATION_MESSAGES)
  ) {
    ctx.session.lastContactDate = Date.now();
    const confirmationMsg =
      config.language.confirmationMessage +
      '\n' +
      (config.show_user_ticket
        ? `${config.language.ticket} #T${ticket.ticketId.toString().padStart(6, '0')}`
        : '');
    sendMessage(chatId, ticket.messenger, confirmationMsg);
  }

  // Send ticket message to staff chat
  const messageId = await sendMessage(
    config.staffchat_id,
    config.staffchat_type,
    formatMessageAsTicket(
      ticket.ticketId,
      ctx,
      autoReplyInfo,
    ),
  );
  db.addIdAndName(ticket.ticketId, messageId, ctx.message.from.first_name);

  // If group flag is set and not the admin chat, forward to group chat
  if (ctx.session.group && ctx.session.group !== config.staffchat_id) {
    const groupOptions = config.allow_private
      ? {
        parse_mode: 'none',
        reply_markup: {
          html: '',
          inline_keyboard: [
            [
              {
                text: config.language.replyPrivate,
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
      }
      : { parse_mode: config.parse_mode };

    sendMessage(
      ctx.session.group,
      ticket.messenger,
      formatMessageAsTicket(
        ticket.ticketId,
        ctx,
        autoReplyInfo,
      ),
      groupOptions,
    );
  }
};

/**
 * Handles ticket processing with spam protection.
 *
 * @param ctx - Bot context.
 * @param chat - Chat object containing an id.
 */
async function chat(ctx: Context, chat: { id: string }) {
  const { config } = cache;
  cache.userId = ctx.message.from.id;
  const isAutoReply = await autoReply(ctx);
  if (isAutoReply && !config.show_auto_replied) return;
  const autoReplyInfo = isAutoReply ? config.language.automatedReplySent : undefined;

  // Ensure the user's ticket is tracked
  if (cache.ticketIDs[cache.userId] === undefined) {
    cache.ticketIDs.push(cache.userId);
  }
  cache.ticketStatus[cache.userId] = true;

  // If no ticket has been sent yet, fetch from DB and set up spam timer
  if (cache.ticketSent[cache.userId] === undefined) {
    const ticket = await db.getTicketByUserId(chat.id, ctx.session.groupCategory);
    processTicket(ticket, ctx, chat.id, autoReplyInfo);

    // Prevent multiple notifications for a period defined by spam_time
    setTimeout(() => {
      cache.ticketSent[cache.userId] = undefined;
    }, config.spam_time);
    cache.ticketSent[cache.userId] = 0;
  } else if (cache.ticketSent[cache.userId] < config.spam_cant_msg) {
    cache.ticketSent[cache.userId]++;
    const ticket = await db.getTicketByUserId(cache.userId, ctx.session.groupCategory);
    sendMessage(
      config.staffchat_id,
      config.staffchat_type,
      formatMessageAsTicket(
        ticket.ticketId,
        ctx,
        autoReplyInfo,
      ),
    );
    if (ctx.session.group && ctx.session.group !== config.staffchat_id) {
      sendMessage(
        ctx.session.group,
        ticket.messenger,
        formatMessageAsTicket(
          ticket.ticketId,
          ctx,
          autoReplyInfo,
        ),
      );
    }
  } else if (cache.ticketSent[cache.userId] === config.spam_cant_msg) {
    cache.ticketSent[cache.userId]++;
    sendMessage(chat.id, ctx.messenger, config.language.blockedSpam);
  }

  // Log the ticket message for debugging
  const ticket = await db.getTicketByUserId(cache.userId, ctx.session.groupCategory)
  log.info(
    formatMessageAsTicket(
      ticket.ticketId,
      ctx,
      autoReplyInfo,
    ),
  );
}

export { chat };
