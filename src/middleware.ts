import cache from './cache';
import * as signal from './addons/signal';
import { Context } from './interfaces';

// strict escape
const strictEscape = function (str: string | any[]) {
  if (cache.config.parse_mode == 'MarkdownV2') {
    let newStr = '';
    const chars = ['[', ']', '(', ')', '_', '*', '~', '`'];
    for (let i = 0; i < str.length; i++) {
      // escape special characters
      if (chars.includes(str[i])) {
        newStr += '\\' + str[i];
      } else {
        newStr += str[i];
      }
    }
    return newStr;
  } else {
    return str.toString();
  }
};

// escape special characters
const escapeText = function (str: string | string[]) {
  if (cache.config.parse_mode == 'HTML' || cache.config.parse_mode == 'html') {
    return str
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  } else if (cache.config.parse_mode == 'MarkdownV2') {
    // '[', ']', '(', ')', are skipped as they are usally for urls
    // '_', '*', '~', '`', are used for actualy markdown
    const chars = ['>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
    let newStr = '';
    let urlStarted = false;
    for (let i = 0; i < str.length; i++) {
      // do not escape in urls
      if (str[i] == '(') {
        urlStarted = true;
      } else if (urlStarted && str[i] == ')') {
        urlStarted = false;
      }
      // escape special characters
      if (!urlStarted && chars.includes(str[i])) {
        newStr += '\\' + str[i];
      } else {
        newStr += str[i];
      }
    }
    return newStr;
  }
  if (str == undefined) {
    return '';
  }
  return str.toString();
};

// handle messages to web socket
const msg = function (id: string | number, msg: string | string[], extra: any = {
  parse_mode: cache.config.parse_mode
}) {
  msg = escapeText(msg);
  // Check web message
  if (id.toString().indexOf('WEB') > -1 && id != cache.config.staffchat_id) {
    // Web message
    console.log('Web message');
    const socketId = id.toString().split('WEB')[1];
    cache.io.to(socketId).emit('chat_staff', msg);
  } else if (
    id.toString().indexOf('SIGNAL') > -1 &&
    id != cache.config.staffchat_id
  ) {
    // Signal message
    console.log('Signal message');
    signal.message(id.toString().split('SIGNAL')[1], msg);
  } else {
    msg = msg.replace(/  /g, '');
    cache.bot.sendMessage(id, msg, extra);
  }
};

const reply = function (ctx: Context, msgtext: string | string[], extra: any = {
  parse_mode: cache.config.parse_mode
}) {
  msg(ctx.message.chat.id, msgtext, extra);
};

export { strictEscape, msg, reply };
