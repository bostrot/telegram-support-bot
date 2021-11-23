const fs = require('fs');
const assert = require('assert');

const YAML = require('yaml');
const config = YAML.parse(fs.readFileSync('./config/config.yaml', 'utf8'))
    .language;
const rawdata = fs.readFileSync('./test/context.json');
const context = JSON.parse(rawdata);

/* eslint-disable */
function clone(a) {
  return JSON.parse(JSON.stringify(a));
}

// override functions
let { bot, main, msgsToUser, msgsToStaff, waiting } = require('./functions.js');

// fake ctx setup
context.update.message.text = "Hey, I need help.";
context.message = context.update.message;
context.from = context.update.message.from;
context.chat = context.update.message.chat;
context.session = {
  'admin': false
};

// check text helper
checkText = function (expected, f, not = false) {
  let ctx = clone(context);
  f(ctx);
  if (not) {
    assert.notEqual(msgsToUser.pop(), expected);
  } else {
    assert.strictEqual(msgsToUser.pop(), expected);
  }
}

// user sends msg helper
userMsg = function (text, fromId, type = 'private') {
  bot.hears = function (msg, f) {
    if (msg == "/(.+)/") {
      let ctx = clone(context);
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
let timeout = true;
assertCommand = function (cmd, expected, not = false) {
  bot.command = function (command, f) {
    timeout = false;
    if (command == cmd)
      checkText(expected, f, not);
  };
  main(bot, false);
}

// override framework functions for commands
describe('Commands', function () {
  describe('User sends /open command', function () {
    it('should return a message with open ticket ids', function () {
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
      assertCommand("id", context.from.id + ' ' + context.chat.id);
    });
  });
  describe('User sends /ban command', function () {
    it('should send a message to the staff chat', function () {
      // TODO: ban
    });
  });

  describe('User sends /start command', function () {
    it('should send a message to the staff chat', function () {
      assertCommand("start", config.startCommandText);
    });
  });

  describe('User sends /help command', function () {
    it('should send a message to the staff chat', function () {
      assertCommand("help", config.helpCommandText);
    });
  });

  describe('User sends /faq command', function () {
    it('should show the specified FAQ', function () {
      assertCommand("help", config.helpCommandText);
    });
    
    it('should not be the same as this text', function () {
      assertCommand("help", "some wrong text", true);
    });
  });
});

describe('Messages', function () {
  describe('User sends message', function () {
    it('should reply with received message', function () {
      userMsg('Hello, this is a test', 123456789);
      //assert.strictEqual(msgsToStaff.pop(), config.contactMessage);
      assert.strictEqual(msgsToUser.pop(), config.contactMessage);
    });
  });
});


/* setTimeout(function () {
    //assert.ok(receivedMsgs.toString().indexOf(context.update.message.text) > -1);

    assert.strictEqual(receivedMsgs[0], 'Dear<b> Eric</b>,\n\nHey, I need help.\n\nBest regards,\nEric');
    console.log(chalk.green('Ticket retour passed'));
    // Automated response sent
    assert.strictEqual(receivedMsgs[1], 'Message sent to user Eric');
    console.log(chalk.green('Ticket acknowledge passed'));
    assert.strictEqual(receivedMsgs[2], config.language.contactMessage);
    console.log(chalk.green('Ticket sent passed'));
    // Ticket sent to group
    assert.ok(receivedMsgs[3].toString().indexOf(context.update.message.text) > -1 &&
      receivedMsgs[3].toString().indexOf(config.language.ticket) > -1);
    console.log(chalk.green('Ticket sent to staff passed'));
    process.exit(0);
  }, 3000)
 */