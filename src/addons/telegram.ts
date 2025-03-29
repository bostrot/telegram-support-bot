// /**
//  * Telegram Ticketing System - Telegram Implementation with GrammY
//  */
import { Bot, Context as GrammyContext, SessionFlavor, session } from 'grammy';
import { Addon, Context, Messenger, SessionData } from '../interfaces';
import { apiThrottler } from '@grammyjs/transformer-throttler';
import * as middleware from '../middleware';
import * as commands from '../commands';
import * as permissions from '../permissions';
import * as inline from '../inline';
import * as text from '../text';
import * as files from '../files';
import * as error from '../error';
import cache from '../cache';

class TelegramAddon implements Addon {
  public bot: Bot<any>;
  public platform: string = 'telegram';
  public botInfo: any = {};

  private static instance: TelegramAddon | null = null;

  private constructor(token: string) {
    type BotContext = GrammyContext & SessionFlavor<SessionData>;
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
        throw new Error('Token must be provided when creating the TelegramAddon for the first time.');
      }
      TelegramAddon.instance = new TelegramAddon(token);
    }
    return TelegramAddon.instance;
  }  

  // --- Session initialization for Telegram ---
  initSession() {
    function initial(): SessionData {
      return {
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
      };
    }
    return session({ initial });
  }

  // --- Methods required by the Addon interface ---
  sendMessage(chatId: string | number, text: string, options?: any): void {
    options = options || {};
    options.disable_web_page_preview = true;
    if (typeof chatId !== 'string' && typeof chatId !== 'number') return;
    this.bot.api.sendMessage(chatId.toString(), text, options);
  }

  sendDocument = (
    chatId: string | number,
    document: any,
    other?: any,
    signal?: any,
  ) => {
    this.bot.api.sendDocument(chatId, document, other, signal);
  };

  sendPhoto(chatId: string | number, photo: any, options?: any): void {
    this.bot.api.sendPhoto(chatId, photo, options);
  }

  sendVideo(chatId: string | number, video: any, options?: any): void {
    this.bot.api.sendVideo(chatId, video, options);
  }

  command(command: string, callback: (ctx: any) => void): void {
    this.bot.command(command, (ctx) => callback(ctx));
  }

  on = (filter: any, ...middleware: any) => {
    this.bot.on(filter, ...middleware);
  };
  
  catch(handler: (error: any, ctx?: any) => void): void {
    this.bot.catch(handler);
  }

  // Optional: utility to register hears handlers.
  hears(trigger: string | string[] | RegExp, callback: (ctx: any) => void): void {
    this.bot.hears(trigger, (ctx) => callback(ctx));
  }

  // --- Start the Telegram bot and configure platform-specific logic ---
  start(): void {
    const self = this;
    console.log('Starting Telegram Addon...');

    // Setup session and middleware.
    this.bot.use(this.initSession());
    this.bot.use((ctx: Context, next: () => any) => {
      ctx.messenger = Messenger.TELEGRAM;
      if (cache.config.dev_mode) {
        middleware.reply(
          ctx,
          `_Dev mode is on: You might notice some delay in messages, no replies or other errors._`
        );
      }
      permissions.checkPermissions(ctx, next, cache.config);
    });

    // Initialize inline keyboard keys.
    const keys = inline.initInline(this);

    // Register commands.
    this.command('open', (ctx: Context) => commands.openCommand(ctx));
    this.command('close', (ctx: Context) => commands.closeCommand(ctx));
    this.command('ban', (ctx: Context) => commands.banCommand(ctx));
    this.command('reopen', (ctx: Context) => commands.reopenCommand(ctx));
    this.command('unban', (ctx: Context) => commands.unbanCommand(ctx));
    this.command('clear', (ctx: Context) => commands.clearCommand(ctx));
    this.command('id', (ctx: Context) => {
      middleware.reply(ctx, `User ID: ${ctx.from.id}\nGroup ID: ${ctx.chat.id}`, {
        parse_mode: cache.config.parse_mode,
      });
    });
    this.command('faq', (ctx: Context) => {
      middleware.reply(ctx, cache.config.language.faqCommandText, {
        parse_mode: cache.config.parse_mode,
      });
    });
    this.command('help', (ctx: Context) => commands.helpCommand(ctx));
    this.command('links', (ctx: Context) => {
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
                if (this.botInfo != null) {
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
      this.command('start', (ctx: Context) => {
        if (ctx.chat.type === 'private') {
          middleware.reply(ctx, cache.config.language.startCommandText);
          if (cache.config.categories && cache.config.categories.length > 0) {
            setTimeout(() => {
              middleware.reply(
                ctx,
                cache.config.language.services,
                inline.replyKeyboard(keys)
              );
            }, 500);
          }
        } else {
          middleware.reply(ctx, cache.config.language.prvChatOnly);
        }
      });
    }

    // Register event handlers.
    this.on('callback_query', (ctx: Context) => inline.callbackQuery(ctx));
    this.on([':photo'], (ctx: Context) => files.fileHandler('photo', self, ctx));
    this.on([':video'], (ctx: Context) => files.fileHandler('video', self, ctx));
    this.on([':document'], (ctx: Context) => files.fileHandler('document', self, ctx));

    // Register generic text handlers.
    this.hears(cache.config.language.back, (ctx: Context) =>
      middleware.reply(ctx, cache.config.language.services, inline.replyKeyboard(keys))
    );
    this.hears('testing', (ctx: Context) => text.handleText(self, ctx, keys));
    this.hears(/(.+)/, (ctx: Context) => text.handleText(self, ctx, keys));

    // Global error handling.
    this.catch((err: any, ctx: Context) => {
      console.log('Error: ', err);
      try {
        middleware.reply(ctx, 'Message is not sent due to an error.');
      } catch (e) {
        console.log('Could not send error msg to chat: ', e);
      }
    });

    // Start the bot.
    this.bot.start();
  }
}

export default TelegramAddon;
