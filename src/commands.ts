import * as db from './db';
const {Extra} = require('telegraf');
import config from '../config/config';

/**
 * Display open tickets
 * @param {Object} ctx
 */
function openCommand(ctx) {
  if (!ctx.session.admin) return;
  let groups = [];
  // Search all labels for this group
  if (config.categories) {
    config.categories.forEach((element, index) => {
      // No subgroup
      if (config.categories[index].subgroups == undefined) {
        if (config.categories[index].group_id == ctx.chat.id) {
          groups.push(config.categories[index].name);
        }
      } else {
        config.categories[index].subgroups.forEach((innerElement, index) => {
          if (innerElement.group_id == ctx.chat.id) {
            groups.push(innerElement.name);
          }
        });
      }
    });
  }
  // Get open tickets for any maintained label
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
    ctx.reply(`<b>${config.language.openTickets}\n\n</b> ${openTickets}`,
        // eslint-disable-next-line new-cap
        Extra.HTML().notifications(false));
  }, groups);
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
                config.language.from));
    // get userid from ticketid
  db.getOpen(userid[1], ctx.session.groupAdmin, function(ticket) {
    if (ticket != undefined) {
        db.add(ticket.userid, 'closed', ctx.session.groupAdmin);
        ctx.reply(`
          ${config.language.ticket} #T${ticket.id.toString().padStart(6, '0')} ${config.language.closed}`,
          // eslint-disable-next-line new-cap
          Extra.HTML().notifications(false)
        );
    }
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
                ' ' + config.language.from));

  // get userid from ticketid
  db.getOpen(userid[1], ctx.session.groupCategory, function(ticket) {
        db.add(ticket.userid, 'banned', undefined);
    bot.telegram.sendMessage(
        ctx.chat.id,
        config.language.usr_with_ticket + ' #T'+
                  ticket.id.toString().padStart(6, '0')+
                      ' ' + config.language.banned,
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
