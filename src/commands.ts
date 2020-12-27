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
function closeCommand(bot, ctx) {
  if (!ctx.session.admin) return;
  let groups = [];
  // Search all labels for this group
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
  // Get open tickets for any maintained label
  let replyText = ctx.message.reply_to_message.text;
  if (replyText == undefined) {
    replyText = ctx.message.reply_to_message.caption;
  }
  // Ticket ID
  const ticketId = replyText.match(new RegExp('#T' + '(.*)' + ' ' +
                config.language.from))[1];
  // get userid from ticketid
  db.open(function(tickets) {
    if (tickets == undefined) {
      console.log('Close command: tickets undefined');
      return;
    }
    let userid = 0;
    for (let i = 0; i < tickets.length; i++) {
      if (tickets[i].id.toString().padStart(6, '0') == ticketId) {
        db.add(tickets[i].userid, 'closed', tickets[i].category);
        userid = tickets[i].userid;
      }
    }
    ctx.reply(`
    ${config.language.ticket} #T${ticketId.toString().padStart(6, '0')} ` +
    `${config.language.closed}`,
    // eslint-disable-next-line new-cap
    Extra.HTML().notifications(false)
    );
    bot.telegram.sendMessage(
      userid,
      `${config.language.ticket} #T${ticketId.toString().padStart(6, '0')} ` +
      `${config.language.closed}\n\n${config.language.ticketClosed}`,
      // eslint-disable-next-line new-cap
      Extra.HTML().notifications(false)
    );
  }, groups);
};

/**
 * Ban user
 * @param {Object} bot
 * @param {Object} ctx
 */
function banCommand(bot, ctx) {
  if (!ctx.session.admin) return;
  // Get open tickets for any maintained label
  const replyText = ctx.message.reply_to_message.text;
  const ticketId = replyText.match(new RegExp('#T' + '(.*)' +
                ' ' + config.language.from))[1];

  // get userid from ticketid
  db.getId(ticketId, function(ticket) {
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

/**
 * Unban user
 * @param {Object} bot
 * @param {Object} ctx
 */
function unbanCommand(bot, ctx) {
  if (!ctx.session.admin) return;
  // Get open tickets for any maintained label
  const replyText = ctx.message.reply_to_message.text;
  const ticketId = replyText.match(new RegExp('#T' + '(.*)' +
                ' ' + config.language.from))[1];

  // get userid from ticketid
  db.getId(ticketId, function(ticket) {
    db.add(ticket.userid, 'closed', undefined);
    bot.telegram.sendMessage(
        ctx.chat.id,
        config.language.usr_with_ticket + ' #T'+
                  ticket.id.toString().padStart(6, '0')+
                      ' ' + 'unbanned',
        // eslint-disable-next-line new-cap
        Extra.HTML().notifications(false)
    );
  });
};

export {
  banCommand,
  openCommand,
  closeCommand,
  unbanCommand,
};
