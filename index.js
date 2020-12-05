/* eslint-disable new-cap */
const Telegraf = require('telegraf');
const {Extra} = Telegraf;

const middleware = require('./src/middleware');
const commands = require('./src/commands');
const permissions = require('./src/permissions');
const inline = require('./src/inline');
const text = require('./src/text');
const config = require('./config/config');

const bot = new Telegraf(config.bot_token);

const testing = false;
if (testing) {
  const {tests} = require('./test/testing');
  tests(bot);
}

bot.use(permissions.currentSession());
bot.use((ctx, next) => permissions.checkPermissions(ctx, next, config));

const keys = inline.initInline(bot, config);

bot.telegram.getMe().then((botInfo) => bot.options.username = botInfo.username);

bot.command('open', (ctx) => commands.openCommand(ctx));
bot.command('close', (ctx) => commands.closeCommand(ctx));
bot.command('ban', (ctx) => commands.banCommand(ctx));
bot.command('start', (ctx) =>
  ctx.reply('Services', inline.replyKeyboard(keys)));
bot.command('id', (ctx) => ctx.reply(ctx.from.id + ' ' + ctx.chat.id));
bot.command('faq', (ctx) => ctx.reply(config.faqCommandText, Extra.HTML()));
bot.command('help', (ctx) => ctx.reply(config.helpCommandText, Extra.HTML()));

bot.on('callback_query', (ctx) => inline.callbackQuery(bot, ctx));
bot.on('photo', middleware.downloadPhotoMiddleware, (ctx) =>
  handler.file('photo', bot, ctx));
bot.on('video', middleware.downloadVideoMiddleware, (ctx) =>
  handler.file('video', bot, ctx));
bot.on('document', middleware.downloadDocumentMiddleware, (ctx) =>
  handler.file('document', bot, ctx));

bot.hears('Go back', (ctx) => ctx.reply('Service', inline.replyKeyboard(keys)));
bot.hears('testing', (ctx) => text.handleText(bot, ctx, keys));
bot.hears(/(.+)/, (ctx) => text.handleText(bot, ctx, keys));

bot.catch((err) => console.log('Error: ', err));

bot.launch();
