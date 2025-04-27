import cache from './cache';
import SignalAddon from './addons/signal';
import { Context, Messenger } from './interfaces';
import TelegramAddon from './addons/telegram';

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
const reply = (
  ctx: Context,
  msgText: string,
  extra: any = { parse_mode: cache.config.parse_mode }
): void => {
  sendMessage(ctx.message.chat.id, ctx.messenger, msgText, extra);
};

export { strictEscape, sendMessage, reply };
