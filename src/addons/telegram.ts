// /**
//  * Telegram Ticketing System - Telegram Implementation with GrammY
//  */

import { Bot, Context, SessionFlavor, session } from "grammy";

interface SessionData {
    admin: boolean,
    modeData: any,
    groupCategory: any, // string
    group: any,
    groupAdmin: any,
    getSessionKey: any,
}

class TelegramAddon {
    bot: Bot = null;

    /**
     * Constructor
     * @param token Telegram Bot Token
     */
    constructor(token: string) {

        type BotContext = Context & SessionFlavor<SessionData>;
        this.bot = new Bot<BotContext>(token);
        this.bot.init().then(() => {
            this.botInfo = this.bot.botInfo;
        });
    }

    initSession() {
        function initial(): SessionData {
            return {
                admin: undefined,
                modeData: undefined,
                groupCategory: undefined,
                group: undefined,
                groupAdmin: undefined,
                getSessionKey: (ctx) => {
                    if (ctx.callbackQuery && ctx.callbackQuery.id) {
                        return `${ctx.from.id}:${ctx.from.id}`;
                    } else if (ctx.from && ctx.inlineQuery) {
                        return `${ctx.from.id}:${ctx.from.id}`;
                    } else if (ctx.from && ctx.chat) {
                        return `${ctx.from.id}:${ctx.chat.id}`;
                    };
                    return null;
                },
            };
        }
        return session({ initial });
    };

    sendMessage = (chat_id: string | number, text: string, other?: any, signal?: any) => {
        this.bot.api.sendMessage(chat_id, text, other, signal);
    };
    command = (command: any, callback: any) => {
        this.bot.command(command, (ctx) => {
            callback(ctx);
        });
    };
    on = (filter: any, ...middleware: any) => {
        this.bot.on(filter, ...middleware);
    };
    start = () => {
        this.bot.start();
    };
    catch = (errorHandler: any) => { this.bot.catch(errorHandler); };
    hears = (trigger: any, callback) => {
        this.bot.hears(trigger, (ctx) => {
            callback(ctx);
        })
    };
    use = (...middleware: any) => { this.bot.use(...middleware) };
    sendDocument = (chat_id: string | number, document: any, other?: any, signal?: AbortSignal) => this.bot.api.sendDocument;
    sendPhoto = (chat_id: string | number, photo: any, other?: any, signal?: any) => this.bot.api.sendPhoto;
    sendVideo = (chat_id: string | number, video: any, other?: any, signal?: AbortSignal) => this.bot.api.sendVideo;
    drop = () => { /* this.bot.drop(); */ };
    init = () => { this.bot.init(); };
    botInfo = null;

    // fake_ctx.reply = (msg, options) => {
    //     message(fake_ctx.message.chat.id, msg);
    // }
}



export default TelegramAddon;