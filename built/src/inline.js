"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeKeyboard = exports.replyKeyboard = exports.initInline = exports.callbackQuery = void 0;
const db = require("./db");
const config_1 = require("../config/config");
/**
 * Helper function for reply keyboard
 * @param {Array} keys
 * @return {Object} reply_markup
 */
function replyKeyboard(keys) {
    return {
        parse_mode: 'html',
        reply_markup: {
            keyboard: keys,
        },
    };
}
exports.replyKeyboard = replyKeyboard;
;
/**
 * Helper function to remove keyboard
 * @return {Object} reply_markup
 */
function removeKeyboard() {
    return {
        parse_mode: 'html',
        reply_markup: {
            remove_keyboard: true,
        },
    };
}
exports.removeKeyboard = removeKeyboard;
;
/**
 * Initialize categories from config
 * @param {Object} bot
 * @param {Object} config
 * @return {Array} keys
 */
function initInline(bot, config) {
    const keys = [];
    // Get categories from config file
    for (const i in config.categories) {
        if (i !== undefined) {
            keys.push([config.categories[i].name]);
            const subKeys = [];
            // Get subcategories
            for (const j in config.categories[i].subgroups) {
                if (j !== undefined) {
                    let categoryFullId = [config.categories[i].name +
                            ': ' + config.categories[i].subgroups[j].name];
                    subKeys.push(categoryFullId);
                    // Create subcategory button events
                    bot.hears(categoryFullId, (ctx) => {
                        ctx.reply(config.language.msgForwarding + '\n' +
                            `<b>${categoryFullId}</b>`, removeKeyboard());
                        // Set subgroup
                        ctx.session.group = config.categories[i].subgroups[j].group_id;
                        ctx.session.groupCategory = config.categories[i].subgroups[j].name;
                    });
                }
            }
            subKeys.push([config.language.back]);
            // Create subcategory buttons
            bot.hears(config.categories[i].name, (ctx) => {
                ctx.reply(config.language.whatSubCategory, replyKeyboard(subKeys));
            });
        }
    }
    return keys;
}
exports.initInline = initInline;
;
/**
 * Callback query handler
 * @param {Object} bot
 * @param {Object} ctx
 */
function callbackQuery(bot, ctx) {
    // Check whether to end callback session
    if (ctx.callbackQuery.data === 'R') {
        ctx.session.mode = undefined;
        ctx.session.modeData = undefined;
        ctx.reply(config_1.default.language.prvChatEnded);
        return;
    }
    // Get Ticket ID from DB
    db.check(ctx.callbackQuery.data, function (ticket) {
        ctx.session.mode = 'private_reply';
        ctx.session.modeData = {
            ticketid: ctx.callbackQuery.data,
            userid: ticket.userid,
        };
        bot.telegram.sendMessage(ctx.callbackQuery.from.id, `${config_1.default.language.ticket} ` +
            `#T${ticket.id.toString().padStart(6, '0')}` +
            `\n\n` +
            config_1.default.language.prvChatOpened, {
            parse_mode: 'html',
            reply_markup: {
                html: '',
                inline_keyboard: [
                    [
                        {
                            'text': config_1.default.language.prvChatEnd,
                            'callback_data': 'R',
                        },
                    ],
                ],
            },
        });
    });
    ctx.answerCbQuery(config_1.default.language.instructionsSent);
}
exports.callbackQuery = callbackQuery;
;
//# sourceMappingURL=inline.js.map