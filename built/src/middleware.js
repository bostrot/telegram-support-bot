"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadDocumentMiddleware = exports.downloadVideoMiddleware = exports.downloadPhotoMiddleware = void 0;
// download photos
const downloadPhotoMiddleware = (bot, ctx, next) => {
    return bot.telegram.getFileLink(ctx.message.photo[0]).then((link) => {
        ctx.state.fileLink = link;
        return next();
    });
};
exports.downloadPhotoMiddleware = downloadPhotoMiddleware;
// download videos
const downloadVideoMiddleware = (bot, ctx, next) => {
    return bot.telegram.getFileLink(ctx.message.video).then((link) => {
        ctx.state.fileLink = link;
        return next();
    });
};
exports.downloadVideoMiddleware = downloadVideoMiddleware;
// download documents
const downloadDocumentMiddleware = (bot, ctx, next) => {
    return bot.telegram.getFileLink(ctx.message.document).then((link) => {
        ctx.state.fileLink = link;
        return next();
    });
};
exports.downloadDocumentMiddleware = downloadDocumentMiddleware;
