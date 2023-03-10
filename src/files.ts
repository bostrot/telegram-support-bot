import * as db from './db';
import cache from './cache';
import * as middleware from './middleware';
import TelegramAddon from './addons/telegram';
import {Context, ModeData} from './interfaces';

/**
 * Helper for private reply
 * @param {Object} ctx
 * @return {Object}
 */
function replyMarkup(ctx: Context): object {
  return {
    html: '',
    inline_keyboard: [
      [
        cache.config.direct_reply ?
          {
            text: cache.config.language.replyPrivate,
            url: `https://t.me/${ctx.from.username}`,
          } :
          {
            text: cache.config.language.replyPrivate,
            callback_data:
                ctx.from.id +
                '---' +
                ctx.message.from.first_name +
                '---' +
                ctx.session.modeData.category +
                '---' +
                ctx.session.modeData.ticketid,
          },
      ],
    ],
  };
}

/**
 * Forward video files to staff.
 * @param {string} type document, photo, video.
 * @param {bot} bot Bot object.
 * @param {context} ctx Bot context.
 */
function fileHandler(type: string, bot: TelegramAddon, ctx: Context) {
  // replying to non-ticket
  let userid: RegExpMatchArray | null;
  let replyText: string;
  if (
    ctx.message !== undefined &&
    ctx.message.reply_to_message !== undefined &&
    ctx.session.admin
  ) {
    replyText = ctx.message.reply_to_message.text;
    if (replyText === undefined) {
      replyText = ctx.message.reply_to_message.caption;
    }
    userid = replyText.match(
        new RegExp('#T' + '(.*)' + ' ' + cache.config.language.from),
    );
    if (userid === null || userid === undefined) {
      userid = replyText.match(
          new RegExp('#T' + '(.*)' + '\n' + cache.config.language.from),
      );
    }
    // replying to non-ticket
    if (userid == null) {
      return;
    }
  }
  forwardFile(ctx, function(userInfo: string) {
    let receiverId = cache.config.staffchat_id;
    let msgId = ctx.message.chat.id;
    let isPrivate = false;

    // if (userid === null || userid === undefined) {
    //   return;
    // }
    // if admin
    if (ctx.session.admin && userInfo === undefined) {
      // null check here
      if (userid != null) {
        msgId = userid[1];
      } else {
        return;
      }
    }
    db.getOpen(
        msgId,
        ctx.session.groupCategory,
        async function(ticket: any) {
          if (ticket == undefined) {
            if (ctx.session.admin && userInfo === undefined) {
            // replying to closed ticket
              middleware.reply(ctx, cache.config.language.ticketClosedError);
            } else {
              middleware.reply(ctx, cache.config.language.textFirst);
            }
            return;
          }
          let captionText =
          cache.config.language.ticket +
          ' #T' +
          ticket.id.toString().padStart(6, '0') +
          ' ' +
          userInfo +
          '\n' +
          (ctx.message.caption || '');
          if (ctx.session.admin && userInfo === undefined) {
            receiverId = ticket.userid;
            captionText = ctx.message.caption || '';
          }
          if (ctx.session.modeData.userid != null) {
            receiverId = ctx.session.modeData.userid;
            isPrivate = true;
          }
          const fileId = (await ctx.getFile()).file_id;
          switch (type) {
            case 'document':
              bot.sendDocument(receiverId, fileId, {
                caption: captionText,
                reply_markup: isPrivate ? replyMarkup(ctx) : {},
              });
              if (
                ctx.session.group !== '' &&
              ctx.session.group !== cache.config.staffchat_id &&
              ctx.session.modeData != {} as ModeData
              ) {
                bot.sendDocument(ctx.session.group, fileId, {
                  caption: captionText,
                  reply_markup: {
                    html: '',
                    inline_keyboard: [
                      [
                        {
                          text: cache.config.language.replyPrivate,
                          callback_data:
                          ctx.from.id +
                          '---' +
                          ctx.message.from.first_name +
                          '---' +
                          ctx.session.groupCategory +
                          '---' +
                          ticket.id,
                        },
                      ],
                    ],
                  },
                });
              }
              break;
            case 'photo':
              bot.sendPhoto(receiverId, fileId, {
                caption: captionText,
                reply_markup: isPrivate ? replyMarkup(ctx) : {},
              });
              if (
                ctx.session.group !== '' &&
              ctx.session.group !== cache.config.staffchat_id &&
              ctx.session.modeData != {} as ModeData
              ) {
                bot.sendPhoto(ctx.session.group, fileId, {
                  caption: captionText,
                  reply_markup: {
                    html: '',
                    inline_keyboard: [
                      [
                        {
                          text: cache.config.language.replyPrivate,
                          callback_data:
                          ctx.from.id +
                          '---' +
                          ctx.message.from.first_name +
                          '---' +
                          ctx.session.groupCategory +
                          '---' +
                          ticket.id,
                        },
                      ],
                    ],
                  },
                });
              }
              break;
            case 'video':
              bot.sendVideo(receiverId, fileId, {
                caption: captionText,
                reply_markup: isPrivate ? replyMarkup(ctx) : {},
              });
              if (
                ctx.session.group !== '' &&
              ctx.session.group !== cache.config.staffchat_id &&
              ctx.session.modeData != {} as ModeData
              ) {
                bot.sendVideo(ctx.session.group, fileId, {
                  caption: captionText,
                  reply_markup: {
                    html: '',
                    inline_keyboard: [
                      [
                        {
                          text: cache.config.language.replyPrivate,
                          callback_data:
                          ctx.from.id +
                          '---' +
                          ctx.message.from.first_name +
                          '---' +
                          ctx.session.groupCategory +
                          '---' +
                          ticket.id,
                        },
                      ],
                    ],
                  },
                });
              }
              break;
          }
          // Confirmation message
          if (!cache.config.autoreply_confirmation) {
            return;
          }
          let message =
          cache.config.language.confirmationMessage +
          (cache.config.show_user_ticket ?
            cache.config.language.yourTicketId +
            ' #T' +
            ticket.id.toString().padStart(6, '0'):
            '');
          // if admin
          if (ctx.session.admin && userInfo === undefined) {
            const name = replyText.match(
                new RegExp(
                    cache.config.language.from +
                ' ' +
                '(.*)' +
                ' ' +
                cache.config.language.language,
                ),
            );
            if (name == null && name == undefined) {
              return;
            }
            message = `${cache.config.language.file_sent} ${name[1]}`;
          }
          middleware.msg(ctx.chat.id, message);
        },
    );
  });
}

/**
 * Handle caching for sent files.
 * @param {context} ctx Bot context.
 * @param {callback} callback Bot callback.
 */
function forwardFile(
    ctx: Context,
    callback: { (userInfo: any): void; (arg0: any): void },
) {
  db.getOpen(
      ctx.message.from.id,
      ctx.session.groupCategory,
      function(ticket: any) {
        let ok = false;
        if (
          ticket == undefined ||
        ticket.status == undefined ||
        ticket.status == 'closed'
        ) {
          db.add(ctx.message.from.id, 'open', null);
          ok = true;
        }
        if (ok || (ticket !== undefined && ticket.status !== 'banned')) {
          if (cache.ticketSent[cache.ticketID] === undefined) {
            fowardHandler(ctx, function(userInfo) {
              callback(userInfo);
            });
            // wait 5 minutes before this message appears again and do not
            // send notificatoin sounds in that time to avoid spam
            setTimeout(function() {
              cache.ticketSent[cache.ticketID] = undefined;
            }, cache.config.spam_time);
            cache.ticketSent[cache.ticketID] = 0;
          } else if (
            cache.ticketSent[cache.ticketID] < cache.config.spam_cant_msg
          ) {
            cache.ticketSent[cache.ticketID]++;
            // TODO: add { parse_mode: cache.config.
            // parse_mode }/* .notifications(false) */
            // property for silent notifications
            fowardHandler(ctx, function(userInfo) {
              callback(userInfo);
            });
          } else if (
            cache.ticketSent[cache.ticketID] === cache.config.spam_cant_msg
          ) {
            cache.ticketSent[cache.ticketID]++;
            middleware.msg(ctx.chat.id, cache.config.language.blockedSpam, {
              parse_mode: cache.config.parse_mode,
            });
          }
        }
      },
  );
}

/**
 * Check if msg comes from user or admin.
 * @param {context} ctx Bot context.
 * @param {callback} callback Bot callback.
 */
function fowardHandler(
    ctx: Context,
    callback: {
    (userInfo: any): void;
    (userInfo: any): void;
    (arg0: undefined): void;
  },
) {
  let userInfo;
  ctx.getChat().then(function(chat: { type: string }) {
    if (chat.type === 'private') {
      cache.ticketID = ctx.message.from.id;
      userInfo =
        `${cache.config.language.from} ${ctx.message.from.first_name} ` +
        `${cache.config.language.language}: ` +
        `${ctx.message.from.language_code}\n\n`;

      if (ctx.session.group === undefined) {
        userInfo =
          `${cache.config.language.from} ${ctx.message.from.first_name} ` +
          `${cache.config.language.language}: ` +
          `${ctx.message.from.language_code}\n\n`;
      }
      callback(userInfo);
    } else {
      callback(undefined);
    }
  });
}

export {fileHandler, forwardFile, fowardHandler};
