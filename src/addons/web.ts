import fakectx from './fakectx';
import {ticketHandler} from '../text';
import cache from '../cache';
import TelegramAddon from './telegram';

/* include script
<script id="chatScript" src="localhost:8080/chat.js"></script>
*/
const init = function(bot: TelegramAddon) {
  // Enable web server with socketio
  if (cache.config.web_server) {
    const express = require('express');
    const http = require('http');
    const app = express();
    const port = cache.config.web_server_port;
    const server = http.createServer(app);

    const {Server} = require('socket.io');
    const io = new Server(server);
    cache.io = io;

    app.get('/', (_req: any, res: { sendFile: (arg0: string) => void }) => {
      res.sendFile(__dirname + '/web/index.html');
    });

    app.get(
        '/chat.js',
        (_req: any, res: { sendFile: (arg0: string) => void }) => {
          res.sendFile(__dirname + '/web/chat.js');
        },
    );

    io.on(
        'connection',
        (socket: {
        on: (arg0: string, arg1: any) => void;
        emit: (arg0: string, arg1: any) => void;
        id: string;
      }) => {
          socket.on('chat', (msg: string) => {
            socket.emit('chat_user', msg);
            fakectx.message.from.id = 'WEB' + socket.id;
            fakectx.message.chat.id = 'WEB' + socket.id;
            fakectx.message.text = msg;
            ticketHandler(bot, fakectx);
          });
          socket.on('disconnect', () => console.log('Disconnected'));
        },
    );

    server.listen(port, () => console.log(`Server started on port ${port}`));
  }
};

export {init};
