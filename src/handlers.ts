import * as commands from './commands';
import * as middleware from './middleware';
import * as inline from './inline';
import * as files from './files';
import * as text from './text';
import cache from './cache';
import * as log from 'fancy-log'

export function registerCommonHandlers(addon: any, keys?: any) {
  // Register commands common to both platforms.
  addon.command('open', (ctx: any) => commands.openCommand(ctx));
  addon.command('close', (ctx: any) => commands.closeCommand(ctx));
  addon.command('ban', (ctx: any) => commands.banCommand(ctx));
  addon.command('reopen', (ctx: any) => commands.reopenCommand(ctx));
  addon.command('unban', (ctx: any) => commands.unbanCommand(ctx));
  addon.command('clear', (ctx: any) => commands.clearCommand(ctx));

  addon.command('id', (ctx: any) =>
    middleware.reply(ctx, `User ID: ${ctx.from.id}\nGroup ID: ${ctx.chat.id}`, {
      parse_mode: cache.config.parse_mode,
    })
  );

  addon.command('faq', (ctx: any) =>
    middleware.reply(ctx, cache.config.language.faqCommandText, {
      parse_mode: cache.config.parse_mode,
    })
  );

  addon.command('help', (ctx: any) => commands.helpCommand(ctx));

  // Common "links" command with platform-specific URL handling.
  addon.command('links', (ctx: any) => {
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
                  url = `https://t.me/${addon.botInfo.username}?start=${id}`;
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
    addon.command('start', (ctx: any) => {
      if (ctx.chat.type === 'private') {
        middleware.reply(ctx, cache.config.language.startCommandText);
        if (cache.config.categories && cache.config.categories.length > 0) {
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
  addon.on('callback_query', (ctx: any) => inline.callbackQuery(ctx));
  addon.on([':photo'], (ctx: any) => files.fileHandler('photo', addon, ctx));
  addon.on([':video'], (ctx: any) => files.fileHandler('video', addon, ctx));
  addon.on([':document'], (ctx: any) => files.fileHandler('document', addon, ctx));

  // Register generic text handlers.
  addon.hears(cache.config.language.back, (ctx: any) => {
    if (addon.platform === 'telegram' && keys) {
      middleware.reply(ctx, cache.config.language.services, inline.replyKeyboard(keys));
    } else {
      middleware.reply(ctx, cache.config.language.services, []);
    }
  });
  addon.hears('testing', (ctx: any) => text.handleText(addon, ctx, keys || []));
  addon.hears(/(.+)/, (ctx: any) => text.handleText(addon, ctx, keys || []));

  // Global error handling.
  addon.catch((err: any, ctx: any) => {
    log.error('Error: ', err);
    try {
      middleware.reply(ctx, 'Message is not sent due to an error.');
    } catch (e) {
      log.error('Could not send error msg to chat: ', e);
    }
  });
}
