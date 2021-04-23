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

export {
  downloadPhotoMiddleware,
  downloadVideoMiddleware,
  downloadDocumentMiddleware,
  escapeText,
};
