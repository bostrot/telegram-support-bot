"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable new-cap */
const Telegraf = require('telegraf');
const { Extra } = Telegraf;
const middleware = require("./middleware");
const commands = require("./commands");
const permissions = require("./permissions");
const inline = require("./inline");
const text = require("./text");
const files = require("./files");
const config_1 = require("../config/config");
const error = require("./error");
// Init error handling
error.init();
// Create new Telegraf() with token
const bot = new Telegraf(config_1.default.bot_token);
// TODO: Unit testing
const testing = false;
if (testing) {
    const { tests } = require('../tests/testing');
    tests(bot);
}
// Use session and check for permissions on message
bot.use(permissions.currentSession());
bot.use((ctx, next) => permissions.checkPermissions(ctx, next, config_1.default));
// Init category keys
const keys = inline.initInline(bot, config_1.default);
// Set bots username
bot.telegram.getMe().then((botInfo) => bot.options.username = botInfo.username);
// Bot commands
bot.command('open', (ctx) => commands.openCommand(ctx));
bot.command('close', (ctx) => commands.closeCommand(ctx));
bot.command('ban', (ctx) => commands.banCommand(bot, ctx));
bot.command('start', (ctx) => {
    if (ctx.chat.type == 'private') {
        ctx.reply(config_1.default.language.startCommandText);
        setTimeout(() => ctx.reply(config_1.default.language.services, inline.replyKeyboard(keys)), 500);
    }
    else
        ctx.reply(config_1.default.language.prvChatOnly);
});
bot.command('id', (ctx) => ctx.reply(ctx.from.id + ' ' + ctx.chat.id));
bot.command('faq', (ctx) => ctx.reply(config_1.default.language.faqCommandText, Extra.HTML()));
bot.command('help', (ctx) => ctx.reply(config_1.default.language.helpCommandText, Extra.HTML()));
// Bot ons
bot.on('callback_query', (ctx) => inline.callbackQuery(bot, ctx));
bot.on('photo', (ctx) => middleware.downloadPhotoMiddleware(bot, ctx, () => files.fileHandler('photo', bot, ctx)));
bot.on('video', (ctx) => middleware.downloadVideoMiddleware(bot, ctx, () => files.fileHandler('video', bot, ctx)));
bot.on('document', (ctx) => middleware.downloadDocumentMiddleware(bot, ctx, () => files.fileHandler('document', bot, ctx)));
// Bot regex
bot.hears(config_1.default.language.back, (ctx) => ctx.reply(config_1.default.language.services, inline.replyKeyboard(keys)));
bot.hears('testing', (ctx) => text.handleText(bot, ctx, keys));
bot.hears(/(.+)/, (ctx) => text.handleText(bot, ctx, keys));
// Catch bot errors
bot.catch((err) => console.log('Error: ', err));
bot.launch();
//# sourceMappingURL=index.js.map