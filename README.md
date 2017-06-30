# Telegram Support Bot
is a support bot for telegram bots, using the Telegraf framework (by @dotcypress). It let users create tickets which will be send to a staff group and can be answered by a reply.

[![Bot API Version](https://img.shields.io/badge/Bot%20API-v3.1-f36caf.svg?style=flat-square)](https://core.telegram.org/bots/api)
[![NPM Version](https://img.shields.io/npm/v/telegraf.svg?style=flat-square)](https://www.npmjs.com/)
[![node](https://img.shields.io/node/v/telegraf.svg?style=flat-square)](https://www.npmjs.com/package/)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](http://standardjs.com/)

## Documentation

`telegram-support-bot` was built on top of [`Telegraf`](https://github.com/telegraf/telegraf) libary.

[Telegraf documentation](http://telegraf.js.org).

## Installation

```js
$ npm install telegraf --save
$ git clone https://github.com/bostrot/telegram-support-bot.git
$ sudo setup_systemctl
```

## Configuration

You need to set your bot tokens and chat id:

const bot = new Telegraf('BOT_TOKEN_SUPPORT_BOT') // support bot
const bitgram = new Telegraf("BOT_TOKEN_OTHER_BOT")

```js
const bot = new Telegraf('BOT_TOKEN_SUPPORT_BOT') // this is your support bot
const bitgram = new Telegraf("BOT_TOKEN_OTHER_BOT") // this is your normal bot
```
