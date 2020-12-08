"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ticketHandler = exports.handleText = void 0;
const db = require("./db");
const config_1 = require("../config/config");
const staff = require("./staff");
const users = require("./users");
/**
 * Text handler
 * @param {Object} bot
 * @param {Object} ctx
 * @param {Array} keys
 */
function handleText(bot, ctx, keys) {
    if (ctx.session.mode == 'private_reply') {
        staff.privateReply(bot, ctx);
    }
    else if (config_1.default.categories && !(JSON.stringify(config_1.default.categories)
        .indexOf(ctx.message.text) > -1)) {
        if (!ctx.session.admin && config_1.default.categories &&
            !ctx.session.group) {
            ctx.reply(config_1.default.language.services, {
                reply_markup: {
                    keyboard: keys,
                },
            });
        }
        else {
            ticketHandler(bot, ctx);
        }
    }
    else {
        ticketHandler(bot, ctx);
    }
}
exports.handleText = handleText;
;
/**
* Decide whether to forward or stop the message.
* @param {bot} bot Bot object.
* @param {context} ctx Bot context.
*/
function ticketHandler(bot, ctx) {
    if (ctx.chat.type === 'private') {
        db.check(ctx.message.from.id, function (user) {
            if (user == undefined || user.status == undefined ||
                user.status == 'closed') {
                if (ctx.session.group !== undefined) {
                    db.add(ctx.message.from.id, 'open', ctx.session.groupCategory);
                }
                else {
                    db.add(ctx.message.from.id, 'open', undefined);
                }
                users.chat(ctx, bot, ctx.message.chat);
            }
            else if (user.status !== 'banned') {
                users.chat(ctx, bot, ctx.message.chat);
            }
        });
    }
    else {
        staff.chat(ctx, bot);
    }
}
exports.ticketHandler = ticketHandler;
//# sourceMappingURL=text.js.map