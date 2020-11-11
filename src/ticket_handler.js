const config = require(__dirname + '/../config/config.js');
const cache = require('./cache.js');
const dbhandler = require('./dbhandler.js');

/**
 * Decide whether to forward or stop the message.
 * @param {bot} bot Bot object.
 * @param {context} ctx Bot context.
 */
function ticketHandler(bot, ctx) {
  ctx.getChat().then(function(chat) {
    if (chat.id.toString() === config.staffchat_id) {
      // let staff handle that
      staffChat(ctx, bot, chat);
    } else if (chat.type === 'private') {
      // create a ticket and send to staff
      // check db for user status
      dbhandler.check(ctx.message.from.id, function(user) {
        if (user == undefined || user.status == undefined ||
            user.status == 'closed') {
          dbhandler.add(ctx.message.from.id, 'open');
          customerChat(ctx, bot, chat);
        } else if (user.status !== 'banned') {
          customerChat(ctx, bot, chat);
        }
      });
    }
  });
}

/**
 * Reply to tickets in staff chat.
 * @param {context} ctx Bot context.
 * @param {bot} bot Bot object.
 */
function staffChat(ctx, bot) {
  // check whether person is an admin
  if (!ctx.session.admin) {
    return;
  }
  // try whether a text or an image/video is replied to
  try {
    // replying to non-ticket
    if (ctx.message === undefined) {
      return;
    }
    replyText = ctx.message.reply_to_message.text;
    if (replyText === undefined) {
      replyText = ctx.message.reply_to_message.caption;
    }

    let userid = replyText.match(new RegExp('#T' +
        '(.*)' + ' ' + config.lang_from));
    if (userid === null || userid === undefined) {
      userid = replyText.match(new RegExp('#T' +
          '(.*)' + '\n' + config.lang_from));
    }

    dbhandler.check(userid[1], function(ticket) {
      const name = replyText.match(new RegExp(
          config.lang_from + ' ' + '(.*)' + ' ' +
      config.lang_language));
      if (ctx.message.text !== undefined && ctx.message.text === 'me') {
        // accept ticket
        // Get Ticket ID from DB
        bot.telegram.sendMessage(config.staffchat_id, '<b>' +
          config.lang_ticket +
          ' #T' +
          user.id.toString().padStart(6, '0') +
          '</b> ' +
          config.lang_acceptedBy +
          ' ' +
          ctx.message.from.first_name +
          ' -> /open',
        cache.noSound
        );
      } else {
        // replying to non-ticket
        if (userid === null) {
          return;
        }
        cache.ticketStatus[userid[1]] = false;
        bot.telegram.sendMessage(ticket.userid, config.lang_dear +
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
          ' #T' +
          ticket.id.toString().padStart(6, '0') +
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
      dbhandler.add(userid[1], 'closed');
    });
  } catch (e) {
    console.log(e);
    bot.telegram.sendMessage(
        config.staffchat_id, `An error occured, please 
          report this to your admin: \n\n` + e,
        cache.noSound
    );
  }
}

/**
 * Ticket handling and spam protection.
 * @param {context} ctx Bot context.
 * @param {bot} bot Bot object.
 * @param {chat} chat Bot chat.
 */
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
    // Get Ticket ID from DB
    bot.telegram.sendMessage(chat.id, config.lang_contactMessage, cache.html);
    // Get Ticket ID from DB
    dbhandler.check(chat.id, function(ticket) {
      bot.telegram.sendMessage(
          config.staffchat_id,
          '' +
        config.lang_ticket +
        ' #T' +
        ticket.id.toString().padStart(6, '0') +
        userInfo +
        ctx.message.text,
          cache.html
      );
    });
    // wait 5 minutes before this message appears again and do not
    // send notificatoin sounds in that time to avoid spam
    setTimeout(function() {
      cache.ticketSent[cache.tickedID] = undefined;
    }, config.spam_time);
    cache.ticketSent[cache.tickedID] = 0;
  } else if (cache.ticketSent[cache.tickedID] < 4) {
    cache.ticketSent[cache.tickedID]++;
    dbhandler.check(cache.tickedID, function(ticket) {
      bot.telegram.sendMessage(
          config.staffchat_id,
          config.lang_ticket +
        ' #T' +
        ticket.id.toString().padStart(6, '0') +
        userInfo +
        ctx.message.text,
          cache.html
      );
    });
  } else if (cache.ticketSent[cache.tickedID] === 4) {
    cache.ticketSent[cache.tickedID]++;
    bot.telegram.sendMessage(chat.id, config.lang_blockedSpam, cache.html);
  }
  dbhandler.check(cache.tickedID, function(ticket) {
    console.log(
        `Ticket: ` +
    ' #T' +
    ticket.id.toString().padStart(6, '0') +
    userInfo.replace('\n\n', ': ')
        .replace('<a href="tg://user?id='+cache.tickedID+'">', '').replace('</a>', '') +
    ctx.message.text
    );
  });
}

/**
 * Forward video files to staff.
 * @param {string} type document, photo, video.
 * @param {bot} bot Bot object.
 * @param {context} ctx Bot context.
 */
function fileHandler(type, bot, ctx) {
  // replying to non-ticket
  let userid;
  if (ctx.message !== undefined && ctx.message.reply_to_message !== undefined && ctx.session.admin) {
    replyText = ctx.message.reply_to_message.text;
    if (replyText === undefined) {
      replyText = ctx.message.reply_to_message.caption;
    }
    userid = replyText.match(new RegExp('#T' +
        '(.*)' + ' ' + config.lang_from));
    if (userid === null || userid === undefined) {
      userid = replyText.match(new RegExp('#T' +
          '(.*)' + '\n' + config.lang_from));
    }
  }
  forwardFile(bot, ctx, function(userInfo) {
    let receiverId = config.staffchat_id;
    let msgId = ctx.message.chat.id;
    // if admin
    if (ctx.session.admin && userInfo === undefined) {
      msgId = userid[1];
    }
    dbhandler.check(msgId, function(ticket) {
      console.log(ticket);
      let captionText = config.lang_ticket +
      ' #T' +
      ticket.id.toString().padStart(6, '0') +
      ' ' +
      userInfo +
      '\n' +
      (ctx.message.caption || '');
      if (ctx.session.admin && userInfo === undefined) {
        receiverId = ticket.userid;
        captionText = (ctx.message.caption || '');
      }
      switch (type) {
        case 'document':
          bot.telegram.sendDocument(
              receiverId,
              ctx.message.document.file_id, {
                caption: captionText,
              }
          );
          break;
        case 'photo':
          bot.telegram.sendPhoto(receiverId, ctx.message.photo[0].file_id, {
            caption: captionText,
          });
          break;
        case 'video':
          bot.telegram.sendVideo(receiverId, ctx.message.video.file_id, {
            caption: captionText,
          });
          break;
      }
    });
  });
}

/**
 * Handle caching for sent files.
 * @param {bot} bot Bot object.
 * @param {context} ctx Bot context.
 * @param {callback} callback Bot callback.
 */
function forwardFile(bot, ctx, callback) {
  dbhandler.check(ctx.message.from.id, function(user) {
    let ok = false;
    if (user == undefined || user.status == undefined ||
        user.status == 'closed') {
      dbhandler.add(ctx.message.from.id, 'open');
      ok = true;
    }
    if (ok || user !== undefined && user.status !== 'banned') {
      if (cache.ticketSent[cache.tickedID] === undefined) {
        fowardHandler(ctx, function(userInfo) {
          callback(userInfo);
        });
        // wait 5 minutes before this message appears again and do not
        // send notificatoin sounds in that time to avoid spam
        setTimeout(function() {
          cache.ticketSent[cache.tickedID] = undefined;
        }, config.spam_time);
        cache.ticketSent[cache.tickedID] = 0;
      } else if (cache.ticketSent[cache.tickedID] < 5) {
        cache.ticketSent[cache.tickedID]++;
        // TODO: add cache.noSound property for silent notifications
        fowardHandler(ctx, function(userInfo) {
          callback(userInfo);
        });
      } else if (cache.ticketSent[cache.tickedID] === 5) {
        cache.ticketSent[cache.tickedID]++;
        bot.telegram.sendMessage(chat.id, config.lang_blockedSpam, cache.html);
      }
    }
  });
}

/**
 * Check if msg comes from user or admin.
 * @param {context} ctx Bot context.
 * @param {callback} callback Bot callback.
 */
function fowardHandler(ctx, callback) {
  ctx.getChat().then(function(chat) {
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
    } else {
      callback();
    }
  });
}

module.exports = {
  ticket: ticketHandler,
  file: fileHandler,
};
