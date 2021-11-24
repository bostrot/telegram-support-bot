import * as assert from 'assert';
import {User, BotAssert, config} from './botassert';

// override functions
import { msgsToUser, msgsToStaff } from './functions';
const exp = require('constants');

// override framework functions for commands
describe('Commands', function () {
  describe('User sends /open command', function () {
    it('should return a message with open ticket ids', function () {
      let botAssert = new BotAssert({admin: true, group: true});
      botAssert.assertCommandAlike("open", "Open Tickets");
      // TODO: open
    });
  });
  describe('User sends /close command', function () {
    it('should send a message to the staff chat', function () {
      // TODO: close
    });
  });
  describe('User sends /id command', function () {
    it('should send a message to the staff chat', function () {
      let botAssert = new BotAssert();
      const ctx = botAssert.getCtx();
      botAssert.assertCommand("id", ctx.from.id + ' ' + ctx.chat.id);
    });
  });
  describe('User sends /ban command', function () {
    it('should send a message to the staff chat', function () {
      // TODO: ban
    });
  });

  describe('User sends /start command', function () {
    it('should send a message to the staff chat', function () {
      let botAssert = new BotAssert();
      botAssert.assertCommand("start", config.startCommandText);
    });
  });

  describe('User sends /help command', function () {
    it('should send a message to the staff chat', function () {
      let botAssert = new BotAssert();
      botAssert.assertCommand("help", config.helpCommandText);
    });

    it('should not be the same as this text', function () {
      let botAssert = new BotAssert();
      botAssert.assertCommandFail("help", "some wrong text");
    });
  });

  describe('User sends /faq command', function () {
    it('should show the specified FAQ', function () {
      let botAssert = new BotAssert();
      botAssert.assertCommand("help", config.helpCommandText);
    });
  });
});

describe('Messages', function () {
  describe('User sends message', function () {
    it('should reply with received message', function () {
      const text = 'Hello, this is a test';
      let botAssert = new BotAssert({text: text});
      botAssert.userMsg(text, 123456789);

      const ctx = botAssert.getCtx();
      const expectedStart = `${config.ticket} #T`;
      const expectedEnd = ` ${config.from} ` +
        `<a href="">` +
        `${ctx.message.from.first_name}</a> ${config.language}: ` +
        `${ctx.message.from.language_code}\n\n` +
        `${ctx.message.text}\n\n` + 
        `<i></i>`;
      const msg = msgsToStaff.pop();
      assert.strictEqual(msg.substr(0, expectedStart.length), expectedStart);
      assert.strictEqual(msg.substr(msg.length - expectedEnd.length,
        msg.length), expectedEnd);
      assert.strictEqual(msgsToUser.pop(), config.contactMessage);
    });
  });
});