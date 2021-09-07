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
import * as webserver from './web';
import cache from './cache';

import * as signal from './addons/signal';

signal.init(function(ctx, msg) {
  console.log(msg)
  text.handleText(bot, ctx, msg);
});

// Create new Telegraf() with token
const bot = new Telegraf(config.bot_token);
cache.bot = bot;

// Start webserver
webserver.init(bot);

// Init error handling
error.init(bot);

// TODO: Unit testing
const testing = false;
if (testing) {
  const {tests} = require('../tests/testing');
  tests(bot);
}

// Use session and check for permissions on message
bot.use(permissions.currentSession());
bot.use((ctx, next) => {
  // Check dev mode
  if (config.dev_mode) {
    ctx.reply('<i>Dev mode is on: You might notice some delay in messages, no replies or other errors.</i>', Extra.HTML());
  }
  permissions.checkPermissions(ctx, next, config)
});

// Init category keys
const keys = inline.initInline(bot, config);

// Set bots username
bot.telegram.getMe().then((botInfo) => bot.options.username = botInfo.username);

// Bot commands
bot.command('open', (ctx) => commands.openCommand(ctx));
bot.command('close', (ctx) => commands.closeCommand(bot, ctx));
bot.command('ban', (ctx) => commands.banCommand(bot, ctx));
bot.command('unban', (ctx) => commands.unbanCommand(bot, ctx));
bot.command('clear', (ctx) => commands.clearCommand(ctx));
bot.command('start', (ctx) => {
  ctx.session.mode = undefined;
  ctx.session.modeData = undefined;
  if (ctx.chat.type == 'private') {
    ctx.reply(config.language.startCommandText);
    if (config.categories.length > 0)
      setTimeout(() => ctx.reply(config.language.services, inline.replyKeyboard(keys)), 500);    
  } else ctx.reply(config.language.prvChatOnly);
});
bot.command('id', (ctx) => ctx.reply(ctx.from.id + ' ' + ctx.chat.id));
bot.command('faq', (ctx) => 
ctx.reply(config.language.faqCommandText, Extra.HTML()));
bot.command('help', (ctx) => ctx.reply(config.language.helpCommandText, Extra.HTML()));
bot.command('links', (ctx) => {
  let links = '';
  const subcategories = [];
  for (const i in config.categories) {
    if (i !== undefined) {
      for (const j in config.categories[i].subgroups) {
        if (j !== undefined) {
          const catName = config.categories[i].subgroups[j].name;
          const id = (config.categories[i].name +
            config.categories[i].subgroups[j].name)
            .replace(/[\[\]\:\ "]/g, '').substr(0,63);
          if (subcategories.indexOf(id) == -1) {
            subcategories.push(id);
            links += `${catName} - https://t.me/${bot.options.username}?start=${id}\n`;
          }
        }
      }
    }
  }
  ctx.reply(`${config.language.links}:\n${links}`, Extra.HTML())
});

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
bot.catch((err, ctx) => {
  console.log('Error: ', err);
  // Catch bot blocked by user
  try {
    ctx.reply('Message is not sent due to an error.');
  } catch(e) {
    console.log('Could not send error msg to chat: ', e);
  }
});

bot.launch();
