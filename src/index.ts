/* eslint-disable new-cap */
const Telegraf = require( 'telegraf');
const {Extra} = Telegraf;

import * as fs from 'fs';
import * as YAML from 'yaml';
import cache from './cache';
cache.config = YAML.parse(fs.readFileSync('./config/config.yaml', 'utf8'));

import * as middleware from './middleware';
import * as commands from './commands';
import * as permissions from './permissions';
import * as inline from './inline';
import * as text from './text';
import * as files from './files';
import * as error from './error';
import * as webserver from './addons/web';

import * as signal from './addons/signal';

// Create new Telegraf() with token
let defaultBot;
function createBot(noCache = false) {
  defaultBot = new Telegraf(cache.config.bot_token);
  
  return defaultBot;
}

function main(bot = defaultBot, logs = true) {
  cache.bot = defaultBot;
  // Check addon
  if (cache.config.signal_enabled) {
    signal.init(function(ctx, msg) {
      console.log(msg)
      text.handleText(bot, ctx, msg);
    });
  }

  // Start webserver
  if (cache.config.web_server) {
    webserver.init(bot);
  }
  // Init error handling
  error.init(bot, logs);

  // Use session and check for permissions on message
  bot.use(permissions.currentSession());
  bot.use((ctx, next) => {
    // Check dev mode
    if (cache.config.dev_mode) {
      middleware.reply(ctx, '<i>Dev mode is on: You might notice some delay in messages, no replies or other errors.</i>', Extra.HTML());
    }
    permissions.checkPermissions(ctx, next, cache.config)
  });

  // Init category keys
  const keys = inline.initInline(bot, cache.config);

  // Set bots username
  bot.telegram.getMe().then((botInfo) => bot.options.username = botInfo.username);

  // Bot commands
  bot.command('open', (ctx) => commands.openCommand(ctx));
  bot.command('close', (ctx) => commands.closeCommand(bot, ctx));
  bot.command('ban', (ctx) => commands.banCommand(bot, ctx));
  bot.command('reopen', (ctx) => commands.reopenCommand(bot, ctx));
  bot.command('unban', (ctx) => commands.unbanCommand(bot, ctx));
  bot.command('clear', (ctx) => commands.clearCommand(ctx));
  bot.command('start', (ctx) => {
    ctx.session.mode = undefined;
    ctx.session.modeData = undefined;
    if (ctx.chat.type == 'private') {
      middleware.reply(ctx, cache.config.language.startCommandText);
      if (cache.config.categories && cache.config.categories.length > 0)
        setTimeout(() => middleware.reply(ctx, cache.config.language.services, inline.replyKeyboard(keys)), 500);    
    } else middleware.reply(ctx, cache.config.language.prvChatOnly);
  });
  bot.command('id', (ctx) => middleware.reply(ctx, ctx.from.id + ' ' + ctx.chat.id));
  bot.command('faq', (ctx) => 
  middleware.reply(ctx, cache.config.language.faqCommandText, Extra.HTML()));
  bot.command('help', (ctx) => middleware.reply(ctx, cache.config.language.helpCommandText, Extra.HTML()));
  bot.command('links', (ctx) => {
    let links = '';
    const subcategories = [];
    for (const i in cache.config.categories) {
      if (i !== undefined) {
        for (const j in cache.config.categories[i].subgroups) {
          if (j !== undefined) {
            const catName = cache.config.categories[i].subgroups[j].name;
            const id = (cache.config.categories[i].name +
              cache.config.categories[i].subgroups[j].name)
              .replace(/[\[\]\:\ "]/g, '').substr(0,63);
            if (subcategories.indexOf(id) == -1) {
              subcategories.push(id);
              links += `${catName} - https://t.me/${bot.options.username}?start=${id}\n`;
            }
          }
        }
      }
    }
    middleware.reply(ctx, `${cache.config.language.links}:\n${links}`, Extra.HTML())
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
  bot.hears(cache.config.language.back, (ctx) => middleware.reply(ctx, cache.config.language.services, inline.replyKeyboard(keys)));
  bot.hears('testing', (ctx) => text.handleText(bot, ctx, keys));
  bot.hears(/(.+)/, (ctx) => text.handleText(bot, ctx, keys));

  // Catch bot errors
  bot.catch((err, ctx) => {
    console.log('Error: ', err);
    // Catch bot blocked by user
    try {
      middleware.reply(ctx, 'Message is not sent due to an error.');
    } catch(e) {
      console.log('Could not send error msg to chat: ', e);
    }
  });

  if (logs) {
    bot.launch();
  }
}

createBot();
main();

export {
  createBot,
  main
}