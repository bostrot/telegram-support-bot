

[![Bot API Version](https://img.shields.io/badge/Bot%20API-v4.8-f36caf.svg?style=flat-square)](https://core.telegram.org/bots/api)
[![NPM Version](https://img.shields.io/npm/v/telegraf.svg?style=flat-square)](https://www.npmjs.com/)
[![node](https://img.shields.io/node/v/telegraf.svg?style=flat-square)](https://www.npmjs.com/package/)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](http://standardjs.com/)
[![pipeline status](https://gitlab.com/botty-group/erics-container-repo/badges/main/pipeline.svg)](https://gitlab.com/botty-group/erics-container-repo/-/pipelines)

# [Telegram Support Bot](https://github.com/bostrot/telegram-support-bot) (Ticketing system for Telegram)
is a support bot for telegram bots, using the ~Telegraf framework (by [@dotcypress](https://github.com/dotcypress))~ [grammY Framework](https://grammy.dev/). It lets users create tickets which will be send to a staff group and can be answered by a reply.

Telegram ticketing implementation:

<table>
<tr>
<th><img src="https://i.imgur.com/du5KZ1C.jpg" /></th>
<th><img src="https://i.imgur.com/N2002b0.jpg" /></th>
</tr>
</table>

If you need help or need a hosted solution of this check out <a href="https://botspace.bostrot.com">Botspace</a> for a one-click setup.

## Documentation

See the [WIKI](https://github.com/bostrot/telegram-support-bot/wiki) for more detailed information.

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

See the [WIKI](https://github.com/bostrot/telegram-support-bot/wiki) for more detailed information.

```bash
mv config/config-sample.yaml config.yaml
```

**Docker** container:

Either with docker-compose:

```
docker-compose up -d
```

## Notes about v4.0.0

Since version v4 this bot uses the grammY Telegram Bot Framework instead of the telegraf framework for various reasons.

## Upgrading to v4.0.0 or to master

Make sure you add the new settings strings to your config.yaml file. Check the config-sample.yaml for all configs.
Here are some of the new settings that you should add when migrating:

    parse_mode: 'MarkdownV2' # DO NOT CHANGE!
    autoreply: (see config-sample.yaml for an example)
    
The config-sample.yaml settings now all use markdown instead of HTML so you have to adjust that. e.g. instead of <br/> line break use \n instead. For a full list check the telegram bot API docs.

Upgrade to the new version. e.g. by pulling the main branch from GitHub or using the docker image bostrot/telegram-support-bot:4.0.0.

Start it.

The old database should work with the new version without changing anything.


## Upgrading to v3.0.0

The latest version uses a new config file in YAML format which would break old versions.

In order to make old versions work with the master you would need to use the new config.yaml file instead of the config.ts file from before. The easiest would be if you copy the config-sample.yaml to config.yaml (both in the config folder) and edit the settings similar to your old config.ts file. There is no need to delete the database file so old tickets can be kept open.

## Telegram token

To use the [Telegram Bot API](https://core.telegram.org/bots/api), 
you first have to [get a bot account](https://core.telegram.org/bots) 
by [chatting with BotFather](https://core.telegram.org/bots#6-botfather).

BotFather will give you a *token*, something like `123456789:AbCdfGhIJKlmNoQQRsTUVwxyZ`.

## Help

You are welcome to contribute with pull requests, bug reports, ideas and donations.

If you need help or need a hosted solution of this check out <a href="https://botspace.bostrot.com">Botspace</a> for a one-click setup.

## Custom requests

Hit me up for hosting or other custom solutions [@bostrot_bot](http://t.me/bostrot_bot)
