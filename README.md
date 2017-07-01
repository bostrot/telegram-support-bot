# Telegram Support Bot
is a support bot for telegram bots, using the Telegraf framework (by [@dotcypress](https://github.com/dotcypress)). It let users create tickets which will be send to a staff group and can be answered by a reply.

[![Bot API Version](https://img.shields.io/badge/Bot%20API-v3.1-f36caf.svg?style=flat-square)](https://core.telegram.org/bots/api)
[![NPM Version](https://img.shields.io/npm/v/telegraf.svg?style=flat-square)](https://www.npmjs.com/)
[![node](https://img.shields.io/node/v/telegraf.svg?style=flat-square)](https://www.npmjs.com/package/)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](http://standardjs.com/)

<table>
<tr>
<th><img src="https://puu.sh/wyvPd/8dde465527.jpg" /></th>
<th><img src="https://puu.sh/wyvxD/35a3b70290.jpg" /></th>
</tr>
</table>

## Documentation

`telegram-support-bot` was built on top of [`Telegraf`](https://github.com/telegraf/telegraf) libary.

[Telegraf documentation](http://telegraf.js.org).

## Installation

```js
$ npm install telegraf --save
$ git clone https://github.com/bostrot/telegram-support-bot.git
$ cd telegram-support-bot
$ sudo bash setup 
```
Enter the bot location (ex. /home/bots/mybot.js) when asked and then your bot name (ex. mybot)
`setup` will create two systemctl links in order that your bot will be automatically restarted when it crashes and runs in the background.

## Configuration

You need to set your bot token and chat ids in `bin/support.js`:

```js
/* edit below */
const bot = new Telegraf('BOT_TOKEN_SUPPORT_BOT') // support bot token
var staff_chat = 'SUPPORT_STAFF_GROUP_ID' // telegram staff group chat id
var owner_id = 'OWNER_ID' // telgram owner id
var supported_bot = 'service_name' // service name of the supported bot
var startCommandText = 'Welcome in our support chat! Ask your question here.'
var faqCommandText = 'Check out our FAQ here: https://bitgram.pro/index.php/bitgram-faq'
var con = mysql.createConnection({ // only needed if you want to get user info from a mysql database with /id command
  host: 'HOST',
  user: 'USR',
  password: 'PWD',
  database: 'DB'
})
/* edit end */
```

## Features

When a user sends a message to the support chat it will create a ticket which will be forwarded to the staff group. Any admin in the staff group may answer that ticket by just replying to it. Salutation is added automatically. Photos will be forwared too.

Currently the support chat offers these commands (staff commands):
* `/open` - lists all open tickets (messages where noone has replied yet)
* `/close` - close a ticket manually (in case someone writes 'thank you')
* `/id (userid)` - lists some stuff from the database about the user

User commands:
* `/start` - tells the user how to use this bot
* `/faq` - shows the FAQ

Admin/Owner commands:
* `/root` - Starts the listener and prevents the bot from crashing (restarts it and sends the log into the staff chat); Also this will open up a dashboard where the admin/owner can control the bot with following `Update`, `Restart`, `Log`, `Stop`.

<img src="https://puu.sh/wywe5/a4c3cee0b7.png" width="400" height="400" />

## Telegram token

To use the [Telegram Bot API](https://core.telegram.org/bots/api), 
you first have to [get a bot account](https://core.telegram.org/bots) 
by [chatting with BotFather](https://core.telegram.org/bots#6-botfather).

BotFather will give you a *token*, something like `123456789:AbCdfGhIJKlmNoQQRsTUVwxyZ`.

## Creating a bot

[Telegraf bot framework](https://github.com/telegraf/telegraf) for building a bot
