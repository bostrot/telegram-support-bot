

[![Bot API Version](https://img.shields.io/badge/Bot%20API-v4.8-f36caf.svg?style=flat-square)](https://core.telegram.org/bots/api)
[![NPM Version](https://img.shields.io/npm/v/telegraf.svg?style=flat-square)](https://www.npmjs.com/)
[![node](https://img.shields.io/node/v/telegraf.svg?style=flat-square)](https://www.npmjs.com/package/)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](http://standardjs.com/)
[![pipeline status](https://gitlab.com/botty-group/erics-container-repo/badges/main/pipeline.svg)](https://gitlab.com/botty-group/erics-container-repo/-/pipelines)

# [Telegram Support Bot](https://github.com/bostrot/telegram-support-bot) (Ticketing system for Telegram)
is a support bot for telegram bots, using the Telegraf framework (by [@dotcypress](https://github.com/dotcypress)). It lets users create tickets which will be send to a staff group and can be answered by a reply.

Telegram ticketing implementation:

<table>
<tr>
<th><img src="https://i.imgur.com/du5KZ1C.jpg" /></th>
<th><img src="https://i.imgur.com/N2002b0.jpg" /></th>
</tr>
</table>

Web implementation:

![image](https://user-images.githubusercontent.com/7342321/132263281-3e556787-ae8b-4a62-840a-165daaec174b.png)

## Documentation

`telegram-support-bot` was built on top of [`Telegraf`](https://github.com/telegraf/telegraf) libary.

[Telegraf documentation](http://telegraf.js.org).


## Features

When a user sends a message to the support chat it will create a ticket which will be forwarded to the staff group. Any admin in the staff group may answer that ticket by just replying to it. Salutation is added automatically. Photos will be forwared too.

Currently the support chat offers these commands (staff commands):
* `/open` - lists all open tickets (messages where noone has replied yet)
* `/close` - close a ticket manually (in case someone writes 'thank you')
* `/id` - returns your telegram id and the group chat id (1234567 -1234567890)
* `/ban` - ban a person from writing to your chat

User commands:
* `/start` - tells the user how to use this bot
* `/help` - an overview over the commands or some explanation for the user
* `/faq` - shows the FAQ

Features:
* File forwarding from and to user
* Database for handling open and closed tickets
* Restrict users
* Simple anti spam system
* Send tickets to different staff groups
* Private reply to user
* Anonymize users
* Auto reply based on keywords [beta]
* Web chat  

## Installation

Install Node ( > 8 ) and npm ( > 3.38.0 ).

Run it
```bash
git clone https://github.com/bostrot/telegram-support-bot.git
cd telegram-support-bot
npm i
cp config/config-sample.ts config/config.ts     # Adjust settings in config.ts
npm run prod                                    # For debugging: npm run dev
```

## Configuration

You can get your ID with /id. The first number will be yours the second the one from the group you are in (if you are in one; including the minus).

You need to set your bot token and chat ids in `config.ts`:

```js
// bot settings
bot_token: 'YOUR_BOT_TOKEN', // support bot token
staffchat_id: 'SUPERGROUP_CHAT_ID', // telegram staff group chat id eg. -123456789
owner_id: 'YOUR_TELEGRAM_ID',
spam_time: 5 * 60 * 1000, // time (in MS) in which user may send 5 messages
allow_private: false, // Allow / disallow option for staff to chat privately
auto_close_tickets: true, // Closes messages after reply
```

If you replace `categories: false` with following snippet, you enable the subgroup system.
This will allow the user to select a subcategory (e.g. for specified staff). If a chat has the same ID
as the `staffchat_id` you can e.g. create a help chat for using the bot.

```js
// subgroups for different subcategories in JS Array -> Object format
categories:
[
  {
    name: 'Category1', subgroups: [
      {name: 'Sub1', group_id: '-12345678910'},
      {name: 'Sub2', group_id: '-12345678910'},
      {name: 'Sub3', group_id: '-12345678910'},
    ],
  },
  {
    name: 'Category2', subgroups: [
      {name: 'Sub4', group_id: '-12345678910'},
      {name: 'Sub5', group_id: '-12345678910'},
      {name: 'Sub6', group_id: '-12345678910'},
    ],
  },
  {
    name: 'Category3', group_id: '-12345678910'
  },
  {
    name: 'Admin Chat', group_id: '-12345678910' 
  },
],
```

To edit autoreply keywords adjust `config/strings.ts` according to your needs:

```js
const strings = [
    [ "how do I install this?", "You don't." ],
    [ "are you sure?", "Yes." ],
    [ "Some other Case Sensitive Text", "OK." ],
]
```

## Docker

via docker-compose:
```
docker-compose up -d
```

or build:

```
docker build -t bostrot/telegram-support-bot:latest .
docker run bostrot/telegram-support-bot -v /path/to/config_dir:/bot/config
```

## Update to v1.0.1

Backup and delete the database file (src/support.db) and move config.js to folder config. Then just start it normally.

## Telegram token

To use the [Telegram Bot API](https://core.telegram.org/bots/api), 
you first have to [get a bot account](https://core.telegram.org/bots) 
by [chatting with BotFather](https://core.telegram.org/bots#6-botfather).

BotFather will give you a *token*, something like `123456789:AbCdfGhIJKlmNoQQRsTUVwxyZ`.

## Creating a bot

[Telegraf bot framework](https://github.com/telegraf/telegraf) for building a bot


## Help

You are welcome to contribute with pull requests, bug reports, ideas and donations.

## Custom requests

Hit me up for hosting or other custom solutions [@bostrot_bot](http://t.me/bostrot_bot)
