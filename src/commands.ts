import * as db from './db';
import cache from './cache';
import * as middleware from './middleware';
import { Context } from './interfaces';
import { ISupportee } from './db';
import * as log from 'fancy-log'

/**
 * Extracts ticket ID from the reply text.
 *
 * @param replyText - The text to extract the ticket ID from.
 * @returns The ticket ID as a string or undefined if not found.
 */
const extractTicketId = (replyText: string): string | undefined => {
  const match = replyText.match(new RegExp(`#T(.*) ${cache.config.language.from}`));
  return match ? match[1] : undefined;
};

/**
 * Display help text depending on whether the user is an admin.
 *
 * @param ctx - The bot context.
 */
const helpCommand = (ctx: Context): void => {
  const { language, parse_mode } = cache.config;
  const text = ctx.session.admin ? language.helpCommandStaffText : language.helpCommandText;
  middleware.reply(ctx, text, { parse_mode });
};

/**
 * Close all open tickets.
 *
 * @param ctx - The bot context.
 */
const clearCommand = (ctx: Context): void => {
  if (!ctx.session.admin) return;
  db.closeAll();
  // Reset the ticket arrays
  cache.ticketIDs.length = 0;
  cache.ticketStatus.length = 0;
  cache.ticketSent.length = 0;
  middleware.reply(ctx, 'All tickets closed.');
};

/**
 * Display open tickets.
 *
 * @param ctx - The bot context.
 */
const openCommand = (ctx: Context): void => {
  if (!ctx.session.admin) return;
  const groups: string[] = [];
  const { categories, language } = cache.config;

  if (categories && categories.length > 0) {
    categories.forEach(category => {
      if (!category.subgroups) {
        if (category.group_id == ctx.chat.id) groups.push(category.name);
      } else {
        category.subgroups.forEach((sub: { group_id: any; name: string }) => {
          if (sub.group_id == ctx.chat.id) groups.push(sub.name);
        });
      }
    });
  }

  db.open((userList: any[]) => {
    let openTickets = '';
    userList.forEach(ticket => {
      if (ticket.userid != null) {
        let ticketInfo = '';
        const uidStr = ticket.userid.toString();
        if (uidStr.includes('WEB')) {
          ticketInfo = '(web)';
        } else if (uidStr.includes('SIGNAL')) {
          ticketInfo = '(signal)';
        }
        openTickets += `#T${ticket.id.toString().padStart(6, '0')} ${ticketInfo}\n`;
      }
    });
    middleware.reply(ctx, `*${language.openTickets}\n\n* ${openTickets}`);
  }, groups);
};

/**
 * Close a specific ticket.
 *
 * @param ctx - The bot context.
 */
const closeCommand = (ctx: Context): void => {
  if (!ctx.session.admin) return;
  const groups: string[] = [];
  const { categories, language } = cache.config;

  if (categories) {
    categories.forEach(category => {
      if (!category.subgroups || category.subgroups.length === 0) {
        if (category.group_id == ctx.chat.id) groups.push(category.name);
      } else {
        category.subgroups.forEach((sub: { group_id: any; name: string }) => {
          if (sub.group_id == ctx.chat.id) groups.push(sub.name);
        });
      }
    });
  }

  // Only process if the reply is to a bot message
  if (!ctx.message.reply_to_message.from.is_bot) return;
  const replyText = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption;
  if (!replyText) return;
  const ticketId = extractTicketId(replyText);
  if (!ticketId) return;

  db.open((tickets: ISupportee[]) => {
    if (!tickets) {
      log.info('Close command: tickets undefined');
      return;
    }
    let userId: any = null;
    tickets.forEach(ticket => {
      if (ticket.id.toString().padStart(6, '0') === ticketId) {
        db.add(ticket.userid, 'closed', ticket.category, ctx.messenger);
      }
      userId = ticket.userid;
    });
    const paddedTicket = ticketId.toString().padStart(6, '0');
    middleware.reply(ctx, `${cache.config.language.ticket} #T${paddedTicket} ${cache.config.language.closed}`);
    middleware.sendMessage(
      userId,
      ctx.messenger,
      `${cache.config.language.ticket} #T${paddedTicket} ${cache.config.language.closed}\n\n${cache.config.language.ticketClosed}`
    );
    delete cache.ticketIDs[userId];
    delete cache.ticketStatus[userId];
    delete cache.ticketSent[userId];
  }, groups);
};

/**
 * Ban a user based on a ticket.
 *
 * @param ctx - The bot context.
 */
const banCommand = (ctx: Context): void => {
  if (!ctx.session.admin) return;
  const replyText = ctx.message.reply_to_message.text;
  if (!replyText) return;
  const ticketId = extractTicketId(replyText);
  if (!ticketId) return;
  db.getByTicketId(ticketId, (ticket: { userid: any; id: { toString: () => string } }) => {
    db.add(ticket.userid, 'banned', '', ctx.messenger);
    middleware.sendMessage(
      ctx.chat.id,
      ctx.messenger,
      `${cache.config.language.usr_with_ticket} #T${ticketId.toString().padStart(6, '0')} ${cache.config.language.banned}`
    );
  });
};

/**
 * Reopen a closed ticket.
 *
 * @param ctx - The bot context.
 */
const reopenCommand = (ctx: Context): void => {
  if (!ctx.session.admin) return;
  const replyText = ctx.message.reply_to_message.text;
  if (!replyText) return;
  const ticketId = extractTicketId(replyText);
  if (!ticketId) return;
  db.getByTicketId(ticketId, (ticket: { userid: any; id: { toString: () => string } }) => {
    db.reopen(ticket.userid, '', ctx.messenger);
    middleware.sendMessage(
      ctx.chat.id,
      ctx.messenger,
      `${cache.config.language.usr_with_ticket} #T${ticket.id.toString().padStart(6, '0')} ${cache.config.language.ticketReopened}`
    );
  });
};

/**
 * Unban a user based on a ticket.
 *
 * @param ctx - The bot context.
 */
const unbanCommand = (ctx: Context): void => {
  if (!ctx.session.admin) return;
  const replyText = ctx.message.reply_to_message.text;
  if (!replyText) return;
  const ticketId = extractTicketId(replyText);
  if (!ticketId) return;
  db.getByTicketId(ticketId, (ticket: { userid: any; id: { toString: () => string } }) => {
    db.add(ticket.userid, 'closed', '', ctx.messenger);
    middleware.sendMessage(
      ctx.chat.id,
      ctx.messenger,
      `${cache.config.language.usr_with_ticket} #T${ticket.id.toString().padStart(6, '0')} unbanned`
    );
  });
};

export {
  banCommand,
  openCommand,
  closeCommand,
  unbanCommand,
  clearCommand,
  reopenCommand,
  helpCommand,
};
