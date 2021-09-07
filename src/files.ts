import * as db from './db';
import config from '../config/config';
import cache from './cache';
import * as staff from './staff';
import * as middleware from './middleware';
const {Extra} = require('telegraf');

/**
 * Helper for private reply
 * @param type 
 * @param bot 
 * @param ctx 
 */
function replyMarkup(ctx) {
  return {
      html: '',
      inline_keyboard: [
        [
          config.direct_reply ?
          {
            'text': config.language.replyPrivate,
            'url': `https://t.me/${ctx.from.username}`,
          } :
          {
            'text': config.language.replyPrivate,
            'callback_data': ctx.from.id +
            '---' + ctx.message.from.first_name + '---' + ctx.session.modeData.category +
            '---' + ctx.session.modeData.ticketid
          },
        ],
      ],
  }
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
  let replyText;
  if (ctx.message !== undefined &&
    ctx.message.reply_to_message !== undefined && ctx.session.admin) {
    replyText = ctx.message.reply_to_message.text;
    if (replyText === undefined) {
      replyText = ctx.message.reply_to_message.caption;
    }
    userid = replyText.match(new RegExp('#T' +
          '(.*)' + ' ' + config.language.from));
    if (userid === null || userid === undefined) {
      userid = replyText.match(new RegExp('#T' +
            '(.*)' + '\n' + config.language.from));
    }
    // replying to non-ticket
    if (userid === null || userid === undefined) {
      return;
    }
  }
  forwardFile(bot, ctx, function(userInfo) {
    let receiverId = config.staffchat_id;
    let msgId = ctx.message.chat.id;
    let isPrivate = false;
    // if admin
    if (ctx.session.admin && userInfo === undefined) {
      msgId = userid[1];
    }
    db.getOpen(msgId, ctx.session.groupCategory, function(ticket) {
      if (ticket == undefined) {
        if(ctx.session.admin && userInfo === undefined) {
          // replying to closed ticket
          ctx.reply(config.language.ticketClosedError);
        } else {
          ctx.reply(config.language.textFirst);
        }
        return;
      }
            let captionText = config.language.ticket +
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
      if (ctx.session.modeData != undefined &&
        ctx.session.modeData.userid != undefined) {
          receiverId = ctx.session.modeData.userid;
          isPrivate = true;
      }
      switch (type) {
        case 'document':
          bot.telegram.sendDocument(
              receiverId,
              ctx.message.document.file_id, {
                caption: captionText,
                reply_markup: isPrivate ? replyMarkup(ctx) : {},
              }
          );
          if (ctx.session.group !== undefined && ctx.session.group !== config.staffchat_id &&
            !ctx.session.modeData) {
            bot.telegram.sendDocument(
                ctx.session.group,
                ctx.message.document.file_id, {
                  caption: captionText,
                  reply_markup: {
                    html: '',
                    inline_keyboard: [
                      [
                        {
                          'text': config.language.replyPrivate,
                          'callback_data': ctx.from.id +
                          '---' + ctx.message.from.first_name + '---' + ctx.session.groupCategory +
                          '---' + ticket.id 
                        }
                      ],
                    ],
                  },
                }
            );
          }
          break;
        case 'photo':
          bot.telegram.sendPhoto(receiverId, ctx.message.photo[0].file_id, {
            caption: captionText,
            reply_markup: isPrivate ? replyMarkup(ctx) : {},
          });
          if (ctx.session.group !== undefined && ctx.session.group !== config.staffchat_id &&
            !ctx.session.modeData) {
            bot.telegram.sendPhoto(ctx.session.group,
                ctx.message.photo[0].file_id, {
                  caption: captionText,
                  reply_markup: {
                    html: '',
                    inline_keyboard: [
                      [
                        {
                          'text': config.language.replyPrivate,
                          'callback_data': ctx.from.id +
                          '---' + ctx.message.from.first_name + '---' + ctx.session.groupCategory +
                          '---' + ticket.id 
                        }
                      ],
                    ],
                  },
                });
          }
          break;
        case 'video':
          bot.telegram.sendVideo(receiverId, ctx.message.video.file_id, {
            caption: captionText,
            reply_markup: isPrivate ? replyMarkup(ctx) : {},
          });
          if (ctx.session.group !== undefined && ctx.session.group !== config.staffchat_id &&
            !ctx.session.modeData) {
            bot.telegram.sendVideo(ctx.session.group,
                ctx.message.video.file_id, {
                  caption: captionText,
                  reply_markup: {
                    html: '',
                    inline_keyboard: [
                      [
                        {
                          'text': config.language.replyPrivate,
                          'callback_data': ctx.from.id +
                          '---' + ctx.message.from.first_name + '---' + ctx.session.groupCategory +
                          '---' + ticket.id 
                        }
                      ],
                    ],
                  },
                });
          }
          break;
      }
      // Confirmation message
      let message = config.language.contactMessage + ' #T' +
        ticket.id.toString().padStart(6, '0');
      // if admin
      if(ctx.session.admin && userInfo === undefined) {
        const name = replyText.match(new RegExp(
            config.language.from + ' ' + '(.*)' + ' ' +
            config.language.language));
        message = `${config.language.file_sent} ${name[1]}`;
      }
      middleware.msg(ctx.chat.id, message, {});
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
  db.getOpen(ctx.message.from.id, ctx.session.groupCategory, function(ticket) {
        let ok = false;
    if (ticket == undefined || ticket.status == undefined ||
          ticket.status == 'closed') {
      db.add(ctx.message.from.id, 'open', undefined);
      ok = true;
    }
    if (ok || ticket !== undefined && ticket.status !== 'banned') {
      if (cache.ticketSent[cache.ticketID] === undefined) {
        fowardHandler(ctx, function(userInfo) {
          callback(userInfo);
        });
        // wait 5 minutes before this message appears again and do not
        // send notificatoin sounds in that time to avoid spam
        setTimeout(function() {
          cache.ticketSent[cache.ticketID] = undefined;
        }, config.spam_time);
        cache.ticketSent[cache.ticketID] = 0;
      } else if (cache.ticketSent[cache.ticketID] < 5) {
        cache.ticketSent[cache.ticketID]++;
        // TODO: add Extra.HTML().notifications(false)
        // property for silent notifications
        fowardHandler(ctx, function(userInfo) {
          callback(userInfo);
        });
      } else if (cache.ticketSent[cache.ticketID] === 5) {
        cache.ticketSent[cache.ticketID]++;
        middleware.msg(ctx.chat.id, config.language.blockedSpam, Extra.HTML());
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
  let userInfo;
  ctx.getChat().then(function(chat) {
    if (chat.type === 'private') {
      cache.ticketID = ctx.message.from.id;
      userInfo =
          `${config.language.from} ${ctx.message.from.first_name} ` +
          `${config.language.language}: ` +
          `${ctx.message.from.language_code}\n\n`;

      if (ctx.session.group === undefined) {
        userInfo =
              `${config.language.from} ${ctx.message.from.first_name} ` +
              `${config.language.language}: ` +
              `${ctx.message.from.language_code}\n\n`;
      }
      callback(userInfo);
    } else {
      callback();
    }
  });
}

export {
  fileHandler,
  forwardFile,
  fowardHandler,
};
