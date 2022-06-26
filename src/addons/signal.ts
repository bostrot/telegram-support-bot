/**
 * Telegram Ticketing System - Signal Addon
 * works with the unofficial signal cli by @AsamK
 */
import fakectx from './fakectx';
import cache from '../cache';
const {exec} = require('child_process');
const username = cache.config.signal_number;

/**
 * Send message
 * @param {String} id Chat ID
 * @param {String} msg Msg
 */
const message = (id, msg) => {
  exec(`signal-cli -u ${username} send -m 
    '${msg}' ${id}`, (error, stdout, stderr) => {
    if (error) {
      console.log(`error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.log(`stderr: ${stderr}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
  });
};

/**
 * Receive pipeline
 * @param {Function} result Result
 */
const receive = (result) => {
  exec(`signal-cli -u '${username}' receive`, (error, stdout, stderr) => {
    if (error) {
      // result(`error: ${error.message}`);
      return;
    }
    if (stderr) {
      // result(`stderr: ${stderr}`);
      return;
    }
    result(stdout);
  });
};

/**
 * String between two strings
 * @param {String} str String to search in
 * @param {String} start Start string
 * @param {String} end End string
 * @return {String} String between start and end
 */
function strBetween(str, start, end) {
  return str.split(start).pop().split(end)[0];
}

fakectx.reply = (msg, options) => {
  message(fakectx.message.chat.id, msg);
};

/**
 * Init receive pipeline
 * @param {Function} handle Function to do when receiving a message
 */
const init = (handle) => {
  // const timestamps = [];
  setInterval(() => {
    receive((res) => {
      const lines = res.split('\n');
      let msg = {
        time: null,
        sender: null,
        name: null,
        body: null,
      };
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('Sender')) {
          // Msg name and sender
          msg.name = strBetween(line, 'Sender: “', '”');
          msg.sender = strBetween(line, '” ', ' (');
        } else if (line.startsWith('Body')) {
          msg.body = line.split('Body: ')[1];
        } else if (line.startsWith('Timestamp')) {
          // Message started
          msg.time = strBetween(line, 'Timestamp: ', ' (');
        } else if (line.startsWith('Profile key update')) {
          // Message ended
          if (msg.time && msg.sender && msg.body) {
            // Message received
            fakectx.message.from.id = 'SIGNAL' + msg.sender;
            fakectx.message.chat.id = 'SIGNAL' + msg.sender;
            fakectx.message.text = msg.body;
            fakectx.message.from.first_name = msg.name;
            handle(fakectx, msg);
          }
          msg = {
            time: null,
            name: null,
            sender: null,
            body: null,
          };
        }
      }
    });
  }, 10000);
};

export {
  message,
  receive,
  init,
};
