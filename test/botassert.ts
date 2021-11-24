import assert = require('assert');

// override functions
import { bot, main, msgsToUser} from './functions';
import * as fs from 'fs';
import * as YAML from 'yaml';

const config = YAML.parse(fs.readFileSync('./config/config.yaml', 'utf8'))
    .language;

export interface User {
    text?: string,
    from?: string,
    lang?: string,
    admin?: boolean,
    group?: boolean,
}

class TelegrafContext {
    ctx;

    constructor(user: User) {
        const rawdata = fs.readFileSync('./test/context.json').toString();
        const context = JSON.parse(rawdata);
        
         // fake ctx setup
        context.update.message.text = 'Hey, I need help.';
        context.message = context.update.message;
        context.from = context.update.message.from;
        context.chat = context.update.message.chat;
        context.session = {};
        context.session.admin = false;
        this.ctx = context;
        this.set(user);
    }

    set(user: User) {
        if (user == undefined) {
            user = {};
        }
        this.ctx.text = user.text || '';
        this.ctx.from.first_name = user.from || '';
        this.ctx.chat.first_name = user.from || '';
        this.ctx.type = user.group ? 'group' : 'private';
        this.ctx.language_code = user.lang || '';
        this.ctx.session.admin = user.admin || false;
    }

    get() {
        return this.ctx;
    }
}

class BotAssert extends TelegrafContext {
    constructor(user?: User) {
        super(user);
    }

    getCtx() {
        return this.ctx;
    }

    // user sends msg helper
    userMsg(text, fromId, type = 'private') {
        const ctx = this.ctx;
        bot.hears = function (msg, f) {
            if (msg == "/(.+)/") {
                ctx.chat.type = type;
                ctx.message.chat.id = fromId;
                ctx.message.from.id = fromId;
                ctx.message.text = text;
                f(ctx);
            }
        }
        main(bot, false);
    }

    // command helper
    assertCommand(cmd, expected) {
        const ctx = this.ctx;
        bot.command = function (command, f) {
            if (command == cmd) {
                f(ctx);
                assert.strictEqual(msgsToUser.pop(), expected);
            }
        };
        main(bot, false);
    }

    assertCommandFail(cmd, expected) {
        const ctx = this.ctx;
        bot.command = function (command, f) {
            if (command == cmd) {
                f(ctx);
                assert.notEqual(msgsToUser.pop(), expected);
            }
        };
        main(bot, false);
    }

    assertCommandAlike(cmd, expected) {
        const ctx = this.ctx;
        console.log(ctx);
        bot.command = function (command, f) {
            if (command == cmd) {
                f(ctx);
                const msg = msgsToUser.pop() || '';
                console.log(msgsToUser)
                if (msg.indexOf(expected) == -1) {
                    assert.fail(`"${msg}" does not contain "${expected}"`);
                }
            }
        };
        main(bot, false);
    }

    assertCommandAlikeFail(cmd, expected) {
        const ctx = this.ctx;
        bot.command = function (command, f) {
            if (command == cmd) {
                f(ctx);
                const msg = msgsToUser.pop() || '';
                if (msg.indexOf(expected) > -1) {
                    assert.fail(`"${msg}" contains "${expected}"`);
                }
            }
        };
        main(bot, false);
    }
}

export {
    BotAssert,
    config
};