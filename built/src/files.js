"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fowardHandler = exports.forwardFile = exports.fileHandler = void 0;
const db = require("./db");
const config_1 = require("../config/config");
const cache_1 = require("./cache");
const { Extra } = require('telegraf');
/**
 * Forward video files to staff.
 * @param {string} type document, photo, video.
 * @param {bot} bot Bot object.
 * @param {context} ctx Bot context.
 */
function fileHandler(type, bot, ctx) {
    // replying to non-ticket
    let userid;
    let replyText;
    if (ctx.message !== undefined &&
        ctx.message.reply_to_message !== undefined && ctx.session.admin) {
        replyText = ctx.message.reply_to_message.text;
        if (replyText === undefined) {
            replyText = ctx.message.reply_to_message.caption;
        }
        userid = replyText.match(new RegExp('#T' +
            '(.*)' + ' ' + config_1.default.language.from));
        if (userid === null || userid === undefined) {
            userid = replyText.match(new RegExp('#T' +
                '(.*)' + '\n' + config_1.default.language.from));
        }
    }
    forwardFile(bot, ctx, function (userInfo) {
        let receiverId = config_1.default.staffchat_id;
        let msgId = ctx.message.chat.id;
        // if admin
        if (ctx.session.admin && userInfo === undefined) {
            msgId = userid[1];
        }
        db.check(msgId, function (ticket) {
            let captionText = config_1.default.language.ticket +
                ' #T' +
                ticket.id.toString().padStart(6, '0') +
                ' ' +
                userInfo +
                '\n' +
                (ctx.message.caption || '');
            if (ctx.session.admin && userInfo === undefined) {
                receiverId = ticket.userid;
                captionText = (ctx.message.caption || '');
            }
            switch (type) {
                case 'document':
                    bot.telegram.sendDocument(receiverId, ctx.message.document.file_id, {
                        caption: captionText,
                    });
                    if (ctx.session.group !== undefined) {
                        bot.telegram.sendDocument(ctx.session.group, ctx.message.document.file_id, {
                            caption: captionText,
                        });
                    }
                    break;
                case 'photo':
                    bot.telegram.sendPhoto(receiverId, ctx.message.photo[0].file_id, {
                        caption: captionText,
                    });
                    if (ctx.session.group !== undefined) {
                        bot.telegram.sendPhoto(ctx.session.group, ctx.message.photo[0].file_id, {
                            caption: captionText,
                        });
                    }
                    break;
                case 'video':
                    bot.telegram.sendVideo(receiverId, ctx.message.video.file_id, {
                        caption: captionText,
                    });
                    if (ctx.session.group !== undefined) {
                        bot.telegram.sendVideo(ctx.session.group, ctx.message.video.file_id, {
                            caption: captionText,
                        });
                    }
                    break;
            }
        });
    });
}
exports.fileHandler = fileHandler;
/**
 * Handle caching for sent files.
 * @param {bot} bot Bot object.
 * @param {context} ctx Bot context.
 * @param {callback} callback Bot callback.
 */
function forwardFile(bot, ctx, callback) {
    db.check(ctx.message.from.id, function (user) {
        let ok = false;
        if (user == undefined || user.status == undefined ||
            user.status == 'closed') {
            db.add(ctx.message.from.id, 'open', undefined);
            ok = true;
        }
        if (ok || user !== undefined && user.status !== 'banned') {
            if (cache_1.default.ticketSent[cache_1.default.ticketID] === undefined) {
                fowardHandler(ctx, function (userInfo) {
                    callback(userInfo);
                });
                // wait 5 minutes before this message appears again and do not
                // send notificatoin sounds in that time to avoid spam
                setTimeout(function () {
                    cache_1.default.ticketSent[cache_1.default.ticketID] = undefined;
                }, config_1.default.spam_time);
                cache_1.default.ticketSent[cache_1.default.ticketID] = 0;
            }
            else if (cache_1.default.ticketSent[cache_1.default.ticketID] < 5) {
                cache_1.default.ticketSent[cache_1.default.ticketID]++;
                // TODO: add Extra.HTML().notifications(false)
                // property for silent notifications
                fowardHandler(ctx, function (userInfo) {
                    callback(userInfo);
                });
            }
            else if (cache_1.default.ticketSent[cache_1.default.ticketID] === 5) {
                cache_1.default.ticketSent[cache_1.default.ticketID]++;
                bot.telegram.sendMessage(ctx.chat.id, 
                // eslint-disable-next-line new-cap
                config_1.default.language.blockedSpam, Extra.HTML());
            }
        }
    });
}
exports.forwardFile = forwardFile;
/**
 * Check if msg comes from user or admin.
 * @param {context} ctx Bot context.
 * @param {callback} callback Bot callback.
 */
function fowardHandler(ctx, callback) {
    let userInfo;
    ctx.getChat().then(function (chat) {
        if (chat.type === 'private') {
            cache_1.default.ticketID = ctx.message.from.id;
            userInfo =
                `${config_1.default.language.from} ${ctx.message.from.first_name} ` +
                    `${config_1.default.language.language}: ` +
                    `${ctx.message.from.language_code}\n\n`;
            if (ctx.session.group === undefined) {
                userInfo =
                    `${config_1.default.language.from} ${ctx.message.from.first_name} ` +
                        `@${ctx.message.from.username} ` +
                        `${config_1.default.language.language}: ` +
                        `${ctx.message.from.language_code}\n\n`;
            }
            callback(userInfo);
        }
        else {
            callback();
        }
    });
}
exports.fowardHandler = fowardHandler;
//# sourceMappingURL=files.js.map