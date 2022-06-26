/* eslint-disable require-jsdoc */

import assert = require('assert');

// override functions
import {bot, main, msgsToUser, msgsToStaff} from './functions';
import * as fs from 'fs';
import * as YAML from 'yaml';

const config = YAML.parse(fs.readFileSync('./config/config.yaml', 'utf8'));
const lang = config.language;

export interface User {
  text?: string;
  from?: string;
  lang?: string;
  admin?: boolean;
  group?: boolean;
  id?: number;
}

class TelegrafContext {
  ctx;

  constructor(user: User) {
    const rawdata = fs.readFileSync('./test/context.json').toString();
    const context = JSON.parse(rawdata);

    // fake ctx setup
    context.update.message.text = 'Hello, this is some test!';
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
    this.ctx.text = user.text || 'Text';
    this.ctx.from.first_name = user.from || 'Name';
    this.ctx.chat.first_name = user.from || 'Name';
    this.ctx.chat.id = user.id || 123456789;
    this.ctx.chat.type = user.group ? 'group' : 'private';
    this.ctx.language_code = user.lang || 'en';
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

  private wildcardCheck(ctx, expectedStaff, expectedUser, f) {
    f(ctx);
    const msg2 = msgsToStaff;
    const msg3 = msgsToUser;
    const msgStaff = msgsToStaff.pop();
    if (!new RegExp(expectedStaff, 'g').test(msgStaff)) {
      assert.fail(`${msgStaff} does not match ${expectedStaff}`);
    }
    const msgUser = msgsToUser.pop();
    if (!new RegExp(expectedUser, 'g').test(msgUser)) {
      assert.fail(`${msgUser} does not match ${expectedUser}`);
    }
  }

  // user sends msg helper
  userMsg(text, fromId, type = 'private') {
    const ctx = this.ctx;
    bot.hears = function(msg, f) {
      if (msg == '/(.+)/') {
        ctx.chat.type = type;
        ctx.message.chat.id = fromId;
        ctx.message.from.id = fromId;
        ctx.update.message.text = text;
        ctx.message.text = text;
        f(ctx);
      }
    };
    main(bot, false);
  }

  // command helper
  assertCommand(cmd, expected) {
    const ctx = this.ctx;
    bot.command = function(command, f) {
      if (command == cmd) {
        f(ctx);
        assert.strictEqual(msgsToUser.pop(), expected);
      }
    };
    main(bot, false);
  }

  assertCommandWildcard(cmd, expectedStaff, expectedUser) {
    const ctx = this.ctx;
    const wildcardCheck = this.wildcardCheck;
    bot.command = function(command, f) {
      if (command == cmd) {
        f(ctx);
        wildcardCheck(ctx, expectedStaff, expectedUser, f);
      }
    };
    main(bot, false);
  }

  assertCommandFail(cmd, expected) {
    const ctx = this.ctx;
    bot.command = function(command, f) {
      if (command == cmd) {
        f(ctx);
        assert.notStrictEqual(msgsToUser.pop(), expected);
      }
    };
    main(bot, false);
  }

  assertCommandAlike(cmd, expected) {
    const ctx = this.ctx;
    bot.command = function(command, f) {
      if (command == cmd) {
        f(ctx);
        const msg = msgsToUser.pop() || '';
        if (msg.indexOf(expected) == -1) {
          assert.fail(`"${msg}" does not contain "${expected}"`);
        }
      }
    };
    main(bot, false);
  }

  assertCommandAlikeFail(cmd, expected) {
    const ctx = this.ctx;
    bot.command = function(command, f) {
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

  assertMsgWildcard(msg, expectedStaff, expectedUser) {
    this.ctx.message.text = msg;
    this.ctx.update.message.text = msg;
    this.userMsg(msg, this.ctx.from.id);
    this.wildcardCheck(this.ctx, expectedStaff, expectedUser, (t) => {});
  }
}

export {BotAssert, config, lang};
