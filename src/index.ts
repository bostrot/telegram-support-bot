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

const bot = new Telegraf(config.bot_token);

const testing = false;
if (testing) {
  // import {tests} = require('../tests/testing');
  // tests(bot);
}

bot.use(permissions.currentSession());
bot.use((ctx, next) => permissions.checkPermissions(ctx, next, config));

const keys = inline.initInline(bot, config);

bot.telegram.getMe().then((botInfo) => bot.options.username = botInfo.username);

bot.command('open', (ctx) => commands.openCommand(ctx));
bot.command('close', (ctx) => commands.closeCommand(ctx));
bot.command('ban', (ctx) => commands.banCommand(bot, ctx));
bot.command('start', (ctx) => ctx.reply(config.language.startCommandText) &&
  ctx.reply(config.language.services, inline.replyKeyboard(keys)));
bot.command('id', (ctx) => ctx.reply(ctx.from.id + ' ' + ctx.chat.id));
bot.command('faq', (ctx) => ctx.reply(config.language.faqCommandText, Extra.HTML()));
bot.command('help', (ctx) => ctx.reply(config.language.helpCommandText, Extra.HTML()));

bot.on('callback_query', (ctx) => inline.callbackQuery(bot, ctx));
bot.on('photo', middleware.downloadPhotoMiddleware, (ctx) =>
  files.fileHandler('photo', bot, ctx));
bot.on('video', middleware.downloadVideoMiddleware, (ctx) =>
  files.fileHandler('video', bot, ctx));
bot.on('document', middleware.downloadDocumentMiddleware, (ctx) =>
  files.fileHandler('document', bot, ctx));

bot.hears('Go back', (ctx) => ctx.reply('Service', inline.replyKeyboard(keys)));
bot.hears('testing', (ctx) => text.handleText(bot, ctx, keys));
bot.hears(/(.+)/, (ctx) => text.handleText(bot, ctx, keys));

bot.catch((err) => console.log('Error: ', err));

bot.launch();
