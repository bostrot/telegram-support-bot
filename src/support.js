const Telegraf = require('telegraf');
const {Extra} = Telegraf;
const config = require(__dirname + '/../config/config.js');
const handler = require('./ticket_handler.js');
const cache = require('./cache.js');
const dbhandler = require('./dbhandler.js');
const session = require('telegraf/session');

const bot = new Telegraf(config.bot_token);

// overload logging to file
const fs = require('fs');
const util = require('util');
const debugFile = __dirname + '/../config/debug.log';
const logStdout = process.stdout;

console.log = function(d) {
  logStdout.write(util.format(d) + '\n');

  fs.appendFile(debugFile,
      util.format(d) + '\n', 'utf8',
      function(err) {
        if (err) throw err;
      });
};

// catch uncaught exceptions to log
process.on('uncaughtException', (err) => {
  console.log('=== UNHANDLED ERROR ===');
  fs.appendFile(debugFile,
      err.stack + '\n', 'utf8',
      function(err) {
        if (err) throw err;
      });
  console.error('Error: ', err);
  process.exit(1);
});


// catch uncaught rejections to log
process.on('unhandledRejection', (err, p) => {
  console.log('=== UNHANDLED REJECTION ===');
  fs.appendFile(debugFile,
      err.stack + '\n', 'utf8',
      function(err) {
        if (err) throw err;
      });
  console.dir(err);
});

// eslint-disable-next-line new-cap
cache.html = Extra.HTML();
cache.markdown = Extra.markdown();
cache.noSound = Extra
// eslint-disable-next-line new-cap
    .HTML().notifications(false);

bot.use(session());
bot.use((ctx, next) => {
  ctx.getChat().then(function(chat) {
    if (chat.type === 'private') {
      ctx.session.admin = false;
      return next();
    } else {
      ctx.getChatAdministrators()
          .then(function(admins) {
            admins = JSON.stringify(admins);
            if (
              ctx.message.reply_to_message !== undefined &&
              admins.indexOf(ctx.from.id) > -1
            ) {
              // admin
              ctx.session.admin = true;
            } else {
              // no admin
              ctx.session.admin = false;
            }
            return next();
          });
    }
  });
});

// on start reply with chat bot rules
bot.command('start', ({
  reply, from, chat}) => {
  reply(config.startCommandText, cache.html, cache.html);
});

bot.command('id', ({reply, from, chat}) => {
  reply(from.id + ' ' + chat.id);
});

bot.command('faq', (ctx) => {
  ctx.reply(config.faqCommandText, cache.html);
});

bot.command('help', (ctx) => {
  ctx.reply(config.helpCommandText, cache.html);
});

// enable for groups (get own username)
bot.telegram.getMe().then((botInfo) => {
  bot.options.username = botInfo.username;
});

// download photos
const downloadPhotoMiddleware = (ctx, next) => {
  return bot.telegram.getFileLink(ctx.message.photo[0]).then((link) => {
    ctx.state.fileLink = link;
    return next();
  });
};

// download videos
const downloadVideoMiddleware = (ctx, next) => {
  return bot.telegram.getFileLink(ctx.message.video).then((link) => {
    ctx.state.fileLink = link;
    return next();
  });
};

// download documents
const downloadDocumentMiddleware = (ctx, next) => {
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
      // check if admin
      ctx.getChatAdministrators().then(function(admins) {
        admins = JSON.stringify(admins);
        if (admins.indexOf(ctx.from.id) > -1) {
          dbhandler.open(function(userList) {
            let openTickets = '';
            for (const i in userList) {
              if (userList[i]['userid'] !== null &&
                  userList[i]['userid'] !== undefined) {
                openTickets += '#T' + userList[i]['id']
                    .toString().padStart(6, '0')
                    .toString() + '\n';
              }
            }
            setTimeout(function() {
              bot.telegram.sendMessage(
                  chat.id,
                  '<b>Open Tickets:\n\n</b>' + openTickets,
                  cache.noSound
              );
            }, 10);
          });
        }
      });
    }
  });
});

// close ticket
bot.command('close', (ctx) => {
  ctx.getChat().then(function(chat) {
    if (chat.id.toString() === config.staffchat_id) {
      // check if admin
      ctx.getChatAdministrators().then(function(admins) {
        admins = JSON.stringify(admins);
        if (
          ctx.message.reply_to_message !== undefined &&
          admins.indexOf(ctx.from.id) > -1
        ) {
          let replyText = ctx.message.reply_to_message.text;
          if (replyText == undefined) {
            replyText = ctx.message.reply_to_message.caption;
          }
          const userid = replyText.match(new RegExp('#T' + '(.*)' + ' ' +
              config.lang_from));
          // get userid from ticketid
          dbhandler.check(userid[1], function(ticket) {
            dbhandler.add(ticket.userid, 'closed');
            bot.telegram.sendMessage(
                chat.id,
                'Ticket #T'+ticket.id.toString().padStart(6, '0')+' closed',
                cache.noSound
            );
          });
        }
      });
    }
  });
});

// ban user
bot.command('ban', (ctx) => {
  ctx.getChat().then(function(chat) {
    if (chat.id.toString() === config.staffchat_id) {
      ctx.getChatAdministrators().then(function(admins) {
        admins = JSON.stringify(admins);
        if (
          ctx.message.reply_to_message !== undefined &&
          admins.indexOf(ctx.from.id) > -1
        ) {
          const replyText = ctx.message.reply_to_message.text;
          const userid = replyText.match(new RegExp('#T' + '(.*)' +
              ' ' + config.lang_from));

          // get userid from ticketid
          dbhandler.check(userid[1], function(ticket) {
            dbhandler.add(ticket.userid, 'banned');
            bot.telegram.sendMessage(
                chat.id,
                config.lang_usr_with_ticket + ' #T'+
                ticket.id.toString().padStart(6, '0')+
                    ' ' + config.lang_banned,
                cache.noSound
            );
          });
        }
      });
    }
  });
});

// handle photo input
bot.on('photo', downloadPhotoMiddleware, (ctx, next) => {
  handler.file('photo', bot, ctx);
});

// handle video input
bot.on('video', downloadVideoMiddleware, (ctx, next) => {
  handler.file('video', bot, ctx);
});

// handle file input
bot.on('document', downloadDocumentMiddleware, (ctx, next) => {
  handler.file('document', bot, ctx);
});

bot.hears(/(.+)/, (ctx) => handler.ticket(bot, ctx));

// telegraf error handling
bot.catch((err) => {
  console.log('Error: ', err);
});

bot.startPolling();
/*
If you receive Error: 409: Conflict: can't use getUpdates method while
webhook is active, comment bot.startPolling() out, remove // of the following
commands, run your bot once and undo the changes. This will disable the
webhook by setting it to empty.

bot.telegram.setWebhook("");
bot.startWebhook("")
*/
