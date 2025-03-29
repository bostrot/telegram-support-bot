import { Bot, Context as GrammyContext, SessionFlavor, session } from 'grammy';
import { Addon, Context, Messenger, SessionData } from '../../interfaces';
import { apiThrottler } from '@grammyjs/transformer-throttler';
import * as middleware from '../../middleware';
import * as commands from '../../commands';
import * as permissions from '../../permissions';
import * as inline from '../../inline';
import * as text from '../../text';
import * as files from '../../files';
import * as error from '../../error';
import cache from '../../cache';

type BotContext = GrammyContext & SessionFlavor<SessionData>;

class TelegramAddon implements Addon {
  public bot: Bot<BotContext>;
  public platform = 'telegram';
  public botInfo: any = {};

  private static instance: TelegramAddon | null = null;

  private constructor(token: string) {
    this.bot = new Bot<BotContext>(token);
    const throttler = apiThrottler();
    this.bot.api.config.use(throttler);
    this.bot.init().then(() => {
      this.botInfo = this.bot.botInfo;
    });
  }

  public static getInstance(token?: string): TelegramAddon {
    if (!TelegramAddon.instance) {
      if (!token) {
        throw new Error(
          'Token must be provided when creating the TelegramAddon for the first time.'
        );
      }
      TelegramAddon.instance = new TelegramAddon(token);
    }
    return TelegramAddon.instance;
  }

  // --- Session Initialization ---
  initSession() {
    const initial = (): SessionData => ({
      admin: null,
      modeData: {} as any,
      mode: null,
      lastContactDate: null,
      groupCategory: null,
      groupTag: '',
      group: '',
      groupAdmin: {} as any,
      getSessionKey: (ctx: Context) => {
        if (ctx.callbackQuery && ctx.callbackQuery.id) {
          return `${ctx.from.id}:${ctx.from.id}`;
        } else if (ctx.from && ctx.inlineQuery) {
          return `${ctx.from.id}:${ctx.from.id}`;
        } else if (ctx.from && ctx.chat) {
          return `${ctx.from.id}:${ctx.chat.id}`;
        }
        return null;
      },
    });
    return session({ initial });
  }

  // --- Methods required by the Addon interface ---
  sendMessage(chatId: string | number, text: string, options: any = {}) {
    options.disable_web_page_preview = true;
    if (typeof chatId !== 'string' && typeof chatId !== 'number') return;
    this.bot.api.sendMessage(chatId.toString(), text, options);
  }

  sendDocument = (
    chatId: string | number,
    document: any,
    other?: any,
    signal?: any
  ) => {
    this.bot.api.sendDocument(chatId, document, other, signal);
  };

  sendPhoto(chatId: string | number, photo: any, options?: any) {
    this.bot.api.sendPhoto(chatId, photo, options);
  }

  sendVideo(chatId: string | number, video: any, options?: any) {
    this.bot.api.sendVideo(chatId, video, options);
  }

  command(command: string, callback: (ctx: any) => void): void {
    this.bot.command(command, ctx => callback(ctx));
  }

  on = (filter: any, ...middleware: any) => {
    this.bot.on(filter, ...middleware);
  };

  catch(handler: (error: any, ctx?: Context) => void): void {
    this.bot.catch(handler);
  }

  hears(trigger: string | string[] | RegExp, callback: (ctx: any) => void): void {
    this.bot.hears(trigger, ctx => callback(ctx));
  }

  // --- Start and Configure the Bot ---
  start(): void {
    console.log('Starting Telegram Addon...');

    // Setup session and middleware.
    this.bot.use(this.initSession());
    this.bot.use((ctx: any, next: () => any) => {
      ctx.messenger = Messenger.TELEGRAM;
      if (cache.config.dev_mode) {
        middleware.reply(
          ctx,
          `_Dev mode is on: You might notice some delay in messages, no replies or other errors._`
        );
      }
      permissions.checkPermissions(ctx, next, cache.config);
    });

    const keys = inline.initInline(this);

    // Register Commands.
    this.command('open', ctx => commands.openCommand(ctx));
    this.command('close', ctx => commands.closeCommand(ctx));
    this.command('ban', ctx => commands.banCommand(ctx));
    this.command('reopen', ctx => commands.reopenCommand(ctx));
    this.command('unban', ctx => commands.unbanCommand(ctx));
    this.command('clear', ctx => commands.clearCommand(ctx));
    this.command('id', ctx =>
      middleware.reply(
        ctx,
        `User ID: ${ctx.from.id}\nGroup ID: ${ctx.chat.id}`,
        { parse_mode: cache.config.parse_mode }
      )
    );
    this.command('faq', ctx =>
      middleware.reply(ctx, cache.config.language.faqCommandText, {
        parse_mode: cache.config.parse_mode,
      })
    );
    this.command('help', ctx => commands.helpCommand(ctx));
    this.command('links', ctx => {
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
              if (!subcategories.includes(id)) {
                subcategories.push(id);
                if (this.botInfo) {
                  links += `${catName} - https://t.me/${this.botInfo.username}?start=${id}\n`;
                }
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
      this.command('start', ctx => {
        if (ctx.chat.type === 'private') {
          middleware.reply(ctx, cache.config.language.startCommandText);
          if (cache.config.categories && cache.config.categories.length > 0) {
            setTimeout(
              () =>
                middleware.reply(ctx, cache.config.language.services, inline.replyKeyboard(keys)),
              500
            );
          }
        } else {
          middleware.reply(ctx, cache.config.language.prvChatOnly);
        }
      });
    }

    // Register Event Handlers.
    this.on('callback_query', ctx => inline.callbackQuery(ctx));
    this.on([':photo'], ctx => files.fileHandler('photo', this, ctx));
    this.on([':video'], ctx => files.fileHandler('video', this, ctx));
    this.on([':document'], ctx => files.fileHandler('document', this, ctx));

    // Generic text handlers.
    this.hears(cache.config.language.back, ctx =>
      middleware.reply(ctx, cache.config.language.services, inline.replyKeyboard(keys))
    );
    this.hears('testing', ctx => text.handleText(this, ctx, keys));
    this.hears(/(.+)/, ctx => text.handleText(this, ctx, keys));

    // Global Error Handling.
    this.catch((err: any, ctx: Context) => {
      console.log('Error: ', err);
      try {
        middleware.reply(ctx, 'Message is not sent due to an error.');
      } catch (e) {
        console.log('Could not send error msg to chat: ', e);
      }
    });

    // Start the Bot.
    this.bot.start();
  }
}

export default TelegramAddon;
