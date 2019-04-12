const config = require('../config.js');
const cache = require('./cache.js');
var dbhandler = require('./dbhandler.js')

function ticketHandler(bot, ctx) {
  ctx.getChat().then(function (chat) {
    if (chat.id.toString() === config.staffchat_id) {
      // let staff handle that
      staffChat(ctx, bot, chat);
    } else if (chat.type === 'private') {
      // create a ticket and send to staff
      // check db for user status
        dbhandler.check(ctx.message.from.id, function (user) {
          if (user == undefined || user.status == undefined) {
            dbhandler.add(ctx.message.from.id, "open");
          } else if (user.status !== "banned") {
            customerChat(ctx, bot, chat);
          }
        });
    }
  });
}

// reply to tickets in staff chat
function staffChat(ctx, bot) {
  // check whether person is an admin
  ctx.getChatAdministrators()
    .then(function (admins) {
      admins = JSON.stringify(admins);
      let replyText;
      if (
        ctx.message.reply_to_message !== undefined &&
        admins.indexOf(ctx.from.id) > -1
      ) {
        // try whether a text or an image/video is replied to
        try {
          replyText = ctx.message.reply_to_message.text;
          if (replyText === undefined) {
            replyText = ctx.message.reply_to_message.caption;
          }
          let userid = replyText.match(new RegExp('#t' + '(.*)' + ' ' + config.lang_from));
          if (userid === null || userid === undefined) {
            userid = replyText.match(new RegExp('#t' + '(.*)' + '\n' + config.lang_from));
          }
          let name = replyText.match(new RegExp(config.lang_from + ' ' + '(.*)' + ' ' 
            + config.lang_language));
          if (ctx.message.text !== undefined && ctx.message.text === 'me') {
            // accept ticket
            bot.telegram.sendMessage(
              config.staffchat_id,
              '<b>' +
              config.lang_ticket +
              ' #t' +
              userid[1] +
              '</b> ' +
              config.lang_acceptedBy +
              ' ' +
              ctx.message.from.first_name +
              ' -> /open',
              cache.noSound
            );
          } else {
            cache.ticketStatus[userid[1]] = false;
            bot.telegram.sendMessage(
              userid[1],
              config.lang_dear +
              ' <b>' +
              name[1] +
              '</b>,\n\n' +
              ctx.message.text +
              '\n\n' +
              config.lang_regards +
              '\n' +
              ctx.message.from.first_name,
              cache.html
            );
            bot.telegram.sendMessage(
              config.staffchat_id,
              config.lang_msg_sent +
              ' <a href="tg://user?id=' + userid[1] + '">' + name[1] + '</a>',
              cache.noSound
            );
            console.log(
              'Answer: ' +
              config.lang_ticket +
              ' #t' +
              userid[1] +
              ' ' +
              config.lang_dear +
              ' ' +
              name[1] +
              ' ' +
              ctx.message.text +
              ' ' +
              config.lang_from +
              ' ' +
              ctx.message.from.first_name
            );
          }
          cache.ticketSent[userid[1]] = undefined;
          // close ticket
          dbhandler.add(userid[1], "closed");
        } catch (e) {
          console.log(e)
          bot.telegram.sendMessage(
            config.staffchat_id, 'An error occured, please report this to your admin: \n\n' + e,
            cache.noSound
          );
        }
      }
    })
    .catch(function (noAdmin) {
      console.log('Error with admins: ' + noAdmin);
    });
}

function customerChat(ctx, bot, chat) {
  cache.tickedID = ctx.message.from.id;
  if (cache.ticketIDs[cache.ticketID] === undefined) {
    cache.ticketIDs.push(cache.tickedID);
  }
  cache.ticketStatus[cache.tickedID] = true;
  userInfo = '';
  userInfo +=
    ' ' + config.lang_from + ' <a href="tg://user?id=' + cache.tickedID + '">' +
    ctx.message.from.first_name + '</a>' + ' ';
  userInfo +=
    config.lang_language +
    ': ' +
    ctx.message.from.language_code +
    '\n\n';
  if (cache.ticketSent[cache.tickedID] === undefined) {
    bot.telegram.sendMessage(chat.id, config.lang_contactMessage, cache.html);
    bot.telegram.sendMessage(
      config.staffchat_id,
      '' +
      config.lang_ticket +
      ' #t' +
      cache.tickedID +
      userInfo +
      ctx.message.text,
      cache.html
    );
    // wait 5 minutes before this message appears again and do not
    // send notificatoin sounds in that time to avoid spam
    setTimeout(function () {
      cache.ticketSent[cache.tickedID] = undefined;
    }, config.spam_time);
    cache.ticketSent[cache.tickedID] = 0;
  } else if (cache.ticketSent[cache.tickedID] < 4) {
    cache.ticketSent[cache.tickedID]++;
    bot.telegram.sendMessage(
      config.staffchat_id,
      config.lang_ticket +
      ' #t' +
      cache.tickedID +
      userInfo +
      ctx.message.text,
      cache.html
    );
  } else if (cache.ticketSent[cache.tickedID] === 4) {
    cache.ticketSent[cache.tickedID]++;
    bot.telegram.sendMessage(chat.id, config.lang_blockedSpam, cache.html);
  }
  console.log(
    'Ticket: ' +
    ' #t' +
    cache.tickedID +
    userInfo.replace('\n\n', ': ')
    .replace('<a href="tg://user?id='+cache.tickedID+'">', '').replace('</a>', '') +
    ctx.message.text
  );
}

function videoHandler(bot, ctx) {
  forwardFile(bot, ctx, function (userInfo) {
    bot.telegram.sendVideo(config.staffchat_id, ctx.message.video.file_id, {
      caption: config.lang_ticket +
        ': #t' +
        cache.ticketID +
        '\n' +
        userInfo +
        '\n' +
        (ctx.message.caption || ''),
    });
  });
}

function photoHandler(bot, ctx) {
  forwardFile(bot, ctx, function (userInfo) {
    bot.telegram.sendPhoto(config.staffchat_id, ctx.message.photo[0].file_id, {
      caption: config.lang_ticket +
        ': #t' +
        cache.ticketID +
        '\n' +
        userInfo +
        '\n' +
        (ctx.message.caption || ''),
    });
  });
}

function documentHandler(bot, ctx) {
  forwardFile(bot, ctx, function (userInfo) {
    bot.telegram.sendDocument(
      config.staffchat_id,
      ctx.message.document.file_id, {
        caption: config.lang_ticket +
          ': #t' +
          cache.ticketID +
          '\n' +
          userInfo +
          (ctx.message.caption || ''),
      }
    );
  });
}

function forwardFile(bot, ctx, callback) {
  if (cache.ticketSent[cache.tickedID] === undefined) {
    fowardHandler(ctx, function (userInfo) {
      callback(userInfo);
    });
    // wait 5 minutes before this message appears again and do not
    // send notificatoin sounds in that time to avoid spam
    setTimeout(function () {
      cache.ticketSent[cache.tickedID] = undefined;
    }, config.spam_time);
    cache.ticketSent[cache.tickedID] = 0;
  } else if (cache.ticketSent[cache.tickedID] < 5) {
    cache.ticketSent[cache.tickedID]++;
    // TODO: add cache.noSound property for silent notifications
    fowardHandler(ctx, function (userInfo) {
      callback(userInfo);
    });
  } else if (cache.ticketSent[cache.tickedID] === 5) {
    cache.ticketSent[cache.tickedID]++;
    bot.telegram.sendMessage(chat.id, config.lang_blockedSpam, cache.html);
  }
}

function fowardHandler(ctx, callback) {
  ctx.getChat().then(function (chat) {
    if (chat.type === 'private') {
      cache.ticketID = ctx.message.from.id;
      userInfo = '';
      userInfo += config.lang_from + ' ' + ctx.message.from.first_name + ' ';
      userInfo +=
        '@' +
        ctx.message.from.username +
        ' ' +
        config.lang_language +
        ': ' +
        ctx.message.from.language_code +
        '\n\n';
      callback(userInfo);
    }
  });
}

module.exports = {
  ticket: ticketHandler,
  photo: photoHandler,
  video: videoHandler,
  document: documentHandler,
};
