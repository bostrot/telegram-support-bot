import fake_ctx from './fake_ctx';
import { ticketHandler } from '../text';
import cache from '../cache';

/* include script
<script id="chatScript" src="localhost:8080/chat.js"></script>
*/
let init = function(bot) {
    // Enable web server with socketio
if (cache.config.web_server) {
    const express = require('express');
    const http = require('http');
    const app = express();
    const port = cache.config.web_server_port;
    const server = http.createServer(app);
  
    const { Server } = require('socket.io');
    const io = new Server(server);
    cache.io = io;
  
    app.get('/', (req, res) => {
      res.sendFile(__dirname + '/web/index.html');
    });
    
    app.get('/chat.js', (req, res) => {
      res.sendFile(__dirname + '/web/chat.js');
    });
    
    io.on('connection', (socket) => {
      socket.on('chat', (msg) => {
        socket.emit('chat_user', msg);
        fake_ctx.message.from.id = 'WEB' + socket.id;
        fake_ctx.message.chat.id = 'WEB' + socket.id;
        fake_ctx.message.text = msg;
        ticketHandler(bot, fake_ctx);
      });
      socket.on('disconnect', () => console.log('Disconnected'));
    });
  
    server.listen(port, () => console.log(`Server started on port ${port}`));
  }
  
}

export { init };