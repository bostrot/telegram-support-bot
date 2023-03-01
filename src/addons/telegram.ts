// /**
//  * Telegram Ticketing System - Telegram Implementation with GrammY
//  */

import {Bot, Context as GrammyContext, SessionFlavor, session} from 'grammy';
import {Context, SessionData} from '../interfaces';
import { apiThrottler } from "@grammyjs/transformer-throttler";

/**
 * Telegram Ticketing System - Telegram Implementation with GrammY
 */
class TelegramAddon {
  bot: Bot<any>;

  /**
   * Constructor
   * @param {String} token Telegram Bot Token
   */
  constructor(token: string) {
    type BotContext = GrammyContext & SessionFlavor<SessionData>;
    this.bot = new Bot<BotContext>(token);
    const throttler = apiThrottler();
    this.bot.api.config.use(throttler);
    this.bot.init().then(() => {
      this.botInfo = this.bot.botInfo;
    });
  }
  /**
   * Session middleware provides a persistent data storage for your bot. You can
   * use it to let your bot remember any data you want, for example the messages
   * it sent or received in the past. This is done by attaching _session data_
   * to
   * every chat. The stored data is then provided on the context object under
   * `ctx.session`.
   *
   * > **What is a session?** Simply put, the session of a chat is a little
   * > persistent storage that is attached to it. As an example, your bot can
   * send
   * > a message to a chat and store the ID of that message in the corresponding
   * > session. The next time your bot receives an update from that chat, the
   * > session will still contain that ID.
   * >
   * > Session data can be stored in a database, in a file, or simply in memory.
   * > grammY only supports memory sessions out of the box, but you can use
   * > third-party session middleware to connect to other storage solutions.
   * Note
   * > that memory sessions will be lost when you stop your bot and the process
   * > exits, so they are usually not useful in production.
   *
   * Whenever your bot receives an update, the first thing the session
   * middleware
   * will do is to load the correct session from your storage solution. This
   * object is then provided on `ctx.session` while your other middleware is
   * running. As soon as your bot is done handling the update, the middleware
   * takes over again and writes back the session object to your storage. This
   * allows you to modify the session object arbitrarily in your middleware, and
   * to stop worrying about the database.
   *
   * ```ts
   * bot.use(session())
   *
   * bot.on('message', ctx => {
   *   // The session object is persisted across updates!
   *   const session = ctx.session
   * })
   * ```
   *
   * It is recommended to make use of the `inital` option in the configuration
   * object, which correctly initializes session objects for new chats.
   *
   * You can delete the session data by setting `ctx.session` to `null` or
   * `undefined`.
   *
   * Check out the [documentation](https://grammy.dev/plugins/session.html) on the
   * website to know more about how sessions work in grammY.
   *
   * @param {any} options Optional configuration to pass to the session
   * middleware
   * @return {session} SessionData
   */
  initSession() {
    /**
     * Init session middleware
     * @return {session} SessionData
     */
    function initial(): SessionData {
      return {
        admin: null,
        modeData: {} as any,
        mode: null,
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
    return session({initial});
  }
  /**
   * Use this method to send text messages. On success, the sent Message
   * is returned.
   *
   * @param {any} chatId Unique identifier for the target chat or username
   * of the target channel (in the format @channelusername)
   * @param {any} text Text of the message to be sent, 1-4096 characters
   * after entities parsing
   * @param {any} other Optional remaining parameters, confer the official
   * reference below
   * @param {any} signal Optional `AbortSignal` to cancel the request
   *
   * **Official reference:** https://core.telegram.org/bots/api#sendmessage
   */
  sendMessage = (
      chatId: string | number,
      text: string,
      other?: any,
      signal?: any,
  ) => {
    other = other || {};
    other.disable_web_page_preview = true;
    // TODO: check where sendMessage is called without id
    if (typeof chatId !== 'string' && typeof chatId !== 'number') {
      return;
    }
    this.bot.api.sendMessage(chatId, text, other, signal);
  };
  /**
   * Registers some middleware that will only be executed when a certain
   * command is found.
   * ```ts
   * // Reacts to /start commands
   * bot.command('start', ctx => { ... })
   * // Reacts to /help commands
   * bot.command('help', ctx => { ... })
   * ```
   *
   * The rest of the message (excluding the command, and trimmed) is provided
   * via `ctx.match`.
   *
   * > **Did you know?** You can use deep linking
   * > (https://core.telegram.org/bots#deep-linking) to let users start your
   * > bot with a custom payload. As an example, send someone the link
   * > https://t.me/name-of-your-bot?start=custom-payload and register a start
   * > command handler on your bot with grammY. As soon as the user starts
   * > your bot, you will receive `custom-payload` in the `ctx.match`
   * > property!
   * > ```ts
   * > bot.command('start', ctx => {
   * >   const payload = ctx.match // will be 'custom-payload'
   * > })
   * > ```
   *
   * Note that commands are not matched in captions or in the middle of the
   * text.
   * ```ts
   * bot.command('start', ctx => { ... })
   * // ... does not match:
   * // A message saying: “some text /start some more text”
   * // A photo message with the caption “/start”
   * ```
   *
   * By default, commands are detected in channel posts, too. This means that
   * `ctx.message` is potentially `undefined`, so you should use `ctx.msg`
   * instead to grab both messages and channel posts. Alternatively, if you
   * want to limit your bot to finding commands only in private and group
   * chats, you can use `bot.on('message').command('start', ctx => { ... })`,
   * or even store a message-only version of your bot in a variable like so:
   * ```ts
   * const m = bot.on('message')
   *
   * m.command('start', ctx => { ... })
   * m.command('help', ctx => { ... })
   * // etc
   * ```
   *
   * If you need more freedom matching your commands, check out the
   * `command-filter` plugin.
   *
   * @param {any} command The command to look for
   * @param {any} callback The middleware to register
   */
  command = (command: any, callback: any) => {
    this.bot.command(command, (ctx) => {
      callback(ctx);
    });
  };
  /**
   * Registers some middleware that will only be executed for some specific
   * updates, namely those matching the provided filter query. Filter queries
   * are a concise way to specify which updates you are interested in.
   *
   * Here are some examples of valid filter queries:
   * ```ts
   * // All kinds of message updates
   * bot.on('message', ctx => { ... })
   *
   * // Only text messages
   * bot.on('message:text', ctx => { ... })
   *
   * // Only text messages with URL
   * bot.on('message:entities:url', ctx => { ... })
   *
   * // Text messages and text channel posts
   * bot.on(':text', ctx => { ... })
   *
   * // Messages with URL in text or caption (i.e. entities or caption entities)
   * bot.on('message::url', ctx => { ... })
   *
   * // Messages or channel posts with URL in text or caption
   * bot.on('::url', ctx => { ... })
   * ```
   *
   * You can use autocomplete in VSCode to see all available filter queries.
   * Check out the
   * [documentation](https://grammy.dev/guide/filter-queries.html) on the
   * website to learn more about filter queries in grammY.
   *
   * It is possible to pass multiple filter queries in an array, i.e.
   * ```ts
   * // Matches all text messages and edited text messages that contain a URL
   * bot.on(['message:entities:url', 'edited_message:entities:url'],
   * ctx => { ... })
   * ```
   *
   * Your middleware will be executed if _any of the provided filter queries_
   * matches (logical OR).
   *
   * If you instead want to match _all of the provided filter queries_
   * (logical AND), you can chain the `.on` calls:
   * ```ts
   * // Matches all messages and channel posts that both a) contain a URL and b)
   * are forwards
   * bot.on('::url').on(':forward_date', ctx => { ... })
   * ```
   *
   * @param {any} filter The filter query to use, may also be an array of
   * queries
   * @param {any} middleware The middleware to register behind the given filter
   */
  on = (filter: any, ...middleware: any) => {
    this.bot.on(filter, ...middleware);
  };
  /**
   * Starts your bot using long polling.
   *
   * > This method returns a `Promise` that will never resolve except if your
   * > bot is stopped. **You don't need to `await` the call to `bot.start`**,
   * > but remember to catch potential errors by calling `bot.catch`.
   * > Otherwise your bot will crash (and stop) if something goes wrong in
   * > your code.
   *
   * This method effectively enters a loop that will repeatedly call
   * `getUpdates` and run your middleware for every received update, allowing
   * your bot to respond to messages.
   *
   * If your bot is already running, this method does nothing.
   *
   * **Note that this starts your bot using a very simple long polling
   * implementation.** `bot.start` should only be used for small bots. While
   * the rest of grammY was built to perform well even under extreme loads,
   * simple long polling is not capable of scaling up in a similar fashion.
   * You should switch over to using `@grammyjs/runner` if you are running a
   * bot with high load.
   *
   * What exactly _high load_ means differs from bot to bot, but as a rule of
   * thumb, simple long polling should not be processing more than ~5K
   * messages every hour. Also, if your bot has long-running operations such
   * as large file transfers that block the middleware from completing, this
   * will impact the responsiveness negatively, so it makes sense to use the
   * `@grammyjs/runner` package even if you receive much fewer messages. If
   * you worry about how much load your bot can handle, check out the grammY
   * [documentation](https://grammy.dev/advanced/scaling.html) about scaling
   * up.
   *
   * @param {any} options Options to use for simple long polling
   */
  start = () => {
    this.bot.start();
  };
  /**
   * Sets the bots error handler that is used during long polling.
   *
   * You should call this method to set an error handler if you are using long
   * polling, no matter whether you use `bot.start` or the `@grammyjs/runner`
   * package to run your bot.
   *
   * Calling `bot.catch` when using other means of running your bot (or
   * webhooks) has no effect.
   *
   * @param {any} errorHandler A function that handles potential middleware
   * errors
   */
  catch = (errorHandler: any) => {
    this.bot.catch(errorHandler);
  };
  /**
   * Registers some middleware that will only be executed when the message
   * contains some text. Is it possible to pass a regular expression to match:
   * ```ts
   * // Match some text (exact match)
   * bot.hears('I love grammY', ctx => ctx.reply('And grammY loves you! <3'))
   * // Match a regular expression
   * bot.hears(/\/echo (.+)/, ctx => ctx.reply(ctx.match[1]))
   * ```
   * Note how `ctx.match` will contain the result of the regular expression.
   * Here it is a `RegExpMatchArray` object, so `ctx.match[1]` refers to the
   * part of the regex that was matched by `(.+)`, i.e. the text that comes
   * after “/echo”.
   *
   * You can pass an array of triggers. Your middleware will be executed if at
   * least one of them matches.
   *
   * Both text and captions of the received messages will be scanned. For
   * example, when a photo is sent to the chat and its caption matches the
   * trigger, your middleware will be executed.
   *
   * If you only want to match text messages and not captions, you can do
   * this:
   * ```ts
   * // Only matches text messages (and channel posts) for the regex
   * bot.on(':text').hears(/\/echo (.+)/, ctx => { ... })
   * ```
   *
   * @param {any} trigger The text to look for
   * @param {any} callback The middleware to register
   */
  hears = (trigger: any, callback: any) => {
    this.bot.hears(trigger, (ctx) => {
      callback(ctx);
    });
  };
  use = (...middleware: any) => {
    this.bot.use(...middleware);
  };
  /**
   * Use this method to send general files. On success, the sent Message
   * is returned. Bots can currently send files of any type of up to 50
   * MB in size, this limit may be changed in the future.
   *
   * @param {any} chatId Unique identifier for the target chat or usernam
   *  of the target channel (in the format @channelusername)
   * @param {any} document File to send. Pass a file_id as String to sen
   *  a file that exists on the Telegram servers (recommended), pass a
   *  HTTP URL as a String for Telegram to get a file from the Internet
   *  or upload a new one using multipart/form-data.
   * @param {any} other Optional remaining parameters, confer the officia
   *  reference below
   * @param {any} signal Optional `AbortSignal` to cancel the request
   *
   * **Official reference:** https://core.telegram.org/bots/api#senddocument
   */
  sendDocument = (
      chatId: string | number,
      document: any,
      other?: any,
      signal?: any,
  ) => {
    this.bot.api.sendDocument(chatId, document, other, signal);
  };
  /**
   * Use this method to send photos. On success, the sent Message is returned.
   *
   * @param {any} chatId Unique identifier for the target chat or usernam
   *  of the target channel (in the format @channelusername)
   * @param {any} photo Photo to send. Pass a file_id as String to send
   *  photo that
   * exists on the Telegram servers (recommended), pass an HTTP URL as a String
   * for Telegram to get a photo from the Internet, or upload a new photo using
   * multipart/form-data. The photo must be at most 10 MB in size. The photo's
   * width and height must not exceed 10000 in total. Width and height ratio
   * must be at most 20.
   * @param {any} other Optional remaining parameters, confer the official
   * reference below
   * @param {any} signal Optional `AbortSignal` to cancel the request
   *
   * **Official reference:** https://core.telegram.org/bots/api#sendphoto
   */
  sendPhoto = (
      chatId: string | number,
      photo: any,
      other?: any,
      signal?: any,
  ) => {
    this.bot.api.sendPhoto(chatId, photo, other, signal);
  };
  /**
   * Use this method to send video files, Telegram clients support mp4 videos
   * (other formats may be sent as Document). On success, the sent Message is
   * returned. Bots can currently send video files of up to 50 MB in size,
   * this limit may be changed in the future.
   *
   * @param {any} chatId Unique identifier for the target chat or username
   * of the target channel (in the format @channelusername)
   * @param {any} video Video to send. Pass a file_id as String to send a
   * video that exists on the Telegram servers (recommended), pass an HTTP
   * URL as a String for Telegram to get a video from the Internet, or upload
   * a new video using multipart/form-data.
   * @param {any} other Optional remaining parameters, confer the official
   * reference below
   * @param {any} signal Optional `AbortSignal` to cancel the request
   *
   * **Official reference:** https://core.telegram.org/bots/api#sendvideo
   */
  sendVideo = (
      chatId: string | number,
      video: any,
      other?: any,
      signal?: any,
  ) => {
    this.bot.api.sendVideo(chatId, video, other, signal);
  };
  drop = () => {
    /* this.bot.drop(); */
  };
  /**
   * Initializes the bot, i.e. fetches information about the bot itself. This
   * method is called automatically, you usually don't have to call it
   * manually.
   */
  init = () => {
    this.bot.init();
  };
  botInfo: any = {};

  // fakectx.reply = (msg, options) => {
  //     message(fakectx.message.chat.id, msg);
  // }
}

export default TelegramAddon;
