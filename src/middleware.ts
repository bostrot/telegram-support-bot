import cache from './cache';
import SignalAddon from './addons/signal/addon';
import { Context, Messenger } from './interfaces';
import TelegramAddon from './addons/telegram';

// Strict escape for MarkdownV2
const strictEscape = (str: string): string => {
  if (cache.config.parse_mode === 'MarkdownV2') {
    return str.replace(/([[\]()_*~`>#+\-=\|{}.!])/g, '\\$1'); // Escape all special MarkdownV2 characters
  } else if (cache.config.parse_mode === 'HTML') {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;'); // Added escape for single quotes
  } else if (cache.config.parse_mode === 'Markdown') {
    return str
      .replace(/([[\]_*`])/g, '\$1') // Escape all special Markdown characters
      .replace(/(\[|\])/g, '\$1'); // Escape square brackets separately for safety
  }
  return str.toString();
};

// Function to send a message
function sendMessage(
  id: string | number,
  messenger: string,
  msg: string,
  extra: any = { parse_mode: cache.config.parse_mode }) {
  var messengerType = messenger as Messenger
  msg = msg.replace(/ {2,}/g, ' '); // Remove extra spaces
  if (messengerType === Messenger.TELEGRAM) {
    TelegramAddon.getInstance().sendMessage(id, msg, extra);
  } else if (messengerType === Messenger.SIGNAL) {
    SignalAddon.getInstance().sendMessage(id, msg, extra);
  } else if (messengerType === Messenger.WEB) {
    const socketId = id.toString().split('WEB')[1];
    cache.io.to(socketId).emit('chat_staff', msg);
  } else {
    throw new Error('Invalid messenger type');
  }
}

// Function to reply in a context
const reply = (
  ctx: Context,
  msgText: string,
  extra: any = { parse_mode: cache.config.parse_mode }
) => {
  sendMessage(ctx.message.chat.id, ctx.messenger, msgText, extra);
};

export { strictEscape, sendMessage, reply };
