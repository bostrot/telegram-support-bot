/**
 * This contains all overriden framework functions so
 * the app logic itself can be tested
 */
const fs = require('fs');
const YAML = require('yaml');
const config = YAML.parse(fs.readFileSync('./config/config.yaml', 'utf8'));

const msgsToUser = [];
const msgsToStaff = [];
let waiting = true;

const {createBot, main} = require('../build/src/index.js');
const bot = createBot();

bot.telegram.sendMessage = function(id, text, options) {
  if (id == config.staffchat_id) {
    // msg to staff
    msgsToStaff.push(text);
  } else {
    // msg to user
    msgsToUser.push(text);
  }

  waiting = false;
};

bot.launch = function() {
  // Do nothing
  console.log('not launching');
};

export {
  bot,
  main,
  waiting,
  msgsToUser,
  msgsToStaff
}