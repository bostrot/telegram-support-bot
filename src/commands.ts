import * as db from './db';
const {Extra} = require('@telegraf');
import config from '../config/config';

/**
 * Display open tickets
 * @param {Object} ctx
 */
function openCommand(ctx) {
  if (!ctx.session.admin) return;
  db.open(function(userList) {
    let openTickets = '';
    for (const i in userList) {
      if (userList[i]['userid'] !== null &&
                      userList[i]['userid'] !== undefined) {
        openTickets += '#T' + userList[i]['id']
            .toString().padStart(6, '0')
            .toString() + '\n';
      }
    }
    ctx.reply('<b>Open Tickets:\n\n</b>' + openTickets,
        // eslint-disable-next-line new-cap
        Extra.HTML().notifications(false));
  }, (ctx.session.groupAdmin));
};

/**
 * Close ticket
 * @param {Object} ctx
 */
function closeCommand(ctx) {
  if (!ctx.session.admin) return;
  let replyText = ctx.message.reply_to_message.text;
  if (replyText == undefined) {
    replyText = ctx.message.reply_to_message.caption;
  }
  const userid = replyText.match(new RegExp('#T' + '(.*)' + ' ' +
                config.lang_from));
    // get userid from ticketid
  db.check(userid[1], function(ticket) {
    db.add(ticket.userid, 'closed', undefined);
    ctx.reply(
        'Ticket #T'+ticket.id.toString().padStart(6, '0')+' closed',
        // eslint-disable-next-line new-cap
        Extra.HTML().notifications(false)
    );
  });
};

/**
 * Ban user
 * @param {Object} bot
 * @param {Object} ctx
 */
function banCommand(bot, ctx) {
  if (!ctx.session.admin) return;
  const replyText = ctx.message.reply_to_message.text;
  const userid = replyText.match(new RegExp('#T' + '(.*)' +
                ' ' + config.lang_from));

  // get userid from ticketid
  db.check(userid[1], function(ticket) {
    db.add(ticket.userid, 'banned', undefined);
    bot.telegram.sendMessage(
        ctx.chat.id,
        config.lang_usr_with_ticket + ' #T'+
                  ticket.id.toString().padStart(6, '0')+
                      ' ' + config.lang_banned,
        // eslint-disable-next-line new-cap
        Extra.HTML().notifications(false)
    );
  });
};

export {
  banCommand,
  openCommand,
  closeCommand,
};
