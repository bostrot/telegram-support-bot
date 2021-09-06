import config from '../config/config';
import cache from './cache';

// download photos
const downloadPhotoMiddleware = (bot, ctx, next) => {
  return bot.telegram.getFileLink(ctx.message.photo[0]).then((link) => {
    ctx.state.fileLink = link;
    return next();
  });
};

// download videos
const downloadVideoMiddleware = (bot, ctx, next) => {
  return bot.telegram.getFileLink(ctx.message.video).then((link) => {
    ctx.state.fileLink = link;
    return next();
  });
};

// download documents
const downloadDocumentMiddleware = (bot, ctx, next) => {
  return bot.telegram.getFileLink(ctx.message.document).then((link) => {
    ctx.state.fileLink = link;
    return next();
  });
};

// escape special characters
const escapeText = (str) => {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
}

// handle messages to web socket
const message = (bot, id, msg, extra) => {
  // Check web message
  if (id.toString().indexOf('WEB') > -1 && id != config.staffchat_id) {
    // Do nothing
    console.log('Web message')
    let socket_id = id.split('WEB')[1];
    cache.io.to(socket_id).emit('chat_staff', msg);
  } else {
    console.log('Send message')
    bot.telegram.sendMessage(id, msg, extra);
  }
}

export {
  downloadPhotoMiddleware,
  downloadVideoMiddleware,
  downloadDocumentMiddleware,
  escapeText,
  message,
};
