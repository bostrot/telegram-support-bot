const assert = require('assert');
const config = require('../config/config.js');
const fs = require('fs');
const chalk = require('chalk');

const rawdata = fs.readFileSync('./test/context.json');
const context = JSON.parse(rawdata);

/* eslint-disable */
function clone(a) {
  return JSON.parse(JSON.stringify(a));
}

const tests = function (bot) {
  context.update.message.text = "Hey, I need help.";
  context.message = context.update.message;
  context.from = context.update.message.from;
  context.chat = context.update.message.chat;
  context.session = { 'admin': false };

  let receivedMsgs = [];

  bot.telegram.sendMessage = function (id, text, options) {
    // console.log(chalk.green('=== SENT MESSAGE ==='));
    receivedMsgs.push(text);
    //console.log(`${text}`);
  };

  // check text function
  checkText = function (expected, f) {
    let ctx = clone(context);
    ctx.reply = function (text, options) {
      assert.strictEqual(text, expected)
    }
    f(ctx);
  }
  // Trigger all commands
  bot.command = function (command, f) {
    // console.log(chalk.green('=== DIRECT COMMAND ==='));
    if (command == 'start') checkText('Services', f);
    // if (command == 'start') checkText(config.startCommandText, f);
    switch (command) {
      case 'open':
        let ctx = clone(context);
        ctx.session.admin = true;
        ctx.reply = function (text, options) {
          assert.ok(text.indexOf('Open Tickets') > -1);
        }
        f(ctx);
        break;
      case 'close':
        break;
      case 'id':
        checkText(context.from.id + ' ' + context.chat.id, f);
        break;
      case 'ban':
        break;
      case 'start':
        // checkText(config.startCommandText, f);
        checkText('Services', f);
        break;
      case 'help':
        checkText(config.helpCommandText, f);
        break;
      case 'faq':
        checkText(config.faqCommandText, f);
        break;
      case 'test':
        break;
      default:
        console.log(`${command} unknown option`);
        break;
    }

  };

  bot.hears = function (listenText, funct) {
    // console.log(chalk.green('=== LISTENING ==='));
    if (listenText == 'testing') {
      let ctx = clone(context);
      ctx.chat.type = 'group';
      ctx.session.admin = true;
      ctx.message.reply_to_message = {
        text:
          `Ticket #T000008 from Eric Language: en\n\n${context.update.message.text}`
      };
      funct(ctx);
    } else {
      let ctx = clone(context);
      ctx.reply = function (text, options) {
        if (config.categories.toString().indexOf(listenText) > -1)
          assert(text == listenText);
      }
      funct(ctx);
    }
  }

  setTimeout(function () {
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

}

module.exports = {
  tests,
};

