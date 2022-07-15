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
const message = (id: string, msg: string) => {
  exec(
      `signal-cli -u ${username} send -m 
    '${msg}' ${id}`,
      (error: { message: any }, stdout: any, stderr: any) => {
        if (error) {
          console.log(`error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.log(`stderr: ${stderr}`);
          return;
        }
        console.log(`stdout: ${stdout}`);
      },
  );
};

/**
 * Receive pipeline
 * @param {Function} result Result
 */
const receive = (result: Function) => {
  exec(
      `signal-cli -u '${username}' receive`,
      (error: any, stdout: any, stderr: any) => {
        if (error) {
        // result(`error: ${error.message}`);
          return;
        }
        if (stderr) {
        // result(`stderr: ${stderr}`);
          return;
        }
        result(stdout);
      },
  );
};

/**
 * String between two strings
 * @param {String} str String to search in
 * @param {String} start Start string
 * @param {String} end End string
 * @return {String} String between start and end
 */
function strBetween(str: string, start: string, end: string): string {
  try {
    return str.split(start)[1].split(end)[0];
  } catch (e) {
    return '';
  }
}

fakectx.reply = (msg: string, options: any) => {
  message(fakectx.message.chat.id, msg);
};

interface Msg {
  time: string;
  sender: string;
  name: string;
  body: string;
}
/**
 * Init receive pipeline
 * @param {Function} handle Function to do when receiving a message
 */
const init = (handle: Function) => {
  // const timestamps = [];
  setInterval(() => {
    receive((res: string) => {
      const lines = res.split('\n');
      let msg = {} as Msg;
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
          msg = {} as Msg;
        }
      }
    });
  }, 10000);
};

export {message, receive, init};
