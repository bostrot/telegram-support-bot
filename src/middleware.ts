import cache from './cache';
import SignalAddon from './addons/signal';
import SlackAddon from './addons/slack';
import DiscordAddon from './addons/discord';
import { Context, Messenger } from './interfaces';
import TelegramAddon from './addons/telegram';

/**
 * Builds an inline keyboard with a "Reply Private" button.
 *
 * @param userId - The user's ID.
 * @param firstName - The user's first name.
 * @param category - The ticket category.
 * @param ticketId - The ticket identifier.
 * @returns The reply markup object.
 */
const buildInlineKeyboard = (
  userId: string | number,
  firstName: string,
  category: string | null,
  ticketId: string | number,
): object => ({
  html: '',
  inline_keyboard: [
    [
      {
        text: cache.config.language.replyPrivate,
        callback_data: `${userId}---${firstName}---${category}---${ticketId}`,
      },
    ],
  ],
});

/**
 * Escapes special characters for MarkdownV2, HTML, or Markdown formats.
 *
 * @param str - The string to escape.
 * @returns The escaped string.
 */
const strictEscape = (str: string): string => {
  const { parse_mode } = cache.config;
  switch (parse_mode) {
    case 'MarkdownV2':
      // Escape all special MarkdownV2 characters
      return str.replace(/([[\]()_*~`>#+\-=\|{}.!\\])/g, '\\$1');
    case 'HTML':
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;'); // Escape single quotes
    case 'Markdown':
      // Escape special Markdown characters (square brackets separately for safety)
      return str
        .replace(/([[\]_*`])/g, '\$1')
        .replace(/(\[|\])/g, '\$1');
    default:
      return str.toString();
  }
};

/**
 * Sends a message through the appropriate messenger addon.
 *
 * @param id - The target identifier.
 * @param messenger - The messenger type.
 * @param msg - The message text.
 * @param extra - Extra options (default includes the configured parse mode).
 */
async function sendMessage (
  id: string | number,
  messenger: string,
  msg: string,
  extra: any = { parse_mode: cache.config.parse_mode }
): Promise<string | null> {
  const messengerType = messenger as Messenger;
  // Remove extra spaces
  const cleanedMsg = msg.replace(/ {2,}/g, ' ');
  
  switch (messengerType) {  
    case Messenger.TELEGRAM:
      return await TelegramAddon.getInstance().sendMessage(id, cleanedMsg, extra);
    case Messenger.SIGNAL:
      return await SignalAddon.getInstance().sendMessage(id, cleanedMsg, extra);
    case Messenger.SLACK:
      return await SlackAddon.getInstance().sendMessage(id, cleanedMsg, extra);
    case Messenger.DISCORD:
      return await DiscordAddon.getInstance().sendMessage(id, cleanedMsg, extra);
    case Messenger.WEB: {
      const socketId = id.toString().split('WEB')[1];
      cache.io.to(socketId).emit('chat_staff', cleanedMsg);
      return null;
    }
    default:
      throw new Error('Invalid messenger type');
  }
};

/**
 * Replies to a message within the given context.
 *
 * @param ctx - The message context.
 * @param msgText - The reply text.
 * @param extra - Extra options (default includes the configured parse mode).
 */
const reply = async (
  ctx: Context,
  msgText: string,
  extra: any = { parse_mode: cache.config.parse_mode }
): Promise<void> => {
  const chatId = ctx.message?.chat?.id ?? ctx.chat?.id;
  if (!chatId) return;
  await sendMessage(chatId, ctx.messenger, msgText, extra);
};

export { buildInlineKeyboard, strictEscape, sendMessage, reply };
