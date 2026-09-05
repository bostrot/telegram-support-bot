import cache from './cache';
import * as middleware from './middleware';
import * as db from './db';
import { Context } from './interfaces';
import { ISupportee } from './db';
import * as log from './logger'
import * as webhooks from './webhooks';
import * as analytics from './analytics';
import * as team from './team';

const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Generates a ticket message.
 *
 * @param name - The name to include in the message.
 * @param message - The message object.
 * @returns The formatted ticket message.
 */
function ticketMsg(
  name: string,
  message: { text: any; from: { first_name: any } },
): string {
  const esc = middleware.strictEscape;
  const { config } = cache;
  if (config.clean_replies) {
    return esc(message.text);
  }
  if (config.anonymous_replies) {
    return `${config.language.dear} ${esc(name)},\n\n${esc(message.text)}\n\n${config.language.regards}\n${config.language.regardsGroup}`;
  }
  return `${config.language.dear} ${esc(name)},\n\n${esc(message.text)}\n\n${config.language.regards}\n${esc(message.from.first_name)}`;
}

/**
 * Sends a private reply to a user.
 *
 * @param ctx - The bot context.
 * @param msg - The message object (defaults to ctx.message if empty).
 */
function privateReply(ctx: Context, msg: any = {}) {
  if (Object.keys(msg).length === 0) {
    msg = ctx.message;
  }

  const { session, messenger, from, message, chat } = ctx;
  const { modeData } = session;
  middleware.sendMessage(
    modeData.userid,
    messenger,
    ticketMsg(`${modeData.name}`, msg),
    {
      parse_mode: cache.config.parse_mode,
      reply_markup: cache.config.direct_reply
        ? {
          html: '',
          inline_keyboard: [
            [{ text: cache.config.language.replyPrivate, url: `https://t.me/${from.username}` }],
          ],
        }
        : middleware.buildInlineKeyboard(from.id, message.from.first_name, modeData.category, modeData.ticketid),
    },
  ).catch(log.error);
  // Send confirmation message
  middleware.sendMessage(chat.id, messenger, cache.config.language.msg_sent, {}).catch(log.error);
}

/**
 * Extracts the ticket ID from the reply text.
 *
 * @param replyText - The text from which to extract the ticket ID.
 * @returns The extracted ticket ID or null if not found.
 */
function extractTicketId(replyText: string): string | null {
  const { language } = cache.config;
  let match = replyText.match(new RegExp(`#T(.*) ${escapeRegex(language.from)}`));
  if (!match) {
    match = replyText.match(new RegExp(`#T(.*)\\n${escapeRegex(language.from)}`));
  }
  return match ? match[1].trim() : null;
}

/**
 * Extracts the supportee's Telegram user ID from a forwarded ticket message.
 * Handles both MarkdownV2/HTML link formats and plain text fallback.
 *
 * @param replyText - The original forwarded ticket message text.
 * @returns The extracted user ID or null if not found.
 */
function extractSupporteeId(replyText: string): string | null {
  // Try to extract from tg://user?id=<id> link (MarkdownV2 / HTML format)
  const linkMatch = replyText.match(/tg:\/\/user\?id=(\d+)/);
  if (linkMatch) return linkMatch[1];

  // Fallback: try [name](tg://user?id=<id>) Markdown pattern
  const mdMatch = replyText.match(/\[.*?\]\(tg:\/\/user\?id=(\d+)\)/);
  if (mdMatch) return mdMatch[1];

  return null;
}

/**
 * Extracts the name from the reply text.
 *
 * @param replyText - The text from which to extract the name.
 * @returns The extracted name or null if not found.
 */
function extractName(replyText: string): string | null {
  const { language } = cache.config;
  const match = replyText.match(new RegExp(`${escapeRegex(language.from)} (.*) ${escapeRegex(language.language)}`));
  return match ? match[1].trim() : null;
}

/**
 * Finds the parent category of the (sub)category a ticket was routed to (#79).
 * Matches by the ticket's category name or by the group the reply was written in.
 */
function findParentCategory(ticketCategory: string | null, chatId: string | number) {
  const { categories } = cache.config;
  if (!Array.isArray(categories)) return null;
  for (const category of categories) {
    if (!Array.isArray(category.subgroups) || category.subgroups.length === 0) continue;
    const matches = category.subgroups.some(
      (sub) => sub.name === ticketCategory || String(sub.group_id) === String(chatId),
    );
    if (matches && category.group_id && String(category.group_id) !== String(chatId)) {
      return category;
    }
  }
  return null;
}

/**
 * Mirrors a staff reply into the parent category group so supervisors can follow
 * subcategory traffic (forward_replies_to_parent, #79).
 */
async function forwardReplyToParent(ctx: Context, ticket: ISupportee, staffMessage: string): Promise<void> {
  if (!cache.config.forward_replies_to_parent) return;
  const parent = findParentCategory(ticket.category, ctx.chat.id);
  if (!parent) return;
  const esc = middleware.strictEscape;
  const { language, staffchat_type } = cache.config;
  const text = `${language.ticket} #T${ticket.ticketId.toString().padStart(6, '0')} ${language.acceptedBy} ${esc(ctx.message.from.first_name)}:\n\n${esc(staffMessage)}`;
  await middleware.sendMessage(parent.group_id, staffchat_type, text).catch(log.error);
}

/**
 * Handles staff chat replies to tickets.
 *
 * @param ctx - The bot context.
 */
async function chat(ctx: Context) {
  if (!ctx.session.admin) {
    return;
  }

  const replyMsg = ctx.message?.reply_to_message;
  if (!replyMsg) return;

  const replyText = replyMsg.text || replyMsg.caption;
  const replyMessageId = ctx.message.external_reply?.message_id;
  if (!replyText && !replyMessageId) return;

  let ticket: ISupportee | null = null;
  let ticketId: number = 0;
  if (replyMessageId) {
    ticket = await db.getTicketByInternalId(replyMessageId);
    if (ticket) {
      ticketId = ticket.ticketId;
    }
  }

  // If internal ID lookup failed, try regex extraction from text
  if (!ticket && replyText) {
    const extractedId = extractTicketId(replyText);
    if (extractedId) {
      ticketId = parseInt(extractedId, 10);
      if (ticketId) {
        ticket = await db.getTicketById(ticketId, ctx.session.groupCategory);
      }
    }
  }

  // If regex also failed, try to find the supportee by extracting their Telegram ID from the forwarded message
  if (!ticket && replyText) {
    const supporteeId = extractSupporteeId(replyText);
    if (supporteeId) {
      ticket = await db.getTicketByUserId(supporteeId, ctx.session.groupCategory);
      if (ticket) {
        ticketId = ticket.ticketId;
      }
    }
  }

  if (!ticket || !ticketId) {
    middleware.reply(ctx, cache.config.language.ticketClosedError);
    return;
  }
  let name: string | null;
  if (ticket.name) {
    name = ticket.name;
  } else {
    name = extractName(replyText);
  }
  if (!name) return;

  // Check for internal note prefix (!note or !internal)
  const staffMessage = ctx.message.text || '';
  if (staffMessage.startsWith('!note ') || staffMessage.startsWith('!internal ')) {
    const noteText = staffMessage.replace(/^!(?:note|internal)\s+/i, '');
    await team.addInternalNoteCommand(ctx, ticketId, noteText);
    return;
  }

  // Mark ticket as no longer active
  cache.ticketStatus[ticketId] = false;

  // Set first response time if not already set
  if (!ticket.first_response_at) {
    await db.setFirstResponseAt(ticketId);
  }

  // Log conversation memory
  const senderId = ctx.from.id.toString();
  await db.addTicketMessage(ticketId, 'staff', senderId, staffMessage);

  // Reply to web users differently
  if (ticket.userid.includes('WEB')) {
    try {
      const socketId = ticket.userid.split('WEB')[1];
      cache.io.to(socketId).emit('chat_staff', ticketMsg(name, ctx.message));
    } catch (e) {
      middleware.sendMessage(
        ctx.chat.id,
        ticket.messenger,
        `Web chat already closed.`,
      ).catch(log.error);
      log.error(e);
    }
  } else {
    // Apply translation if enabled
    let replyContent = ticketMsg(name, ctx.message);
    if (cache.config.translate_enabled) {
      const translated = await import('./addons/llm.js').then(m => m.translateText(staffMessage));
      if (translated) {
        replyContent = ticketMsg(name, { text: translated, from: ctx.message.from });
      }
    }
    middleware.sendMessage(ticket.userid, ticket.messenger, replyContent).catch(log.error);
  }

  const esc = middleware.strictEscape;
  middleware.sendMessage(
    ctx.chat.id,
    cache.config.staffchat_type,
    `${cache.config.language.msg_sent} ${esc(name)}`,
  ).catch(log.error);
  log.info(`Answer by @${ctx.from.username ?? '-'} (${ctx.from.id}) to ${ticket.userid} (${name}) on #T${ticketId}: ${staffMessage}`);
  delete cache.ticketSent[ticketId];

  // Mirror the reply to the parent category group if configured
  await forwardReplyToParent(ctx, ticket, staffMessage);

  // Record analytics event for staff reply
  await db.recordAnalyticsEvent('staff_reply', ticketId, senderId);

  // Fire webhook for ticket reply
  await webhooks.webhooks.ticketReplied(ticketId, senderId, staffMessage.substring(0, 200));

  // Auto-close the ticket if enabled
  if (cache.config.auto_close_tickets) {
    await db.add(String(ticketId), 'closed', '', ticket.messenger);
    await db.setClosedAt(ticketId);
    await db.recordAnalyticsEvent('ticket_closed', ticketId, senderId);
    await webhooks.webhooks.ticketClosed(ticketId, senderId.toString());

    // Send CSAT survey on close
    await analytics.sendCSATSurvey(ticket.userid, ticket.messenger, ticketId);
  }
}

export { privateReply, chat, ticketMsg, extractSupporteeId, findParentCategory, forwardReplyToParent };
