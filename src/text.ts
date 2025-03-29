import * as db from './db';
import cache from './cache';
import * as staff from './staff';
import * as users from './users';
import * as middleware from './middleware';
import TelegramAddon from './addons/telegram';
import { Addon, Context } from './interfaces';

/**
 * Checks if the given message text exists in the configured categories.
 * @param message - The text of the incoming message.
 * @returns True if the message is one of the categories, false otherwise.
 */
function isMessageInCategories(message: string): boolean {
  const { categories } = cache.config;
  return Array.isArray(categories) && categories.length > 0 &&
    categories.findIndex(category => category.msg.includes(message)) !== -1;
}

/**
 * Handles incoming text messages.
 * @param bot - Instance of the Telegram addon.
 * @param ctx - The context of the message.
 * @param keys - Keyboard keys to use for replies.
 */
export function handleText(bot: Addon, ctx: any, keys: any[] = []) {
  // If the session is in private reply mode, handle via staff.
  if (ctx.session.mode === 'private_reply') {
    return staff.privateReply(ctx);
  }

  if (shouldReplyWithCategoryKeyboard(ctx)) {
    return middleware.reply(ctx, cache.config.language.services, {
      reply_markup: { keyboard: keys },
    });
  }

  // In all other cases, process the ticket.
  return ticketHandler(bot, ctx);
}

function shouldReplyWithCategoryKeyboard(ctx: any) {
  return cache.config.categories &&
    cache.config.categories.length > 0 &&
    !isMessageInCategories(ctx.message.text) &&
    !ctx.session.admin && !ctx.session.group;
}

/**
 * Determines whether to forward the message or to handle it as a ticket.
 * @param bot - Instance of the Telegram addon.
 * @param ctx - The context of the message.
 */
export function ticketHandler(bot: Addon, ctx: Context) {
  // For private chats, check for an existing ticket; otherwise, create one.
  if (ctx.chat.type === 'private') {
    return db.getTicketByUserId(ctx.message.from.id, ctx.session.groupCategory, (ticket: any) => {
      if (!ticket) {
        db.add(ctx.message.from.id, 'open', ctx.session.groupCategory, ctx.messenger);
      }
      users.chat(ctx, ctx.message.chat);
    });
  }

  // For non-private chats, use the staff chat handler.
  return staff.chat(ctx);
}
