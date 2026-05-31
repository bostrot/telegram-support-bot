import * as db from './db';
import cache from './cache';
import * as middleware from './middleware';
import { Context } from './interfaces';
import { ISupportee } from './db';
import * as log from 'fancy-log'
import * as team from './team';
import * as analytics from './analytics';
import * as workflows from './workflows';
import { extractSupporteeId } from './staff';

const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Extracts ticket ID from the reply text.
 */
const extractTicketId = (replyText: string): string | undefined => {
  const { language } = cache.config;
  let match = replyText.match(new RegExp(`#T(.*) ${escapeRegex(language.from)}`));
  if (!match) {
    match = replyText.match(new RegExp(`#T(.*)\\n${escapeRegex(language.from)}`));
  }
  return match ? match[1] : undefined;
};

/**
 * Attempts to find a ticket from a replied message using multiple fallback strategies:
 * 1. Regex extraction of #T ID from text
 * 2. Extract supportee's Telegram ID from forwarded message → DB lookup by user
 * Returns the ticket or null if all methods fail.
 */
async function resolveTicketFromReply(
  replyText: string,
  category: string | null = null,
): Promise<{ ticket: ISupportee; ticketIdStr: string } | null> {
  // Strategy 1: regex extraction from forwarded text
  const extractedId = extractTicketId(replyText);
  if (extractedId) {
    const ticketId = parseInt(extractedId, 10);
    if (ticketId) {
      const ticket = await db.getTicketById(ticketId, category);
      if (ticket) return { ticket, ticketIdStr: extractedId };
    }
  }

  // Strategy 2: extract supportee Telegram ID from forwarded message → lookup by user
  const supporteeId = extractSupporteeId(replyText);
  if (supporteeId) {
    const ticket = await db.getTicketByUserId(supporteeId, category);
    if (ticket) return { ticket, ticketIdStr: ticket.ticketId.toString() };
  }

  return null;
}

/**
 * Display help text depending on whether the user is an admin.
 */
const helpCommand = (ctx: Context): void => {
  const { language, parse_mode } = cache.config;
  let text = ctx.session.admin ? language.helpCommandStaffText : language.helpCommandText;

  // Append new staff commands to help if available
  if (ctx.session.admin) {
    text += `\n\n*Team & Analytics:*\n`;
    text += `/assign <user_id> — Assign ticket to staff member\n`;
    text += `/unassign — Unassign current ticket\n`;
    text += `/tag <tags> — Add tags (comma-separated)\n`;
    text += `/untag <tag> — Remove a tag\n`;
    text += `/priority <low|normal|high|urgent> — Set priority\n`;
    text += `/mute — Mute ticket notifications\n`;
    text += `/unmute — Unmute ticket notifications\n`;
    text += `/note <text> — Add internal note\n`;
    text += `/notes — Show all internal notes\n`;
    text += `/staff — List staff members\n`;
    text += `/stats — Show analytics stats\n`;
    text += `/templates — List canned responses\n`;
  }

  middleware.reply(ctx, text, { parse_mode });
};

/**
 * Close all open tickets.
 *
 * @param ctx - The bot context.
 */
const clearCommand = async (ctx: Context): Promise<void> => {
  if (!ctx.session.admin) return;
  await db.closeAll();
  // Reset the ticket caches
  Object.keys(cache.ticketIDs).forEach(k => delete cache.ticketIDs[k]);
  Object.keys(cache.ticketStatus).forEach(key => delete cache.ticketStatus[key]);
  Object.keys(cache.ticketSent).forEach(key => delete cache.ticketSent[key]);
  middleware.reply(ctx, 'All tickets closed.');
};

/**
 * Display open tickets.
 *
 * @param ctx - The bot context.
 */
const openCommand = async (ctx: Context): Promise<void> => {
  if (!ctx.session.admin) return;
  const groups: string[] = [];
  const { categories, language } = cache.config;

  if (categories && categories.length > 0) {
    categories.forEach(category => {
      if (!category.subgroups) {
        if (category.group_id === ctx.chat.id) groups.push(category.name);
      } else {
        category.subgroups.forEach((sub: { group_id: unknown; name: string }) => {
          if (sub.group_id === ctx.chat.id) groups.push(sub.name);
        });
      }
    });
  }

  const userList = await db.open(groups);
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
      openTickets += `#T${(ticket.ticketId ?? 0).toString().padStart(6, '0')} ${ticketInfo}\n`;
    }
  });
  await middleware.reply(ctx, `*${language.openTickets}\n\n* ${openTickets}`);
};

/**
 * Close a specific ticket.
 *
 * @param ctx - The bot context.
 */
const closeCommand = async (ctx: Context): Promise<void> => {
  if (!ctx.session.admin) return;
  const groups: string[] = [];
  const { categories, language } = cache.config;

  if (categories) {
    categories.forEach(category => {
      if (!category.subgroups || category.subgroups.length === 0) {
        if (category.group_id === ctx.chat.id) groups.push(category.name);
      } else {
        category.subgroups.forEach((sub: { group_id: unknown; name: string }) => {
          if (sub.group_id === ctx.chat.id) groups.push(sub.name);
        });
      }
    });
  }

  // Only process if the reply is to a bot message
  if (!ctx.message.reply_to_message.from.is_bot) return;
  const replyText = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption;
  if (!replyText) return;

  const resolved = await resolveTicketFromReply(replyText, null);
  if (!resolved) {
    middleware.reply(ctx, 'Could not find ticket in the replied message.');
    return;
  }
  const { ticket, ticketIdStr } = resolved;

  const tickets = await db.open(groups);
  let userId: string | null = null;
  for (const t of tickets) {
    if ((t.ticketId ?? 0).toString().padStart(6, '0') === ticketIdStr.padStart(6, '0')) {
      await db.add(t.userid, 'closed', t.category ?? '', ctx.messenger);
    }
    userId = t.userid;
  }

  // Also close directly if not found in open list (ticket might already be closed)
  if (!userId) {
    await db.add(ticket.userid, 'closed', ticket.category ?? '', ctx.messenger);
    userId = ticket.userid;
  }
  const paddedTicket = ticketIdStr.toString().padStart(6, '0');
  await middleware.reply(ctx, `${language.ticket} #T${paddedTicket} ${language.closed}`);
  if (userId) {
    await middleware.sendMessage(
      userId,
      ctx.messenger,
      `${language.ticket} #T${paddedTicket} ${language.closed}\n\n${language.ticketClosed}`,
    ).catch(log.error);
    delete cache.ticketIDs[userId];
    delete cache.ticketStatus[userId];
    delete cache.ticketSent[userId];
  }
};

/**
 * Ban a user based on a ticket.
 *
 * @param ctx - The bot context.
 */
const banCommand = async (ctx: Context): Promise<void> => {
  if (!ctx.session.admin) return;
  const replyText = ctx.message.reply_to_message.text;
  if (!replyText) return;

  const resolved = await resolveTicketFromReply(replyText);
  if (!resolved) {
    middleware.reply(ctx, 'Could not find ticket in the replied message.');
    return;
  }
  const { ticket, ticketIdStr } = resolved;

  await db.add(ticket.userid, 'banned', '', ctx.messenger);
  await middleware.sendMessage(
    ctx.chat.id,
    ctx.messenger,
    `${cache.config.language.usr_with_ticket} #T${ticketIdStr.toString().padStart(6, '0')} ${cache.config.language.banned}`,
  ).catch(log.error);
};

/**
 * Reopen a closed ticket.
 *
 * @param ctx - The bot context.
 */
const reopenCommand = async (ctx: Context): Promise<void> => {
  if (!ctx.session.admin) return;
  const replyText = ctx.message.reply_to_message.text;
  if (!replyText) return;

  const resolved = await resolveTicketFromReply(replyText);
  if (!resolved) {
    middleware.reply(ctx, 'Could not find ticket in the replied message.');
    return;
  }
  const { ticket, ticketIdStr } = resolved;

  await db.reopen(ticket.userid, '', ctx.messenger);
  await middleware.sendMessage(
    ctx.chat.id,
    ctx.messenger,
    `${cache.config.language.usr_with_ticket} #T${ticketIdStr.toString().padStart(6, '0')} ${cache.config.language.ticketReopened}`,
  ).catch(log.error);
};

/**
 * Unban a user based on a ticket.
 *
 * @param ctx - The bot context.
 */
const unbanCommand = async (ctx: Context): Promise<void> => {
  if (!ctx.session.admin) return;
  const replyText = ctx.message.reply_to_message.text;
  if (!replyText) return;

  const resolved = await resolveTicketFromReply(replyText);
  if (!resolved) {
    middleware.reply(ctx, 'Could not find ticket in the replied message.');
    return;
  }
  const { ticket, ticketIdStr } = resolved;

  await db.add(ticket.userid, 'closed', '', ctx.messenger);
  await middleware.sendMessage(
    ctx.chat.id,
    ctx.messenger,
    `${cache.config.language.usr_with_ticket} #T${ticketIdStr.toString().padStart(6, '0')} unbanned`,
  ).catch(log.error);
};

// --- Team Collaboration Commands ---

/**
 * Assign a ticket to a staff member: /assign <telegram_id>
 */
const assignCommand = async (ctx: Context): Promise<void> => {
  if (!ctx.session.admin) return;
  const args = ctx.match?.trim();
  if (!args) {
    middleware.reply(ctx, 'Usage: /assign <staff_telegram_id>');
    return;
  }

  // Check permission to assign
  if (!team.canPerformAction(ctx.from.id.toString(), 'assign')) {
    middleware.reply(ctx, 'You do not have permission to assign tickets.');
    return;
  }

  const replyText = ctx.message.reply_to_message?.text || ctx.message.reply_to_message?.caption;
  if (!replyText) {
    middleware.reply(ctx, 'Reply to a ticket message to assign it.');
    return;
  }

  const resolved = await resolveTicketFromReply(replyText);
  if (!resolved) {
    middleware.reply(ctx, 'Could not find ticket ID in the replied message.');
    return;
  }

  await team.assignTicketCommand(ctx, args.trim(), parseInt(resolved.ticketIdStr));
};

/**
 * Unassign a ticket: /unassign
 */
const unassignCommand = async (ctx: Context): Promise<void> => {
  if (!ctx.session.admin) return;

  const replyText = ctx.message.reply_to_message?.text || ctx.message.reply_to_message?.caption;
  if (!replyText) {
    middleware.reply(ctx, 'Reply to a ticket message to unassign it.');
    return;
  }

  const resolved = await resolveTicketFromReply(replyText);
  if (!resolved) {
    middleware.reply(ctx, 'Could not find ticket ID in the replied message.');
    return;
  }

  await team.unassignTicketCommand(ctx, parseInt(resolved.ticketIdStr));
};

/**
 * Add tags to a ticket: /tag <tag1,tag2,...>
 */
const tagCommand = async (ctx: Context): Promise<void> => {
  if (!ctx.session.admin) return;
  const args = ctx.match?.trim();
  if (!args) {
    middleware.reply(ctx, 'Usage: /tag <tag1,tag2,...>');
    return;
  }

  const replyText = ctx.message.reply_to_message?.text || ctx.message.reply_to_message?.caption;
  if (!replyText) {
    middleware.reply(ctx, 'Reply to a ticket message to add tags.');
    return;
  }

  const resolved = await resolveTicketFromReply(replyText);
  if (!resolved) {
    middleware.reply(ctx, 'Could not find ticket ID in the replied message.');
    return;
  }

  const tags = args.split(',').map((t: string) => t.trim()).filter(Boolean);
  await team.addTagsCommand(ctx, parseInt(resolved.ticketIdStr), tags);
};

/**
 * Remove a tag from a ticket: /untag <tag>
 */
const untagCommand = async (ctx: Context): Promise<void> => {
  if (!ctx.session.admin) return;
  const args = ctx.match?.trim();
  if (!args) {
    middleware.reply(ctx, 'Usage: /untag <tag>');
    return;
  }

  const replyText = ctx.message.reply_to_message?.text || ctx.message.reply_to_message?.caption;
  if (!replyText) {
    middleware.reply(ctx, 'Reply to a ticket message to remove a tag.');
    return;
  }

  const resolved = await resolveTicketFromReply(replyText);
  if (!resolved) {
    middleware.reply(ctx, 'Could not find ticket ID in the replied message.');
    return;
  }

  await team.removeTagCommand(ctx, parseInt(resolved.ticketIdStr), args.trim());
};

/**
 * Set priority: /priority <low|normal|high|urgent>
 */
const priorityCommand = async (ctx: Context): Promise<void> => {
  if (!ctx.session.admin) return;
  const args = ctx.match?.trim().toLowerCase() ?? '';
  const validPriorities = ['low', 'normal', 'high', 'urgent'];
  if (!args || !validPriorities.includes(args)) {
    middleware.reply(ctx, `Usage: /priority <${validPriorities.join('|')}>`);
    return;
  }

  const replyText = ctx.message.reply_to_message?.text || ctx.message.reply_to_message?.caption;
  if (!replyText) {
    middleware.reply(ctx, 'Reply to a ticket message to set priority.');
    return;
  }

  const resolved = await resolveTicketFromReply(replyText);
  if (!resolved) {
    middleware.reply(ctx, 'Could not find ticket ID in the replied message.');
    return;
  }

  await team.setPriorityCommand(ctx, parseInt(resolved.ticketIdStr, 10), args as import('./interfaces').TicketPriority);
};

/**
 * Mute a ticket: /mute
 */
const muteCommand = async (ctx: Context): Promise<void> => {
  if (!ctx.session.admin) return;

  const replyText = ctx.message.reply_to_message?.text || ctx.message.reply_to_message?.caption;
  if (!replyText) {
    middleware.reply(ctx, 'Reply to a ticket message to mute it.');
    return;
  }

  const resolved = await resolveTicketFromReply(replyText);
  if (!resolved) {
    middleware.reply(ctx, 'Could not find ticket ID in the replied message.');
    return;
  }

  await team.muteTicketCommand(ctx, parseInt(resolved.ticketIdStr));
};

/**
 * Unmute a ticket: /unmute
 */
const unmuteCommand = async (ctx: Context): Promise<void> => {
  if (!ctx.session.admin) return;

  const replyText = ctx.message.reply_to_message?.text || ctx.message.reply_to_message?.caption;
  if (!replyText) {
    middleware.reply(ctx, 'Reply to a ticket message to unmute it.');
    return;
  }

  const resolved = await resolveTicketFromReply(replyText);
  if (!resolved) {
    middleware.reply(ctx, 'Could not find ticket ID in the replied message.');
    return;
  }

  await team.unmuteTicketCommand(ctx, parseInt(resolved.ticketIdStr));
};

/**
 * Add internal note: /note <text>
 */
const noteCommand = async (ctx: Context): Promise<void> => {
  if (!ctx.session.admin) return;
  const args = ctx.match?.trim();
  if (!args) {
    middleware.reply(ctx, 'Usage: /note <internal note text>');
    return;
  }

  const replyText = ctx.message.reply_to_message?.text || ctx.message.reply_to_message?.caption;
  if (!replyText) {
    middleware.reply(ctx, 'Reply to a ticket message to add an internal note.');
    return;
  }

  const resolved = await resolveTicketFromReply(replyText);
  if (!resolved) {
    middleware.reply(ctx, 'Could not find ticket ID in the replied message.');
    return;
  }

  await team.addInternalNoteCommand(ctx, parseInt(resolved.ticketIdStr), args);
};

/**
 * Show internal notes: /notes
 */
const notesCommand = async (ctx: Context): Promise<void> => {
  if (!ctx.session.admin) return;

  const replyText = ctx.message.reply_to_message?.text || ctx.message.reply_to_message?.caption;
  if (!replyText) {
    middleware.reply(ctx, 'Reply to a ticket message to view its internal notes.');
    return;
  }

  const resolved = await resolveTicketFromReply(replyText);
  if (!resolved) {
    middleware.reply(ctx, 'Could not find ticket ID in the replied message.');
    return;
  }

  await team.showNotesCommand(ctx, parseInt(resolved.ticketIdStr));
};

/**
 * List staff members: /staff
 */
const listStaffCommand = async (ctx: Context): Promise<void> => {
  if (!ctx.session.admin) return;
  await team.listStaffCommand(ctx);
};

// --- Analytics Commands ---

/**
 * Show analytics stats: /stats
 */
const statsCommand = async (ctx: Context): Promise<void> => {
  if (!ctx.session.admin) return;

  // Check permission to view analytics
  if (!team.canPerformAction(ctx.from.id.toString(), 'view_analytics')) {
    middleware.reply(ctx, 'You do not have permission to view analytics.');
    return;
  }

  await analytics.showStatsCommand(ctx);
};

// --- Workflow Commands ---

/**
 * List canned responses: /templates
 */
const templatesCommand = (ctx: Context): void => {
  if (!ctx.session.admin) return;
  const output = workflows.listCannedResponses();
  middleware.reply(ctx, output, { parse_mode: cache.config.parse_mode });
};

export {
  banCommand,
  openCommand,
  closeCommand,
  unbanCommand,
  clearCommand,
  reopenCommand,
  helpCommand,
  // Team collaboration commands
  assignCommand,
  unassignCommand,
  tagCommand,
  untagCommand,
  priorityCommand,
  muteCommand,
  unmuteCommand,
  noteCommand,
  notesCommand,
  listStaffCommand,
  // Analytics commands
  statsCommand,
  // Workflow commands
  templatesCommand,
};
