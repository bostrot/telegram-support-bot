import * as db from './db';
import cache from './cache';
import * as staff from './staff';
import * as users from './users';
import * as middleware from './middleware';
import { Addon, Context } from './interfaces';
import { ISupportee } from './db';

/**
 * Checks if the given message text exists in the configured categories.
 *
 * @param message - The text of the incoming message.
 * @returns True if the message is one of the categories, false otherwise.
 */
const isMessageInCategories = (message: string): boolean => {
  const { categories } = cache.config;
  return Array.isArray(categories) && categories.length > 0 &&
    categories.some(category => category.msg.includes(message));
};

/**
 * Determines if a category keyboard should be shown.
 *
 * @param ctx - The message context.
 * @returns True if the keyboard should be shown, false otherwise.
 */
const shouldReplyWithCategoryKeyboard = (ctx: Context): boolean => {
  const { categories } = cache.config;
  return Array.isArray(categories) &&
    categories.length > 0 &&
    !isMessageInCategories(ctx.message.text) &&
    !ctx.session.admin &&
    !ctx.session.group;
};

/**
 * Handles incoming text messages.
 *
 * @param bot - Instance of the Telegram addon.
 * @param ctx - The context of the message.
 * @param keys - Keyboard keys to use for replies.
 */
export function handleText(bot: Addon, ctx: Context, keys: any[] = []) {
  // Handle private replies via staff
  if (ctx.session.mode === 'private_reply') {
    return staff.privateReply(ctx);
  }

  // If conditions met, reply with the category keyboard
  if (shouldReplyWithCategoryKeyboard(ctx)) {
    return middleware.reply(ctx, cache.config.language.services, {
      reply_markup: { keyboard: keys },
    });
  }

  // In all other cases, process the ticket
  return ticketHandler(bot, ctx);
}

/**
 * Determines whether to forward the message or to handle it as a ticket.
 *
 * @param bot - Instance of the Telegram addon.
 * @param ctx - The context of the message.
 */
export async function ticketHandler(bot: Addon, ctx: Context): Promise<ISupportee | null> {
  const { chat, message, session, messenger } = ctx;
  // For private chats, check for an existing ticket; otherwise, create one.
  if (chat.type === 'private') {
    let ticket = await db.getTicketByUserId(message.from.id, session.groupCategory)
    if (!ticket) {
      // db.add must be awaited: users.chat() reads the ticket back from the DB
      // immediately, so firing this off unawaited made every first message from
      // a new user crash in processTicket() with "Cannot read properties of null
      // (reading 'ticketId')" - and never reach the staff chat.
      await db.add(message.from.id, 'open', session.groupCategory, messenger);
      // findOneAndReplace() returns the pre-image (null on insert), so re-read.
      ticket = await db.getTicketByUserId(message.from.id, session.groupCategory);
    }
    users.chat(ctx, message.chat);
    return ticket;
  }

  // For non-private chats, use the staff chat handler.
  staff.chat(ctx);
}
