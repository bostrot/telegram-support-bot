// download photos
const downloadPhotoMiddleware = (ctx, next) => {
  return bot.telegram.getFileLink(ctx.message.photo[0]).then((link) => {
    ctx.state.fileLink = link;
    return next();
  });
};

// download videos
const downloadVideoMiddleware = (ctx, next) => {
  return bot.telegram.getFileLink(ctx.message.video).then((link) => {
    ctx.state.fileLink = link;
    return next();
  });
};

// download documents
const downloadDocumentMiddleware = (ctx, next) => {
  return bot.telegram.getFileLink(ctx.message.document).then((link) => {
    ctx.state.fileLink = link;
    return next();
  });
};

module.exports = {
  downloadPhotoMiddleware,
  downloadVideoMiddleware,
  downloadDocumentMiddleware,
};
