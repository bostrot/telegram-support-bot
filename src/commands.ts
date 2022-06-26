import * as db from './db';
import cache from './cache';
import * as middleware from './middleware';

/**
 * Close all open tickets
 * @param {Object} ctx
 */
function clearCommand(ctx) {
  if (!ctx.session.admin) return;
  db.closeAll();
  middleware.reply(ctx, 'All tickets closed.', { parse_mode: cache.config.parse_mode }/* .notifications(false) */);
}

/**
 * Display open tickets
 * @param {Object} ctx
 */
function openCommand(ctx) {
  if (!ctx.session.admin) return;
  let groups = [];
  // Search all labels for this group
  if (cache.config.categories != undefined) {
    cache.config.categories.forEach((element, index) => {
      // No subgroup
      if (cache.config.categories[index].subgroups == undefined) {
        if (cache.config.categories[index].group_id == ctx.chat.id) {
          groups.push(cache.config.categories[index].name);
        }
      } else {
        cache.config.categories[index].subgroups.forEach((innerElement, index) => {
          if (innerElement.group_id == ctx.chat.id) {
            groups.push(innerElement.name);
          }
        });
      }
    });
  }
  // Get open tickets for any maintained label
  db.open(function (userList) {
    let openTickets = '';
    for (const i in userList) {
      if (userList[i]['userid'] !== null &&
        userList[i]['userid'] !== undefined) {
        let ticketInfo = '';
        if (userList[i]['userid'].indexOf('WEB') > -1)
          ticketInfo = '(web)';
        if (userList[i]['userid'].indexOf('SIGNAL') > -1)
          ticketInfo = '(signal)';
        openTickets += '#T' + userList[i]['id']
          .toString().padStart(6, '0')
          .toString() + ' ' + ticketInfo +
          '\n';
      }
    }
    middleware.reply(ctx, `*${cache.config.language.openTickets}\n\n* ${openTickets}`,
      // eslint-disable-next-line new-cap
      { parse_mode: cache.config.parse_mode }/* .notifications(false) */);
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
  if (cache.config.categories) {
    cache.config.categories.forEach((element, index) => {
      // No subgroup
      if (cache.config.categories[index].subgroups == undefined) {
        if (cache.config.categories[index].group_id == ctx.chat.id) {
          groups.push(cache.config.categories[index].name);
        }
      } else {
        cache.config.categories[index].subgroups.forEach((innerElement, index) => {
          if (innerElement.group_id == ctx.chat.id) {
            groups.push(innerElement.name);
          }
        });
      }
    });
  }
  // Check if in reply to bot
  if (!ctx.message.reply_to_message.from.is_bot) {
    return;
  }
  // Get open tickets for any maintained label
  let replyText = ctx.message.reply_to_message.text;

  if (replyText == undefined) {
    replyText = ctx.message.reply_to_message.caption;
  }
  // Ticket ID
  let ticketId = -1;
  try {
    ticketId = replyText.match(new RegExp('#T' + '(.*)' + ' ' +
      cache.config.language.from))[1];
  } catch (e) {
    // Not replying to a ticket so return
    return;
  }
  // get userid from ticketid
  db.open(function (tickets) {
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
    middleware.reply(ctx, `
    ${cache.config.language.ticket} #T${ticketId.toString().padStart(6, '0')} ` +
      `${cache.config.language.closed}`,
      // eslint-disable-next-line new-cap
      { parse_mode: cache.config.parse_mode }/* .notifications(false) */
    );
    middleware.msg(userid,
      `${cache.config.language.ticket} #T${ticketId.toString().padStart(6, '0')} ` +
      `${cache.config.language.closed}\n\n${cache.config.language.ticketClosed}`,
      { parse_mode: cache.config.parse_mode }/* .notifications(false) */);
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

  let ticketId = -1;
  try {
    ticketId = replyText.match(new RegExp('#T' + '(.*)' +
      ' ' + cache.config.language.from))[1];
  } catch (e) {
    // Not replying to a ticket so return
    return;
  }

  // get userid from ticketid
  db.getId(ticketId, function (ticket) {
    db.add(ticket.userid, 'banned', undefined);

    middleware.msg(ctx.chat.id, cache.config.language.usr_with_ticket + ' #T' +
      ticket.id.toString().padStart(6, '0') +
      ' ' + cache.config.language.banned, { parse_mode: cache.config.parse_mode }/* .notifications(false) */);
  });
};

/**
 * Reopen ticket
 * @param {Object} bot
 * @param {Object} ctx
 */
function reopenCommand(bot, ctx) {
  if (!ctx.session.admin) return;
  // Get open tickets for any maintained label
  const replyText = ctx.message.reply_to_message.text;

  let ticketId = -1;
  try {
    ticketId = replyText.match(new RegExp('#T' + '(.*)' +
      ' ' + cache.config.language.from))[1];
  } catch (e) {
    // Not replying to a ticket so return
    return;
  }

  // get userid from ticketid
  db.getId(ticketId, function (ticket) {
    db.reopen(ticket.userid, undefined);

    middleware.msg(ctx.chat.id, cache.config.language.usr_with_ticket + ' #T' +
      ticket.id.toString().padStart(6, '0') +
      ' ' + cache.config.language.ticketReopened, { parse_mode: cache.config.parse_mode }/* .notifications(false) */);
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

  let ticketId = -1;
  try {
    ticketId = replyText.match(new RegExp('#T' + '(.*)' +
      ' ' + cache.config.language.from))[1];
  } catch (e) {
    // Not replying to a ticket so return
    return;
  }

  // get userid from ticketid
  db.getId(ticketId, function (ticket) {
    db.add(ticket.userid, 'closed', undefined);
    middleware.msg(ctx.chat.id, cache.config.language.usr_with_ticket + ' #T' +
      ticket.id.toString().padStart(6, '0') +
      ' ' + 'unbanned', { parse_mode: cache.config.parse_mode }/* .notifications(false) */);
  });
};

export {
  banCommand,
  openCommand,
  closeCommand,
  unbanCommand,
  clearCommand,
  reopenCommand,
};
