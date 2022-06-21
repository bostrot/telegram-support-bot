import cache from './cache';
import * as signal from './addons/signal';

// download photos
const downloadPhotoMiddleware = function(bot, ctx, next) {
  return bot.telegram.getFileLink(ctx.message.photo[0]).then((link) => {
    ctx.state.fileLink = link;
    return next();
  });
};

// download videos
const downloadVideoMiddleware = function(bot, ctx, next) {
  return bot.telegram.getFileLink(ctx.message.video).then((link) => {
    ctx.state.fileLink = link;
    return next();
  });
};

// download documents
const downloadDocumentMiddleware = function(bot, ctx, next) {
  return bot.telegram.getFileLink(ctx.message.document).then((link) => {
    ctx.state.fileLink = link;
    return next();
  });
};

// escape special characters
const escapeText = function(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
}

// handle messages to web socket
const msg = function(id, msg, extra) {
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
    cache.bot.telegram.sendMessage(id, msg, extra);
  }
}

const reply = function(ctx, msgtext, extra = null) {
  msg(ctx.message.chat.id, msgtext, extra);
}

export {
  downloadPhotoMiddleware,
  downloadVideoMiddleware,
  downloadDocumentMiddleware,
  escapeText,
  msg,
  reply,
};
