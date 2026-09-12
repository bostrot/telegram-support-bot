import * as commands from './commands';
import * as middleware from './middleware';
import * as inline from './inline';
import * as files from './files';
import * as text from './text';
import cache from './cache';
import { Addon, Context } from './interfaces';
import * as analytics from './analytics';
import * as workflows from './workflows';
import * as edited from './edited';
import * as log from './logger'

/**
 * grammY sets ctx.match to a string for string triggers and to a RegExpMatchArray for
 * RegExp triggers; normalise to the first capture group (or the whole match).
 */
export function matchedCommand(match: unknown): string | null {
  if (typeof match === 'string') return match.replace(/^\//, '') || null;
  if (Array.isArray(match)) {
    const value = (match[1] ?? match[0]) as string | undefined;
    return value ? value.replace(/^\//, '') : null;
  }
  return null;
}

/**
 * Reply-keyboard markup for the /start message (start_keyboard, #142).
 */
export function startKeyboardMarkup(): Record<string, unknown> | null {
  const buttons = cache.config.start_keyboard;
  if (!Array.isArray(buttons) || buttons.length === 0) return null;
  return {
    parse_mode: cache.config.parse_mode,
    reply_markup: { keyboard: buttons.map((label) => [label]), resize_keyboard: true },
  };
}

export function registerCommonHandlers(addon: Addon, keys?: string[][]) {
  // Register commands common to both platforms.
  addon.command('open', (ctx: Context) => commands.openCommand(ctx));
  addon.command('close', (ctx: Context) => commands.closeCommand(ctx));
  addon.command('ban', (ctx: Context) => commands.banCommand(ctx));
  addon.command('reopen', (ctx: Context) => commands.reopenCommand(ctx));
  addon.command('unban', (ctx: Context) => commands.unbanCommand(ctx));
  addon.command('clear', (ctx: Context) => commands.clearCommand(ctx));

  // Team collaboration commands
  addon.command('assign', (ctx: Context) => commands.assignCommand(ctx));
  addon.command('unassign', (ctx: Context) => commands.unassignCommand(ctx));
  addon.command('tag', (ctx: Context) => commands.tagCommand(ctx));
  addon.command('untag', (ctx: Context) => commands.untagCommand(ctx));
  addon.command('priority', (ctx: Context) => commands.priorityCommand(ctx));
  addon.command('mute', (ctx: Context) => commands.muteCommand(ctx));
  addon.command('unmute', (ctx: Context) => commands.unmuteCommand(ctx));
  addon.command('note', (ctx: Context) => commands.noteCommand(ctx));
  addon.command('notes', (ctx: Context) => commands.notesCommand(ctx));
  addon.command('staff', (ctx: Context) => commands.listStaffCommand(ctx));

  // Analytics commands
  addon.command('stats', (ctx: Context) => commands.statsCommand(ctx));

  // Workflow commands
  addon.command('templates', (ctx: Context) => commands.templatesCommand(ctx));

  // Ticket details (#85) and broadcast (#159)
  addon.command('ticket', (ctx: Context) => commands.ticketCommand(ctx));
  addon.command('broadcast', (ctx: Context) => commands.broadcastCommand(ctx));

  addon.command('id', (ctx: Context) =>
    middleware.reply(ctx, `User ID: ${ctx.from.id}\nGroup ID: ${ctx.chat.id}`, {
      parse_mode: cache.config.parse_mode,
    })
  );

  addon.command('faq', (ctx: Context) =>
    middleware.reply(ctx, cache.config.language.faqCommandText, {
      parse_mode: cache.config.parse_mode,
    })
  );

  addon.command('help', (ctx: Context) => commands.helpCommand(ctx));

  // Common "links" command with platform-specific URL handling.
  addon.command('links', (ctx: Context) => {
    let links = '';
    const subcategories: string[] = [];
    for (const cat of cache.config.categories) {
      if (cat) {
        for (const subgroup of cat.subgroups) {
          if (subgroup) {
            const catName = subgroup.name;
            const id = (cat.name + subgroup.name)
              .replace(/[\[\]\:\ "]/g, '')
              .substring(0, 63);
            if (subcategories.indexOf(id) === -1) {
              subcategories.push(id);
              let url = '';
              if (addon.platform === 'telegram' && addon.botInfo) {
                  const botUsername = addon.botInfo.username as string | undefined;
                  if (botUsername) {
                    url = `https://t.me/${botUsername}?start=${id}`;
                  }
              }
              links += `${catName} - ${url}\n`;
            }
          }
        }
      }
    }
    middleware.reply(ctx, `${cache.config.language.links}:\n${links}`, {
      parse_mode: cache.config.parse_mode,
    });
  });

  if (cache.config.pass_start === false) {
    addon.command('start', (ctx: Context) => {
      if (ctx.chat.type === 'private') {
        const hasCategories = cache.config.categories && cache.config.categories.length > 0;
        const startMarkup = !hasCategories && addon.platform === 'telegram' ? startKeyboardMarkup() : null;
        if (startMarkup) {
          middleware.reply(ctx, cache.config.language.startCommandText, startMarkup);
        } else {
          middleware.reply(ctx, cache.config.language.startCommandText);
        }
        if (hasCategories) {
          // For Telegram, use inline keyboard keys if available.
          if (addon.platform === 'telegram' && keys) {
            setTimeout(() => {
              middleware.reply(ctx, cache.config.language.services, inline.replyKeyboard(keys));
            }, 500);
          } else {
            setTimeout(() => {
              middleware.reply(ctx, cache.config.language.services);
            }, 500);
          }
        }
      } else {
        middleware.reply(ctx, cache.config.language.prvChatOnly);
      }
    });
  }

  // Register event handlers for callback queries and file types.
  addon.on('callback_query', async (ctx: Context) => {
    // Handle CSAT rating callbacks
    if (ctx.callbackQuery.data && ctx.callbackQuery.data.startsWith('csat:')) {
      const parts = ctx.callbackQuery.data.split(':');
      const ticketId = parseInt(parts[1], 10);
      const rating = parseInt(parts[2], 10);
      await analytics.handleCSATCallback(ticketId, rating);
      await ctx.answerCbQuery(cache.config.language.csatThankYou || 'Thank you!');
      return;
    }
    inline.callbackQuery(ctx);
  });
  addon.on([':photo'], (ctx: Context) => files.fileHandler('photo', addon, ctx));
  addon.on([':video'], (ctx: Context) => files.fileHandler('video', addon, ctx));
  addon.on([':document'], (ctx: Context) => files.fileHandler('document', addon, ctx));
  if (cache.config.forward_stickers && addon.sendSticker) {
    addon.on([':sticker'], (ctx: Context) => files.fileHandler('sticker', addon, ctx));
  }
  if (cache.config.forward_edited_messages) {
    addon.on('edited_message', (ctx: Context) => edited.handleEditedMessage(ctx));
  }

  // Register generic text handlers.
  addon.hears(cache.config.language.back, (ctx: Context) => {
    if (addon.platform === 'telegram' && keys) {
      middleware.reply(ctx, cache.config.language.services, inline.replyKeyboard(keys));
    } else {
      middleware.reply(ctx, cache.config.language.services, []);
    }
  });

  // Handle custom user commands (#84) and canned response commands (/key pattern)
  addon.hears(/^\/(\w+)(?:@\w+)?$/, async (ctx: Context) => {
    const cmd = matchedCommand(ctx.match);
    if (!cmd) return;

    // Custom user commands answer everyone in private chats and non-staff anywhere
    if (!ctx.session.admin || ctx.chat.type === 'private') {
      const userCommand = commands.findUserCommand(cmd);
      if (userCommand) {
        middleware.reply(ctx, userCommand.text, { parse_mode: cache.config.parse_mode });
        return;
      }
    }
    if (!ctx.session.admin) return;

    // Check if this is a canned response key
    const cannedText = workflows.getCannedResponse(cmd);
    if (cannedText) {
      // If replying to a ticket, send the canned response as reply
      const replyMsg = ctx.message?.reply_to_message;
      if (replyMsg && replyMsg.text) {
        const replyText = replyMsg.text || replyMsg.caption;
        const match = replyText.match(/#T(.*)/);
        if (match) {
          // Store canned text on context for staff handler to pick up
          ctx.message.text = cannedText;
          return; // Let the regular chat handler process it
        }
      }
      middleware.reply(ctx, `Template "${cmd}":\n\n${cannedText}`, { parse_mode: cache.config.parse_mode });
    }
  });

  addon.hears('testing', (ctx: Context) => text.handleText(addon, ctx, keys || []));
  addon.hears(/(.+)/, (ctx: Context) => text.handleText(addon, ctx, keys || []));

  // Global error handling.
  addon.catch(async (err: Error, ctx?: Context): Promise<void> => {
    log.error('Error: ', err);
    if (!ctx || !ctx.message) return;
    try {
      await middleware.reply(ctx, 'Message is not sent due to an error.');
    } catch (e) {
      log.error('Could not send error msg to chat: ', e);
    }
  });
}
