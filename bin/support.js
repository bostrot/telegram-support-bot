const Telegraf = require('telegraf');
const {Extra} = Telegraf;
const config = require('../config.js');
const handler = require('./ticket_handler.js');
let cache = require('./cache.js');

const bot = new Telegraf(config.bot_token);

const cron = require('cron');
const exec = require('child_process').exec;
let cronJob;

cache.html = Extra.HTML(); // eslint-disable-line no-use-before-define
cache.noSound = Extra
      .HTML().notifications(false); // eslint-disable-line no-use-before-define

const root = Extra.HTML().markup(( // eslint-disable-line no-use-before-define
  m // inline keyboard for admin dashboard
) =>
  m.inlineKeyboard([
    m.callbackButton('🔄 Update', 'update'),
    m.callbackButton('📖 Log', 'log'),
    m.callbackButton('♻️ Restart', 'restart'),
    m.callbackButton('🚫 Stop', 'stop'),
  ])
);

bot.action('restart', (ctx) => {
  // restart other bot
  if (ctx.from.id === config.owner_id) {
    ex('service ' + config.supported_bot + ' restart', function(results) {
      setTimeout(function() {
        ex('service ' + config.supported_bot + ' status', function(results) {
          if (cronJob !== undefined) {
            status = cronJob.running;
          }
          ctx.editMessageText(
            'Current status:\n' + results + '\nCron running: restart',
            root
          );
        });
      }, 2000);
    });
    if (cronJob !== undefined) {
      if (cronJob.running === false) {
        cronJob.start();
      }
    }
  }
});
bot.action('log', (ctx) => {
  // send other bots log
  if (ctx.from.id == config.owner_id) {
    ex(
      'journalctl -u ' + config.supported_bot + ' -b > /logs/log.txt',
      function(results) {
        ctx.replyWithDocument({
          source: '/logs/log.txt',
        });
      }
    );
  }
});
bot.action('update', (ctx) => {
  // update admin dasboard"s status
  if (ctx.from.id == config.owner_id) {
    let status;
    ex('service ' + config.supported_bot + ' status', function(results) {
      if (cronJob !== undefined) {
        status = cronJob.running;
      }
      ctx.editMessageText(
        'Current status:\n' + results + '\nCron running: ' + status,
        root
      );
    });
  }
});
bot.action('stop', (ctx) => {
  // stop the bot
  if (ctx.from.id == config.owner_id) {
    ex('service ' + config.supported_bot + ' stop', function(results) {
      ctx.editMessageText('Bitgram stopped', root);
    });
    if (cronJob !== undefined) {
      if (cronJob.running === true) {
        cronJob.stop();
      }
    }
  }
});

let cronSession = function(ctx) {
  // check every 5 seconds if other bot is down, if it"s inactive restart it
  console.log('Session started.\n');
  cronJob = cron.job(
    '*/5 * * * * *',
    function() {
      // 5 seconds
      ex('systemctl is-active ' + config.supported_bot + '', function(results) {
        if (results.indexOf('failed') > -1) {
          // restart on failed
          ex(
            'journalctl -u ' +
              config.supported_bot +
              ' -b > /var/www/cache.html/' +
              config.supported_bot +
              '/logs/log.txt',
            function(results) {
              ctx.replyWithDocument({
                source:
                  '/var/www/cache.html/' +
                  config.supported_bot +
                  '/logs/log.txt',
              });
            }
          );
          ex('service ' + config.supported_bot + ' start', function(results) {
            bot.telegram.sendMessage(
              config.staffchat_id,
              'Restarted bot. See log.',
              cache.html
            );
          });
        }
        if (results.indexOf('inactive') > -1) {
          // restart on inactive
          ex(
            'journalctl -u ' +
              config.supported_bot +
              ' -b > /var/www/cache.html/' +
              config.supported_bot +
              '/logs/log.txt',
            function(results) {
              ctx.replyWithDocument({
                source:
                  '/var/www/cache.html/' +
                  config.supported_bot +
                  '/logs/log.txt',
              });
            }
          );
          ex('service ' + config.supported_bot + ' start', function(results) {
            bot.telegram.sendMessage(
              config.staffchat_id,
              'Restarted bot. See log.',
              cache.html
            );
          });
        }
        results = null;
      });
    },
    function() {
      bot.telegram.sendMessage(
        config.staffchat_id,
        'Stopped cron job.',
        cache.html
      );
    }
  );
  cronJob.start();
};

let ex = function execute(command, callback) {
  // execute command
  exec(command, function(error, stdout, stderr) {
    callback(stdout);
  });
};

bot.command('start', ({ // on start reply with chat bot rules
  reply, from, chat}) => {
  reply(config.startCommandText, cache.html);
});

bot.command('id', ({reply, from, chat}) => {
  reply(from.id + ' ' + chat.id);
});
bot.command('faq', (ctx) => {
  // faq
  ctx.reply(config.faqCommandText);
});

bot.command('root', (ctx) => {
  // admin dashboard can only be used by owner
  console.log('id ' + ctx.from.id);
  if (ctx.from.id.toString() == config.owner_id) {
    bot.telegram.sendMessage(
      config.staffchat_id,
      'You will receive the logs when the bot crashes.',
      root
    );
    cronSession(ctx);
  }
});

bot.telegram.getMe().then((botInfo) => {
  // enable for groups (get own username)
  bot.options.username = botInfo.username;
});

const downloadPhotoMiddleware = (ctx, next) => {
  // download photos
  return bot.telegram.getFileLink(ctx.message.photo[0]).then((link) => {
    ctx.state.fileLink = link;
    return next();
  });
};

const downloadVideoMiddleware = (ctx, next) => {
  // download videos
  return bot.telegram.getFileLink(ctx.message.video).then((link) => {
    ctx.state.fileLink = link;
    return next();
  });
};

const downloadDocumentMiddleware = (ctx, next) => {
  // download documents
  console.log(ctx.message);
  return bot.telegram.getFileLink(ctx.message.document).then((link) => {
    ctx.state.fileLink = link;
    return next();
  });
};

// display open tickets
bot.command('open', (ctx) => {
  ctx.getChat().then(function(chat) {
    if (chat.id.toString() === config.staffchat_id) {
      console.log('chatid', chat.id.toString());
      ctx.getChatAdministrators().then(function(admins) {
        admins = JSON.stringify(admins);
        if (admins.indexOf(ctx.from.id) > -1) {
          let openTickets = '';
          for (let i in cache.ticketIDs) {
            if (cache.ticketStatus[cache.ticketIDs[i]] === true) {
              if (openTickets.indexOf(cache.ticketIDs[i]) === -1) {
                openTickets += '<code>#' + cache.ticketIDs[i] + '</code>\n';
              }
            }
          }
          setTimeout(function() {
            bot.telegram.sendMessage(
              chat.id,
              '<b>Open Tickets:\n\n</b>' + openTickets,
              cache.noSound
            );
          }, 10);
        }
      });
    }
  });
});

// close ticket
bot.command('close', (ctx) => {
  ctx.getChat().then(function(chat) {
    if (chat.id.toString() === config.staffchat_id) {
      ctx.getChatAdministrators().then(function(admins) {
        admins = JSON.stringify(admins);
        if (
          ctx.message.reply_to_message !== undefined &&
          admins.indexOf(ctx.from.id) > -1
        ) {
          let replyText = ctx.message.reply_to_message.text;
          let userid = replyText.match(new RegExp('#' + '(.*)' + ' from'));
          cache.ticketStatus[userid[1]] = false;
        }
      });
    }
  });
});

// handle photo input
bot.on('photo', downloadPhotoMiddleware, (ctx, next) => {
  handler.photo(bot, ctx);
});

// handle video input
bot.on('video', downloadVideoMiddleware, (ctx, next) => {
  handler.photo(bot, ctx);
});

// handle file input
bot.on('document', downloadDocumentMiddleware, (ctx, next) => {
  handler.document(bot, ctx);
});

bot.hears(/(.+)/, (ctx) => handler.ticket(bot, ctx));

bot.startPolling();
/*
If you receive Error: 409: Conflict: can't use getUpdates method while
webhook is active, comment bot.startPolling() out, remove // of the following
commands, run your bot once and undo the changes. This will disable the
webhook by setting it to empty.

bot.telegram.setWebhook("");
bot.startWebhook("")
*/
