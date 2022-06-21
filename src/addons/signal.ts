/**
 * Telegram Ticketing System - Signal Addon
 * works with the unofficial signal cli by @AsamK
 */
import fake_ctx from './fake_ctx';
import cache from '../cache';
const { exec } = require("child_process");
const username = cache.config.signal_number;

/**
 * Send message
 */
const message = (id, msg) => {
    exec(`signal-cli -u ${username} send -m '${msg}' ${id}`, (error, stdout, stderr) => {
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
}

/**
 * Receive pipeline
 */
const receive = (result) => {
    exec(`signal-cli -u '${username}' receive`, (error, stdout, stderr) => {
        if (error) {
            //result(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            //result(`stderr: ${stderr}`);
            return;
        }
        result(stdout);
    });
}

function strBetween(str, start, end) {
    return str.split(start).pop().split(end)[0];
}

fake_ctx.reply = (msg, options) => {
    message(fake_ctx.message.chat.id, msg);
}

/**
 * Init receive pipeline
 * @param {Function} handle Function to do when receiving a message
 */
const init = (handle) => {
    let timestamps = [];
    setInterval(() => {
        receive((res) => {
            let lines = res.split('\n');
            let msg = {
                time: null,
                sender: null,
                name: null,
                body: null,
            };
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
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
                        fake_ctx.message.from.id = 'SIGNAL' + msg.sender;
                        fake_ctx.message.chat.id = 'SIGNAL' + msg.sender;
                        fake_ctx.message.text = msg.body;
                        fake_ctx.message.from.first_name = msg.name;
                        handle(fake_ctx, msg);
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
}

export {
    message,
    receive,
    init,
}