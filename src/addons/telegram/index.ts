import { Bot, Context as GrammyContext, SessionFlavor, session } from 'grammy';
import { Addon, Context, Messenger, SessionData } from '../../interfaces';
import { apiThrottler } from '@grammyjs/transformer-throttler';
import * as middleware from '../../middleware';
import * as permissions from '../../permissions';
import * as inline from '../../inline';
import cache from '../../cache';
import { registerCommonHandlers } from '../../handlers';
import * as log from 'fancy-log'

type BotContext = GrammyContext & SessionFlavor<SessionData>;

class TelegramAddon implements Addon {
  public bot: Bot<BotContext>;
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
  async sendMessage(chatId: string | number, text: string, options: any = {}): Promise<string | null> {
    options.disable_web_page_preview = true;
    if (typeof chatId !== 'string' && typeof chatId !== 'number') return;
    const response = await this.bot.api.sendMessage(chatId.toString(), text, options);
    return response.message_id.toString();
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
    log.info('Starting Telegram Addon...');

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
    registerCommonHandlers(this, keys);

    // Start the Bot.
    this.bot.start();
  }
}

export default TelegramAddon;
