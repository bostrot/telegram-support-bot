/* eslint-disable new-cap */
const Telegraf = require( 'telegraf');
const {Extra} = Telegraf;

import * as middleware from './middleware';
import * as commands from './commands';
import * as permissions from './permissions';
import * as inline from './inline';
import * as text from './text';
import * as files from './files';
import config from '../config/config';
import * as error from './error';

// Init error handling
error.init();

// Create new Telegraf() with token
const bot = new Telegraf(config.bot_token);

// TODO: Unit testing
const testing = false;
if (testing) {
  const {tests} = require('../tests/testing');
  tests(bot);
}

// Use session and check for permissions on message
bot.use(permissions.currentSession());
bot.use((ctx, next) => permissions.checkPermissions(ctx, next, config));

// Init category keys
const keys = inline.initInline(bot, config);

// Set bots username
bot.telegram.getMe().then((botInfo) => bot.options.username = botInfo.username);

// Bot commands
bot.command('open', (ctx) => commands.openCommand(ctx));
bot.command('close', (ctx) => commands.closeCommand(bot, ctx));
bot.command('ban', (ctx) => commands.banCommand(bot, ctx));
bot.command('start', (ctx) => {
  if (ctx.chat.type == 'private') {
    ctx.reply(config.language.startCommandText);
    if (config.categories.length > 0)
      setTimeout(() => ctx.reply(config.language.services, inline.replyKeyboard(keys)), 500);    
  } else ctx.reply(config.language.prvChatOnly);
});
bot.command('id', (ctx) => ctx.reply(ctx.from.id + ' ' + ctx.chat.id));
bot.command('faq', (ctx) => ctx.reply(config.language.faqCommandText, Extra.HTML()));
bot.command('help', (ctx) => ctx.reply(config.language.helpCommandText, Extra.HTML()));

// Bot ons
bot.on('callback_query', (ctx) => inline.callbackQuery(bot, ctx));
bot.on('photo', (ctx) => middleware.downloadPhotoMiddleware(bot, ctx, () => 
  files.fileHandler('photo', bot, ctx)));
bot.on('video', (ctx) => middleware.downloadVideoMiddleware(bot, ctx, () => 
  files.fileHandler('video', bot, ctx)));
bot.on('document', (ctx) => middleware.downloadDocumentMiddleware(bot, ctx, () => 
  files.fileHandler('document', bot, ctx)));

// Bot regex
bot.hears(config.language.back, (ctx) => ctx.reply(config.language.services, inline.replyKeyboard(keys)));
bot.hears('testing', (ctx) => text.handleText(bot, ctx, keys));
bot.hears(/(.+)/, (ctx) => text.handleText(bot, ctx, keys));

// Catch bot errors
bot.catch((err) => console.log('Error: ', err));

bot.launch();
