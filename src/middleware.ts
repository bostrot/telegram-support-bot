import cache from './cache';
import * as signal from './addons/signal';

// download photos
const downloadPhotoMiddleware = async function (bot, ctx, next) {
  const file = await ctx.getFile();
  return file.getUrl(ctx.message.photo[0]).then((link) => {
    ctx.state.fileLink = link;
    return next();
  });
};

// download videos
const downloadVideoMiddleware = async function (bot, ctx, next) {
  const file = await ctx.getFile();
  return file.getUrl(ctx.message.video).then((link) => {
    ctx.state.fileLink = link;
    return next();
  });
};

// download documents
const downloadDocumentMiddleware = async function (bot, ctx, next) {
  const file = await ctx.getFile();
  return file.getUrl(ctx.message.document).then((link) => {
    ctx.state.fileLink = link;
    return next();
  });
};

// strict escape
const strictEscape = function (str) {
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
};

// escape special characters
const escapeText = function (str) {
  if (cache.config.parse_mode == 'HTML' || cache.config.parse_mode == 'html') {
    return str.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  } else {
    // '[', ']', '(', ')', are skipped as they are usally for urls
    // '_', '*', '~', '`', are used for actualy markdown
    const chars = ['>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
    let newStr = '';
    let urlNameStarted = false;
    let urlStarted = false;
    for (let i = 0; i < str.length; i++) {
      // do not escape in urls
      if (str[i] == '[') {
        urlStarted = true;
      } else if (str[i] == '(') {
        urlNameStarted = true;
      } else if (urlStarted && str[i] == ']') {
        urlStarted = false;
      } else if (urlNameStarted && str[i] == ')') {
        urlNameStarted = false;
      }
      // escape special characters
      if (!urlStarted && !urlNameStarted && chars.includes(str[i])) {
        newStr += '\\' + str[i];
      } else {
        newStr += str[i];
      }
    }
    return newStr;
  }
}

// handle messages to web socket
const msg = function (id, msg, extra = {}) {
  msg = escapeText(msg);
  // Check web message
  if (id.toString().indexOf('WEB') > -1 && id != cache.config.staffchat_id) {
    // Web message
    console.log('Web message');
    let socket_id = id.split('WEB')[1];
    cache.io.to(socket_id).emit('chat_staff', msg);
  } else if (id.toString().indexOf('SIGNAL') > -1 && id != cache.config.staffchat_id) {
    // Signal message
    console.log('Signal message');
    signal.message(id.split('SIGNAL')[1], msg);
  }
  else {
    cache.bot.sendMessage(id, msg, extra);
  }
}

const reply = function (ctx, msgtext, extra = null) {
  msg(ctx.message.chat.id, msgtext, extra);
}

export {
  downloadPhotoMiddleware,
  downloadVideoMiddleware,
  downloadDocumentMiddleware,
  strictEscape,
  msg,
  reply,
};
